import type {SceneModel} from "../../scene";
import {findSceneObjectsForGeometry} from "../labels/findSceneObjectsForGeometry";
import type {InspectSceneModelParams} from "../params/InspectSceneModelParams";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";
import type {SceneModelInspectionIndex} from "../internal/SceneModelInspectionIndex";
import {getInspectionIndex} from "../internal/getInspectionIndex";
import {isTriangleMesh} from "./util";


/**
 * **Opt-in** ({@link InspectSceneModelParams.checkSimilarGeometries}).
 * Pose-invariant shape match — two geometries are flagged similar
 * when they share the same primitive, vertex / triangle count, and
 * triangle edge-length distribution (a 64-bin log₂ histogram).
 *
 * Edge lengths are translation-, rotation-, and reflection-
 * invariant, so two byte-different SceneGeometries that represent
 * the same shape under any of those transforms produce the same
 * histogram. NOT scale-invariant: a 1 m cube and a 5 m cube
 * fingerprint differently.
 *
 * Pairs with {@link mergeSimilarGeometries}, which fits a rigid
 * transform from each similar geometry to the canonical via
 * Kabsch (Horn's quaternion method) under same-vertex-order
 * correspondence and bakes the inverse into each referencing
 * mesh's matrix. Geometries whose vertex orders don't line up
 * with the canonical fail the residual gate and stay in place
 * rather than mis-align silently. The issue carries
 * `context.similar` listing the redundant ids.
 *
 * Two-pass: first bucket by topology — that's free, and a topology
 * mismatch means the shapes can't be the same regardless of
 * histogram. Then within each multi-element topology bucket,
 * compute the edge-length histogram and bucket again.
 */
export const similarGeometries: Inspection = {

  codes: ["GEOMETRY_SIMILAR"],

  description: "Similar geometries (same shape, any pose)",

  labels: {
    GEOMETRY_SIMILAR: "Similar geometry",
  },

  descriptions: {
    GEOMETRY_SIMILAR:
      "Two or more geometries are pose-invariant equivalent — same shape, but different translation / rotation / reflection. A single canonical geometry can replace them, instanced through per-mesh transforms; the fix attempts this under same-vertex-order correspondence and skips any whose vertex orders don't line up.",
  },

  optIn: true,
  paramsKey: "checkSimilarGeometries",

  run(
    sceneModel: SceneModel,
    params: InspectSceneModelParams,
    index?: SceneModelInspectionIndex,
  ): Issue[] {
    if (!params.checkSimilarGeometries) return [];
    const ix = index ?? getInspectionIndex(sceneModel);

    const issues: Issue[] = [];
    const topoBuckets = new Map<string, string[]>();
    for (const id in sceneModel.geometries) {
      const geom = sceneModel.geometries[id];
      if (geom.destroyed) continue;
      if (!isTriangleMesh(geom)) continue;
      if (!geom.indices || geom.indices.length < 3) continue;
      if (!geom.positionsCompressed || !geom.aabb) continue;
      const topoKey = ix.topologyKey(id);
      const arr = topoBuckets.get(topoKey);
      if (arr) arr.push(id);
      else topoBuckets.set(topoKey, [id]);
    }

    const shapeBuckets = new Map<string, string[]>();
    for (const [topoKey, ids] of topoBuckets) {
      if (ids.length < 2) continue;     // can't be similar to anything
      for (const id of ids) {
        const histogram = ix.edgeLengthHistogram(id);
        if (!histogram) continue;
        const shapeKey = `${topoKey}|${histogram.join(",")}`;
        const arr = shapeBuckets.get(shapeKey);
        if (arr) arr.push(id);
        else shapeBuckets.set(shapeKey, [id]);
      }
    }

    for (const ids of shapeBuckets.values()) {
      if (ids.length < 2) continue;
      const [keep, ...similar] = ids;
      const owners: string[] = [];
      const ownerSeen = new Set<string>();
      for (const id of ids) {
        for (const objId of findSceneObjectsForGeometry(sceneModel, id)) {
          if (ownerSeen.has(objId)) continue;
          ownerSeen.add(objId);
          owners.push(objId);
        }
      }
      issues.push({
        severity: "warning",
        code:     "GEOMETRY_SIMILAR",
        message:  `${ids.length} SceneGeometries share the same shape (matching topology + edge-length distribution) — '${keep}' may be instanceable from '${similar.join("', '")}' via per-mesh transforms`,
        summary:  `→ ${similar.length} similar`,
        resourceId: keep,
        context:   {similar},
        ...(owners.length > 0 ? {highlight: {objectIds: owners}} : {}),
      });
    }
    return issues;
  },
};
