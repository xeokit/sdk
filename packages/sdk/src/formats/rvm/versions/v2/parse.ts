import type {ModelParseParams} from "../../../ModelParseParams";
import {ChunkReader} from "./chunkReader";
import {parsePrimitive} from "./parsePrimitive";
import {RVMPrimitive} from "./RVMPrimitive";
import {createMat4Float64, identityMat4} from "../../../../base/math/matrix";
import type {Mat4} from "../../../../base/math/matrix";
import type {Vec3} from "../../../../base/math/vector";
import {yieldToHost} from "../../../../base/utils";
import type {LoaderProgress} from "../../../LoaderProgress";

/**
 * Parse an RVM v2 binary file into a `SceneModel`.
 *
 * RVM has no chunk-size fields — chunks are walked token-by-token
 * and the parser must know each chunk's layout exactly. The dispatch
 * follows pmuc's reader:
 *
 *   1. HEAD chunk: id + 8 unused bytes + version + 5 strings (info,
 *      note, date, user, encoding — encoding is sometimes empty).
 *   2. MODL chunk: id + 8 unused bytes + version + 2 strings (project,
 *      name).
 *   3. Loop: read 4-char id and dispatch
 *      - CNTB → enter container (recursive — children follow as
 *               sibling chunks, terminated by CNTE)
 *      - PRIM → primitive payload
 *      - COLR → colour-palette entry (materialId → packed RGBA)
 *      - END  → exit
 *
 * Translations stored in RVM are in millimetres; we apply a 0.001
 * scale to convert to metres (the SceneModel's expected unit).
 *
 * @private
 */
export async function parse(params: ModelParseParams, options?: any): Promise<void> {
  const {fileData, sceneModel} = params;
  if (!sceneModel) return;

  const opts = options || {};
  const onProgress: ((p: LoaderProgress) => void) | undefined = opts.onProgress;
  const signal: AbortSignal | undefined = opts.signal;
  const progress: LoaderProgress = {phase: "Parsing RVM", current: 0, total: 0};
  const emitProgress = (current: number): void => {
    if (!onProgress) return;
    progress.phase = "Parsing RVM";
    progress.current = current;
    progress.total = 0;
    onProgress(progress);
  };

  const reader = new ChunkReader(fileData);

  // ── HEAD ─────────────────────────────────────────────────────────
  if (reader.readChunkId() !== "HEAD") {
    throw new Error(`[RVMLoader] expected HEAD chunk at byte 0`);
  }
  reader.readChunkPreamble();
  reader.readString();                        // banner / info
  reader.readString();                        // note
  reader.readString();                        // date
  reader.readString();                        // user
  // pmuc-style headers omit the encoding string in older revisions; if
  // the next 4 bytes look like a string-word count followed by a sane
  // ASCII payload we read it, otherwise we just continue. We cheat:
  // the next chunk id ("MODL") wouldn't be a small word count, so
  // peek-and-read is safe.
  tryReadString(reader);

  // ── MODL ─────────────────────────────────────────────────────────
  if (reader.readChunkId() !== "MODL") {
    throw new Error(`[RVMLoader] expected MODL after HEAD`);
  }
  reader.readChunkPreamble();
  reader.readString();                        // project
  reader.readString();                        // name

  // ── Top-level walk ───────────────────────────────────────────────
  const ctx: WalkContext = {
    reader,
    sceneModel,
    geometryIdSeq: 0,
    meshIdSeq: 0,
    objectIdSeq: 0,
    geomCreateFails: 0,
    meshCreateFails: 0,
    objectCreateFails: 0,
    primCounts: {},
    parentMatrixStack: [identityMat4(createMat4Float64())],
    parentMaterialStack: [0],
    palette: new Map<number, Vec3>(),
    options: opts,
    signal,
    emitProgress,
    primSinceYield: 0,
  };

  while (true) {
    const id = reader.readChunkId();
    if (id === "END" || id === "END:") break;
    if (id === "CNTB") {
      await readContainer(ctx);
    } else if (id === "PRIM") {
      await readPrimitiveChunk(ctx);
    } else if (id === "COLR") {
      readColor(ctx);
    } else if (!id) {
      // Empty id usually means we walked past the file end.
      break;
    } else {
      // Unknown top-level chunk — bail loudly. There's no size field
      // to skip, so we can't recover.
      throw new Error(`[RVMLoader] unknown top-level chunk '${id}' at byte ${reader.offset - 16}`);
    }
  }
  emitProgress(ctx.meshIdSeq);

  console.log(
    `[RVMLoader] done: objects=${ctx.objectIdSeq}, meshes=${ctx.meshIdSeq}, geoms=${ctx.geometryIdSeq}` +
    `; primitive kinds:`, ctx.primCounts,
    `; failures: createGeometry=${ctx.geomCreateFails}, createMesh=${ctx.meshCreateFails}, createObject=${ctx.objectCreateFails}`
  );
}

