/**
 * <img style="padding:20px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_docmodel_greyscale_icon.png"/>
 *
 * # SceneModel Inspector
 *
 * Runs inspections on a {@link model!scene.SceneModel | SceneModel}
 * and returns a structured {@link InspectionReport}.
 *
 * {@link applyFixes} applies registered fixes for supported issue
 * codes. The module also exports registries, async variants, and
 * {@link optimizeSceneModel}.
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class inspectSceneModel {
 *       +(params) InspectionReport
 *     }
 *     class applyFixes {
 *       +(params) SDKResult~ApplyFixesResult~
 *     }
 *     class InspectionReport {
 *       +issues   : Issue[]
 *       +errors / warnings / info : Issue[]
 *       +byCode   : Map~code, Issue[]~
 *     }
 *     class Issue {
 *       +code      : string
 *       +severity  : error | warning | info
 *       +message   : string
 *       +resourceId? / context?
 *     }
 *     class ApplyFixesResult {
 *       +fixed    : Issue[]
 *       +skipped  : Issue[]
 *       +errors   : Issue[]
 *     }
 *     class Inspection {
 *       +codes    : string[]
 *       +run(sceneModel, push)
 *     }
 *     class Fix {
 *       +codes    : string[]
 *       +apply(issue, sceneModel)
 *     }
 *     class InspectionRegistry {
 *       +register(inspection)
 *     }
 *     class FixRegistry {
 *       +register(fix)
 *       +unregister(code)
 *     }
 *     inspectSceneModel ..> InspectionRegistry : walks
 *     inspectSceneModel ..> InspectionReport : produces
 *     InspectionRegistry "1" *-- "*" Inspection
 *     InspectionReport "1" *-- "*" Issue
 *     applyFixes ..> InspectionReport : consumes
 *     applyFixes ..> FixRegistry : dispatches
 *     applyFixes ..> ApplyFixesResult : returns
 *     FixRegistry "1" *-- "*" Fix
 * ```
 *
 * ## Pipeline
 *
 * ```mermaid
 * flowchart LR
 *     A[SceneModel] --> B[inspectSceneModel]
 *     B --> C[InspectionReport]
 *     C --> D[applyFixes]
 *     D --> E[ApplyFixesResult]
 *     E -- re-inspect --> B
 * ```
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Core Types
 *
 * - {@link Issue}: one finding with severity, code, message,
 *   optional resource id, and optional `context`.
 * - {@link InspectionReport}: issue list plus severity and code
 *   groupings.
 * - {@link Inspection}: `{codes[], description, run}`. Walks a
 *   SceneModel and returns issues.
 * - {@link Fix}: `{codes[], description, apply}`. Handles one or
 *   more issue codes.
 *
 * ## Registries
 *
 * Inspections and fixes are stored in separate registries:
 *
 * - {@link InspectionRegistry}: inspections run by
 *   {@link inspectSceneModel}. {@link DEFAULT_INSPECTION_REGISTRY}
 *   contains the built-in inspections.
 * - {@link FixRegistry}: issue-code dispatch table used by
 *   {@link applyFixes}. {@link DEFAULT_FIX_REGISTRY} contains the
 *   built-in fixes. Registering a fix for an existing code replaces
 *   the previous mapping.
 *
 * Tests and one-off pipelines can create fresh registries and pass
 * them through the matching `registry` field on the params object.
 *
 * ```ts
 * // Register a fix in the default registry.
 * import * as sceneModelInspector from "@xeokit/sdk/quality/sceneModel";
 *
 * sceneModelInspector.DEFAULT_FIX_REGISTRY.register({
 *   codes: ["MyApp/STALE_PROPERTY_SET"],
 *   description: "Prune deprecated property sets",
 *   apply(issue, sceneModel) {
 *     return {ok: true, value: {fixed: true}};
 *   },
 * });
 * ```
 *
 * ```ts
 * // Build a one-off registry.
 * import {
 *   FixRegistry,
 *   mergeDuplicateGeometries,
 *   applyFixes,
 * } from "@xeokit/sdk/quality/sceneModel";
 *
 * const registry = new FixRegistry([
 *   mergeDuplicateGeometries,
 *   myFix,
 * ]);
 * applyFixes({sceneModel, report, registry});
 * ```
 *
 * Use `unregister(code)` to remove a fix mapping.
 *
 * ## Built-in inspections
 *
 * Built-in inspections are registered in
 * {@link DEFAULT_INSPECTION_REGISTRY}.
 *
 * | Inspection                        | Codes                                                                                   |
 * | --------------------------------- | --------------------------------------------------------------------------------------- |
 * | {@link geometryDataIntegrity}        | `GEOMETRY_NO_POSITIONS`, `GEOMETRY_POSITIONS_LENGTH`, `GEOMETRY_PRIMITIVE_UNSUPPORTED`, `GEOMETRY_NORMALS_LENGTH`, `GEOMETRY_UVS_LENGTH`, `GEOMETRY_COLORS_LENGTH`, `GEOMETRY_AABB_LENGTH`, `GEOMETRY_AABB_NONFINITE`, `GEOMETRY_AABB_INVERTED`, `GEOMETRY_NO_INDICES`, `GEOMETRY_INDICES_LENGTH`, `GEOMETRY_INDEX_OUT_OF_RANGE`, `GEOMETRY_EDGE_INDICES_LENGTH`, `GEOMETRY_EDGE_INDEX_OUT_OF_RANGE`, `GEOMETRY_SPLAT_SCALES_LENGTH`, `GEOMETRY_SPLAT_ROTATIONS_LENGTH` (errors) |
 * | {@link meshReferences}             | `MESH_DANGLING_GEOMETRY`, `MESH_DANGLING_MATERIAL`, `MESH_DANGLING_TRANSFORM`, `MESH_NONFINITE_MATRIX` (errors) |
 * | {@link objectMeshReferences}       | `OBJECT_DANGLING_MESH` (error) |
 * | {@link transformParentCycles}      | `TRANSFORM_CYCLE` (error) |
 * | {@link unusedResources}      | `MATERIAL_UNUSED`, `TEXTURE_UNUSED`, `TRANSFORM_UNUSED` (warnings) |
 * | {@link identityTransforms}   | `TRANSFORM_IDENTITY` (warning) |
 * | {@link duplicateGeometries}  | `GEOMETRY_DUPLICATE` (warning, **opt-in** via `checkDuplicateGeometries`) |
 * | {@link similarGeometries}    | `GEOMETRY_SIMILAR` (warning, **opt-in** via `checkSimilarGeometries`) |
 * | {@link denseGeometries}      | `GEOMETRY_OVER_BUDGET` (warning, **opt-in** via `checkDenseGeometries`) |
 * | {@link largeGeometries}      | `GEOMETRY_OVER_EXTENT` (warning, **opt-in** via `checkLargeGeometries`) |
 * | {@link geometryQuality}      | `GEOMETRY_ZERO_VOLUME_AABB`, `GEOMETRY_DEGENERATE_TRIANGLES`, `GEOMETRY_UNUSED_VERTICES`, `GEOMETRY_DUPLICATE_VERTICES`, `GEOMETRY_NON_WATERTIGHT`, `GEOMETRY_INCONSISTENT_WINDING`, `GEOMETRY_AABB_NOT_TIGHT`, `GEOMETRY_DUPLICATE_INDICES` (warnings, **opt-in** via `checkGeometryQuality`) |
 * | {@link objectPlacement}      | `OBJECT_FAR_FROM_ORIGIN`, `OBJECT_DUPLICATE_AABB` (warnings, **opt-in** via `checkObjectStructure`) |
 * | {@link textureDimensions}        | `TEXTURE_NPOT`, `TEXTURE_OVERSIZED` (warnings, **opt-in** via `checkTextureSanity`) |
 * | {@link farFromOriginGeometries} | `GEOMETRY_FAR_FROM_ORIGIN` (warning, **opt-in** via `checkGeometryFarFromOrigin`) |
 *
 * ## Built-in fixes
 *
 * Built-in fixes are registered in {@link DEFAULT_FIX_REGISTRY}.
 *
 * | Fix                              | Codes handled                                                  |
 * | -------------------------------- | -------------------------------------------------------------- |
 * | {@link addMissingUVs}     | `MATERIAL_TEXTURED_GEOMETRY_NO_UVS` — synthesises planar UVs   |
 * | {@link addMissingNormals} | `MATERIAL_PBR_GEOMETRY_NO_NORMALS` — synthesises smooth normals |
 * | {@link pruneDanglingMeshRefs}  | `OBJECT_DANGLING_MESH`                                         |
 * | {@link dropUnusedMaterial}   | `MATERIAL_UNUSED` — destroys the orphan SceneMaterial          |
 * | {@link dropUnusedTexture}    | `TEXTURE_UNUSED` — destroys the orphan SceneTexture            |
 * | {@link dropUnusedTransform}  | `TRANSFORM_UNUSED` — destroys the orphan SceneTransform        |
 * | {@link dropIdentityTransform} | `TRANSFORM_IDENTITY` — re-parents referencers and destroys the identity transform |
 * | {@link mergeDuplicateGeometries}      | `GEOMETRY_DUPLICATE`                                           |
 * | {@link mergeSimilarGeometries}        | `GEOMETRY_SIMILAR` — fits a rigid transform via Kabsch (Horn's quaternion method) and instances each similar geometry through its referencing meshes' matrices |
 * | {@link splitDenseGeometry}    | `GEOMETRY_OVER_BUDGET` — splits dense / over-budget geometries (one split per apply) |
 * | {@link splitLargeGeometry}    | `GEOMETRY_OVER_EXTENT` — splits large / over-extent geometries (one split per apply) |
 * | {@link dropDegenerateTriangles} | `GEOMETRY_DEGENERATE_TRIANGLES` — drops zero-area triangles from `geom.indices` |
 * | {@link compactUnusedVertices} | `GEOMETRY_UNUSED_VERTICES` — compacts unused vertex slots, remaps indices |
 * | {@link mergeDuplicateVertices}        | `GEOMETRY_DUPLICATE_VERTICES` — coalesces byte-identical vertex slots, remaps indices |
 * | {@link downgradeNonWatertight} | `GEOMETRY_NON_WATERTIGHT` — flips `SolidPrimitive` → `SurfacePrimitive` |
 * | {@link dropDuplicateObject}  | `OBJECT_DUPLICATE_AABB` — destroys duplicate SceneObjects (detach + destroy meshes, then destroy object) |
 * | {@link recenterGeometry}      | `GEOMETRY_FAR_FROM_ORIGIN` — shifts the AABB to origin and composes the inverse offset into each referencing mesh's matrix |
 * | {@link unifyTriangleWinding}          | `GEOMETRY_INCONSISTENT_WINDING` — flood-fill flip wrongly-wound triangles to match the seed |
 * | {@link tightenAabb}           | `GEOMETRY_AABB_NOT_TIGHT` — re-quantises positions into a tight AABB to recover precision |
 * | {@link dropDuplicateTriangles} | `GEOMETRY_DUPLICATE_INDICES` — drops duplicate triangles (same vertex set, any rotation / winding) from indices |
 *
 * Codes without a built-in fix include `MESH_DANGLING_*`,
 * `MESH_NONFINITE_MATRIX`, malformed `GEOMETRY_*` issues, and
 * `TRANSFORM_CYCLE`.
 *
 * Typical pipeline: load -> inspect -> applyFixes -> re-inspect -> render.
 *
 * ## Example
 *
 * ```ts
 * import * as sceneModelInspector from "@xeokit/sdk/quality/sceneModel";
 *
 * const report = sceneModelInspector.inspectSceneModel({
 *   sceneModel,
 *   checkDuplicateGeometries: true,   // opt-in: byte-identical detection
 *   checkSimilarGeometries:   true,   // opt-in: pose-invariant shape match
 * });
 *
 * if (report.errors.length > 0) {
 *   for (const e of report.errors) {
 *     console.error(`[${e.code}] ${e.message}`);
 *   }
 *   return;
 * }
 *
 * const fixResult = sceneModelInspector.applyFixes({sceneModel, report});
 * if (!fixResult.ok) throw new Error(fixResult.error);
 *
 * const {fixed, skipped, errors} = fixResult.value;
 * console.log(
 *   `fixed ${fixed.length}, skipped ${skipped.length}, ` +
 *   `errors ${errors.length}`,
 * );
 *
 * // Re-inspect after applying fixes.
 * const after = sceneModelInspector.inspectSceneModel({sceneModel});
 * ```
 *
 * {@link optimizeSceneModel} runs inspection first, stops on
 * errors, splits oversized geometries, and prunes orphan resources.
 * Use `inspectSceneModel` and `applyFixes` directly when you need
 * per-rule control.
 *
 * @module sceneModel
 */

