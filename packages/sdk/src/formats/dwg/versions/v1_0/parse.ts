/**
 * DWG parser + SceneModel emitter — v1.0.
 *
 * Owns the entire DWG → SceneModel pipeline for v1.0:
 *
 *  1. Dynamically imports `@mlightcad/libredwg-web` from a CDN (URL
 *     configured on the loader via {@link DWGLoaderParams.libredwgEsmUrl};
 *     pinned instance accepted via {@link DWGLoaderParams.libredwg} to
 *     skip the import).
 *  2. Reads the raw DWG bytes through libredwg
 *     (`dwg_read_data` → `convert`).
 *  3. Maps libredwg's `DwgDatabase` entity shapes into the SDK's
 *     {@link DWGDocument} discriminated union (renames fields,
 *     normalises points from `{x, y, z}` to `[x, y, z]`, converts
 *     angles from degrees to radians).
 *  4. Walks {@link DWGDocument.entities} (with INSERT recursion into
 *     `DWGDocument.blocks`) and tessellates / buckets geometry per
 *     SceneObject.
 *  5. Emits `createGeometry` / `createMaterial` / `createMesh` /
 *     `createObject` calls into the target SceneModel.
 *
 * Two public entry points:
 *
 *   - {@link parse} — full pipeline (bytes → SceneModel).
 *     Used by {@link DWGLoader}.
 *   - {@link emit} — skip parsing; emit a pre-built `DWGDocument`
 *     directly. Used by {@link DXFLoader} after it parses DXF text
 *     into a `DWGDocument` via its own adapter, and by callers that
 *     produced the document some other way (e.g. server-side
 *     conversion to JSON).
 *
 * Format coverage (every loader / emitter walks the same union):
 *  - **LINE** — single segment.
 *  - **LWPOLYLINE / POLYLINE** — open or closed polyline.
 *  - **CIRCLE** — `circleSteps`-faceted closed polyline.
 *  - **ARC** — partial circle as open polyline.
 *  - **ELLIPSE** — full or partial ellipse, sampled parametrically.
 *  - **POINT** — small `+` cross.
 *  - **3DFACE** — one triangle (or two if the 4th corner is
 *    distinct from the 3rd).
 *  - **INSERT** — recursive block expansion, capped at
 *    {@link DWGLoadOptions.maxInsertDepth}.
 *  - **TEXT / MTEXT** — rasterised to a canvas + emitted as a
 *    textured quad. Browser-only — Node hosts should pass
 *    `renderText: false`.
 *
 * Skipped in v1: HATCH, SPLINE, DIMENSION, 3D solids, proxy
 * entities, region boundaries, plot styles, line types. For
 * pixel-faithful DWG render of arbitrary files use libredwg's
 * `dwg_to_svg` → SVGLoader chain instead.
 *
 * One SceneObject per DWG layer by default (configurable via
 * {@link DWGLoadOptions.objectIdStrategy}); within each, strokes
 * are bucketed by `(colour, lineWidth)` for efficient batching.
 *
 * @internal
 *
 * Everything in `formats/dwg/versions/*` is package-internal. The
 * only sanctioned consumers are {@link DWGLoader} and the DXF loader
 * (which calls {@link emit} after parsing DXF text into a
 * `DWGDocument`). External code should go through `DWGLoader` /
 * `DXFLoader` and never deep-import from this directory.
 */
import {LinesPrimitive, TrianglesPrimitive} from "../../../../base/constants";
import {SDKErrorType, type SDKResult} from "../../../../base/core";
import type {SceneModel} from "../../../../model/scene";

import type {DWGBlock} from "../../lib/DWGBlock";
import type {DWGDocument} from "../../lib/DWGDocument";
import type {DWGEntity} from "../../lib/DWGEntity";
import type {Vec3} from "../../lib/Vec3";
import {
  DEFAULT_DWG_LOAD_OPTIONS,
  DEFAULT_LIBREDWG_ESM_URL,
  DEFAULT_LIBREDWG_WASM_DIR,
} from "../../lib/DWGLoadOptions";
import type {DWGLoadOptions, DWGLoaderParams} from "../../lib/DWGLoadOptions";
import type {DWGLoadResult} from "../../lib/DWGLoadResult";


/**
 * Inputs to {@link parse} (full pipeline).
 *
 * @internal
 */
export interface DWGParseInput {
  fileData:   ArrayBuffer | Uint8Array;
  sceneModel: SceneModel;
}

/**
 * Inputs to {@link emit} (document → SceneModel only).
 *
 * @internal
 */
export interface DWGEmitInput {
  document:   DWGDocument;
  sceneModel: SceneModel;
}


// ─── Libredwg cache ───────────────────────────────────────────────
//
// Dynamic ESM imports are expensive (network + WASM init). Cache
// the resolved Promise by URL pair so repeated loads against the
// same source don't repeat the work. WeakMaps would be wrong here
// — URLs are strings, not objects.
const _libredwgCache = new Map<string, Promise<{lib: any; fileType: any}>>();

