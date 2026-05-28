/**
 * DXF parser + SceneModel emitter — v1.0.
 *
 * Owns the entire DXF → SceneModel pipeline for v1.0:
 *
 *  1. Tokenises the DXF source into `(group-code, value)` pairs.
 *  2. Walks the SECTION/ENDSEC structure (BLOCKS, ENTITIES) and
 *     dispatches each entity record into a typed map onto the
 *     shared {@link DWGDocument} shape (renames a few fields,
 *     normalises points from `{x, y, z}` to `[x, y, z]`, converts
 *     ARC / ELLIPSE / INSERT angles from degrees to radians).
 *  3. Hands the document to {@link dwg!emit} for the shared
 *     SceneModel emission (per-layer SceneObjects, per (colour,
 *     line-width) stroke bucketing, INSERT recursion, text
 *     rasterisation).
 *
 * DXF is open ASCII and the format is simple enough to parse
 * in-tree without bundling a third-party library — this module
 * is the entire parser. For files that use SPLINE, full POLYLINE
 * variants with VERTEX sub-entities, complex MTEXT formatting
 * codes, or other edge-case features, swap in `dxf-parser` /
 * `dxf` from npm and call {@link dwg!emit} directly with the
 * parsed `DWGDocument`.
 *
 * Format coverage (matches what {@link DWGLoader} renders):
 *  - **LINE** — single segment.
 *  - **LWPOLYLINE** — `vertices` flat array `[x0, y0, x1, y1, ...]`,
 *    `flag` bit 0 = closed, `elevation` (group 38) honoured.
 *  - **POLYLINE** — header-only stub; the VERTEX sub-entities that
 *    follow as separate `0` records are not gathered. Pre-process
 *    via `dxf-parser` for proper POLYLINE handling.
 *  - **CIRCLE** — center + radius.
 *  - **ARC** — center + radius + start/end angle (degrees in
 *    source, radians on output).
 *  - **3DFACE** — 4 corners via group codes 10–13 / 20–23 / 30–33.
 *  - **INSERT** — `name`, `position`, `scale` (group 41/42/43),
 *    `rotation` (degrees → radians).
 *  - **TEXT / MTEXT** — `text` (group 1), `position`, `height`
 *    (group 40), `rotation`.
 *  - **BLOCKS** section — each `BLOCK` ... `ENDBLK` becomes one
 *    `DWGBlock`; INSERTs in the ENTITIES section expand recursively
 *    by name.
 *
 * Skipped: HEADER variables, TABLES (layer-colour lookup — the
 * loader's ACI palette handles per-entity colour directly),
 * OBJECTS section, complex MTEXT control codes, SPLINE, HATCH,
 * DIMENSION, ATTRIB/ATTDEF.
 */

import type {SDKResult} from "../../../../base/core";
import {SDKErrorType} from "../../../../base/core";
import type {SceneModel} from "../../../../model/scene";

import type {DWGBlock} from "../../../dwg/lib/DWGBlock";
import type {DWGDocument} from "../../../dwg/lib/DWGDocument";
import type {DWGEntity} from "../../../dwg/lib/DWGEntity";
import type {DWGLoadOptions} from "../../../dwg/lib/DWGLoadOptions";
import type {DWGLoadResult} from "../../../dwg/lib/DWGLoadResult";
import {emit as emit_v1_0} from "../../../dwg/versions/v1_0/parse";


/** Inputs to {@link parse}. */
export interface DXFParseInput {
  /** DXF source as a UTF-8 string. */
  fileData:   string;
  /** Target SceneModel — must be unfinalised. */
  sceneModel: SceneModel;
}


/**
 * Full pipeline: DXF text → SceneModel.
 *
 * Validates input, parses the DXF source into a `DWGDocument`,
 * then delegates to the shared DWG emit step. Returns an
 * `SDKResult<DWGLoadResult>` directly so the wrapping
 * {@link DXFLoader} can pass it through unchanged.
 */