// ─────────────────────────────────────────────────────────────────────
// Walker state & helpers
// ─────────────────────────────────────────────────────────────────────

interface WalkContext {
  reader: ChunkReader;
  sceneModel: any;
  geometryIdSeq: number;
  meshIdSeq: number;
  objectIdSeq: number;
  geomCreateFails: number;
  meshCreateFails: number;
  objectCreateFails: number;
  primCounts: Record<number, number>;
  parentMatrixStack: Mat4[];
  // CNTB materialIds inherited down the hierarchy. A CNTB with
  // materialId 0 means "inherit from parent" (matches pmuc behaviour);
  // a non-zero id is pushed and popped with the container.
  parentMaterialStack: number[];
  // Colour palette built from COLR chunks: materialId → linear RGB.
  palette: Map<number, Vec3>;
  options: any;
  signal?: AbortSignal;
  emitProgress: (current: number) => void;
  primSinceYield: number;
}

/**
 * CNTB is recursive: after reading its own payload (name + translation
 * + materialId), the caller keeps reading sibling chunks (CNTB / PRIM
 * / COLR) until the matching CNTE is hit. Each CNTB synthesises one
 * `SceneObject` from the meshes its descendants produce.
 */
async function readContainer(ctx: WalkContext): Promise<void> {
  ctx.reader.readChunkPreamble();
  const name = ctx.reader.readString();
  const tx = ctx.reader.readFloat32() * 0.001;   // mm → m
  const ty = ctx.reader.readFloat32() * 0.001;
  const tz = ctx.reader.readFloat32() * 0.001;
  const materialId = ctx.reader.readInt32();

  const parent = ctx.parentMatrixStack[ctx.parentMatrixStack.length - 1];
  const local = createMat4Float64();
  for (let i = 0; i < 16; i++) (local as any)[i] = (parent as any)[i];
  (local as any)[12] += tx;
  (local as any)[13] += ty;
  (local as any)[14] += tz;
  ctx.parentMatrixStack.push(local);

  // 0 means "inherit"; otherwise this CNTB's id wins for descendants.
  const inherited = ctx.parentMaterialStack[ctx.parentMaterialStack.length - 1];
  ctx.parentMaterialStack.push(materialId !== 0 ? materialId : inherited);

  const myMeshIds: string[] = [];
  await walkChildren(ctx, myMeshIds);

  ctx.parentMaterialStack.pop();
  ctx.parentMatrixStack.pop();

  if (myMeshIds.length > 0) {
    const objectId = (name && name.length > 0)
      ? `${name}-${ctx.objectIdSeq++}`
      : `cntb-${ctx.objectIdSeq++}`;
    const r = ctx.sceneModel.createObject({
      id: objectId,
      meshIds: myMeshIds
    });
    if (r && r.ok === false) {
      ctx.objectCreateFails++;
      if (ctx.objectCreateFails <= 3) console.warn("[RVMLoader] createObject failed:", r.error);
    }
  }
}