async function loadLibredwg(opts: DWGLoadOptions & DWGLoaderParams): Promise<{lib: any; fileType: any}> {
  if (opts.libredwg && opts.libredwg.lib && opts.libredwg.fileType) {
    return opts.libredwg;
  }
  const esmUrl = opts.libredwgEsmUrl  ?? DEFAULT_LIBREDWG_ESM_URL;
  const wasm   = opts.libredwgWasmDir ?? DEFAULT_LIBREDWG_WASM_DIR;
  const key = `${esmUrl}|${wasm}`;
  let p = _libredwgCache.get(key);
  if (!p) {
    p = (async () => {
      const mod = await import(/* webpackIgnore: true */ esmUrl);
      if (!mod.LibreDwg || !mod.Dwg_File_Type) {
        throw new Error(`libredwg module at '${esmUrl}' is missing expected exports (LibreDwg, Dwg_File_Type)`);
      }
      const lib = await mod.LibreDwg.create(wasm);
      return {lib, fileType: mod.Dwg_File_Type};
    })();
    // If init throws, drop the cached failure so a retry can try again.
    p.catch(() => _libredwgCache.delete(key));
    _libredwgCache.set(key, p);
  }
  return p;
}


// ─── Public entry points ──────────────────────────────────────────

/**
 * Full pipeline: DWG bytes → SceneModel.
 *
 * Uses {@link loadLibredwg} to acquire the parser (CDN-fetched by
 * default, configurable via options), parses the bytes, maps the
 * libredwg `DwgDatabase` into a {@link DWGDocument}, then delegates
 * to {@link emit}.
 *
 * @internal
 */
export async function parse(input: DWGParseInput, options: DWGLoadOptions & DWGLoaderParams = {}): Promise<SDKResult<DWGLoadResult>> {

  if (!input || !input.sceneModel) {
    return err(SDKErrorType.InvalidInput, "[dwg.parse] sceneModel is required");
  }
  if (input.sceneModel.destroyed) {
    return err(SDKErrorType.InvalidOperation, "[dwg.parse] SceneModel already destroyed");
  }
  if (!input.fileData) {
    return err(SDKErrorType.InvalidInput, "[dwg.parse] fileData is required");
  }

  // Init libredwg (cached across calls).
  let lib: any, fileType: any;
  try {
    const got = await loadLibredwg(options);
    lib = got.lib; fileType = got.fileType;
  } catch (e: any) {
    return err(SDKErrorType.InvalidOperation, `[dwg.parse] libredwg-web init failed: ${e?.message ?? e}`);
  }

  // Parse bytes; capture libredwg's warning code (logged via
  // console.log by the wrapper regardless of severity).
  let document: DWGDocument;
  let warnings = 0;
  const origLog = console.log;
  console.log = (...args: any[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("Open dwg file with error code")) {
      warnings = Number(args[1]) || 0;
    }
    return origLog.apply(console, args);
  };
  let dwgPtr: any;
  try {
    dwgPtr = lib.dwg_read_data(input.fileData, fileType.DWG);
  } catch (e: any) {
    console.log = origLog;
    return err(SDKErrorType.InvalidInput, `[dwg.parse] libredwg.dwg_read_data threw: ${e?.message ?? e}`);
  } finally {
    console.log = origLog;
  }
  if (!dwgPtr) {
    return err(SDKErrorType.InvalidInput, `[dwg.parse] libredwg.dwg_read_data returned no pointer (warnings=${warnings})`);
  }
  try {
    const database = lib.convert(dwgPtr);
    document = mapDwgDatabaseToDocument(database);
  } catch (e: any) {
    return err(SDKErrorType.InvalidInput, `[dwg.parse] DwgDatabase → DWGDocument mapping failed: ${e?.message ?? e}`);
  } finally {
    // Always release native memory, even on mapping failure.
    try { lib.dwg_free(dwgPtr); } catch { /* swallow */ }
  }

  const emitRes = await emit({document, sceneModel: input.sceneModel}, options);
  if (!emitRes.ok) return emitRes;
  return {ok: true, value: {...emitRes.value, parserWarnings: warnings}};
}


/**
 * Emit a pre-built {@link DWGDocument} into a SceneModel. The
 * sibling entry-point to {@link parse}; skips the libredwg
 * fetch / parse / map steps entirely, takes a ready-made document.
 *
 * Used by {@link DXFLoader} (parses DXF text via its own adapter
 * into a `DWGDocument`, then hands it here for the shared
 * emission). Also the right entry point for callers that produced
 * the document via a server-side conversion (DWG → JSON), a
 * different in-browser parser, or a hand-authored fixture.
 *
 * @internal
 */
