import type {SceneModel} from "../../../model/scene";
import {findSceneObjectsForGeometry} from "../labels/findSceneObjectsForGeometry";
import type {InspectSceneModelParams} from "../params/InspectSceneModelParams";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";
import {resolveConfig} from "../Config";


/**
 * **Opt-in** ({@link InspectSceneModelParams.checkGeometryArrayLengths}).
 * Emits one `GEOMETRY_ARRAY_OVERSIZED` warning per geometry whose
 * raw `positionsCompressed`, `indices`, `normalsCompressed`, or
 * `uvsCompressed` array length exceeds the matching configured
 * threshold.
 *
 * Distinct from {@link denseGeometries}, which measures vertex /
 * primitive *counts* — this check measures the raw `.length` of
 * each typed array, because that's the unit the
 * `WebGLRenderer`'s `GPUMemoryBatch.addMesh` allocator measures
 * against. A geometry that survives `denseGeometries` can still
 * trip the batch portion limits (e.g. a `Lines` primitive whose
 * `indices` array is huge but whose triangle count is zero), so
 * the two cover different failure modes.
 *
 * Catches the renderer's
 *
 *   `GPUMemoryBatch.addMesh: Unable to allocate indices portion
 *    (of length 147804) for geometry 78 - limit is 90000 indices`
 *
 * class of error *before* the GPU upload, so the user can split
 * the offending geometry via {@link splitOversizedGeometry} or
 * raise `MemoryConfigs.maxBatchVertices` / `maxBatchIndices`
 * ahead of time.
 *
 * Pairs with {@link splitOversizedGeometry}. Pieces that still
 * exceed any threshold after the split surface as new issues on
 * the next inspection pass — the user (or
 * {@link optimizeSceneModel}) re-runs inspect → applyFixes until
 * the report converges.
 *
 * **Prototype** for the declarative {@link ConfigSchema} pipeline.
 * The thresholds and opt-in toggle live on `config` below; `run`
 * reads them via {@link resolveConfig}, layering schema defaults
 * under any matching fields supplied on
 * {@link InspectSceneModelParams}. Other inspections in this
 * directory still read fields directly from `params`; both
 * patterns coexist while the migration rolls out.
 */
