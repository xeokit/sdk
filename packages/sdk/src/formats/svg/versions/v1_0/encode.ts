/**
 * Encodes a SceneModel as SVG text.
 *
 * The encoder walks every SceneObject → SceneMesh → SceneGeometry,
 * decompresses each geometry's quantised positions through its
 * AABB, bakes the mesh's world matrix (via `getMeshWorldMatrix`,
 * which composes parent-transform chains and the model's
 * coordinate-system transform), then projects each vertex onto the
 * configured 2D plane.
 *
 * Entity mapping:
 *  - `TrianglesPrimitive` / `SolidPrimitive` / `SurfacePrimitive`
 *    → one `<polygon>` per triangle, with the mesh's stroke + fill.
 *  - `LinesPrimitive` → one `<line>` per index pair, or a
 *    coalesced `<polyline>` per connected run when
 *    `coalescePolylines: true`.
 *  - `PointsPrimitive` → one `<circle r="1">` per vertex.
 *
 * Output structure:
 *
 *  ```xml
 *  <svg xmlns="..." viewBox="..." width="..." height="...">
 *    [optional <rect> background]
 *    <g stroke-linecap="round" stroke-linejoin="round">
 *      <g id="sceneObject1">
 *        <line ... />
 *        <polygon ... />
 *        ...
 *      </g>
 *      <g id="sceneObject2">
 *        ...
 *      </g>
 *    </g>
 *  </svg>
 *  ```
 *
 * Round-trippable through {@link SVGLoader} — `<line>`,
 * `<polyline>`, and `<polygon>` are all loader-recognised entity
 * types.
 */
import {
  LinesPrimitive,
  PointsPrimitive,
  SolidPrimitive,
  SurfacePrimitive,
  TrianglesPrimitive,
} from "../../../../base/constants";
import {createVec3Float64} from "../../../../base/math/vector";
import {transformPoint3} from "../../../../base/math/matrix";
import {decompressPoint3WithAABB3} from "../../../../base/math/compression";
import {getMeshWorldMatrix} from "../../../../model/scene";
import {yieldToHost} from "../../../../base/utils";
import type {LoaderProgress} from "../../../LoaderProgress";
import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import {DEFAULT_SVG_EXPORT_OPTIONS, type SVGExportOptions} from "../../SVGExportOptions";


const tempVec3a = createVec3Float64();
const tempVec3b = createVec3Float64();
const tempVec3c = createVec3Float64();


type RGB = [number, number, number];


/**
 * @private
 */