export async function emit(input: DWGEmitInput, options: DWGLoadOptions = {}): Promise<SDKResult<DWGLoadResult>> {

  if (!input || !input.sceneModel) {
    return err(SDKErrorType.InvalidInput, "[dwg.emit] sceneModel is required");
  }
  if (input.sceneModel.destroyed) {
    return err(SDKErrorType.InvalidOperation, "[dwg.emit] SceneModel already destroyed");
  }
  if (!input.document || !Array.isArray(input.document.entities)) {
    return err(SDKErrorType.InvalidInput, "[dwg.emit] document is missing entities array");
  }

  const opts: ResolvedOpts = {
    ...DEFAULT_DWG_LOAD_OPTIONS,
    colorOverride:     options.color ?? null,
    textColorOverride: options.textColor ?? null,
    onProgress:        options.onProgress ?? (() => {}),
    ...options,
  } as ResolvedOpts;

  const doc = input.document;

  const blockMap = new Map<string, DWGBlock>();
  if (doc.blocks) {
    for (const b of doc.blocks) {
      if (b && b.name) blockMap.set(b.name, b);
    }
  }

  // Walk entities + collect into per-object buckets.
  const collector = new GeometryCollector();
  let insertCount = 0;
  for (let i = 0; i < doc.entities.length; i++) {
    insertCount += processEntity(
      doc.entities[i],
      IDENTITY_AFFINE,
      /*inheritedColor*/null,
      /*inheritedLineWidth*/undefined,
      collector, opts, blockMap, /*depth*/0,
    );
    opts.onProgress(i + 1, doc.entities.length);
  }

  // ── Emit ─────────────────────────────────────────────────────
  const sceneObjectIds: string[] = [];
  let segmentCount  = 0;
  let triangleCount = 0;
  let textCount     = 0;

  const buckets = collector.buckets();
  for (let bIdx = 0; bIdx < buckets.length; bIdx++) {
    const bucket = buckets[bIdx];
    const objectId = `${input.sceneModel.id}-${bucket.id}`;
    const meshIds: string[] = [];

    // Fills first — z-offset back so they sit behind shared strokes.
    let fillIdx = 0;
    for (const [, fb] of bucket.fillBuckets) {
      if (fb.triangles.length === 0) continue;
      const suffix = `fill-${fillIdx++}`;
      const meshId = `${objectId}-${suffix}-mesh`;
      const geomId = `${objectId}-${suffix}-geom`;
      const matId  = `${objectId}-${suffix}-mat`;

      const tris = fb.triangles;
      const positions = new Float32Array(tris.length * 3 * 3);
      const indices   = new Uint32Array(tris.length * 3);
      for (let t = 0; t < tris.length; t++) {
        const p = tris[t];
        const o = t * 9;
        positions[o    ] = p[0] * opts.scale; positions[o + 1] = p[1] * opts.scale; positions[o + 2] = p[2] * opts.scale;
        positions[o + 3] = p[3] * opts.scale; positions[o + 4] = p[4] * opts.scale; positions[o + 5] = p[5] * opts.scale;
        positions[o + 6] = p[6] * opts.scale; positions[o + 7] = p[7] * opts.scale; positions[o + 8] = p[8] * opts.scale;
        const i0 = t * 3;
        indices[i0    ] = i0;
        indices[i0 + 1] = i0 + 1;
        indices[i0 + 2] = i0 + 2;
      }

      const gRes = input.sceneModel.createGeometry({
        id: geomId, primitive: TrianglesPrimitive,
        positions: positions as any, indices: indices as any,
      });
      if (gRes.ok === false) return err(gRes.type, `[dwg.emit] ${objectId} fill: ${gRes.error}`);

      const mRes = input.sceneModel.createMaterial({id: matId, color: fb.color});
      if (mRes.ok === false) return err(mRes.type, `[dwg.emit] ${objectId} fill: ${mRes.error}`);

      const meshRes = input.sceneModel.createMesh({
        id: meshId, geometryId: geomId, materialId: matId,
        color: fb.color,
      });
      if (meshRes.ok === false) return err(meshRes.type, `[dwg.emit] ${objectId} fill: ${meshRes.error}`);
      meshIds.push(meshId);
      triangleCount += tris.length;
    }

    // Strokes.
    let strokeIdx = 0;
    for (const [, sb] of bucket.strokeBuckets) {
      if (sb.segments.length === 0) continue;
      const suffix = `lines-${strokeIdx++}`;
      const meshId = `${objectId}-${suffix}-mesh`;
      const geomId = `${objectId}-${suffix}-geom`;
      const matId  = `${objectId}-${suffix}-mat`;

      const segs = sb.segments;
      const positions = new Float32Array(segs.length * 2 * 3);
      const indices   = new Uint32Array(segs.length * 2);
      for (let s = 0; s < segs.length; s++) {
        const p = segs[s];
        const o = s * 6;
        positions[o    ] = p[0] * opts.scale; positions[o + 1] = p[1] * opts.scale; positions[o + 2] = p[2] * opts.scale;
        positions[o + 3] = p[3] * opts.scale; positions[o + 4] = p[4] * opts.scale; positions[o + 5] = p[5] * opts.scale;
        const i0 = s * 2;
        indices[i0    ] = i0;
        indices[i0 + 1] = i0 + 1;
      }

      const gRes = input.sceneModel.createGeometry({
        id: geomId, primitive: LinesPrimitive,
        positions: positions as any, indices: indices as any,
      });
      if (gRes.ok === false) return err(gRes.type, `[dwg.emit] ${objectId} strokes: ${gRes.error}`);

      const lineWidth = Math.max(opts.minLineWidth, sb.lineWidth * opts.lineWidthScale);
      const mRes = input.sceneModel.createMaterial({
        id: matId, color: sb.color, lineWidth,
      });
      if (mRes.ok === false) return err(mRes.type, `[dwg.emit] ${objectId} strokes: ${mRes.error}`);

      const meshRes = input.sceneModel.createMesh({
        id: meshId, geometryId: geomId, materialId: matId, color: sb.color,
      });
      if (meshRes.ok === false) return err(meshRes.type, `[dwg.emit] ${objectId} strokes: ${meshRes.error}`);
      meshIds.push(meshId);
      segmentCount += segs.length;
    }

    // Text quads.
    let textIdx = 0;
    for (const tx of bucket.texts) {
      const suffix = `text-${textIdx++}`;
      const meshId = `${objectId}-${suffix}-mesh`;
      const geomId = `${objectId}-${suffix}-geom`;
      const matId  = `${objectId}-${suffix}-mat`;
      const texId  = `${objectId}-${suffix}-tex`;

      const ctx2d = tx.canvas.getContext("2d");
      if (!ctx2d) continue;
      const imgData = ctx2d.getImageData(0, 0, tx.canvas.width, tx.canvas.height);

      const tRes = input.sceneModel.createTexture({
        id: texId,
        // `flipY` is a no-op in the current renderer (see PDFLoader
        // and SVGLoader for the same finding). UV V values below
        // compensate.
        flipY: true,
        imageData: {data: imgData.data, width: imgData.width, height: imgData.height},
      });
      if (tRes.ok === false) {
        console.warn(`[dwg.emit] ${objectId} text "${tx.text.slice(0, 24)}": ${tRes.error}`);
        continue;
      }

      const matRes = input.sceneModel.createMaterial({
        id: matId, colorTextureId: texId, alphaMode: "MASK", alphaCutoff: 0.05,
      });
      if (matRes.ok === false) {
        console.warn(`[dwg.emit] ${objectId} text: ${matRes.error}`);
        continue;
      }

      const c = tx.corners;
      const positions = new Float32Array([
        c[0][0] * opts.scale, c[0][1] * opts.scale, c[0][2] * opts.scale,
        c[1][0] * opts.scale, c[1][1] * opts.scale, c[1][2] * opts.scale,
        c[2][0] * opts.scale, c[2][1] * opts.scale, c[2][2] * opts.scale,
        c[3][0] * opts.scale, c[3][1] * opts.scale, c[3][2] * opts.scale,
      ]);
      // BL→(0,1) BR→(1,1) TR→(1,0) TL→(0,0) — matches SVG/PDF text
      // emission and the renderer's actual texture-Y orientation.
      const uvs     = new Float32Array([0, 1,  1, 1,  1, 0,  0, 0]);
      const indices = new Uint32Array([0, 1, 2,  0, 2, 3]);

      const gRes = input.sceneModel.createGeometry({
        id: geomId, primitive: TrianglesPrimitive,
        positions: positions as any, uvs: uvs as any, indices: indices as any,
      });
      if (gRes.ok === false) {
        console.warn(`[dwg.emit] ${objectId} text: ${gRes.error}`);
        continue;
      }

      const meshRes = input.sceneModel.createMesh({
        id: meshId, geometryId: geomId, materialId: matId,
      });
      if (meshRes.ok === false) {
        console.warn(`[dwg.emit] ${objectId} text: ${meshRes.error}`);
        continue;
      }
      meshIds.push(meshId);
      textCount++;
    }

    if (meshIds.length === 0) continue;
    const oRes = input.sceneModel.createObject({id: objectId, meshIds});
    if (oRes.ok === false) return err(oRes.type, `[dwg.emit] ${objectId}: ${oRes.error}`);
    sceneObjectIds.push(objectId);
  }

  return {
    ok: true,
    value: {
      sceneModel: input.sceneModel,
      segmentCount, triangleCount, textCount, insertCount,
      sceneObjectIds,
    },
  };
}


