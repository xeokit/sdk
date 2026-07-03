import type {SceneGeometry, SceneModel} from "../../../model/scene";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";
import {indexStrideFor, isFiniteAABB} from "./util";


/**
 * Walks every {@link model!scene.SceneGeometry | SceneGeometry} in the SceneModel and emits
 * data-shape errors that the renderer or downstream optimisations
 * can't safely tolerate. One pass; nine codes.
 *
 *   - `GEOMETRY_NO_POSITIONS`     missing positionsCompressed
 *   - `GEOMETRY_POSITIONS_LENGTH` length not divisible by 3
 *   - `GEOMETRY_NORMALS_LENGTH`   length ≠ 2 × vertex count (oct-pairs)
 *   - `GEOMETRY_UVS_LENGTH`       length ≠ 2 × vertex count
 *   - `GEOMETRY_COLORS_LENGTH`    length ≠ 4 × vertex count
 *   - `GEOMETRY_AABB_NONFINITE`   NaN / Infinity in AABB
 *   - `GEOMETRY_AABB_INVERTED`    min > max on at least one axis
 *   - `GEOMETRY_INDICES_LENGTH`   length doesn't match primitive stride
 *   - `GEOMETRY_INDEX_OUT_OF_RANGE` index ≥ vertex count
 */
export const geometryDataIntegrity: Inspection = {

  codes: [
    "GEOMETRY_NO_POSITIONS",
    "GEOMETRY_POSITIONS_LENGTH",
    "GEOMETRY_NORMALS_LENGTH",
    "GEOMETRY_UVS_LENGTH",
    "GEOMETRY_COLORS_LENGTH",
    "GEOMETRY_AABB_NONFINITE",
    "GEOMETRY_AABB_INVERTED",
    "GEOMETRY_INDICES_LENGTH",
    "GEOMETRY_INDEX_OUT_OF_RANGE",
  ],

  description: "Geometry data integrity",

  labels: {
    GEOMETRY_NO_POSITIONS:       "Geometry missing positions",
    GEOMETRY_POSITIONS_LENGTH:   "Bad positions length",
    GEOMETRY_NORMALS_LENGTH:     "Bad normals length",
    GEOMETRY_UVS_LENGTH:         "Bad UVs length",
    GEOMETRY_COLORS_LENGTH:      "Bad colors length",
    GEOMETRY_AABB_NONFINITE:     "AABB contains NaN / Infinity",
    GEOMETRY_AABB_INVERTED:      "AABB min greater than max",
    GEOMETRY_INDICES_LENGTH:     "Bad indices length",
    GEOMETRY_INDEX_OUT_OF_RANGE: "Index out of range",
  },

  descriptions: {
    GEOMETRY_NO_POSITIONS:
      "Geometry has no vertex positions buffer, so the renderer has nothing to draw.",
    GEOMETRY_POSITIONS_LENGTH:
      "Positions buffer length is not a multiple of 3, so the (x, y, z) groupings don't line up — at least one vertex is truncated.",
    GEOMETRY_NORMALS_LENGTH:
      "Normals buffer is the wrong size for the vertex count. Oct-encoded normals must be exactly 2 × vertexCount u16 elements.",
    GEOMETRY_UVS_LENGTH:
      "UVs buffer is the wrong size for the vertex count — must be exactly 2 × vertexCount.",
    GEOMETRY_COLORS_LENGTH:
      "Compressed color buffer is the wrong size for the vertex count. RGBA colors must be exactly 4 × vertexCount byte elements.",
    GEOMETRY_AABB_NONFINITE:
      "Geometry AABB contains NaN or ±Infinity, which breaks frustum culling, picking, and bounds-driven layout.",
    GEOMETRY_AABB_INVERTED:
      "AABB min is greater than max on at least one axis — the box is empty or inside-out, and culling rejects everything inside it.",
    GEOMETRY_INDICES_LENGTH:
      "Index buffer length is not a whole multiple of the primitive's stride (3 for triangles, 2 for lines), so the last primitive is malformed.",
    GEOMETRY_INDEX_OUT_OF_RANGE:
      "An index references a vertex slot that doesn't exist (≥ vertex count or < 0). The renderer would read past the buffer end.",
  },

  run(sceneModel: SceneModel): Issue[] {
    const issues: Issue[] = [];
    for (const id in sceneModel.geometries) {
      const geom = sceneModel.geometries[id];
      if (geom.destroyed) continue;
      checkGeometry(geom, issues);
    }
    return issues;
  },
};


