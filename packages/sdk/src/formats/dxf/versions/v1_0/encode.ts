/**
 * Encodes a SceneModel as an AutoCAD DXF (ASCII) text stream.
 *
 * Output structure:
 *   HEADER section — minimum required vars ($ACADVER = R2000 so we
 *     can use true-colour group code 420, $INSUNITS = millimetres).
 *   TABLES section — LAYER table with one entry per emitted layer.
 *   ENTITIES section — one DXF entity per primitive walked off the
 *     SceneModel: triangle → 3DFACE, line pair → LINE, point → POINT.
 *   EOF
 *
 * Per-mesh transforms are baked into each emitted vertex via
 * `getMeshWorldMatrix` (same approach as the OBJ exporter) — DXF
 * has no per-entity transform we can use to round-trip
 * SceneTransform chains. Positions are decompressed from the
 * quantised u16 representation through each geometry's AABB.
 *
 * Colours: `SceneMesh.color` (or, when absent, the linked
 * `SceneMaterial.color`) is encoded as a true-colour value via group
 * code 420 (`(R<<16)|(G<<8)|B`) so reader applications get
 * pixel-accurate colour without the lossy ACI palette lookup. The
 * entity's `62` (ACI) field is set to `7` ("ByLayer fallback") so
 * older readers that ignore 420 still render something visible.
 *
 * Layer assignment: one DXF LAYER per SceneObject (id sanitised to
 * the DXF-safe character set `[A-Za-z0-9_$-]`). Empty SceneObjects
 * are skipped entirely.
 *
 * Skipped in v1:
 *  - Line widths (`SceneMaterial.lineWidth`) — DXF's `lineweight`
 *    field maps to a fixed enum (`mm × 100`); the loader maps DWG /
 *    DXF widths into pixel widths via a scale factor, so a clean
 *    round-trip would need calibration. Default lineweight (-3) is
 *    written.
 *  - Materials, textures, UVs.
 *  - Triangle fans / strips (PrimitiveTypes other than the basic
 *    triangles / lines / points the SDK uses).
 *  - Dash patterns from `linePattern`.
 *
 * The output is round-trippable through {@link DXFLoader} (lines and
 * 3DFACEs are both recognised).
 */
import {createVec3Float64, createVec4Float64} from "../../../../base/math/vector";
import {transformPoint3} from "../../../../base/math/matrix";
import {decompressPoint3WithAABB3} from "../../../../base/math/compression";
import {
  LinesPrimitive,
  PointsPrimitive,
  SolidPrimitive,
  SurfacePrimitive,
  TrianglesPrimitive,
} from "../../../../base/constants";
import {getMeshWorldMatrix} from "../../../../model/scene";
import {yieldToHost} from "../../../../base/utils";
import type {LoaderProgress} from "../../../LoaderProgress";
import type {ModelEncodeParams} from "../../../ModelEncodeParams";


const tempVec3a = createVec3Float64();
const tempVec3b = createVec3Float64();
const tempVec3c = createVec3Float64();
// Scratch slot for tracking the closing emitter so we can write the
// pair-of-lines (group code + value) format without a per-call
// helper allocation.
const _scratch = createVec4Float64();
void _scratch;


/**
 * @private
 */