// ─── libredwg DwgDatabase → DWGDocument mapping ───────────────────

function mapDwgDatabaseToDocument(database: any): DWGDocument {
  const mappedEntities: DWGEntity[] = [];
  for (const e of (database.entities || [])) {
    const mapped = mapEntity(e);
    if (mapped) mappedEntities.push(mapped);
  }
  return {
    header: {units: database.header?.INSUNITS},
    blocks: [],   // see note in formats_dwg_floorPlan example —
                  // block-record entity ownership chasing is a TODO.
    entities: mappedEntities,
  };
}

function pt(p: any): Vec3 {
  if (!p) return [0, 0, 0];
  return [p.x || 0, p.y || 0, p.z || 0];
}

const DEG2RAD = Math.PI / 180;

/**
 * Map a single libredwg-web entity into the SDK's `DWGEntity`
 * discriminated union. Renames fields (`startPoint` → `start`,
 * `insertPoint` → `position`, …), normalises points from `{x,y,z}`
 * to `[x,y,z]`, converts ARC/ELLIPSE/INSERT/TEXT angles from
 * degrees to radians, forwards `colorIndex` as the ACI palette
 * index. Unknown entity types (HATCH, SPLINE, DIMENSION, etc.)
 * return null and get filtered out.
 */
function mapEntity(e: any): DWGEntity | null {
  if (!e || !e.type) return null;
  const common = {
    layer: e.layer || "0",
    ...(e.colorIndex !== undefined ? {color: e.colorIndex} : {}),
  };
  switch (String(e.type).toUpperCase()) {

    case "LINE":
      return {...common, type: "LINE", start: pt(e.startPoint), end: pt(e.endPoint)};

    case "LWPOLYLINE": {
      const flat: number[] = [];
      for (const v of e.vertices || []) flat.push(v.x || 0, v.y || 0);
      return {
        ...common, type: "LWPOLYLINE",
        vertices: flat,
        elevation: e.elevation || 0,
        closed: ((e.flag || 0) & 1) !== 0,
      };
    }

    case "POLYLINE":
    case "POLYLINE_2D":
    case "POLYLINE_3D":
      return {
        ...common, type: "POLYLINE",
        vertices: (e.vertices || []).map(pt),
        closed: ((e.flag || 0) & 1) !== 0,
      };

    case "CIRCLE":
      return {...common, type: "CIRCLE", center: pt(e.center), radius: e.radius || 0};

    case "ARC":
      // libredwg returns angles in DEGREES; SDK expects radians.
      return {
        ...common, type: "ARC",
        center: pt(e.center), radius: e.radius || 0,
        startAngle: (e.startAngle || 0) * DEG2RAD,
        endAngle:   (e.endAngle   || 0) * DEG2RAD,
      };

    case "ELLIPSE": {
      const majorAxis = pt(e.majorAxisEndpoint || e.majorAxis);
      return {
        ...common, type: "ELLIPSE",
        center: pt(e.center),
        majorAxis,
        ratio: e.minorAxisRatio ?? e.ratio ?? 1,
        startAngle: (e.startAngle ?? 0)   * DEG2RAD,
        endAngle:   (e.endAngle   ?? 360) * DEG2RAD,
      };
    }

    case "POINT":
      return {...common, type: "POINT", position: pt(e.position || e.point)};

    case "3DFACE": {
      const c = e.corners || [e.corner1, e.corner2, e.corner3, e.corner4];
      return {
        ...common, type: "3DFACE",
        corners: [pt(c[0]), pt(c[1]), pt(c[2]), pt(c[3])],
      };
    }

    case "INSERT":
      return {
        ...common, type: "INSERT",
        blockName: e.name || e.blockName || "",
        position:  pt(e.insertPoint || e.position),
        scale:     pt(e.scaleFactor),       // pt() defaults missing components to 0, but…
        rotation:  (e.rotation || 0) * DEG2RAD,
      };

    case "TEXT":
      return {
        ...common, type: "TEXT",
        text: e.text || "",
        position: pt(e.position || e.insertionPoint),
        height: e.textHeight || e.height || 1,
        rotation: (e.rotation || 0) * DEG2RAD,
      };

    case "MTEXT":
      return {
        ...common, type: "MTEXT",
        text: e.text || e.contents || "",
        position: pt(e.position || e.insertionPoint),
        height: e.textHeight || e.height || e.initialTextHeight || 1,
        rotation: (e.rotation || 0) * DEG2RAD,
      };

    default:
      // HATCH, SPLINE, DIMENSION, SOLID, TRACE, RAY, XLINE,
      // 3DSOLID, REGION, MLINE, ATTRIB, ATTDEF, etc. — silently
      // skipped; the loader's switch treats unknown types as
      // no-ops too.
      return null;
  }
}


