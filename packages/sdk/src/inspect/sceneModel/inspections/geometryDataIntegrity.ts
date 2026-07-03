import type {SceneGeometry, SceneModel} from "../../../model/scene";
import {GaussianSplatsPrimitive} from "../../../base/constants";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";
import {indexStrideFor, isFiniteAABB} from "./util";


/**
 * Walks every {@link model!scene.SceneGeometry | SceneGeometry} in the SceneModel and emits
 * data-shape errors that the renderer or downstream optimisations
 * can't safely tolerate. One pass; fifteen codes.
 *
 *   - `GEOMETRY_NO_POSITIONS`     missing positionsCompressed
 *   - `GEOMETRY_POSITIONS_LENGTH` length not divisible by 3
 *   - `GEOMETRY_NORMALS_LENGTH`   length ≠ 2 × vertex count (oct-pairs)
 *   - `GEOMETRY_UVS_LENGTH`       length ≠ 2 × vertex count
 *   - `GEOMETRY_COLORS_LENGTH`    length ≠ 4 × vertex count
 *   - `GEOMETRY_AABB_LENGTH`      missing or not six values
 *   - `GEOMETRY_AABB_NONFINITE`   NaN / Infinity in AABB
 *   - `GEOMETRY_AABB_INVERTED`    min > max on at least one axis
 *   - `GEOMETRY_NO_INDICES`       indexed primitive has no indices
 *   - `GEOMETRY_INDICES_LENGTH`   length doesn't match primitive stride
 *   - `GEOMETRY_INDEX_OUT_OF_RANGE` index ≥ vertex count
 *   - `GEOMETRY_EDGE_INDICES_LENGTH` edgeIndices length not divisible by 2
 *   - `GEOMETRY_EDGE_INDEX_OUT_OF_RANGE` edge index ≥ vertex count
 *   - `GEOMETRY_SPLAT_SCALES_LENGTH` scales length ≠ 3 × splat count
 *   - `GEOMETRY_SPLAT_ROTATIONS_LENGTH` rotations length ≠ 4 × splat count
 */