export async function encode(params: ModelEncodeParams, options?: SVGExportOptions): Promise<string> {

  const {sceneModel} = params;
  if (!sceneModel) throw new Error("[SVGExporter] sceneModel is required");

  const opts = {...DEFAULT_SVG_EXPORT_OPTIONS, ...(options || {})};
  const userOpts = (options || {}) as SVGExportOptions;
  const onProgress: ((p: LoaderProgress) => void) | undefined = (userOpts as any).onProgress;
  const signal: AbortSignal | undefined = (userOpts as any).signal;
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

  // ── Two-pass: first walk to compute AABB + buffer per-object
  //   element strings; then assemble the document so viewBox can
  //   be set from the AABB.
  const objectBlocks: string[] = [];          // one entry per emitted SceneObject
  // Running 2D AABB in projected-XY space (post-projection,
  // pre-flipY). Padded after the walk.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const project = pickProjector(opts.projectionPlane);

  const sceneObjects = Object.values(sceneModel.objects);
  for (let i = 0, len = sceneObjects.length; i < len; i++) {
    if ((i & 0x1F) === 0) await step("Encoding SVG", i, len);
    const sceneObject = sceneObjects[i];
    const meshes = sceneObject.meshes || [];
    if (meshes.length === 0) continue;

    const meshLines: string[] = [];
    for (const sceneMesh of meshes) {
      const geometry = sceneMesh.geometry;
      if (!geometry) continue;
      const positionsCompressed = geometry.positionsCompressed;
      const aabb = geometry.aabb;
      if (!positionsCompressed || positionsCompressed.length === 0 || !aabb) continue;

      const worldMatrix = getMeshWorldMatrix(sceneMesh);
      const indices = geometry.indices;
      const meshColor = pickColor(sceneMesh) ?? [0, 0, 0];

      // Resolve stroke / fill — option overrides win, then per-mesh.
      const strokeRgb = userOpts.strokeColor ?? meshColor;
      const fillRgb: RGB | "none" = userOpts.fillColor !== undefined
          ? userOpts.fillColor
          : meshColor;
      const stroke = rgbToCss(strokeRgb);
      const fill   = fillRgb === "none" ? "none" : rgbToCss(fillRgb);

      // Decompress + project every vertex once; downstream emitters
      // index into the `projected` array.
      const numVerts = (positionsCompressed.length / 3) | 0;
      const projected: number[] = new Array(numVerts * 2);
      for (let v = 0; v < numVerts; v++) {
        const o = v * 3;
        tempVec3a[0] = positionsCompressed[o];
        tempVec3a[1] = positionsCompressed[o + 1];
        tempVec3a[2] = positionsCompressed[o + 2];
        decompressPoint3WithAABB3(tempVec3a, aabb, tempVec3b);
        transformPoint3(worldMatrix, tempVec3b, tempVec3c);
        const x = tempVec3c[project.xAxis] * opts.scale;
        const y = tempVec3c[project.yAxis] * opts.scale;
        projected[v * 2]     = x;
        projected[v * 2 + 1] = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }

      const primitive = geometry.primitive;
      const isTri = primitive === TrianglesPrimitive
                 || primitive === SolidPrimitive
                 || primitive === SurfacePrimitive;
      const isLine = primitive === LinesPrimitive;
      const isPoint = primitive === PointsPrimitive;

      // Resolve stroke-width once per mesh.
      const mat = (sceneMesh as any).material;
      const matLineWidth = mat && typeof mat.lineWidth === "number" ? mat.lineWidth : undefined;
      const strokeWidth = (matLineWidth ?? opts.defaultStrokeWidth) * opts.strokeWidthScale;
      const swAttr = `stroke-width="${num(strokeWidth)}"`;

      // ── TRIANGLES → <polygon> ───────────────────────────────────
      if (isTri && indices && indices.length >= 3) {
        const fillAttr   = fill === "none" ? `fill="none"` : `fill="${fill}"`;
        const strokeAttr = `stroke="${stroke}"`;
        for (let k = 0; k < indices.length; k += 3) {
          const a = indices[k]     | 0;
          const b = indices[k + 1] | 0;
          const c = indices[k + 2] | 0;
          const pts =
            `${num(projected[a * 2])},${num(projected[a * 2 + 1])} ` +
            `${num(projected[b * 2])},${num(projected[b * 2 + 1])} ` +
            `${num(projected[c * 2])},${num(projected[c * 2 + 1])}`;
          meshLines.push(`<polygon points="${pts}" ${fillAttr} ${strokeAttr} ${swAttr}/>`);
        }
        continue;
      }

      // ── LINES → <line> (or coalesced <polyline>) ────────────────
      if (isLine && indices && indices.length >= 2) {
        const strokeAttr = `stroke="${stroke}"`;
        const fillAttr   = `fill="none"`;
        if (opts.coalescePolylines) {
          const polylines = coalesceSegments(indices, projected);
          for (const poly of polylines) {
            if (poly.length === 2) {
              meshLines.push(
                `<line x1="${num(poly[0][0])}" y1="${num(poly[0][1])}" ` +
                `x2="${num(poly[1][0])}" y2="${num(poly[1][1])}" ` +
                `${strokeAttr} ${fillAttr} ${swAttr}/>`,
              );
            } else {
              const pts = poly.map((p) => `${num(p[0])},${num(p[1])}`).join(" ");
              meshLines.push(`<polyline points="${pts}" ${strokeAttr} ${fillAttr} ${swAttr}/>`);
            }
          }
        } else {
          for (let k = 0; k < indices.length; k += 2) {
            const a = indices[k]     | 0;
            const b = indices[k + 1] | 0;
            meshLines.push(
              `<line x1="${num(projected[a * 2])}" y1="${num(projected[a * 2 + 1])}" ` +
              `x2="${num(projected[b * 2])}" y2="${num(projected[b * 2 + 1])}" ` +
              `${strokeAttr} ${fillAttr} ${swAttr}/>`,
            );
          }
        }
        continue;
      }

      // ── POINTS → <circle r="1"> ─────────────────────────────────
      if (isPoint) {
        const fillAttr = `fill="${stroke}"`;
        for (let v = 0; v < numVerts; v++) {
          meshLines.push(
            `<circle cx="${num(projected[v * 2])}" cy="${num(projected[v * 2 + 1])}" ` +
            `r="${num(strokeWidth)}" ${fillAttr}/>`,
          );
        }
        continue;
      }
      // Other primitive types: silently skipped.
    }

    if (meshLines.length === 0) continue;
    const objectId = xmlAttr(sceneObject.id);
    objectBlocks.push(`<g id="${objectId}">\n  ${meshLines.join("\n  ")}\n</g>`);
  }

  await step("Encoding SVG", sceneObjects.length, sceneObjects.length);

  // Empty model → still emit a well-formed (empty) SVG.
  if (!isFinite(minX)) {
    minX = 0; minY = 0; maxX = 0; maxY = 0;
  }

  // ── Apply padding + Y-flip to derive viewBox ───────────────────
  // In projected coordinates `y` increases in the source plane's
  // direction. flipY negates Y on every emitted element so world +Y
  // ends up at SVG top. Doing the flip via viewBox alone wouldn't
  // suffice: SVG viewBox doesn't support negative scale, so we
  // rewrite Y values during emission OR translate after the fact.
  // The cleanest path is to rewrite Y here (post-walk) by
  // string-replacement — but that's brittle. Instead we wrap the
  // geometry in a `<g transform="scale(1,-1)">` and shift viewBox
  // to match.
  const pad = opts.padding;
  const vbX = minX - pad;
  const vbW = (maxX - minX) + 2 * pad;
  const vbY = opts.flipY ? -(maxY + pad) : (minY - pad);
  const vbH = (maxY - minY) + 2 * pad;

  const width  = userOpts.width  ?? vbW;
  const height = userOpts.height ?? vbH;

  const bg = userOpts.backgroundColor
    ? `<rect x="${num(vbX)}" y="${num(vbY)}" width="${num(vbW)}" height="${num(vbH)}" fill="${rgbToCss(userOpts.backgroundColor)}"/>\n`
    : "";

  const rootGAttrs = opts.roundJoins
    ? `stroke-linecap="round" stroke-linejoin="round" `
    : "";
  const flipTransform = opts.flipY ? `transform="scale(1,-1)" ` : "";

  const head =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="${num(vbX)} ${num(vbY)} ${num(vbW)} ${num(vbH)}" ` +
    `width="${width}" height="${height}">\n`;
  const body = `${bg}<g ${rootGAttrs}${flipTransform}>\n${objectBlocks.join("\n")}\n</g>\n`;
  const tail = `</svg>\n`;
  return head + body + tail;
}


// ─── helpers ───────────────────────────────────────────────────────

interface Projector { xAxis: 0 | 1 | 2; yAxis: 0 | 1 | 2 }

function pickProjector(plane: "XY" | "XZ" | "YZ"): Projector {
  switch (plane) {
    case "XZ": return {xAxis: 0, yAxis: 2};
    case "YZ": return {xAxis: 1, yAxis: 2};
    case "XY":
    default:   return {xAxis: 0, yAxis: 1};
  }
}

function pickColor(sceneMesh: any): RGB | null {
  if (sceneMesh.color && sceneMesh.color.length >= 3) {
    return [sceneMesh.color[0], sceneMesh.color[1], sceneMesh.color[2]];
  }
  const mat = sceneMesh.material;
  if (mat && mat.color && mat.color.length >= 3) {
    return [mat.color[0], mat.color[1], mat.color[2]];
  }
  return null;
}

function rgbToCss(c: RGB): string {
  const r = Math.max(0, Math.min(255, Math.round(c[0] * 255)));
  const g = Math.max(0, Math.min(255, Math.round(c[1] * 255)));
  const b = Math.max(0, Math.min(255, Math.round(c[2] * 255)));
  return `rgb(${r},${g},${b})`;
}

function num(v: number): string {
  if (!isFinite(v)) return "0";
  return Number(v.toFixed(4)).toString();
}

/**
 * Escapes an SceneObject id for safe inclusion as an XML attribute
 * value — replaces the five XML-special characters. Used only for
 * the `id` attribute on per-object `<g>` wrappers.
 */
function xmlAttr(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}


/**
 * Greedy coalescing of paired-line indices into runs of connected
 * polyline points. Each input pair `(indices[k], indices[k+1])` is
 * a 2-vertex line segment in `projected` (which stores `[x0, y0,
 * x1, y1, ...]` per vertex index).
 *
 * Walks segments in order; when a segment's start coincides with
 * the previous run's end (within `eps`), it extends the run.
 * Otherwise it starts a new run. Result: an array of polylines,
 * each a list of `[x, y]` pairs.
 *
 * This is the simplest version — doesn't try every reordering /
 * pairing, just respects source order. For most SDK-generated line
 * batches (e.g. wall-segment runs from a CAD import) source order
 * already follows the natural connectivity.
 */
function coalesceSegments(
  indices: ArrayLike<number>, projected: number[],
): [number, number][][] {
  const eps = 1e-6;
  const out: [number, number][][] = [];
  let current: [number, number][] | null = null;
  let lastIdx = -1;
  for (let k = 0; k < indices.length; k += 2) {
    const a = indices[k]     | 0;
    const b = indices[k + 1] | 0;
    const ax = projected[a * 2],     ay = projected[a * 2 + 1];
    const bx = projected[b * 2],     by = projected[b * 2 + 1];
    if (current && lastIdx === a) {
      current.push([bx, by]);
    } else if (current && lastIdx >= 0
            && Math.abs(projected[lastIdx * 2]     - ax) < eps
            && Math.abs(projected[lastIdx * 2 + 1] - ay) < eps) {
      current.push([bx, by]);
    } else {
      if (current) out.push(current);
      current = [[ax, ay], [bx, by]];
    }
    lastIdx = b;
  }
  if (current) out.push(current);
  return out;
}