// ─── Resolved options + collection types ──────────────────────────

type ResolvedOpts = Required<typeof DEFAULT_DWG_LOAD_OPTIONS> & {
  colorOverride:     RGB | null;
  textColorOverride: RGB | null;
  onProgress:        (i: number, total: number) => void;
};

type RGB = [number, number, number];

interface ObjectBucket {
  id: string;
  strokeBuckets: Map<string, { color: RGB; lineWidth: number; segments: Segment[] }>;
  fillBuckets:   Map<string, { color: RGB; triangles: Tri[] }>;
  texts:         TextEmission[];
}

type Segment = [number, number, number, number, number, number];  // x1,y1,z1,x2,y2,z2
type Tri     = [number, number, number, number, number, number, number, number, number];  // 3 × (x,y,z)

interface TextEmission {
  text:    string;
  canvas:  HTMLCanvasElement;
  corners: [number, number, number][];  // BL, BR, TR, TL in world space
}

class GeometryCollector {
  private readonly _buckets = new Map<string, ObjectBucket>();

  bucket(id: string): ObjectBucket {
    let b = this._buckets.get(id);
    if (!b) {
      b = {id, strokeBuckets: new Map(), fillBuckets: new Map(), texts: []};
      this._buckets.set(id, b);
    }
    return b;
  }