export async function parse(input: DXFParseInput, options: DWGLoadOptions = {}): Promise<SDKResult<DWGLoadResult>> {

  if (!input || !input.sceneModel) {
    return err(SDKErrorType.InvalidInput, "[dxf.parse] sceneModel is required");
  }
  if (input.sceneModel.destroyed) {
    return err(SDKErrorType.InvalidOperation, "[dxf.parse] SceneModel already destroyed");
  }
  if (typeof input.fileData !== "string" || input.fileData.length === 0) {
    return err(SDKErrorType.InvalidInput, "[dxf.parse] fileData must be a non-empty DXF string");
  }

  let document: DWGDocument;
  try {
    document = parseDXFText(input.fileData);
  } catch (e: any) {
    return err(SDKErrorType.InvalidInput, `[dxf.parse] DXF parse failed: ${e?.message ?? e}`);
  }

  return emit_v1_0({document, sceneModel: input.sceneModel}, options);
}


// ─── DXF text → DWGDocument ───────────────────────────────────────

/**
 * Parse a DXF text stream into a {@link DWGDocument}. Exported
 * (with the same lifting as {@link parse} but no SceneModel
 * emission) so callers that want to inspect the parsed document
 * without touching a SceneModel — or feed it into a different
 * emitter — can do so directly.
 */
export function parseDXFText(text: string): DWGDocument {
  const pairs = tokenisePairs(text);
  const blocks: DWGBlock[] = [];
  const entities: DWGEntity[] = [];

  let i = 0;
  while (i < pairs.length) {
    const [code, value] = pairs[i];
    if (code === 0 && value === "SECTION") {
      // Next pair should be (2, sectionName).
      i++;
      const sectionName = pairs[i] && pairs[i][0] === 2 ? pairs[i][1] : "";
      i++;
      if (sectionName === "BLOCKS") {
        const end = findEndSec(pairs, i);
        parseBlocks(pairs, i, end, blocks);
        i = end + 1;
      } else if (sectionName === "ENTITIES") {
        const end = findEndSec(pairs, i);
        parseEntities(pairs, i, end, entities);
        i = end + 1;
      } else {
        // HEADER, TABLES, OBJECTS — skip to ENDSEC.
        i = findEndSec(pairs, i) + 1;
      }
    } else if (code === 0 && value === "EOF") {
      break;
    } else {
      i++;
    }
  }
  return {entities, blocks};
}


// ─── DXF tokeniser ────────────────────────────────────────────────

type Pair = [number, string];

/**
 * Pair the raw lines into `[code, value]` tuples. DXF allows
 * trailing whitespace and CRLF line endings; both get trimmed.
 * Stops at the `EOF` sentinel even when the file has trailing
 * garbage.
 */
function tokenisePairs(text: string): Pair[] {
  const lines = text.split(/\r?\n/);
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const codeStr = lines[i].trim();
    const valStr  = lines[i + 1].trim();
    if (codeStr.length === 0) continue;
    const code = parseInt(codeStr, 10);
    if (!Number.isFinite(code)) continue;
    pairs.push([code, valStr]);
    if (code === 0 && valStr === "EOF") break;
  }
  return pairs;
}

function findEndSec(pairs: Pair[], start: number): number {
  for (let i = start; i < pairs.length; i++) {
    if (pairs[i][0] === 0 && pairs[i][1] === "ENDSEC") return i;
  }
  return pairs.length;
}


// ─── BLOCKS section ───────────────────────────────────────────────

function parseBlocks(pairs: Pair[], start: number, end: number, blocks: DWGBlock[]): void {
  let i = start;
  while (i < end) {
    if (pairs[i][0] === 0 && pairs[i][1] === "BLOCK") {
      const block: DWGBlock = {name: "", basePoint: [0, 0, 0], entities: []};
      i++;
      // Read BLOCK header pairs until we hit the first contained
      // entity (next `0 <TYPE>` that isn't `ENDBLK`).
      while (i < end) {
        const [c, v] = pairs[i];
        if (c === 0) {
          if (v === "ENDBLK") { i++; break; }
          // Header done — fall through to entity parsing.
          break;
        }
        if (c === 2)      block.name           = v;
        else if (c === 10) block.basePoint![0] = parseFloat(v);
        else if (c === 20) block.basePoint![1] = parseFloat(v);
        else if (c === 30) block.basePoint![2] = parseFloat(v);
        i++;
      }
      // Entities inside the block — read until ENDBLK.
      const blockEnd = findEndBlk(pairs, i, end);
      parseEntities(pairs, i, blockEnd, block.entities);
      blocks.push(block);
      i = blockEnd + 1;
    } else {
      i++;
    }
  }
}

