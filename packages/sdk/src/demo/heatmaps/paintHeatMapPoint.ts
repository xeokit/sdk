/**
 * Paints a brush of texels on a SceneMesh's heat-map texture, given a
 * world-space point. The point is mapped through the mesh's inverse
 * world matrix to local space, planar-projected onto the same UV axes
 * the heat-map painter chose, and rasterised as a circular brush over
 * the colour texture's `imageData`.
 *
 * Mutates `texture.imageData.data` in place, then reassigns
 * `texture.imageData = imageData` so the SceneTexture setter fires
 * `onSceneTextureImageDataChanged` — the renderer's atlas re-uploads
 * the affected sub-rect via `texSubImage2D`, no batch / mesh / material
 * rebuild needed.
 */

import {SDKErrorType, type SDKResult} from "../../core";
import {inverseMat4, transformPoint3} from "../../math/matrix";
import type {Vec3} from "../../math/vector";
import type {PaintHeatMapPointParams} from "./PaintHeatMapPointParams";
import type {PaintHeatMapPointResult} from "./PaintHeatMapPointResult";


/**
 * Paint a brush of texels on a SceneMesh's heat-map colour texture,
 * keyed by a world-space point.
 *
 * Pipeline:
 *
 *   1. Resolve the colour `SceneTexture` from `sceneMesh.material`.
 *      The mesh must have a material with a colour texture whose
 *      `imageData` is set (i.e. one painted by `paintHeatMap` or any
 *      raw-pixel SceneTexture).
 *   2. Invert `sceneMesh.worldMatrix` to map `worldPos` into the
 *      geometry's local frame — the same frame the geometry's
 *      `aabb` and `positionsCompressed` live in.
 *   3. Pick the same planar UV axes the painter chose (worldUp +
 *      smallest-extent heuristic), and convert the local point's
 *      coordinates on those axes into a `[0, 1]² ` UV.
 *   4. Scale the UV to texel coordinates.
 *   5. Walk a circular brush of radius `radius` centred on the texel,
 *      computing a radial weight per pixel and alpha-blending the
 *      brush colour over the existing texel.
 *
 * Symmetry note: the projection here mirrors `paintHeatMap`'s
 * algorithm exactly (factored into the same `pickAxes` shape). If
 * `paintHeatMap`'s heuristic ever changes, this function must be
 * updated alongside.
 */
