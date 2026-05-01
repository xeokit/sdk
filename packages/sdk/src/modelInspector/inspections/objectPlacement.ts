import type {SceneModel} from "../../scene";
import {formatDistance} from "./util";
import type {InspectSceneModelParams} from "../InspectSceneModelParams";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";
import type {SceneModelInspectionIndex} from "../SceneModelInspectionIndex";
import {getInspectionIndex} from "../getInspectionIndex";


/**
 * **Opt-in** ({@link InspectSceneModelParams.checkObjectStructure}).
 * Two object-level checks driven by a single per-object world-AABB
 * walk:
 *
 *   - `OBJECT_FAR_FROM_ORIGIN` — the AABB centroid magnitude
 *     exceeds {@link InspectSceneModelParams.maxOriginDistance}
 *     (default `1e6`). Float-precision risk; usually a
 *     coordinate-system mismatch (model authored in georeferenced
 *     coordinates and not re-centred for viewing).
 *   - `OBJECT_DUPLICATE_AABB` — two or more SceneObjects share
 *     byte-identical world-space AABB *and* the same mesh count.
 *     Often a loader emitting the same element twice; matching on
 *     mesh count suppresses the rare coincidence of two genuinely
 *     different objects with identical AABBs. Each cluster emits
 *     one warning, with `context.duplicates` listing the
 *     redundant ids.
 *
 * Per-object world AABB is computed from the eight corners of
 * each mesh's geometry-AABB transformed through `mesh.worldMatrix`
 * (so any parent SceneTransform chain is honoured).
 */
export const objectPlacement: Inspection = {

  codes: ["OBJECT_FAR_FROM_ORIGIN", "OBJECT_DUPLICATE_AABB"],

  description: "Object placement (far from origin, duplicates)",

  labels: {
    OBJECT_FAR_FROM_ORIGIN: "Object far from origin",
    OBJECT_DUPLICATE_AABB:  "Duplicate object",
  },

  descriptions: {
    OBJECT_FAR_FROM_ORIGIN:
      "Object's centre is far enough from the world origin that float32 precision drift causes shimmering at render time. Usually a sign the model was authored in georeferenced coordinates and never re-centred for viewing.",
    OBJECT_DUPLICATE_AABB:
      "Two or more objects share the same world-space AABB and mesh count — strong signal of an authoring or import mistake (the same element placed twice). One of each cluster can usually be dropped.",
  },

  optIn: true,
  paramsKey: "checkObjectStructure",

  run(
    sceneModel: SceneModel,
    params: InspectSceneModelParams,
    index?: SceneModelInspectionIndex,
  ): Issue[] {
    if (!params.checkObjectStructure) return [];
    const ix = index ?? getInspectionIndex(sceneModel);

    const maxOriginDistance = params.maxOriginDistance ?? 1e6;
    const issues: Issue[] = [];

    // World-AABBs come from the index; computed once per object
    // (lazily) and cached so the duplicate-AABB clustering pass
    // below reuses the same buffers.
    const aabbs = new Map<string, Float32Array>();
    const meshCounts = new Map<string, number>();
    for (const objId in sceneModel.objects) {
      const obj = sceneModel.objects[objId];
      if (obj.destroyed) continue;
      const aabb = ix.objectWorldAABB(objId);
      if (!Number.isFinite(aabb[0])) continue;   // empty / missing mesh data
      aabbs.set(objId, aabb);
      meshCounts.set(objId, obj.meshes.length);

      // ── Far from origin ─────────────────────────────────────
      const cx = (aabb[0] + aabb[3]) * 0.5;
      const cy = (aabb[1] + aabb[4]) * 0.5;
      const cz = (aabb[2] + aabb[5]) * 0.5;
      const dist = Math.sqrt(cx * cx + cy * cy + cz * cz);
      if (dist > maxOriginDistance) {
        issues.push({
          severity: "warning",
          code:     "OBJECT_FAR_FROM_ORIGIN",
          message:  `SceneObject '${objId}' centroid is ${dist.toFixed(2)} units from the origin (max ${maxOriginDistance}) — float-precision risk; likely a coordinate-system mismatch`,
          summary:  `${formatDistance(dist)} from origin`,
          resourceId: objId,
          context:   {distance: dist, maxOriginDistance, centroid: [cx, cy, cz]},
          highlight: {objectIds: [objId]},
        });
      }
    }

    // ── Duplicate AABB ──────────────────────────────────────────
    // Cluster objects by (AABB-bytes | meshCount). The mesh-count
    // suffix filters out the rare false positive where two
    // unrelated objects happen to share identical AABBs.
    const buckets = new Map<string, string[]>();
    for (const [objId, aabb] of aabbs) {
      const meshCount = meshCounts.get(objId) ?? 0;
      const key = `${aabb[0]}|${aabb[1]}|${aabb[2]}|${aabb[3]}|${aabb[4]}|${aabb[5]}|${meshCount}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(objId);
      else buckets.set(key, [objId]);
    }
    for (const ids of buckets.values()) {
      if (ids.length < 2) continue;
      const [keep, ...duplicates] = ids;
      issues.push({
        severity: "warning",
        code:     "OBJECT_DUPLICATE_AABB",
        message:  `${ids.length} SceneObjects share an identical world AABB and mesh count — '${keep}' could absorb '${duplicates.join("', '")}'; likely a loader emitting the same element twice`,
        summary:  `→ ${duplicates.length} duplicate${duplicates.length === 1 ? "" : "s"}`,
        resourceId: keep,
        context:   {duplicates},
        highlight: {objectIds: ids},
      });
    }

    return issues;
  },
};