function findEndBlk(pairs: Pair[], start: number, end: number): number {
  for (let i = start; i < end; i++) {
    if (pairs[i][0] === 0 && pairs[i][1] === "ENDBLK") return i;
  }
  return end;
}


// ─── ENTITIES section ─────────────────────────────────────────────

function parseEntities(pairs: Pair[], start: number, end: number, out: DWGEntity[]): void {
  let i = start;
  while (i < end) {
    const [c, v] = pairs[i];
    if (c !== 0) { i++; continue; }
    // Boundary records — ENDSEC handled by caller; ENDBLK exits a
    // block (caller scopes).
    if (v === "ENDSEC" || v === "ENDBLK") return;
    const type = v.toUpperCase();
    const entityStart = i + 1;
    const entityEnd   = findNextEntity(pairs, entityStart, end);
    const ent = parseEntityBody(type, pairs, entityStart, entityEnd);
    if (ent) out.push(ent);
    i = entityEnd;
  }
}

function findNextEntity(pairs: Pair[], start: number, end: number): number {
  for (let i = start; i < end; i++) {
    if (pairs[i][0] === 0) return i;
  }
  return end;
}

function parseEntityBody(type: string, pairs: Pair[], start: number, end: number): DWGEntity | null {
  // Collect common attributes (layer, colour). Type-specific group
  // codes are handled inside each per-type parser below.
  const common: {layer: string; color?: number} = {layer: "0"};
  for (let i = start; i < end; i++) {
    const [c, v] = pairs[i];
    if (c === 8)       common.layer = v;
    else if (c === 62) common.color = parseInt(v, 10);
  }

  switch (type) {
    case "LINE":       return parseLine(pairs, start, end, common);
    case "LWPOLYLINE": return parseLwPolyline(pairs, start, end, common);
    case "POLYLINE":   return parsePolyline(pairs, start, end, common);
    case "CIRCLE":     return parseCircle(pairs, start, end, common);
    case "ARC":        return parseArc(pairs, start, end, common);
    case "3DFACE":     return parse3DFace(pairs, start, end, common);
    case "INSERT":     return parseInsert(pairs, start, end, common);
    case "TEXT":
    case "MTEXT":      return parseText(pairs, start, end, common, type as "TEXT" | "MTEXT");
    default:           return null;
  }
}


// ─── Per-entity parsers ───────────────────────────────────────────

type Common = {layer: string; color?: number};

function parseLine(pairs: Pair[], s: number, e: number, common: Common): DWGEntity {
  const ent: any = {...common, type: "LINE", start: [0, 0, 0], end: [0, 0, 0]};
  for (let i = s; i < e; i++) {
    const [c, v] = pairs[i];
    const n = parseFloat(v);
    if      (c === 10) ent.start[0] = n;
    else if (c === 20) ent.start[1] = n;
    else if (c === 30) ent.start[2] = n;
    else if (c === 11) ent.end[0]   = n;
    else if (c === 21) ent.end[1]   = n;
    else if (c === 31) ent.end[2]   = n;
  }
  return ent;
}

function parseLwPolyline(pairs: Pair[], s: number, e: number, common: Common): DWGEntity {
  const ent: any = {...common, type: "LWPOLYLINE", vertices: [] as number[], closed: false, elevation: 0};
  let curX: number | null = null;
  for (let i = s; i < e; i++) {
    const [c, v] = pairs[i];
    if (c === 10) {
      // Orphan x (no matching 20 yet) — pair with y=0 before
      // starting a new vertex. Defensive against malformed input.
      if (curX !== null) ent.vertices.push(curX, 0);
      curX = parseFloat(v);
    } else if (c === 20) {
      ent.vertices.push(curX ?? 0, parseFloat(v));
      curX = null;
    } else if (c === 38) {
      ent.elevation = parseFloat(v);
    } else if (c === 70) {
      ent.closed = (parseInt(v, 10) & 1) !== 0;
    }
  }
  if (curX !== null) ent.vertices.push(curX, 0);
  return ent;
}