/**
 * Reads sibling chunks (CNTB / PRIM / COLR) inside a CNTB until the
 * matching CNTE is hit. Mesh IDs from PRIM children are appended to
 * `meshIds` so the enclosing CNTB can attach them to its SceneObject.
 */
async function walkChildren(ctx: WalkContext, meshIds: string[]): Promise<void> {
  while (true) {
    const id = ctx.reader.readChunkId();
    if (id === "CNTE") {
      ctx.reader.readChunkPreamble();          // CNTE has no payload
      return;
    }
    if (id === "CNTB") {
      await readContainer(ctx);
    } else if (id === "PRIM") {
      const meshId = await readPrimitiveChunk(ctx);
      if (meshId) meshIds.push(meshId);
    } else if (id === "COLR") {
      readColor(ctx);
    } else if (!id) {
      return; // unexpected EOF — be lenient
    } else {
      throw new Error(`[RVMLoader] unknown child chunk '${id}' inside CNTB at byte ${ctx.reader.offset - 16}`);
    }
  }
}

/**
 * PRIM payload (after id + preamble):
 *   - primitiveKind (uint32)
 *   - 12 floats — column-major 3x4 modelling matrix.
 *   - 6 floats — bounding box, discarded.
 *   - per-primitive payload, dispatched in `parsePrimitive`.
 *
 * AVEVA RVM exporters split into two camps on this matrix's units:
 *
 *   (a) **Unit-rotation form** — rotation columns at unit length,
 *       translation in millimetres. The pmuc-canonical layout, and
 *       what this SDK's own `RVMExporter` writes.
 *   (b) **Pre-scaled form** — rotation columns scaled by `0.001`, so
 *       the matrix itself converts millimetre-space geometry into
 *       world metres. Translation is already in metres. Common in
 *       real AVEVA PDMS / E3D exports.
 *
 * Both produce identical world positions, but the per-primitive
 * geometry built by `parsePrimitive` is always in metres — so we
 * normalise the matrix to a single internal form (pure rotation +
 * translation in metres) by sniffing the column-0 length.
 *
 * Returns the synthesised mesh id when geometry was created;
 * otherwise (Line, malformed FacetGroup, etc.) returns null.
 */
async function readPrimitiveChunk(ctx: WalkContext): Promise<string | null> {
  if ((ctx.primSinceYield++ & 0x7F) === 0) {
    ctx.emitProgress(ctx.meshIdSeq);
    await yieldToHost(ctx.signal);
  }
  ctx.reader.readChunkPreamble();
  const kind = ctx.reader.readUint32() as RVMPrimitive;
  ctx.primCounts[kind] = (ctx.primCounts[kind] ?? 0) + 1;

  // Modelling matrix — 12 floats column-major (3x4). See note above
  // on the two AVEVA conventions for unit handling.
  const m = ctx.reader.readFloat32Array(12);
  const colXLen = Math.hypot(m[0], m[1], m[2]) || 1;
  // Anything below 0.5 has to be the pre-scaled form — no real
  // exporter writes a 50%-scaled rotation, so the threshold is safe.
  const matrixCarriesScale = colXLen < 0.5;
  const rotInv     = matrixCarriesScale ? 1.0 / colXLen : 1.0;
  const transScale = matrixCarriesScale ? 1.0 : 0.001;

  const matrix: Mat4 = new Float64Array(16) as unknown as Mat4;
  matrix[0] = m[0] * rotInv; matrix[1] = m[1] * rotInv; matrix[2]  = m[2] * rotInv; matrix[3]  = 0;
  matrix[4] = m[3] * rotInv; matrix[5] = m[4] * rotInv; matrix[6]  = m[5] * rotInv; matrix[7]  = 0;
  matrix[8] = m[6] * rotInv; matrix[9] = m[7] * rotInv; matrix[10] = m[8] * rotInv; matrix[11] = 0;
  matrix[12]= m[9]  * transScale;
  matrix[13]= m[10] * transScale;
  matrix[14]= m[11] * transScale;
  matrix[15]= 1;

  ctx.reader.skip(6 * 4); // bbox (mins + maxes) — unused

  const geometryParams = parsePrimitive(ctx.reader, kind);
  if (!geometryParams) return null;

  geometryParams.id = `g${ctx.geometryIdSeq++}`;
  const gr = ctx.sceneModel.createGeometry(geometryParams);
  if (gr && gr.ok === false) {
    ctx.geomCreateFails++;
    if (ctx.geomCreateFails <= 3) console.warn("[RVMLoader] createGeometry failed:", gr.error);
    return null;
  }

  const meshId = `m${ctx.meshIdSeq++}`;
  const materialId = ctx.parentMaterialStack[ctx.parentMaterialStack.length - 1];
  const mr = ctx.sceneModel.createMesh({
    id: meshId,
    geometryId: geometryParams.id,
    matrix,
    color: colorForMaterialId(ctx, materialId)
  });
  if (mr && mr.ok === false) {
    ctx.meshCreateFails++;
    if (ctx.meshCreateFails <= 3) console.warn("[RVMLoader] createMesh failed:", mr.error);
    return null;
  }
  return meshId;
}

