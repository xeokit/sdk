import type {SceneGeometry, SceneModel} from "@xeokit/sdk/model/scene";
import {SDKErrorType, type SDKResult} from "@xeokit/sdk/base/core";
import {
  LinearEncoding,
  LinearFilter,
  SolidPrimitive,
  SurfacePrimitive,
  TrianglesPrimitive,
  sRGBEncoding,
} from "@xeokit/sdk/base/constants";
import {
  DEFAULT_HEATMAP_RAMP,
  paintHeatMap,
} from "@xeokit/sdk/model/generation/paintMaterials";

import type {ApplyHeatMapMaterialsParams} from "./ApplyHeatMapMaterialsParams";
import {ensureGeometryAttribs} from "@xeokit/sdk/model/scene/ensureGeometryAttribs";


/**
 * Paint per-geometry heat maps onto `params.sceneModel` and reskin
 * its objects to display them.
 *
 * For each triangle geometry the function:
 *
 *   1. Resolves the scalar field via `params.scalars` (default:
 *      world-up elevation).
 *   2. Calls the heat-map painter to rasterise the field into a
 *      colour map and produce matching UVs.
 *   3. Writes the painted `uvsCompressed` back onto the
 *      `SceneGeometry`.
 *   4. Creates the three `SceneTexture`s (colour, normal, mr) and a
 *      `SceneMaterial` on the `SceneModel`, namespaced by geometry
 *      id.
 *
 * Then walks `sceneModel.objects` and, for each `SceneObject`,
 * snapshots + destroys + recreates the object's meshes bound to
 * their geometry's heat-map material. Mesh transforms / opacity /
 * parent-transform bindings are preserved.
 *
 * Limitations:
 *
 *   - Only triangle geometries are painted (`TrianglesPrimitive`,
 *     `SolidPrimitive`, `SurfacePrimitive`); points and lines are
 *     skipped (their meshes keep their original material).
 *   - Geometries shared across multiple meshes display the same heat
 *     map on every instance — UVs are stored on the geometry, so
 *     the scalar field has to be a property of the geometry, not
 *     the mesh.
 *   - Geometries without indices or with empty AABBs are skipped.
 */