export function paintHeatMapPoint(
  params: PaintHeatMapPointParams
): SDKResult<PaintHeatMapPointResult> {
  const mesh = params.sceneMesh;
  const radius   = Math.max(0, params.radius   ?? 4);
  const opacity  = clamp01(params.opacity  ?? 1);
  const falloff  = Math.max(0, params.falloff  ?? 1);

  if (!mesh) {
    return errInvalid("[paintHeatMapPoint] sceneMesh is required");
  }
  if (mesh.destroyed) {
    return errInvalid(`[paintHeatMapPoint] SceneMesh '${mesh.id}' is destroyed`);
  }
  const material = mesh.material;
  if (!material) {
    return errInvalid(`[paintHeatMapPoint] SceneMesh '${mesh.id}' has no material — heat-map texels live on the material's colour texture`);
  }
  const texture = material.colorTexture;
  if (!texture) {
    return errInvalid(`[paintHeatMapPoint] SceneMaterial '${material.id}' has no colorTexture`);
  }
  const imageData = texture.imageData;
  if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
    return errInvalid(`[paintHeatMapPoint] SceneTexture '${texture.id}' has no mutable imageData (likely sourced from an encoded buffer or remote URL)`);
  }
  const data = imageData.data;
  const tw = imageData.width;
  const th = imageData.height;

  // ── 1. World → local ────────────────────────────────────────────
  // mesh.worldMatrix is local→world; we need the inverse to bring
  // worldPos into the geometry's local frame.
  const inv = inverseMat4(mesh.worldMatrix as any) as any;
  const worldP: Vec3 = [params.worldPos[0], params.worldPos[1], params.worldPos[2]] as any;
  const localP: Vec3 = [0, 0, 0] as any;
  transformPoint3(inv, worldP, localP);

  // ── 2. Pick UV axes ─────────────────────────────────────────────
  // Same heuristic as paintHeatMap.
  const aabb = mesh.geometry.aabb;
  const exts: [number, number, number] = [
    aabb[3] - aabb[0],
    aabb[4] - aabb[1],
    aabb[5] - aabb[2],
  ];
  let smallestAxis = 0;
  if (exts[1] < exts[smallestAxis]) smallestAxis = 1;
  if (exts[2] < exts[smallestAxis]) smallestAxis = 2;

  const worldUp = params.worldUp
    ?? mesh.model.coordinateSystem?.worldUp
    ?? [0, 0, 1];
  let upAxis = -1;
  {
    const ax = Math.abs(worldUp[0]);
    const ay = Math.abs(worldUp[1]);
    const az = Math.abs(worldUp[2]);
    if (ax >= ay && ax >= az)      upAxis = 0;
    else if (ay >= az)              upAxis = 1;
    else                            upAxis = 2;
  }

  let axisU: number, axisV: number;
  if (upAxis >= 0 && upAxis !== smallestAxis) {
    axisV = upAxis;
    const o0 = (upAxis + 1) % 3;
    const o1 = (upAxis + 2) % 3;
    axisU = exts[o0] >= exts[o1] ? o0 : o1;
  } else {
    axisU = (smallestAxis + 1) % 3;
    axisV = (smallestAxis + 2) % 3;
  }

  // ── 3. Local-XYZ → UV in [0, 1] ─────────────────────────────────
  // The point is allowed to fall outside [0,1] (e.g. user clicked
  // beyond the geometry's AABB on the projection axes); the brush
  // bbox below clips against the texture.
  const minU = aabb[axisU];
  const minV = aabb[axisV];
  const rangeU = exts[axisU];
  const rangeV = exts[axisV];
  const u = rangeU > 0 ? (localP[axisU] - minU) / rangeU : 0;
  const v = rangeV > 0 ? (localP[axisV] - minV) / rangeV : 0;

  // ── 4. UV → texel ──────────────────────────────────────────────
  const cx = Math.round(u * (tw - 1));
  const cy = Math.round(v * (th - 1));

  // ── 5. Brush splat ─────────────────────────────────────────────
  const brushR = Math.round(clamp01(params.color[0]) * 255);
  const brushG = Math.round(clamp01(params.color[1]) * 255);
  const brushB = Math.round(clamp01(params.color[2]) * 255);

  const x0 = Math.max(0,      cx - radius);
  const x1 = Math.min(tw - 1, cx + radius);
  const y0 = Math.max(0,      cy - radius);
  const y1 = Math.min(th - 1, cy + radius);

  const r2 = radius * radius;
  const rDenom = radius > 0 ? radius : 1;

  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dist2 = dx * dx + dy * dy;
      if (radius > 0 && dist2 > r2) continue;

      // Radial weight ∈ [0, 1]; falloff=0 ⇒ hard disc.
      const dist = Math.sqrt(dist2);
      const t = 1 - dist / rDenom;
      const weight = falloff <= 0 ? 1 : Math.pow(t < 0 ? 0 : t, falloff);
      const a = clamp01(weight * opacity);
      if (a <= 0) continue;

      const i = (y * tw + x) * 4;
      const oneMinusA = 1 - a;
      data[i]     = (data[i]     * oneMinusA + brushR * a) | 0;
      data[i + 1] = (data[i + 1] * oneMinusA + brushG * a) | 0;
      data[i + 2] = (data[i + 2] * oneMinusA + brushB * a) | 0;
    }
  }

  // Re-trigger the SceneTexture's setter so the renderer's atlas
  // re-uploads the affected sub-rect via texSubImage2D.
  if (x1 >= x0 && y1 >= y0) {
    texture.imageData = imageData;
  }

  return {
    ok: true,
    value: {
      texture,
      centerTexel: [cx, cy],
      bounds: [x0, y0, x1, y1],
    },
  };
}


function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function errInvalid<T>(message: string): SDKResult<T> {
  return {ok: false, type: SDKErrorType.InvalidOperation, error: message};
}