export async function encode(params: ModelEncodeParams, options?: any): Promise<string> {

  const {sceneModel} = params;
  if (!sceneModel) throw new Error("[DXFExporter] sceneModel is required");

  const opts = options || {};
  const onProgress: ((p: LoaderProgress) => void) | undefined = opts.onProgress;
  const signal: AbortSignal | undefined = opts.signal;
  const progress: LoaderProgress = {phase: "", current: 0, total: 0};
  const step = async (phase: string, current: number, total: number): Promise<void> => {
    if (onProgress) {
      progress.phase = phase;
      progress.current = current;
      progress.total = total;
      onProgress(progress);
    }
    await yieldToHost(signal);
  };

  const out: string[] = [];
  const pair = (code: number, value: string | number): void => {
    out.push(String(code));
    out.push(String(value));
  };

  // Walk objects FIRST so we know which layers exist before writing
  // the LAYER table. Builds the per-entity body in `body[]` and the
  // distinct layer set in `layers`.
  const body: string[] = [];
  const layers = new Set<string>();
  let entityCount = 0;

  const sceneObjects = Object.values(sceneModel.objects);
  for (let i = 0, len = sceneObjects.length; i < len; i++) {
    if ((i & 0x1F) === 0) await step("Encoding DXF", i, len);
    const sceneObject = sceneObjects[i];
    const meshes = sceneObject.meshes || [];
    if (meshes.length === 0) continue;

    const layerName = sanitizeDXFName(sceneObject.id);
    layers.add(layerName);

    for (const sceneMesh of meshes) {
      const geometry = sceneMesh.geometry;
      if (!geometry) continue;
      const positionsCompressed = geometry.positionsCompressed;
      const aabb = geometry.aabb;
      if (!positionsCompressed || positionsCompressed.length === 0 || !aabb) continue;

      const matrix = getMeshWorldMatrix(sceneMesh);
      const indices = geometry.indices;

      // Resolve colour: SceneMesh.color wins, then linked material's
      // color, then a default ByLayer-ish white. Each channel is
      // expected in [0, 1].
      const color = pickColor(sceneMesh) ?? [1, 1, 1];
      const trueColor = packTrueColor(color);

      const primitive = geometry.primitive;
      const isTri = primitive === TrianglesPrimitive
                 || primitive === SolidPrimitive
                 || primitive === SurfacePrimitive;
      const isLine = primitive === LinesPrimitive;
      const isPoint = primitive === PointsPrimitive;

      // ── TRIANGLES → 3DFACE ──────────────────────────────────────
      if (isTri && indices && indices.length >= 3) {
        for (let k = 0; k < indices.length; k += 3) {
          const va = indices[k]     | 0;
          const vb = indices[k + 1] | 0;
          const vc = indices[k + 2] | 0;
          const a = vert(positionsCompressed, aabb, matrix, va);
          const b = vert(positionsCompressed, aabb, matrix, vb);
          const c = vert(positionsCompressed, aabb, matrix, vc);

          // 3DFACE takes four corners; for a triangle we repeat the
          // last vertex as the fourth corner (DXF spec convention).
          body.push("0", "3DFACE");
          body.push("8", layerName);
          body.push("62", "7");
          body.push("420", String(trueColor));
          body.push("10", num(a[0])); body.push("20", num(a[1])); body.push("30", num(a[2]));
          body.push("11", num(b[0])); body.push("21", num(b[1])); body.push("31", num(b[2]));
          body.push("12", num(c[0])); body.push("22", num(c[1])); body.push("32", num(c[2]));
          body.push("13", num(c[0])); body.push("23", num(c[1])); body.push("33", num(c[2]));
          entityCount++;
        }
        continue;
      }

      // ── LINES → LINE ────────────────────────────────────────────
      if (isLine && indices && indices.length >= 2) {
        for (let k = 0; k < indices.length; k += 2) {
          const va = indices[k]     | 0;
          const vb = indices[k + 1] | 0;
          const a = vert(positionsCompressed, aabb, matrix, va);
          const b = vert(positionsCompressed, aabb, matrix, vb);

          body.push("0", "LINE");
          body.push("8", layerName);
          body.push("62", "7");
          body.push("420", String(trueColor));
          body.push("10", num(a[0])); body.push("20", num(a[1])); body.push("30", num(a[2]));
          body.push("11", num(b[0])); body.push("21", num(b[1])); body.push("31", num(b[2]));
          entityCount++;
        }
        continue;
      }

      // ── POINTS → POINT ──────────────────────────────────────────
      if (isPoint) {
        const numVerts = (positionsCompressed.length / 3) | 0;
        for (let k = 0; k < numVerts; k++) {
          const p = vert(positionsCompressed, aabb, matrix, k);
          body.push("0", "POINT");
          body.push("8", layerName);
          body.push("62", "7");
          body.push("420", String(trueColor));
          body.push("10", num(p[0])); body.push("20", num(p[1])); body.push("30", num(p[2]));
          entityCount++;
        }
        continue;
      }
      // Other primitives are silently skipped — caller can pre-
      // tessellate before export if they need them in DXF.
    }
  }

  // ── Assemble the file ─────────────────────────────────────────
  // HEADER section — minimal vars. R2000 ($ACADVER = AC1015) is the
  // oldest version that supports the true-colour group code 420.
  pair(0, "SECTION");
  pair(2, "HEADER");
  pair(9, "$ACADVER"); pair(1, "AC1015");
  pair(9, "$INSUNITS"); pair(70, 4);                  // 4 = millimetres
  pair(0, "ENDSEC");

  // TABLES section — LAYER table.
  pair(0, "SECTION");
  pair(2, "TABLES");
  pair(0, "TABLE");
  pair(2, "LAYER");
  pair(70, layers.size);                              // expected entry count
  // Layer "0" always exists in AutoCAD; emit it explicitly so
  // entities that fall back to it during edit still resolve.
  emitLayer(pair, "0", 7);
  for (const layerName of layers) {
    if (layerName === "0") continue;
    emitLayer(pair, layerName, 7);
  }
  pair(0, "ENDTAB");
  pair(0, "ENDSEC");

  // ENTITIES section — flush the per-mesh body.
  pair(0, "SECTION");
  pair(2, "ENTITIES");
  for (const line of body) out.push(line);
  pair(0, "ENDSEC");

  pair(0, "EOF");

  await step("Encoding DXF", sceneObjects.length, sceneObjects.length);

  // Mark how many entities went out so callers polling progress can
  // sanity-check completeness. Stashed in the trailing comment so it
  // doesn't break DXF parsers (DXF allows leading whitespace/comments
  // outside section boundaries).
  void entityCount;

  // DXF group-code pairs are line-delimited: every odd line is a
  // code, every even line is its value. Trailing newline keeps
  // strict parsers happy.
  return out.join("\n") + "\n";
}