function parsePolyline(_pairs: Pair[], _s: number, _e: number, common: Common): DWGEntity {
  // POLYLINE is a "header" record; its vertices follow as VERTEX
  // child records terminated by SEQEND. The mini parser splits them
  // out as separate top-level entities (and ignores VERTEX), so the
  // POLYLINE itself comes through empty. Hosts that need real
  // POLYLINE support should pre-process with `dxf-parser` /
  // `dxf` and feed the resulting DWGDocument to `dwg.emit` directly.
  return {...common, type: "POLYLINE", vertices: [], closed: false} as any;
}

function parseCircle(pairs: Pair[], s: number, e: number, common: Common): DWGEntity {
  const ent: any = {...common, type: "CIRCLE", center: [0, 0, 0], radius: 0};
  for (let i = s; i < e; i++) {
    const [c, v] = pairs[i];
    const n = parseFloat(v);
    if      (c === 10) ent.center[0] = n;
    else if (c === 20) ent.center[1] = n;
    else if (c === 30) ent.center[2] = n;
    else if (c === 40) ent.radius    = n;
  }
  return ent;
}

function parseArc(pairs: Pair[], s: number, e: number, common: Common): DWGEntity {
  const ent: any = {...common, type: "ARC", center: [0, 0, 0], radius: 0, startAngle: 0, endAngle: 0};
  for (let i = s; i < e; i++) {
    const [c, v] = pairs[i];
    const n = parseFloat(v);
    if      (c === 10) ent.center[0]  = n;
    else if (c === 20) ent.center[1]  = n;
    else if (c === 30) ent.center[2]  = n;
    else if (c === 40) ent.radius     = n;
    // DXF arc angles are in degrees; the SDK's DWGEntity expects radians.
    else if (c === 50) ent.startAngle = n * Math.PI / 180;
    else if (c === 51) ent.endAngle   = n * Math.PI / 180;
  }
  return ent;
}

function parse3DFace(pairs: Pair[], s: number, e: number, common: Common): DWGEntity {
  const corners: [number, number, number][] = [[0,0,0],[0,0,0],[0,0,0],[0,0,0]];
  for (let i = s; i < e; i++) {
    const [c, v] = pairs[i];
    const n = parseFloat(v);
    // Group codes 10/11/12/13 are X for corners 0..3; 20/21/22/23 Y;
    // 30/31/32/33 Z.
    if (c >= 10 && c <= 13)      corners[c - 10][0] = n;
    else if (c >= 20 && c <= 23) corners[c - 20][1] = n;
    else if (c >= 30 && c <= 33) corners[c - 30][2] = n;
  }
  return {...common, type: "3DFACE", corners} as any;
}

function parseInsert(pairs: Pair[], s: number, e: number, common: Common): DWGEntity {
  const ent: any = {
    ...common, type: "INSERT",
    blockName: "", position: [0, 0, 0],
    scale: [1, 1, 1], rotation: 0,
  };
  for (let i = s; i < e; i++) {
    const [c, v] = pairs[i];
    if      (c === 2)  ent.blockName    = v;
    else if (c === 10) ent.position[0]  = parseFloat(v);
    else if (c === 20) ent.position[1]  = parseFloat(v);
    else if (c === 30) ent.position[2]  = parseFloat(v);
    else if (c === 41) ent.scale[0]     = parseFloat(v);
    else if (c === 42) ent.scale[1]     = parseFloat(v);
    else if (c === 43) ent.scale[2]     = parseFloat(v);
    else if (c === 50) ent.rotation     = parseFloat(v) * Math.PI / 180;
  }
  return ent;
}

function parseText(pairs: Pair[], s: number, e: number, common: Common, type: "TEXT" | "MTEXT"): DWGEntity {
  const ent: any = {...common, type, text: "", position: [0, 0, 0], height: 1, rotation: 0};
  for (let i = s; i < e; i++) {
    const [c, v] = pairs[i];
    const n = parseFloat(v);
    if      (c === 1)  ent.text         = v;
    else if (c === 10) ent.position[0]  = n;
    else if (c === 20) ent.position[1]  = n;
    else if (c === 30) ent.position[2]  = n;
    else if (c === 40) ent.height       = n;
    else if (c === 50) ent.rotation     = n * Math.PI / 180;
  }
  return ent;
}


function err<T>(type: SDKErrorType, message: string): SDKResult<T> {
  return {ok: false, type, error: message};
}