export function applyHeatMapMaterials(params: ApplyHeatMapMaterialsParams): SDKResult<void> {

  const sceneModel   = params.sceneModel;
  const textureSize  = params.textureSize ?? 512;
  const ramp         = params.ramp        ?? DEFAULT_HEATMAP_RAMP;
  const roughness    = params.roughness   ?? 0.6;
  const metallic     = params.metallic    ?? 0.0;
  const bg           = params.backgroundColor ?? [0, 0, 0];
  const opacityFloor = Math.max(0, Math.min(1, params.transparentOpacityFloor ?? 0.5));


  // ── Pre-pass: capture each geometry's existing transparency ─────
  //
  // From the first mesh that references it. Heat maps are
  // per-geometry, so we can only honour one opacity per shared
  // geometry; first-wins is a fine convention for IFC (windows of
  // the same geometry share the same opacity anyway).

  const ALPHA_MODES = ["OPAQUE", "MASK", "BLEND"] as const;
  type AlphaModeStr = typeof ALPHA_MODES[number];

  const matInfoByGeomId: Record<string, {opacity: number, alphaMode: AlphaModeStr}> = {};
  for (const objId in sceneModel.objects) {
    const obj = sceneModel.objects[objId];
    for (const m of obj.meshes) {
      if (matInfoByGeomId[m.geometryId]) {
        continue;
      }
      if (m.material) {
        matInfoByGeomId[m.geometryId] = {
          opacity:   m.material.opacity,
          alphaMode: ALPHA_MODES[m.material.alphaMode as number] ?? "OPAQUE",
        };
      }
    }
  }


  const worldUp: ArrayLike<number> = sceneModel.coordinateSystem
    ? sceneModel.coordinateSystem.worldUp
    : [0, 0, 1];

  // Pick the world-up axis index once — the default scalar field
  // uses it as the elevation axis.
  const wuAx = pickAxis(worldUp);

  const scalarsFn = params.scalars ?? ((geom) => defaultElevationScalars(geom, wuAx));


  // ── 1. Compute scalars per geometry, decide global range ────────
  //
  // First pass: enumerate paintable geometries, compute their scalar
  // arrays. Cached so the second (paint) pass doesn't recompute.

  const paintable: Array<{geom: SceneGeometry, scalars: ArrayLike<number>}> = [];
  for (const id in sceneModel.geometries) {
    const geom = sceneModel.geometries[id];
    if (!isTriangleGeom(geom)) {
      continue;
    }
    if (!geom.aabb || !geom.positionsCompressed || !geom.indices) {
      continue;
    }

    const scalars  = scalarsFn(geom);
    const expected = (geom.positionsCompressed.length / 3) | 0;
    if (!scalars || scalars.length !== expected) {
      // Caller's scalar function returned the wrong shape — surface
      // as an error so it's not silently ignored.
      return {
        ok:    false,
        type:  SDKErrorType.InvalidOperation,
        error: `[applyHeatMapMaterials] scalars(geometry '${geom.id}') returned length ${scalars ? scalars.length : "n/a"}; expected ${expected}`,
      };
    }
    paintable.push({geom, scalars});
  }

  let globalRange: [number, number] | undefined;
  if (Array.isArray(params.range)) {
    globalRange = [params.range[0], params.range[1]];
  } else if (params.range !== "perGeometry") {
    // Default: union range across every paintable geometry.
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const {scalars} of paintable) {
      for (let i = 0; i < scalars.length; i++) {
        const v = scalars[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    globalRange = isFinite(lo) && isFinite(hi) ? [lo, hi] : [0, 1];
  }


  // ── 2. Paint each geometry, write UVs, create textures + material ─

  const materialIdByGeometryId: Record<string, string> = {};
  // Maps the source geometry id to the id of the sibling
  // SceneGeometry that carries the painted UVs (and synthesised
  // smooth normals when the source had none). The reskin pass
  // below routes recreated meshes onto the sibling rather than
  // mutating the source — keeps SceneGeometry immutable
  // post-construction and leaves the source available for any mesh
  // that wasn't part of this paint pass.
  const replacementGeomIdByGeometryId: Record<string, string> = {};
  const preserveUvs = !!params.preserveExistingUvs;

  for (const {geom, scalars} of paintable) {

    const existingUvs = (preserveUvs && geom.uvsCompressed && geom.uvsCompressed.length > 0)
      ? geom.uvsCompressed
      : undefined;

    const result = paintHeatMap(
      {
        positionsCompressed: geom.positionsCompressed,
        indices:             geom.indices!,
        aabb:                geom.aabb,
        scalars,
        uvs:                 existingUvs,
      },
      {
        size:            textureSize,
        ramp,
        range:           globalRange,
        worldUp,
        roughness,
        metallic,
        backgroundColor: bg,
        grid:            params.grid,
      },
    );

    // Build a sibling SceneGeometry that carries the painted UVs
    // (and synthesised smooth normals when missing). The original
    // is left intact. `result.uvs` is already a `Float32Array` in
    // the layout `SceneGeometry.uvsCompressed` expects, so the
    // helper just stores it.
    const siblingRes = ensureGeometryAttribs(sceneModel, geom.id, {
      uvs: result.uvs,
      cloneIdSuffix: "__heat",
    });
    if (siblingRes.ok === false) {
      return {
        ok:    false,
        type:  SDKErrorType.InvalidOperation,
        error: `[applyHeatMapMaterials] ensureGeometryAttribs(${geom.id}) failed: ${siblingRes.error}`,
      };
    }
    replacementGeomIdByGeometryId[geom.id] = siblingRes.value;

    const matId = `_heat_mat_${geom.id}`;
    const cTex  = `_heat_${geom.id}_color`;
    const nTex  = `_heat_${geom.id}_normal`;
    const mTex  = `_heat_${geom.id}_mr`;

    const cR = sceneModel.createTexture({id: cTex, imageData: result.maps.color,  encoding: sRGBEncoding,   minFilter: LinearFilter, flipY: false});
    const nR = sceneModel.createTexture({id: nTex, imageData: result.maps.normal, encoding: LinearEncoding, minFilter: LinearFilter, flipY: false});
    const mR = sceneModel.createTexture({id: mTex, imageData: result.maps.mr,     encoding: LinearEncoding, minFilter: LinearFilter, flipY: false});

    if (cR.ok === false) console.warn(`[applyHeatMapMaterials] createTexture(${cTex}) failed:`, cR.error);
    if (nR.ok === false) console.warn(`[applyHeatMapMaterials] createTexture(${nTex}) failed:`, nR.error);
    if (mR.ok === false) console.warn(`[applyHeatMapMaterials] createTexture(${mTex}) failed:`, mR.error);

    // Inherit transparency from the original mesh material (typically
    // window / curtain-wall glass). The opacity floor keeps the heat
    // map readable on very transparent originals; pass-through alpha
    // mode means the renderer still blends correctly.
    const orig          = matInfoByGeomId[geom.id];
    const isTransparent = orig && (orig.opacity < 1 || orig.alphaMode === "BLEND");

    const matParams: {
      id:                         string;
      colorTextureId:             string;
      normalsTextureId:           string;
      metallicRoughnessTextureId: string;
      opacity?:                   number;
      alphaMode?:                 AlphaModeStr;
    } = {
      id:                         matId,
      colorTextureId:             cTex,
      normalsTextureId:           nTex,
      metallicRoughnessTextureId: mTex,
    };
    if (isTransparent) {
      matParams.opacity   = Math.max(orig.opacity, opacityFloor);
      matParams.alphaMode = orig.alphaMode === "OPAQUE" ? "BLEND" : orig.alphaMode;
    }

    const matRes = sceneModel.createMaterial(matParams);
    if (matRes.ok === false) {
      return {
        ok:    false,
        type:  SDKErrorType.InvalidOperation,
        error: `[applyHeatMapMaterials] createMaterial(${matId}) failed: ${matRes.error}`,
      };
    }

    materialIdByGeometryId[geom.id] = matId;
  }


  // ── 3. Reskin every object's meshes that reference a painted geometry ─
  //
  // SceneMesh.material is immutable, so the supported reskin path is
  // destroy + recreate. Skip meshes whose geometry isn't paintable
  // (e.g. a points cloud) — they keep their original material.

  for (const objId in sceneModel.objects) {
    const sceneObj = sceneModel.objects[objId];

    type Snap = {
      id:                 string;
      geometryId:         string;
      matrix:             Float64Array<any>;
      opacity:            number;
      parentTransformId?: string;
      materialId:         string;
    };
    const meshSnaps: Snap[] = [];

    for (const m of sceneObj.meshes) {
      const heatMatId = materialIdByGeometryId[m.geometryId];
      if (!heatMatId) {
        // Non-paintable geometry — leave the mesh alone.
        continue;
      }
      meshSnaps.push({
        id:                m.id,
        geometryId:        m.geometryId,
        matrix:            new Float64Array(m.matrix),
        opacity:           m.opacity,
        parentTransformId: m.parentTransform ? m.parentTransform.id : undefined,
        materialId:        heatMatId,
      });
    }

    for (const snap of meshSnaps) {
      const mesh = sceneModel.meshes[snap.id];
      if (!mesh) {
        continue;
      }
      const rr = sceneObj.removeMesh(snap.id);
      if (rr.ok === false) {
        return rr;
      }
      const dr = mesh.destroy();
      if (dr.ok === false) {
        return dr;
      }
    }

    for (const snap of meshSnaps) {
      // Recreated meshes bind to the sibling geometry built in
      // step 2 (carrying the heat-map UVs and any synthesised
      // smooth normals). Falls back to the source id if the
      // sibling wasn't built — should only happen for an
      // un-paintable geometry, in which case the snap wouldn't
      // have been collected, but defensive anyway.
      const geometryId = replacementGeomIdByGeometryId[snap.geometryId] ?? snap.geometryId;
      if (!sceneModel.geometries[geometryId]) {
        continue;
      }
      const cr = sceneModel.createMesh({
        id:         snap.id,
        geometryId,
        materialId: snap.materialId,
        matrix:     snap.matrix,
        opacity:    snap.opacity,
      });
      if (cr.ok === false) {
        return cr;
      }
      const ar = sceneObj.addMesh(cr.value.id);
      if (ar.ok === false) {
        return ar;
      }
      if (snap.parentTransformId) {
        const lr = cr.value.setParentTransformId(snap.parentTransformId);
        if (lr.ok === false) {
          return lr;
        }
      }
    }
  }

  return {ok: true, value: undefined};
}


// ─────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────


/** True for the three triangle-mesh primitive constants. */
function isTriangleGeom(geom: SceneGeometry): boolean {
  return (
    geom.primitive === TrianglesPrimitive ||
    geom.primitive === SolidPrimitive    ||
    geom.primitive === SurfacePrimitive
  );
}


/** Pick the axis index (0|1|2) most aligned with a given vector. */
function pickAxis(v: ArrayLike<number>): 0 | 1 | 2 {
  const ax = Math.abs(v[0]);
  const ay = Math.abs(v[1]);
  const az = Math.abs(v[2]);
  if (ax >= ay && ax >= az) return 0;
  if (ay >= az)             return 1;
  return 2;
}


/**
 * Default scalar field: vertex elevation along the worldUp axis,
 * decompressed against the geometry's AABB. Returns metres in the
 * SceneModel's coordinate system.
 */
function defaultElevationScalars(geom: SceneGeometry, wuAx: 0 | 1 | 2): Float32Array<any> {
  const aabb      = geom.aabb;
  const min       = aabb[wuAx];
  const range     = aabb[wuAx + 3] - min;
  const positions = geom.positionsCompressed;
  const vertCount = (positions.length / 3) | 0;
  const out       = new Float32Array(vertCount);
  for (let i = 0; i < vertCount; i++) {
    out[i] = min + range * (positions[i * 3 + wuAx] / 65535);
  }
  return out;
}