export const geometryArrayLengths: Inspection = {

  codes: ["GEOMETRY_ARRAY_OVERSIZED"],

  description: "Geometries with oversized vertex / index arrays",

  labels: {
    GEOMETRY_ARRAY_OVERSIZED: "Oversized geometry array",
  },

  descriptions: {
    GEOMETRY_ARRAY_OVERSIZED:
      "One of the geometry's typed arrays (positions, indices, normals, or UVs) is longer than the configured per-geometry threshold. The WebGLRenderer's GPUMemoryBatch allocates each array into a fixed-size portion of a shared batch texture, and rejects geometries whose array length exceeds that portion. Splitting the geometry (via splitOversizedGeometry) or raising the batch capacity avoids the upload-time MemoryAllocationFailed error.",
  },

  // Legacy metadata — kept while the orchestrator and tooling
  // still consult these. The `config.enabled` below is the new
  // source of truth.
  optIn: true,
  paramsKey: "checkGeometryArrayLengths",

  config: {
    enabled: {
      kind: "boolean",
      key: "checkGeometryArrayLengths",
      label: "Check geometry array lengths",
      description:
        "Flag geometries whose raw positions / indices / normals / UVs " +
        "array length exceeds the per-geometry batch-portion threshold " +
        "the WebGLRenderer enforces at GPU-upload time.",
      default: false,
    },
    fields: [
      {
        kind: "number",
        key: "maxPositionsLength",
        label: "Max positionsCompressed length",
        description:
          "positionsCompressed.length threshold (= u16 components, " +
          "3 per vertex). Renderer cap on a minimum-spec config: " +
          "maxBatchVertices * 3 = 300_000.",
        default: 300_000,
        min: 0,
        step: 1_000,
        unit: "components",
      },
      {
        kind: "number",
        key: "maxIndicesLength",
        label: "Max indices length",
        description:
          "indices.length threshold. Renderer cap on a minimum-spec " +
          "config: maxBatchIndices = 100_000.",
        default: 100_000,
        min: 0,
        step: 1_000,
        unit: "indices",
      },
      {
        kind: "number",
        key: "maxNormalsLength",
        label: "Max normalsCompressed length",
        description:
          "normalsCompressed.length threshold (= octahedral u16 " +
          "components, 2 per vertex). Renderer cap on a minimum-spec " +
          "config: maxBatchVertices * 2 = 200_000.",
        default: 200_000,
        min: 0,
        step: 1_000,
        unit: "components",
      },
      {
        kind: "number",
        key: "maxUvsLength",
        label: "Max uvsCompressed length",
        description:
          "uvsCompressed.length threshold (= float components, 2 per " +
          "vertex). Renderer cap on a minimum-spec config: " +
          "maxBatchVertices * 2 = 200_000.",
        default: 200_000,
        min: 0,
        step: 1_000,
        unit: "components",
      },
    ],
  },

  run(sceneModel: SceneModel, params: InspectSceneModelParams): Issue[] {
    const cfg = resolveConfig(this.config, params);
    if (!cfg.enabled) return [];

    const maxPositionsLength = cfg.maxPositionsLength as number;
    const maxIndicesLength   = cfg.maxIndicesLength   as number;
    const maxNormalsLength   = cfg.maxNormalsLength   as number;
    const maxUvsLength       = cfg.maxUvsLength       as number;

    const issues: Issue[] = [];
    for (const id in sceneModel.geometries) {
      const geom = sceneModel.geometries[id];
      if (geom.destroyed) continue;

      const positionsLength = geom.positionsCompressed?.length ?? 0;
      const indicesLength   = geom.indices?.length             ?? 0;
      const normalsLength   = geom.normalsCompressed?.length   ?? 0;
      const uvsLength       = geom.uvsCompressed?.length       ?? 0;

      const overPositions = positionsLength > maxPositionsLength;
      const overIndices   = indicesLength   > maxIndicesLength;
      const overNormals   = normalsLength   > maxNormalsLength;
      const overUvs       = uvsLength       > maxUvsLength;
      if (!overPositions && !overIndices && !overNormals && !overUvs) continue;

      const limits: string[] = [];
      if (overPositions) limits.push(`positions ${positionsLength} > ${maxPositionsLength}`);
      if (overIndices)   limits.push(`indices ${indicesLength} > ${maxIndicesLength}`);
      if (overNormals)   limits.push(`normals ${normalsLength} > ${maxNormalsLength}`);
      if (overUvs)       limits.push(`uvs ${uvsLength} > ${maxUvsLength}`);

      const summaryParts: string[] = [];
      if (overPositions) summaryParts.push(`${positionsLength.toLocaleString()} pos`);
      if (overIndices)   summaryParts.push(`${indicesLength.toLocaleString()} idx`);
      if (overNormals)   summaryParts.push(`${normalsLength.toLocaleString()} nrm`);
      if (overUvs)       summaryParts.push(`${uvsLength.toLocaleString()} uv`);

      const owners = findSceneObjectsForGeometry(sceneModel, id);
      issues.push({
        severity: "warning",
        code:     "GEOMETRY_ARRAY_OVERSIZED",
        message:  `SceneGeometry '${id}' has array lengths above the renderer batch portion thresholds (${limits.join("; ")}) — consider splitting via splitOversizedGeometry or raising MemoryConfigs.maxBatchVertices / maxBatchIndices`,
        summary:  summaryParts.join(" · "),
        resourceId: id,
        context: {
          maxPositionsLength, maxIndicesLength, maxNormalsLength, maxUvsLength,
          positionsLength,    indicesLength,    normalsLength,    uvsLength,
        },
        ...(owners.length > 0 ? {highlight: {objectIds: owners}} : {}),
      });
    }
    return issues;
  },
};
