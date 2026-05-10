import type {SceneModel} from "../../scene";
import {findSceneObjectsForGeometry} from "../labels/findSceneObjectsForGeometry";
import type {InspectSceneModelParams} from "../params/InspectSceneModelParams";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";


/**
 * **Opt-in** ({@link InspectSceneModelParams.checkDenseGeometries}).
 * Emits one `GEOMETRY_OVER_BUDGET` warning per geometry whose
 * vertex or primitive count exceeds the configured thresholds —
 * `params.maxVertices` (default 65535) and `params.maxPrimitives`
 * (default 32768).
 *
 * Pairs with {@link splitDenseGeometry}, which splits
 * the geometry in half. Pieces still over the budget after the
 * split surface as new issues on the next inspection pass — the
 * user (or {@link optimizeSceneModel}) re-runs inspect → applyFixes
 * until the report converges.
 */
export const denseGeometries: Inspection = {

  codes: ["GEOMETRY_OVER_BUDGET"],

  description: "Dense geometries (over storage budget)",

  labels: {
    GEOMETRY_OVER_BUDGET: "Dense geometry",
  },

  descriptions: {
    GEOMETRY_OVER_BUDGET:
      "Geometry has more vertices or triangles than the renderer's per-geometry budget. Over-large buffers prevent fine-grained frustum culling and starve the GPU of parallelism. Splitting into smaller chunks tightens culling and recovers throughput.",
  },

  optIn: true,
  paramsKey: "checkDenseGeometries",

  run(sceneModel: SceneModel, params: InspectSceneModelParams): Issue[] {
    if (!params.checkDenseGeometries) return [];

    const maxVertices   = params.maxVertices   ?? 65535;
    const maxPrimitives = params.maxPrimitives ?? 32768;
    const issues: Issue[] = [];
    for (const id in sceneModel.geometries) {
      const geom = sceneModel.geometries[id];
      if (geom.destroyed) continue;
      if (!geom.positionsCompressed) continue;
      const vertCount = (geom.positionsCompressed.length / 3) | 0;
      const triCount  = geom.indices ? (geom.indices.length / 3) | 0 : 0;
      const overVerts = vertCount > maxVertices;
      const overTris  = triCount  > maxPrimitives;
      if (!overVerts && !overTris) continue;
      const limits: string[] = [];
      if (overVerts) limits.push(`${vertCount} vertices > ${maxVertices}`);
      if (overTris)  limits.push(`${triCount} primitives > ${maxPrimitives}`);
      const owners = findSceneObjectsForGeometry(sceneModel, id);
      issues.push({
        severity: "warning",
        code:     "GEOMETRY_OVER_BUDGET",
        message:  `SceneGeometry '${id}' is over the storage budget (${limits.join("; ")}) — consider splitting via splitDenseGeometry`,
        summary:  `${vertCount.toLocaleString()} verts · ${triCount.toLocaleString()} tris`,
        resourceId: id,
        context:   {maxVertices, maxPrimitives, vertCount, triCount},
        ...(owners.length > 0 ? {highlight: {objectIds: owners}} : {}),
      });
    }
    return issues;
  },
};
