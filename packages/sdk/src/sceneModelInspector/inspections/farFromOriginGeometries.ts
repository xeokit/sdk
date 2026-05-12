import type {SceneModel} from "../../scene";
import {findSceneObjectsForGeometry} from "../labels/findSceneObjectsForGeometry";
import {formatDistance} from "./util";
import type {InspectSceneModelParams} from "../params/InspectSceneModelParams";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";
import type {SceneModelInspectionIndex} from "../internal/SceneModelInspectionIndex";
import {getInspectionIndex} from "../internal/getInspectionIndex";


/**
 * **Opt-in** ({@link InspectSceneModelParams.checkGeometryFarFromOrigin}).
 * Flags every {@link SceneGeometry} whose **local** AABB centroid
 * has magnitude above
 * {@link InspectSceneModelParams.maxOriginDistance} (default
 * `1e6`).
 *
 * This is a different failure mode from
 * {@link objectPlacement}'s `OBJECT_FAR_FROM_ORIGIN`:
 * that check looks at the *world-space* AABB after `mesh.worldMatrix`
 * is applied. `GEOMETRY_FAR_FROM_ORIGIN` localises the offset to
 * the geometry itself — the quantisation range encoded in
 * `geom.aabb` is far from origin, so dequantised positions land
 * far from origin even before any mesh matrix runs.
 *
 * Loaders sometimes bake a global translation into geometry
 * positions (georeferenced BIM, for instance) instead of using
 * `mesh.matrix` / a parent `SceneTransform`. The matching
 * {@link recenterGeometry} relocates the offset out of the
 * geometry into each referencing mesh's matrix, preserving every
 * vertex's world position while keeping `geom.aabb` centred at
 * the origin so the renderer's float precision is preserved.
 *
 * `highlight.objectIds` covers every SceneObject that owns a
 * mesh referencing the offending geometry, so the example UI's
 * Locate button lights up the affected elements.
 */
export const farFromOriginGeometries: Inspection = {

  codes: ["GEOMETRY_FAR_FROM_ORIGIN"],

  description: "Geometries far from origin",

  labels: {
    GEOMETRY_FAR_FROM_ORIGIN: "Geometry far from origin",
  },

  descriptions: {
    GEOMETRY_FAR_FROM_ORIGIN:
      "Geometry's local-space AABB centre is far from the origin — typically a georeferenced offset baked into vertex positions instead of a mesh matrix. Float32 precision drift causes shimmering. Re-centring relocates the offset into each referencing mesh, preserving every vertex's world position.",
  },

  optIn: true,
  paramsKey: "checkGeometryFarFromOrigin",

  run(
    sceneModel: SceneModel,
    params: InspectSceneModelParams,
    index?: SceneModelInspectionIndex,
  ): Issue[] {
    if (!params.checkGeometryFarFromOrigin) return [];
    const ix = index ?? getInspectionIndex(sceneModel);
    const maxOriginDistance = params.maxOriginDistance ?? 1e6;
    const maxDistSq = maxOriginDistance * maxOriginDistance;
    const issues: Issue[] = [];

    for (const id in sceneModel.geometries) {
      const geom = sceneModel.geometries[id];
      if (geom.destroyed) continue;
      const aabb = geom.aabb;
      if (!aabb || aabb.length < 6) continue;

      // Squared centroid magnitude from the index — avoids the
      // sqrt for every geometry, only paying it for the few that
      // actually trip the threshold.
      const distSq = ix.aabbCentroidMagSq(id);
      if (distSq <= maxDistSq) continue;
      const dist = Math.sqrt(distSq);

      const cx = (aabb[0] + aabb[3]) * 0.5;
      const cy = (aabb[1] + aabb[4]) * 0.5;
      const cz = (aabb[2] + aabb[5]) * 0.5;

      const owners = findSceneObjectsForGeometry(sceneModel, id);
      issues.push({
        severity: "warning",
        code:     "GEOMETRY_FAR_FROM_ORIGIN",
        message:  `SceneGeometry '${id}' AABB centroid is ${dist.toFixed(2)} units from the origin (max ${maxOriginDistance}) — float-precision risk; recenter via recenterGeometry`,
        summary:  `${formatDistance(dist)} from origin`,
        resourceId: id,
        context:   {distance: dist, maxOriginDistance, centroid: [cx, cy, cz]},
        ...(owners.length > 0 ? {highlight: {objectIds: owners}} : {}),
      });
    }
    return issues;
  },
};