  addStroke(objectId: string, color: RGB, lineWidth: number, segs: Segment[]): void {
    if (segs.length === 0) return;
    const b = this.bucket(objectId);
    const key = `${colorKey(color)}|${lineWidth.toFixed(3)}`;
    let sb = b.strokeBuckets.get(key);
    if (!sb) { sb = {color, lineWidth, segments: []}; b.strokeBuckets.set(key, sb); }
    for (const s of segs) sb.segments.push(s);
  }

  addFill(objectId: string, color: RGB, tris: Tri[]): void {
    if (tris.length === 0) return;
    const b = this.bucket(objectId);
    const key = colorKey(color);
    let fb = b.fillBuckets.get(key);
    if (!fb) { fb = {color, triangles: []}; b.fillBuckets.set(key, fb); }
    for (const t of tris) fb.triangles.push(t);
  }

  addText(objectId: string, t: TextEmission): void {
    this.bucket(objectId).texts.push(t);
  }

  buckets(): ObjectBucket[] { return Array.from(this._buckets.values()); }
}

function colorKey(c: RGB): string { return `${c[0].toFixed(3)},${c[1].toFixed(3)},${c[2].toFixed(3)}`; }


// ─── 3D affine — 4×4 row-major for INSERT block expansion ─────────

type Affine = number[];   // length 16

const IDENTITY_AFFINE: Affine = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

function multiplyAffine(a: Affine, b: Affine): Affine {
  const out = new Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j];
      out[i * 4 + j] = s;
    }
  }
  return out;
}

function applyAffine(m: Affine, x: number, y: number, z: number): Vec3 {
  return [
    m[0] * x + m[1] * y + m[2]  * z + m[3],
    m[4] * x + m[5] * y + m[6]  * z + m[7],
    m[8] * x + m[9] * y + m[10] * z + m[11],
  ];
}

function makeInsertAffine(position: Vec3, scale: Vec3, rotationZ: number): Affine {
  const cos = Math.cos(rotationZ), sin = Math.sin(rotationZ);
  // M = T(pos) · R_z(rot) · S(scale)
  return [
    cos * scale[0], -sin * scale[1], 0, position[0],
    sin * scale[0],  cos * scale[1], 0, position[1],
    0,               0,              scale[2], position[2],
    0,               0,              0,        1,
  ];
}


// ─── Entity walker ────────────────────────────────────────────────

