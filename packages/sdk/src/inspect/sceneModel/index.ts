/**
 * <img style="padding:20px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_docmodel_greyscale_icon.png"/>
 *
 * # xeokit Model Inspector
 *
 * ---
 *
 * **IDE-style inspect / quick-fix toolkit for {@link model!scene.SceneModel | SceneModel}.**
 *
 * ---
 *
 * Catches data-integrity errors and performance / correctness
 * warnings, surfaces them as a structured report, and dispatches
 * each finding to a pluggable {@link Fix} that knows how to
 * remediate it. Mental model is `eslint`'s rule registry +
 * IntelliJ's "fix all problems" — bring your own rules and your
 * own remediations; the framework wires them together.
 *
 * <br>
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
 * <br>
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
 * <br>
 *
 * ## Features
 *
 * - **Pluggable rules** — {@link Inspection}s registered into an
 *   {@link InspectionRegistry} produce typed {@link Issue}s; the
 *   shipped {@link DEFAULT_INSPECTION_REGISTRY} covers structural
 *   integrity, dangling references, geometry quality, transform
 *   cycles, texture sanity, and more.
 * - **Pluggable fixes** — {@link Fix}es registered into a
 *   {@link FixRegistry} claim issue codes and apply remediation in
 *   place. {@link DEFAULT_FIX_REGISTRY} ships ~20 built-ins;
 *   last-registration-wins lets plugins override built-ins by
 *   re-registering for the same code.
 * - **Structured `byCode` payloads** — `Issue.context` carries the
 *   strategy-readable payload (e.g. `{geometryId}`,
 *   `{duplicates: [ids]}`) so fix code never has to parse a
 *   human-readable message.
 * - **Severity tiers** — issues split into `errors`, `warnings`,
 *   and `info`. Errors block downstream optimisation
 *   ({@link optimizeSceneModel} refuses to run with any errors
 *   present) because auto-fixing them would mask data corruption.
 * - **Opt-in expensive walks** — geometry-quality / duplicate /
 *   similarity / dense / oversize checks are off by default and
 *   enabled via `checkX` flags so a default inspection stays
 *   cheap.
 * - **Re-inspection loop** — typical pipeline is
 *   inspect → fix → re-inspect to see the post-fix state.
 * - **Async variants** — {@link inspectSceneModelAsync} +
 *   {@link applyFixesAsync} yield to the host periodically so very
 *   large models don't block the main thread.
 * - **Orchestrator facade** — {@link optimizeSceneModel} wraps the
 *   "inspect → split oversized geometries → prune orphans" path
 *   when callers want a one-call convenience.
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * Three core artefacts:
 *
 *   - {@link Issue} — one finding (severity, code, message,
 *     resourceId, structured `context`). The `context` field
 *     carries strategy-readable payload (`{geometryId}`,
 *     `{duplicates: [ids]}`, …) so fix code never has to parse
 *     the message.
 *
 *   - {@link InspectionReport} — `{issues, errors, warnings,
 *     info, byCode}`. The `byCode` `Map<code, Issue[]>` is the
 *     canonical "set of issue lists" view that fix dispatch
 *     iterates, and that the demo example (see
 *     `examples/ValidateSceneModel_Duplex`) groups by in its UI.
 *
 *   - {@link Fix} — `{codes[], description, apply}`. The
 *     `apply` function is the fix itself; `codes` is the list of
 *     {@link Issue.code | issue codes} the strategy claims.
 *
 * ## Plugin registries
 *
 * Both halves of the pipeline are pluggable through symmetric
 * registries:
 *
 *   - {@link InspectionRegistry} — list of {@link Inspection}s
 *     {@link inspectSceneModel} walks. Singleton at
 *     {@link DEFAULT_INSPECTION_REGISTRY}; plugins register
 *     additional rules into it on import. Inspection registration
 *     is append-only — adding a rule never removes an existing
 *     one.
 *   - {@link FixRegistry} — per-code dispatch table
 *     {@link applyFixes} reaches into. Singleton at
 *     {@link DEFAULT_FIX_REGISTRY}; plugins register
 *     replacements for built-in fixes by re-registering against
 *     the same code (last-registration-wins).
 *
 * Tests / one-off pipelines build fresh registries instead and
 * pass them via the matching `registry` field on the params
 * object.
 *
 * ```ts
 * // Plug a strategy into the singleton — every applyFixes() call
 * // sees it from now on.
 * import {sceneModelInspector} from "@xeokit/sdk/demo";
 *
 * sceneModelInspector.DEFAULT_FIX_REGISTRY.register({
 *   codes: ["MyApp/STALE_PROPERTY_SET"],
 *   description: "Prune deprecated property sets",
 *   apply(issue, sceneModel) {
 *     // … remediation in place; return {fixed: true} on success
 *     return {ok: true, value: {fixed: true}};
 *   },
 * });
 * ```
 *
 * ```ts
 * // Or build a one-off registry — leaves the default untouched.
 * import {
 *   sceneModelInspector,
 *   FixRegistry,
 *   mergeDuplicateGeometries,
 * } from "@xeokit/sdk/demo";
 *
 * const registry = new FixRegistry([
 *   mergeDuplicateGeometries,   // pick the built-ins you want
 *   myFix,
 * ]);
 * sceneModelInspector.applyFixes({sceneModel, report, registry});
 * ```
 *
 * Last registration wins for a given code, so plugins can
 * override built-ins by registering after them. Use
 * `unregister(code)` to opt out.
 *
 * ## Built-in inspections
 *
 * One file per inspection under
 * {@link demo/sceneModelInspector/inspections}, all pre-registered into
 * {@link DEFAULT_INSPECTION_REGISTRY}. Each inspection groups
 * codes by topical concern — one walk, multiple codes — so the
 * file count stays low and the registration order is meaningful.
 *
 * | Inspection                        | Codes                                                                                   |
 * | --------------------------------- | --------------------------------------------------------------------------------------- |
 * | {@link geometryDataIntegrity}        | `GEOMETRY_NO_POSITIONS`, `GEOMETRY_POSITIONS_LENGTH`, `GEOMETRY_NORMALS_LENGTH`, `GEOMETRY_UVS_LENGTH`, `GEOMETRY_AABB_NONFINITE`, `GEOMETRY_AABB_INVERTED`, `GEOMETRY_INDICES_LENGTH`, `GEOMETRY_INDEX_OUT_OF_RANGE` (errors) |
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
 * One file per fix under {@link demo/sceneModelInspector/fixes}, all
 * pre-registered into {@link DEFAULT_FIX_REGISTRY}.
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
 * Codes deliberately without a built-in fix
 * (`MESH_DANGLING_*`, `MESH_NONFINITE_MATRIX`, every malformed
 * `GEOMETRY_*`, `TRANSFORM_CYCLE`) need user judgement —
 * auto-fixing them would mask data corruption or silently change
 * semantics.
 *
 * Typical pipeline: load → inspect → applyFixes → re-inspect → render.
 *
 * ## Putting it together
 *
 * ```ts
 * import {sceneModelInspector} from "@xeokit/sdk/demo";
 *
 * const report = sceneModelInspector.inspectSceneModel({
 *   sceneModel,
 *   checkDuplicateGeometries: true,   // opt-in: byte-identical detection
 *   checkSimilarGeometries:   true,   // opt-in: pose-invariant shape match
 * });
 *
 * if (report.errors.length > 0) {
 *   // Errors block downstream optimisation — auto-fixing them
 *   // would mask data corruption. Surface to the user instead.
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
 * // Re-inspect to see the post-fix state.
 * const after = sceneModelInspector.inspectSceneModel({sceneModel});
 * ```
 *
 * {@link optimizeSceneModel} is the broader orchestrator — runs
 * inspection up-front (refusing to run if any errors are
 * present), splits oversized geometries, and prunes orphan
 * resources. Use it when you want the convenience facade; reach
 * for `inspectSceneModel` / `applyFixes` directly when you want
 * IDE-style granularity (per-rule remediation, custom strategies,
 * partial application).
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
export * from "./async/inspectSceneModelAsync";
export * from "./serializers/inspectionReportToJson";
export * from "./labels/findSceneObjectsForGeometry";
export * from "./labels/labelForCode";
export * from "./labels/descriptionForCode";
export * from "./labels/findResourceLabel";

// ── Inspection plugin framework + built-in inspections ──────────
export * from "./Inspection";
export * from "./Config";
export * from "./InspectionRegistry";
export * from "./DEFAULT_INSPECTION_REGISTRY";
export * from "./internal/SceneModelInspectionIndex";
export * from "./internal/createSceneModelInspectionIndex";
export * from "./internal/getInspectionIndex";
export * from "./inspections";

// ── Fix-strategy framework + built-in strategies ────────────────
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
export * from "./async/applyFixesAsync";
export * from "./serializers/applyFixesResultToJson";

// ── Optimisation orchestrator ───────────────────────────────────
export * from "./params/OptimizeSceneModelParams";
export * from "./optimizeSceneModel";
