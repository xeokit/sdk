import type {SceneModel} from "../../../model/scene";
import {findSceneObjectsForGeometry} from "../labels/findSceneObjectsForGeometry";
import type {InspectSceneModelParams} from "../params/InspectSceneModelParams";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";
import {resolveConfig} from "../Config";


/**
 * **Opt-in** ({@link InspectSceneModelParams.checkLargeGeometries}).
 * Emits one `GEOMETRY_OVER_EXTENT` warning per geometry whose AABB
 * has any axis dimension greater than `params.maxExtent` (default
 * 100; SceneModel coordinate-system units).
 *
 * Pairs with {@link splitLargeGeometry}. As with the
 * over-budget pass, pieces that remain over-extent surface as new
 * issues on the next inspection pass.
 */
export const largeGeometries: Inspection = {

  codes: ["GEOMETRY_OVER_EXTENT"],

  description: "Large geometries (over spatial extent)",

  labels: {
    GEOMETRY_OVER_EXTENT: "Large geometry",
  },

  descriptions: {
    GEOMETRY_OVER_EXTENT:
      "Geometry's AABB exceeds the per-geometry spatial-extent budget. A single huge bounding box is rejected by frustum culling far less often than the smaller boxes that would replace it. Splitting tightens culling and reduces overdraw.",
  },

  optIn: true,
  paramsKey: "checkLargeGeometries",

  config: {
    enabled: {
      kind: "boolean",
      key: "checkLargeGeometries",
      label: "Check large geometries",
      description:
        "Flag geometries whose AABB extent on at least one axis " +
        "exceeds the configured per-geometry spatial-extent budget.",
      default: false,
    },
    fields: [
      {
        kind: "number",
        key: "maxExtent",
        label: "Max per-axis AABB extent",
        description:
          "Threshold for any single axis of the geometry's AABB, in " +
          "SceneModel coordinate-system units (typically metres). " +
          "Default 100 — reasonable for individual building elements.",
        default: 100,
        min: 0,
        step: 1,
        unit: "units",
      },
    ],
  },

  run(sceneModel: SceneModel, params: InspectSceneModelParams): Issue[] {
    const cfg = resolveConfig(this.config, params);
    if (!cfg.enabled) return [];

    const maxExtent = cfg.maxExtent as number;
    const issues: Issue[] = [];
    for (const id in sceneModel.geometries) {
      const geom = sceneModel.geometries[id];
      if (geom.destroyed) continue;
      if (!geom.aabb) continue;
      const dx = geom.aabb[3] - geom.aabb[0];
      const dy = geom.aabb[4] - geom.aabb[1];
      const dz = geom.aabb[5] - geom.aabb[2];
      const overX = dx > maxExtent;
      const overY = dy > maxExtent;
      const overZ = dz > maxExtent;
      if (!overX && !overY && !overZ) continue;
      const overAxes: string[] = [];
      if (overX) overAxes.push(`X=${dx.toFixed(2)}`);
      if (overY) overAxes.push(`Y=${dy.toFixed(2)}`);
      if (overZ) overAxes.push(`Z=${dz.toFixed(2)}`);
      const owners = findSceneObjectsForGeometry(sceneModel, id);
      issues.push({
        severity: "warning",
        code:     "GEOMETRY_OVER_EXTENT",
        message:  `SceneGeometry '${id}' AABB exceeds the spatial budget (max ${maxExtent}; ${overAxes.join(", ")}) — consider splitting via splitLargeGeometry`,
        summary:  `${dx.toFixed(1)} × ${dy.toFixed(1)} × ${dz.toFixed(1)}`,
        resourceId: id,
        context:   {maxExtent, extents: [dx, dy, dz]},
        ...(owners.length > 0 ? {highlight: {objectIds: owners}} : {}),
      });
    }
    return issues;
  },
};