function processEntity(
  entity: DWGEntity, ctm: Affine,
  inheritedColor: RGB | null, inheritedLineWidth: number | undefined,
  collector: GeometryCollector, opts: ResolvedOpts,
  blockMap: Map<string, DWGBlock>, depth: number,
): number {

  const objectId = pickObjectId(entity, opts);
  const color    = resolveColor(entity, inheritedColor, opts);
  const width    = resolveLineWidth(entity, inheritedLineWidth, opts);

  switch (entity.type.toUpperCase()) {

    case "LINE": {
      const e = entity as Extract<DWGEntity, {type: "LINE"}>;
      const a = applyAffine(ctm, e.start[0], e.start[1], e.start[2]);
      const b = applyAffine(ctm, e.end[0],   e.end[1],   e.end[2]);
      if (color) collector.addStroke(objectId, color, width, [[a[0], a[1], a[2], b[0], b[1], b[2]]]);
      return 0;
    }

    case "LWPOLYLINE": {
      const e = entity as Extract<DWGEntity, {type: "LWPOLYLINE"}>;
      const pts = flattenLwPolyline(e.vertices, e.elevation ?? 0);
      emitPolylineSegments(pts, !!e.closed, ctm, color, width, collector, objectId);
      return 0;
    }

    case "POLYLINE": {
      const e = entity as Extract<DWGEntity, {type: "POLYLINE"}>;
      emitPolylineSegments(e.vertices, !!e.closed, ctm, color, width, collector, objectId);
      return 0;
    }

    case "CIRCLE": {
      const e = entity as Extract<DWGEntity, {type: "CIRCLE"}>;
      const pts = sampleCircle(e.center, e.radius, 0, 2 * Math.PI, opts.circleSteps);
      emitPolylineSegments(pts, /*closed*/true, ctm, color, width, collector, objectId);
      return 0;
    }

    case "ARC": {
      const e = entity as Extract<DWGEntity, {type: "ARC"}>;
      let sweep = e.endAngle - e.startAngle;
      if (sweep < 0) sweep += 2 * Math.PI;
      const steps = Math.max(2, Math.ceil(opts.circleSteps * (sweep / (2 * Math.PI))));
      const pts   = sampleCircle(e.center, e.radius, e.startAngle, e.startAngle + sweep, steps);
      emitPolylineSegments(pts, /*closed*/false, ctm, color, width, collector, objectId);
      return 0;
    }

    case "ELLIPSE": {
      const e = entity as Extract<DWGEntity, {type: "ELLIPSE"}>;
      const start = e.startAngle ?? 0, end = e.endAngle ?? (2 * Math.PI);
      let sweep = end - start;
      if (sweep <= 0) sweep += 2 * Math.PI;
      const steps = Math.max(8, Math.ceil(opts.circleSteps * (sweep / (2 * Math.PI))));
      const pts   = sampleEllipse(e.center, e.majorAxis, e.ratio, start, start + sweep, steps);
      const closed = Math.abs(sweep - 2 * Math.PI) < 1e-6;
      emitPolylineSegments(pts, closed, ctm, color, width, collector, objectId);
      return 0;
    }

    case "POINT": {
      const e = entity as Extract<DWGEntity, {type: "POINT"}>;
      const r = 0.5;
      const p = applyAffine(ctm, e.position[0], e.position[1], e.position[2]);
      if (color) {
        collector.addStroke(objectId, color, width, [
          [p[0] - r, p[1], p[2],  p[0] + r, p[1], p[2]],
          [p[0], p[1] - r, p[2],  p[0], p[1] + r, p[2]],
        ]);
      }
      return 0;
    }

    case "3DFACE": {
      const e = entity as Extract<DWGEntity, {type: "3DFACE"}>;
      const a = applyAffine(ctm, e.corners[0][0], e.corners[0][1], e.corners[0][2]);
      const b = applyAffine(ctm, e.corners[1][0], e.corners[1][1], e.corners[1][2]);
      const c = applyAffine(ctm, e.corners[2][0], e.corners[2][1], e.corners[2][2]);
      const d = applyAffine(ctm, e.corners[3][0], e.corners[3][1], e.corners[3][2]);
      if (color) {
        const tris: Tri[] = [
          [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]],
        ];
        const fourthDistinct =
          Math.abs(d[0] - c[0]) > 1e-9 || Math.abs(d[1] - c[1]) > 1e-9 || Math.abs(d[2] - c[2]) > 1e-9;
        if (fourthDistinct) tris.push([a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]]);
        collector.addFill(objectId, color, tris);
      }
      return 0;
    }

    case "INSERT": {
      if (depth >= opts.maxInsertDepth) {
        console.warn(`[dwg.parse] INSERT recursion limit (${opts.maxInsertDepth}) reached for block '${(entity as any).blockName}'`);
        return 0;
      }
      const e = entity as Extract<DWGEntity, {type: "INSERT"}>;
      const block = blockMap.get(e.blockName);
      if (!block) {
        // Quiet skip — libredwg's mapping commonly references blocks
        // we don't extract (the BLOCK_RECORD chase isn't implemented
        // yet). A console warning per missing block would flood the
        // console on real drawings.
        return 0;
      }
      const insertM = makeInsertAffine(
        e.position,
        (e.scale ?? [1, 1, 1]) as Vec3,
        e.rotation ?? 0,
      );
      const childCtm = multiplyAffine(ctm, insertM);
      for (const child of block.entities) {
        processEntity(child, childCtm, color, width, collector, opts, blockMap, depth + 1);
      }
      return 1;
    }

    case "TEXT":
    case "MTEXT": {
      if (!opts.renderText) return 0;
      const e = entity as Extract<DWGEntity, {type: "TEXT" | "MTEXT"}>;
      emitTextEntity(e, ctm, color, opts, collector, objectId);
      return 0;
    }

    default:
      return 0;
  }
}


// ─── Per-element helpers ──────────────────────────────────────────

function pickObjectId(entity: DWGEntity, opts: ResolvedOpts): string {
  switch (opts.objectIdStrategy) {
    case "single":  return "model";
    case "entity":  return `${entity.type.toLowerCase()}-${(syntheticIdCounter.next++)}`;
    case "layer":
    default:        return safeId(entity.layer || "0");
  }
}

const syntheticIdCounter = { next: 0 };

function safeId(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_\-]/g, "_") || "0";
}

function resolveColor(entity: DWGEntity, inherited: RGB | null, opts: ResolvedOpts): RGB | null {
  if (opts.colorOverride) return opts.colorOverride;
  const c = entity.color;
  if (Array.isArray(c)) return c as RGB;
  if (typeof c === "number") {
    if (c === 0)   return inherited ?? [1, 1, 1];
    if (c === 256) return inherited ?? [1, 1, 1];
    return aciToRgb(c) ?? inherited ?? [1, 1, 1];
  }
  return inherited ?? [1, 1, 1];
}

function resolveLineWidth(entity: DWGEntity, inherited: number | undefined, opts: ResolvedOpts): number {
  return entity.lineWidth ?? inherited ?? opts.defaultLineWidth;
}


// ─── Geometry samplers ────────────────────────────────────────────

function flattenLwPolyline(verts: number[] | [number, number][], elevation: number): Vec3[] {
  const out: Vec3[] = [];
  if (verts.length === 0) return out;
  if (Array.isArray(verts[0])) {
    for (const v of verts as [number, number][]) out.push([v[0], v[1], elevation]);
  } else {
    const flat = verts as number[];
    for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1], elevation]);
  }
  return out;
}

function sampleCircle(center: Vec3, radius: number, a0: number, a1: number, steps: number): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + (a1 - a0) * t;
    pts.push([center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius, center[2]]);
  }
  return pts;
}