export const geometryDataIntegrity: Inspection = {

  codes: [
    "GEOMETRY_NO_POSITIONS",
    "GEOMETRY_POSITIONS_LENGTH",
    "GEOMETRY_NORMALS_LENGTH",
    "GEOMETRY_UVS_LENGTH",
    "GEOMETRY_COLORS_LENGTH",
    "GEOMETRY_AABB_LENGTH",
    "GEOMETRY_AABB_NONFINITE",
    "GEOMETRY_AABB_INVERTED",
    "GEOMETRY_NO_INDICES",
    "GEOMETRY_INDICES_LENGTH",
    "GEOMETRY_INDEX_OUT_OF_RANGE",
    "GEOMETRY_EDGE_INDICES_LENGTH",
    "GEOMETRY_EDGE_INDEX_OUT_OF_RANGE",
    "GEOMETRY_SPLAT_SCALES_LENGTH",
    "GEOMETRY_SPLAT_ROTATIONS_LENGTH",
  ],

  description: "Geometry data integrity",

  labels: {
    GEOMETRY_NO_POSITIONS:       "Geometry missing positions",
    GEOMETRY_POSITIONS_LENGTH:   "Bad positions length",
    GEOMETRY_NORMALS_LENGTH:     "Bad normals length",
    GEOMETRY_UVS_LENGTH:         "Bad UVs length",
    GEOMETRY_COLORS_LENGTH:      "Bad colors length",
    GEOMETRY_AABB_LENGTH:        "Bad AABB length",
    GEOMETRY_AABB_NONFINITE:     "AABB contains NaN / Infinity",
    GEOMETRY_AABB_INVERTED:      "AABB min greater than max",
    GEOMETRY_NO_INDICES:         "Geometry missing indices",
    GEOMETRY_INDICES_LENGTH:     "Bad indices length",
    GEOMETRY_INDEX_OUT_OF_RANGE: "Index out of range",
    GEOMETRY_EDGE_INDICES_LENGTH:     "Bad edge indices length",
    GEOMETRY_EDGE_INDEX_OUT_OF_RANGE: "Edge index out of range",
    GEOMETRY_SPLAT_SCALES_LENGTH:     "Bad splat scales length",
    GEOMETRY_SPLAT_ROTATIONS_LENGTH:  "Bad splat rotations length",
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
    GEOMETRY_AABB_LENGTH:
      "Geometry AABB is missing or does not have exactly six values [minX, minY, minZ, maxX, maxY, maxZ].",
    GEOMETRY_AABB_NONFINITE:
      "Geometry AABB contains NaN or ±Infinity, which breaks frustum culling, picking, and bounds-driven layout.",
    GEOMETRY_AABB_INVERTED:
      "AABB min is greater than max on at least one axis — the box is empty or inside-out, and culling rejects everything inside it.",
    GEOMETRY_NO_INDICES:
      "Geometry primitive requires an index buffer, but indices are missing or empty. Lines and triangle-family primitives must have indices.",
    GEOMETRY_INDICES_LENGTH:
      "Index buffer length is not a whole multiple of the primitive's stride (3 for triangles, 2 for lines), so the last primitive is malformed.",
    GEOMETRY_INDEX_OUT_OF_RANGE:
      "An index references a vertex slot that doesn't exist (≥ vertex count or < 0). The renderer would read past the buffer end.",
    GEOMETRY_EDGE_INDICES_LENGTH:
      "Edge index buffer length is not a whole multiple of 2, so the last edge segment is malformed.",
    GEOMETRY_EDGE_INDEX_OUT_OF_RANGE:
      "An edge index references a vertex slot that doesn't exist (≥ vertex count or < 0). Edge rendering and vertex-compaction fixes would read past the buffer end.",
    GEOMETRY_SPLAT_SCALES_LENGTH:
      "Gaussian splat scales buffer is missing or the wrong size for the splat count. It must be exactly 3 × splatCount float elements.",
    GEOMETRY_SPLAT_ROTATIONS_LENGTH:
      "Gaussian splat rotations buffer is missing or the wrong size for the splat count. It must be exactly 4 × splatCount quaternion elements.",
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

  if (geom.primitive === GaussianSplatsPrimitive) {
    if (!geom.scales || geom.scales.length !== vertCount * 3) {
      issues.push({
        severity: "error",
        code:     "GEOMETRY_SPLAT_SCALES_LENGTH",
        message:  `SceneGeometry '${id}' scales.length=${geom.scales?.length ?? 0} is not 3 × ${vertCount}`,
        resourceId: id,
      });
    }
    if (!geom.rotations || geom.rotations.length !== vertCount * 4) {
      issues.push({
        severity: "error",
        code:     "GEOMETRY_SPLAT_ROTATIONS_LENGTH",
        message:  `SceneGeometry '${id}' rotations.length=${geom.rotations?.length ?? 0} is not 4 × ${vertCount}`,
        resourceId: id,
      });
    }
  }

  if (!geom.aabb || geom.aabb.length !== 6) {
    issues.push({
      severity: "error",
      code:     "GEOMETRY_AABB_LENGTH",
      message:  `SceneGeometry '${id}' AABB length=${geom.aabb?.length ?? 0} is not 6`,
      resourceId: id,
    });
  } else if (!isFiniteAABB(geom.aabb)) {
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

  const indexStride = indexStrideFor(geom.primitive);
  if (indexStride > 0 && (!geom.indices || geom.indices.length === 0)) {
    issues.push({
      severity: "error",
      code:     "GEOMETRY_NO_INDICES",
      message:  `SceneGeometry '${id}' primitive ${geom.primitive} requires a non-empty indices buffer`,
      resourceId: id,
    });
  } else if (geom.indices) {
    const indices = geom.indices;
    const stride = indexStride;
    if (stride > 0 && indices.length % stride !== 0) {
      issues.push({
        severity: "error",
        code:     "GEOMETRY_INDICES_LENGTH",
        message:  `SceneGeometry '${id}' indices.length=${indices.length} is not a multiple of ${stride} (required by primitive ${geom.primitive})`,
        resourceId: id,
      });
    }
    let outOfRange: number | undefined;
    for (let i = 0; i < indices.length; i++) {
      if (indices[i] < 0 || indices[i] >= vertCount) {
        outOfRange = indices[i];
        break;
      }
    }
    if (outOfRange !== undefined) {
      issues.push({
        severity: "error",
        code:     "GEOMETRY_INDEX_OUT_OF_RANGE",
        message:  `SceneGeometry '${id}' has index ${outOfRange} out of [0, ${vertCount - 1}]`,
        resourceId: id,
      });
    }
  }

  if (geom.edgeIndices) {
    const edgeIndices = geom.edgeIndices;
    if (edgeIndices.length % 2 !== 0) {
      issues.push({
        severity: "error",
        code:     "GEOMETRY_EDGE_INDICES_LENGTH",
        message:  `SceneGeometry '${id}' edgeIndices.length=${edgeIndices.length} is not a multiple of 2`,
        resourceId: id,
      });
    }
    let outOfRange: number | undefined;
    for (let i = 0; i < edgeIndices.length; i++) {
      if (edgeIndices[i] < 0 || edgeIndices[i] >= vertCount) {
        outOfRange = edgeIndices[i];
        break;
      }
    }
    if (outOfRange !== undefined) {
      issues.push({
        severity: "error",
        code:     "GEOMETRY_EDGE_INDEX_OUT_OF_RANGE",
        message:  `SceneGeometry '${id}' has edge index ${outOfRange} out of [0, ${vertCount - 1}]`,
        resourceId: id,
      });
    }
  }
}