/**
 * COLR payload: preamble + uint32 index + uint32 packed RGBA. The
 * packed word is byte-order [R, G, B, A], each 0–255. Stored linear —
 * the renderer applies its own tonemap.
 */
function readColor(ctx: WalkContext): void {
  ctx.reader.readChunkPreamble();
  const index = ctx.reader.readUint32();
  const rgba  = ctx.reader.readUint32();
  const r = ((rgba >>> 24) & 0xff) / 255;
  const g = ((rgba >>> 16) & 0xff) / 255;
  const b = ((rgba >>> 8)  & 0xff) / 255;
  ctx.palette.set(index, [r, g, b] as Vec3);
}

/**
 * Resolves a CNTB materialId to a colour. Lookup order:
 *
 *   1. Palette entry from a COLR chunk — the "real" path when the
 *      writer emitted colours.
 *   2. Deterministic golden-angle hash — gives every distinct
 *      materialId a stable, distinguishable colour even when the
 *      file lacks COLR entries (common in pmuc-stripped exports).
 *   3. Renderer-default grey when materialId is 0 (= "no material").
 */
const DEFAULT_RVM_GREY: Vec3 = [0.7, 0.72, 0.78];
function colorForMaterialId(ctx: WalkContext, materialId: number): Vec3 {
  if (materialId === 0) return DEFAULT_RVM_GREY;
  const fromPalette = ctx.palette.get(materialId);
  if (fromPalette) return fromPalette;
  // Golden-angle hue spread keeps neighbouring ids visually distinct.
  const hue = (materialId * 0.6180339887) % 1;
  return hslToRgb(hue, 0.45, 0.6);
}

function hslToRgb(h: number, s: number, l: number): Vec3 {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h * 6;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if      (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else             { r = c; b = x; }
  const m = l - c / 2;
  return [r + m, g + m, b + m] as Vec3;
}

/**
 * Tolerantly reads a string — if the next uint32 looks like the start
 * of a chunk id ("MODL"-ish) we leave the cursor where it was. This
 * is only used for the optional 5th HEAD string ("encoding") that
 * older AVEVA writers omit.
 */
function tryReadString(reader: ChunkReader): void {
  const offsetBefore = reader.offset;
  const peek = reader.readUint32();
  // A chunk id's first uint32 is always the LSB-encoded char "M", "C",
  // "P", "E", or "C" — those are 0x4D, 0x43, 0x50, 0x45, 0x43. A string
  // word count is typically small (< 1024). If the value looks like an
  // ASCII char, it's a chunk id; rewind.
  if (peek > 0x20 && peek < 0x80) {
    reader.seek(offsetBefore);
    return;
  }
  // Otherwise treat it as a word count and consume that many bytes.
  reader.skip(peek * 4);
}