function checkGeometry(geom: SceneGeometry, issues: Issue[]): void {
  const id = geom.id;

  if (!geom.positionsCompressed || geom.positionsCompressed.length === 0) {
    issues.push({
      severity: "error",
      code:     "GEOMETRY_NO_POSITIONS",
      message:  `SceneGeometry '${id}' has no positionsCompressed`,
      resourceId: id,
    });
    return;
  }
  if (geom.positionsCompressed.length % 3 !== 0) {
    issues.push({
      severity: "error",
      code:     "GEOMETRY_POSITIONS_LENGTH",
      message:  `SceneGeometry '${id}' positionsCompressed.length=${geom.positionsCompressed.length} is not a multiple of 3`,
      resourceId: id,
    });
    return;
  }

  const vertCount = (geom.positionsCompressed.length / 3) | 0;

  if (geom.normalsCompressed && geom.normalsCompressed.length !== vertCount * 2) {
    // Oct-encoded as (u16, u16) per vertex — 2 elements, NOT 3.
    issues.push({
      severity: "error",
      code:     "GEOMETRY_NORMALS_LENGTH",
      message:  `SceneGeometry '${id}' normalsCompressed.length=${geom.normalsCompressed.length} is not 2 × ${vertCount} (oct-encoded u16 pairs)`,
      resourceId: id,
    });
  }

  if (geom.uvsCompressed && geom.uvsCompressed.length !== vertCount * 2) {
    issues.push({
      severity: "error",
      code:     "GEOMETRY_UVS_LENGTH",
      message:  `SceneGeometry '${id}' uvsCompressed.length=${geom.uvsCompressed.length} is not 2 × ${vertCount}`,
      resourceId: id,
    });
  }

  if (geom.colorsCompressed && geom.colorsCompressed.length !== vertCount * 4) {
    issues.push({
      severity: "error",
      code:     "GEOMETRY_COLORS_LENGTH",
      message:  `SceneGeometry '${id}' colorsCompressed.length=${geom.colorsCompressed.length} is not 4 × ${vertCount}`,
      resourceId: id,
    });
  }

  if (geom.aabb) {
    if (!isFiniteAABB(geom.aabb)) {
      issues.push({
        severity: "error",
        code:     "GEOMETRY_AABB_NONFINITE",
        message:  `SceneGeometry '${id}' AABB contains NaN or Infinity`,
        resourceId: id,
      });
    } else if (geom.aabb[0] > geom.aabb[3] || geom.aabb[1] > geom.aabb[4] || geom.aabb[2] > geom.aabb[5]) {
      issues.push({
        severity: "error",
        code:     "GEOMETRY_AABB_INVERTED",
        message:  `SceneGeometry '${id}' AABB has min > max on at least one axis`,
        resourceId: id,
      });
    }
  }

  if (geom.indices) {
    const indices = geom.indices;
    const stride = indexStrideFor(geom.primitive);
    if (stride > 0 && indices.length % stride !== 0) {
      issues.push({
        severity: "error",
        code:     "GEOMETRY_INDICES_LENGTH",
        message:  `SceneGeometry '${id}' indices.length=${indices.length} is not a multiple of ${stride} (required by primitive ${geom.primitive})`,
        resourceId: id,
      });
    }
    let outOfRange = -1;
    for (let i = 0; i < indices.length; i++) {
      if (indices[i] < 0 || indices[i] >= vertCount) {
        outOfRange = indices[i];
        break;
      }
    }
    if (outOfRange !== -1) {
      issues.push({
        severity: "error",
        code:     "GEOMETRY_INDEX_OUT_OF_RANGE",
        message:  `SceneGeometry '${id}' has index ${outOfRange} out of [0, ${vertCount - 1}]`,
        resourceId: id,
      });
    }
  }
}
