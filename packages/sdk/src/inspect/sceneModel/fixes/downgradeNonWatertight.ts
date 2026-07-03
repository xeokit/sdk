import type {SceneModel} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import {SolidPrimitive, SurfacePrimitive} from "../../../base/constants";
import type {Fix, FixApplyResult} from "../Fix";
import {finishGeometryMutation, snapshotGeometryMutation} from "../internal/finishGeometryMutation";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `GEOMETRY_NON_WATERTIGHT` — flips a SceneGeometry's
 * `primitive` from `SolidPrimitive` to `SurfacePrimitive`. The
 * inspection has already proven the geometry isn't a closed
 * manifold, so the solid claim is wrong; surface is the honest
 * label and downstream pipelines (back-face culling decisions,
 * BVH closed-cell containment, IFC inside / outside) get correct
 * semantics.
 *
 * Index stride and per-vertex requirements are the same for both
 * primitives — the change is purely semantic. Mutates `primitive`
 * in place via typed cast (same pattern the rest of the
 * geometry-fix family uses for `indices` / `*Compressed`).
 *
 * Idempotent: returns `{fixed: false}` when the geometry is
 * already `SurfacePrimitive` (or any other primitive).
 */
export const downgradeNonWatertight: Fix = {

  codes: ["GEOMETRY_NON_WATERTIGHT"],

  description: "Downgrade Solid → Surface primitive",

  procedure: [
    "Find the geometry",
    "If it isn't tagged as a closed solid, do nothing",
    "Re-tag it as an open surface",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableDowngradeNonWatertight",
      label: "Downgrade Solid → Surface primitive",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const geomId = issue.resourceId;
    if (!geomId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[downgradeNonWatertight] issue has no resourceId (geometry id)`,
      };
    }
    const geom = sceneModel.geometries[geomId];
    if (!geom || geom.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }
    if (geom.primitive !== SolidPrimitive) {
      return {ok: true, value: {fixed: false, reason: "no-op"}};
    }
    const before = snapshotGeometryMutation(geom);
    (geom as { primitive: number }).primitive = SurfacePrimitive;
    finishGeometryMutation(geom, before);
    return {ok: true, value: {fixed: true, trace: `'${geomId}': SolidPrimitive → SurfacePrimitive`}};
  },
};