// ── Inspection types ────────────────────────────────────────────
export * from "./params/IssueSeverity";
export * from "./params/IssueHighlight";
export * from "./Issue";
export * from "./InspectionReport";
export * from "./params/InspectSceneModelParams";
export * from "./params/InspectProgress";
export * from "./inspectSceneModel";
export * from "./tasks/inspectSceneModelAsync";
export * from "./serializers/inspectionReportToJson";
export * from "./labels/findSceneObjectsForGeometry";
export * from "./labels/labelForCode";
export * from "./labels/descriptionForCode";
export * from "./labels/findResourceLabel";

// ── Inspection registries and built-in inspections ──────────────
export * from "./Inspection";
export * from "./Config";
export * from "./InspectionRegistry";
export * from "./DEFAULT_INSPECTION_REGISTRY";
export * from "./internal/SceneModelInspectionIndex";
export * from "./internal/createSceneModelInspectionIndex";
export * from "./internal/getInspectionIndex";
export * from "./inspections";

// ── Fix registries and built-in fixes ───────────────────────────
export * from "./Fix";
export * from "./params/FixSkipReason";
export * from "./FixRegistry";
export * from "./DEFAULT_FIX_REGISTRY";
export * from "./fixes";
export * from "./internal/splitGeometryAndRebuildMeshes";
export * from "./params/ApplyFixesParams";
export * from "./params/ApplyFixesProgress";
export * from "./ApplyFixesResult";
export * from "./applyFixes";
export * from "./tasks/applyFixesAsync";
export * from "./serializers/applyFixesResultToJson";

// ── Optimisation orchestrator ───────────────────────────────────
export * from "./params/OptimizeSceneModelParams";
export * from "./optimizeSceneModel";