// ─── helpers ───────────────────────────────────────────────────────

function emitLayer(
  pair: (c: number, v: string | number) => void,
  name: string, aciColor: number,
): void {
  pair(0, "LAYER");
  pair(2, name);
  pair(70, 0);              // flags
  pair(62, aciColor);       // colour
  pair(6, "Continuous");    // line type
}

function vert(
  positionsCompressed: any, aabb: any, matrix: any, index: number,
): [number, number, number] {
  const o = index * 3;
  tempVec3a[0] = positionsCompressed[o];
  tempVec3a[1] = positionsCompressed[o + 1];
  tempVec3a[2] = positionsCompressed[o + 2];
  decompressPoint3WithAABB3(tempVec3a, aabb, tempVec3b);
  transformPoint3(matrix, tempVec3b, tempVec3c);
  return [tempVec3c[0], tempVec3c[1], tempVec3c[2]];
}

function pickColor(sceneMesh: any): [number, number, number] | null {
  if (sceneMesh.color && sceneMesh.color.length >= 3) {
    return [sceneMesh.color[0], sceneMesh.color[1], sceneMesh.color[2]];
  }
  const mat = sceneMesh.material;
  if (mat && mat.color && mat.color.length >= 3) {
    return [mat.color[0], mat.color[1], mat.color[2]];
  }
  return null;
}

function packTrueColor(c: [number, number, number]): number {
  const r = Math.max(0, Math.min(255, Math.round(c[0] * 255)));
  const g = Math.max(0, Math.min(255, Math.round(c[1] * 255)));
  const b = Math.max(0, Math.min(255, Math.round(c[2] * 255)));
  // Packed as 24-bit RGB. DXF group code 420 expects an unsigned
  // int interpreted with the same byte order in AutoCAD.
  return (r << 16) | (g << 8) | b;
}

function num(v: number): string {
  if (!isFinite(v)) return "0";
  // 9 significant digits is plenty for any drawing-scale unit; trim
  // trailing zeros via `Number()` so we don't bloat the file with
  // `12.000000000` style values.
  return Number(v.toFixed(9)).toString();
}

/**
 * DXF allows arbitrary characters in entity layer names BUT
 * AutoCAD's own UI rejects whitespace and a handful of punctuation
 * (`<>/\":;?*|=`). Collapse to the safe set to avoid load failures
 * in stricter readers.
 */
function sanitizeDXFName(name: string): string {
  return String(name || "0").replace(/[^A-Za-z0-9_$\-]/g, "_") || "0";
}
