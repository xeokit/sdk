import type {SceneModel} from "../../scene";
import type {SDKResult} from "../../core";
import {SDKErrorType} from "../../core";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../../constants";
import {generateSmoothNormals} from "../../demo/synthesizeGeometryAttribs";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `MATERIAL_PBR_GEOMETRY_NO_NORMALS`.
 *
 * Reads `context.geometryId` (set by the inspection) and synthesises
 * area-weighted smooth normals in place via
 * {@link generateSmoothNormals} — face normals computed from the
 * geometry's triangle indices, accumulated per shared vertex,
 * normalised, and oct-encoded into a `Uint16Array` with the SDK's
 * standard `octEncodeNormalsToU16`.
 *
 * Narrow scope by design — only normals. The sibling
 * {@link addMissingUVs} handles UVs.
 *
 * Reports `{fixed: false}` (without an error) when:
 *
 *   - the geometry has been destroyed,
 *   - it lacks positions / AABB / indices (no shape to derive
 *     normals from),
 *   - its primitive isn't triangle-based (lines / points have no
 *     defensible per-vertex normal),
 *   - normals are already populated, or
 *   - `generateSmoothNormals` returns null (degenerate geometry —
 *     every face normal collapses to zero length).
 */
export const addMissingNormals: Fix = {

  codes: ["MATERIAL_PBR_GEOMETRY_NO_NORMALS"],

  description: "Synthesize missing normals",

  procedure: [
    "Compute each triangle's face normal",
    "Sum face normals into each vertex, weighted by triangle area",
    "Normalize each vertex's accumulated normal to unit length",
    "Compress and store the new per-vertex normals on the geometry",
  ],

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const ctx = issue.context;
    const geomId = (ctx && typeof ctx.geometryId === "string") ? ctx.geometryId : undefined;
    if (!geomId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[addMissingNormals] issue '${issue.code}' has no context.geometryId`,
      };
    }
    const geom = sceneModel.geometries[geomId];
    if (!geom || geom.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }
    if (!geom.positionsCompressed || !geom.aabb || !geom.indices) {
      return {ok: true, value: {fixed: false, reason: "malformed-issue"}};
    }
    const isTriangleMesh =
      geom.primitive === TrianglesPrimitive ||
      geom.primitive === SolidPrimitive ||
      geom.primitive === SurfacePrimitive;
    if (!isTriangleMesh) {
      return {ok: true, value: {fixed: false, reason: "precondition-failed"}};
    }
    if (geom.normalsCompressed && (geom.normalsCompressed as ArrayLike<number>).length > 0) {
      return {ok: true, value: {fixed: false, reason: "no-op"}};
    }

    const normals = generateSmoothNormals(geom.positionsCompressed, geom.indices, geom.aabb);
    if (!normals) {
      return {ok: true, value: {fixed: false, reason: "precondition-failed"}};
    }
    (geom as { normalsCompressed: typeof normals }).normalsCompressed = normals;
    return {ok: true, value: {fixed: true, trace: `synthesized smooth normals on '${geomId}'`}};
  },
};