function sampleEllipse(center: Vec3, majorAxis: Vec3, ratio: number, a0: number, a1: number, steps: number): Vec3[] {
  const aLen = Math.hypot(majorAxis[0], majorAxis[1]);
  if (aLen === 0) return [];
  const ux = majorAxis[0] / aLen, uy = majorAxis[1] / aLen;
  const vx = -uy, vy = ux;
  const bLen = aLen * ratio;
  const pts: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + (a1 - a0) * t;
    const cx = Math.cos(a) * aLen, cy = Math.sin(a) * bLen;
    pts.push([center[0] + cx * ux + cy * vx,
              center[1] + cx * uy + cy * vy,
              center[2]]);
  }
  return pts;
}

function emitPolylineSegments(
  pts: Vec3[], closed: boolean, ctm: Affine,
  color: RGB | null, width: number, collector: GeometryCollector, objectId: string,
): void {
  if (!color || pts.length < 2) return;
  const segs: Segment[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = applyAffine(ctm, pts[i - 1][0], pts[i - 1][1], pts[i - 1][2]);
    const b = applyAffine(ctm, pts[i][0],     pts[i][1],     pts[i][2]);
    segs.push([a[0], a[1], a[2], b[0], b[1], b[2]]);
  }
  if (closed && pts.length > 2) {
    const a = applyAffine(ctm, pts[pts.length - 1][0], pts[pts.length - 1][1], pts[pts.length - 1][2]);
    const b = applyAffine(ctm, pts[0][0], pts[0][1], pts[0][2]);
    segs.push([a[0], a[1], a[2], b[0], b[1], b[2]]);
  }
  collector.addStroke(objectId, color, width, segs);
}


// ─── Text rasterisation ───────────────────────────────────────────

function emitTextEntity(
  entity: Extract<DWGEntity, {type: "TEXT" | "MTEXT"}>,
  ctm: Affine, color: RGB | null,
  opts: ResolvedOpts, collector: GeometryCollector, objectId: string,
): void {

  if (typeof document === "undefined") return;
  if (!entity.text || entity.text.length === 0) return;
  const text = entity.text;

  const heightUnits = entity.height || 1;
  const pxFont = heightUnits * opts.textPxPerUnit;
  const fontStr = `${pxFont}px ${opts.textFont}`;
  const fillRgb: RGB = opts.textColorOverride ?? color ?? opts.textDefaultColor;

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return;
  measure.font = fontStr;
  const tm = measure.measureText(text);
  const ascentPx  = tm.actualBoundingBoxAscent  || pxFont * 0.80;
  const descentPx = tm.actualBoundingBoxDescent || pxFont * 0.20;
  const widthPx   = Math.max(1, Math.ceil(tm.width));
  const heightPx  = Math.max(1, Math.ceil(ascentPx + descentPx));

  const canvas = document.createElement("canvas");
  canvas.width  = widthPx;
  canvas.height = heightPx;
  const cctx = canvas.getContext("2d");
  if (!cctx) return;
  cctx.font = fontStr;
  cctx.textBaseline = "alphabetic";
  cctx.fillStyle = `rgb(${Math.round(fillRgb[0] * 255)}, ${Math.round(fillRgb[1] * 255)}, ${Math.round(fillRgb[2] * 255)})`;
  cctx.fillText(text, 0, ascentPx);

  // DWG's +Y is up — no Y-flip needed (unlike SVG).
  const wText = widthPx   / opts.textPxPerUnit;
  const wAsc  = ascentPx  / opts.textPxPerUnit;
  const wDsc  = descentPx / opts.textPxPerUnit;

  const rot = entity.rotation ?? 0;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const pos = entity.position;
  const localCorners: [number, number][] = [
    [0,      -wDsc],
    [wText,  -wDsc],
    [wText,   wAsc],
    [0,       wAsc],
  ];
  const worldCorners: [number, number, number][] = localCorners.map(([lx, ly]) => {
    const rx = cos * lx - sin * ly + pos[0];
    const ry = sin * lx + cos * ly + pos[1];
    const rz = pos[2];
    return applyAffine(ctm, rx, ry, rz);
  });

  collector.addText(objectId, {text, canvas, corners: worldCorners});
}


// ─── AutoCAD Color Index → RGB ────────────────────────────────────

const ACI_PALETTE: Record<number, RGB> = {
  1: [1.00, 0.00, 0.00],  2: [1.00, 1.00, 0.00],  3: [0.00, 1.00, 0.00],
  4: [0.00, 1.00, 1.00],  5: [0.00, 0.00, 1.00],  6: [1.00, 0.00, 1.00],
  7: [1.00, 1.00, 1.00],  8: [0.50, 0.50, 0.50],  9: [0.75, 0.75, 0.75],
  250: [0.20, 0.20, 0.20],
  251: [0.30, 0.30, 0.30],
  252: [0.40, 0.40, 0.40],
  253: [0.55, 0.55, 0.55],
  254: [0.70, 0.70, 0.70],
  255: [0.85, 0.85, 0.85],
};

function aciToRgb(index: number): RGB | null {
  return ACI_PALETTE[index] ?? null;
}


function err<T>(type: SDKErrorType, message: string): SDKResult<T> {
  return {ok: false, type, error: message};
}
