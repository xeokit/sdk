/**
 * <img style="padding:20px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_docmodel_greyscale_icon.png"/>
 *
 * # xeokit Model Inspector
 *
 * ---
 *
 * **IDE-style inspect / quick-fix toolkit for {@link scene!SceneModel | SceneModel}.**
 *
 * ---
 *
 * Catches
 * data-integrity errors and performance / correctness warnings,
 * surfaces them as a structured report, and dispatches each
 * finding to a pluggable {@link Fix} that knows how to
 * remediate it. Mental model is `eslint`'s rule registry +
 * IntelliJ's "fix all problems" — bring your own rules and your
 * own remediations; the framework wires them together.
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Pipeline
 *
 * ```
 * inspectSceneModel ──► InspectionReport ──► applyFixes ──► ApplyFixesResult
 *      ▲                  { issues,           ▲              { fixed,
 *      │                    errors,           │                skipped,
 *      │                    warnings,         │                errors }
 *      │                    info,             │
 *      │                    byCode }          │
 *      │                                      │
 *      └──── re-inspect after fixes to see the post-fix state ───┘
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
 * import {modelInspector} from "@xeokit/sdk/demo";
 *
 * modelInspector.DEFAULT_FIX_REGISTRY.register({
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
 *   modelInspector,
 *   FixRegistry,
 *   mergeDuplicateGeometries,
 * } from "@xeokit/sdk/demo";
 *
 * const registry = new FixRegistry([
 *   mergeDuplicateGeometries,   // pick the built-ins you want
 *   myFix,
 * ]);
 * modelInspector.applyFixes({sceneModel, report, registry});
 * ```
 *
 * Last registration wins for a given code, so plugins can
 * override built-ins by registering after them. Use
 * `unregister(code)` to opt out.
 *
 * ## Built-in inspections
 *
 * One file per inspection under
 * {@link demo/modelInspector/inspections}, all pre-registered into
 * {@link DEFAULT_INSPECTION_REGISTRY}. Each inspection groups
 * codes by topical concern — one walk, multiple codes — so the
 * file count stays low and the registration order is meaningful.
 *
 * | Inspection                        | Codes                                                                                   |
 * | --------------------------------- | --------------------------------------------------------------------------------------- |
 * | {@link geometryDataIntegrity}        | `GEOMETRY_NO_POSITIONS`, `GEOMETRY_POSITIONS_LENGTH`, `GEOMETRY_NORMALS_LENGTH`, `GEOMETRY_UVS_LENGTH`, `GEOMETRY_AABB_NONFINITE`, `GEOMETRY_AABB_INVERTED`, `GEOMETRY_INDICES_LENGTH`, `GEOMETRY_INDEX_OUT_OF_RANGE` (errors) |
 * | {@link meshReferences}             | `MESH_DANGLING_GEOMETRY`, `MESH_DANGLING_MATERIAL`, `MESH_DANGLING_TRANSFORM`, `MESH_NONFINITE_MATRIX` (errors) |
 * | {@link materialAttributeBinding}      | `MATERIAL_TEXTURED_GEOMETRY_NO_UVS`, `MATERIAL_PBR_GEOMETRY_NO_NORMALS` (warnings) |
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
 * One file per fix under {@link demo/modelInspector/fixes}, all
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
 * ## Lifecycle constraints
 *
 *   - {@link inspectSceneModel} only reads state — runs before or
 *     after `sceneModel.finalize()`.
 *   - {@link applyFixes} mutates the SceneModel — strategies that
 *     call `createGeometry` / `createMesh` (notably the dedupe
 *     strategy) require `!sceneModel.finalized`.
 *   - {@link optimizeSceneModel} requires `!finalized` itself
 *     (its split pass calls `createGeometry`).
 *
 * Typical pipeline: load → inspect → applyFixes → re-inspect →
 * finalize → render.
 *
 * ## Putting it together
 *
 * ```ts
 * import {modelInspector} from "@xeokit/sdk/demo";
 *
 * const report = modelInspector.inspectSceneModel({
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
 * const fixResult = modelInspector.applyFixes({sceneModel, report});
 * if (!fixResult.ok) throw new Error(fixResult.error);
 *
 * const {fixed, skipped, errors} = fixResult.value;
 * console.log(
 *   `fixed ${fixed.length}, skipped ${skipped.length}, ` +
 *   `errors ${errors.length}`,
 * );
 *
 * // Re-inspect to see the post-fix state.
 * const after = modelInspector.inspectSceneModel({sceneModel});
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
 * @module modelInspector
 */

// ── Inspection types ────────────────────────────────────────────
export * from "./IssueSeverity";
export * from "./IssueHighlight";
export * from "./Issue";
export * from "./InspectionReport";
export * from "./InspectSceneModelParams";
export * from "./InspectProgress";
export * from "./inspectSceneModel";
export * from "./inspectSceneModelAsync";
export * from "./inspectionReportToJson";
export * from "./findSceneObjectsForGeometry";
export * from "./labelForCode";
export * from "./descriptionForCode";
export * from "./findResourceLabel";

// ── Inspection plugin framework + built-in inspections ──────────
export * from "./Inspection";
export * from "./InspectionRegistry";
export * from "./DEFAULT_INSPECTION_REGISTRY";
export * from "./SceneModelInspectionIndex";
export * from "./createSceneModelInspectionIndex";
export * from "./getInspectionIndex";
export * from "./inspections";

// ── Fix-strategy framework + built-in strategies ────────────────
export * from "./Fix";
export * from "./FixSkipReason";
export * from "./FixRegistry";
export * from "./DEFAULT_FIX_REGISTRY";
export * from "./fixes";
export * from "./splitGeometryAndRebuildMeshes";
export * from "./ApplyFixesParams";
export * from "./ApplyFixesProgress";
export * from "./ApplyFixesResult";
export * from "./applyFixes";
export * from "./applyFixesAsync";
export * from "./applyFixesResultToJson";

// ── Optimisation orchestrator ───────────────────────────────────
export * from "./OptimizeSceneModelParams";
export * from "./optimizeSceneModel";
