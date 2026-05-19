/**
 * # xeokit Section Caps
 *
 * ---
 *
 * **Generates filled cap geometry along arbitrary world-space cut planes
 * through a {@link model!scene.SceneModel | SceneModel}, so sliced models read
 * as solid cross-sections instead of hollow shells.**
 *
 * ---
 *
 * The `sectionCaps` module complements
 * {@link viewing!viewer.SectionPlane | SectionPlane}-style clipping: where a
 * SectionPlane hides everything on the clipped side of a plane,
 * `sectionCaps` *fills the hole* the plane leaves behind. Output is
 * baked into a caller-owned target {@link model!scene.SceneModel | SceneModel}
 * as flat `TrianglesPrimitive` meshes lying on the cut planes, one
 * {@link model!scene.SceneObject | SceneObject} per source object that
 * contributed at least one cap.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class buildSectionCaps {
 *       +(params) Promise~SDKResult~BuildSectionCapsResult~~
 *     }
 *     class canBuildSectionCaps {
 *       +(sourceModel) boolean
 *     }
 *     class clearSectionCaps {
 *       +(targetModel) void
 *     }
 *     class BuildSectionCapsParams {
 *       +sourceModel        : SceneModel
 *       +targetModel        : SceneModel
 *       +capPlanes          : CapPlane[]
 *       +capColor?          : Vec3
 *       +idPrefix?          : string
 *       +layerId?           : string
 *       +includeObjectIds?  : string[] | Set~string~
 *       +excludeObjectIds?  : string[] | Set~string~
 *       +includeObject?     : (SceneObject) =&gt; boolean
 *       +progressive?       : boolean | ProgressiveSpec
 *     }
 *     class CapPlane {
 *       +dir  : Vec3
 *       +dist : number
 *     }
 *     class ProgressiveSpec {
 *       +batchSize? : number
 *       +yield?     : () =&gt; Promise~void~
 *     }
 *     class BuildSectionCapsResult {
 *       +numObjectsWithCaps : number
 *       +numCapMeshes       : number
 *       +numUnclosedMeshes  : number
 *     }
 *     class SceneModel {
 *       <<scene>>
 *     }
 *     class SectionPlane {
 *       <<viewer>>
 *       +dir
 *       +dist
 *     }
 *     BuildSectionCapsParams "1" *-- "*" CapPlane : capPlanes
 *     BuildSectionCapsParams o-- SceneModel : sourceModel
 *     BuildSectionCapsParams o-- SceneModel : targetModel
 *     BuildSectionCapsParams o-- ProgressiveSpec : progressive
 *     buildSectionCaps ..> BuildSectionCapsParams : reads
 *     buildSectionCaps ..> BuildSectionCapsResult : returns
 *     canBuildSectionCaps ..> SceneModel : scans
 *     clearSectionCaps ..> SceneModel : destroys
 *     CapPlane <.. SectionPlane : copy dir + dist
 * ```
 *
 * <br>
 *
 * ## Pipeline
 *
 * For every triangle-bearing source {@link model!scene.SceneMesh | SceneMesh}
 * the extractor straddle-tests each plane, stitches the resulting
 * segments into closed loops, then triangulates them into cap meshes:
 *
 * ```mermaid
 * flowchart TD
 *     A[Source SceneModel] --> B[Walk triangle meshes]
 *     B --> C[Slice triangles against plane]
 *     C --> D[Stitch segments into loops]
 *     D --> E[Sutherland-Hodgman trim against other planes]
 *     E --> F[Classify outer / hole rings]
 *     F --> G[earcut triangulate]
 *     G --> H[Emit geometry + material + mesh]
 *     H --> I[Group meshes per source object]
 *     I --> J[Target SceneModel]
 *     D -.unclosed.-> K[numUnclosedMeshes diagnostic]
 * ```
 *
 * The orchestrating entry point is {@link buildSectionCaps}, which
 * accepts a {@link BuildSectionCapsParams} bundle and returns counts
 * via {@link BuildSectionCapsResult} inside an
 * {@link base!core.SDKResult | SDKResult}. Sibling helpers:
 *
 * - {@link canBuildSectionCaps} — predicate guard: skip the call
 *   when the source has no triangle-bearing geometry.
 * - {@link clearSectionCaps} — destroyed-aware wrapper for tearing
 *   the target SceneModel down.
 *
 * <br>
 *
 * ## Features
 *
 * - **Watertight cap fills** — every cut produces a closed,
 *   triangulated polygon (per source mesh per plane) so the model
 *   reads as a solid cross-section rather than a hollow shell.
 * - **Multi-plane caps** — caps from intersecting cut planes are
 *   trimmed against each other's kept half-spaces (Sutherland-Hodgman),
 *   so two cuts don't double-cover their shared corner.
 * - **Outer / hole topology** — loops are classified by signed area
 *   and holes attached to their tightest container, so cross-sections
 *   through hollow members (pipes, walls with openings) render with
 *   their interiors open rather than filled.
 * - **Hatch-pattern preservation** — the cap's
 *   {@link model!scene.SceneMaterial | SceneMaterial} inherits the source
 *   mesh material's `hatchPattern` (when present), so sectioned
 *   masonry, concrete, and metal read with the same engineering
 *   hatch convention as the rest of the model.
 * - **Per-mesh colour passthrough** — when no `capColor` is supplied,
 *   each cap inherits its source mesh's effective colour (material
 *   colour first, then mesh-level colour, then a neutral grey
 *   fallback). Reads better on multi-material BIM models than a
 *   single global tint.
 * - **{@link viewing!viewer.SectionPlane | SectionPlane}-compatible
 *   convention** — `CapPlane.dir` and `CapPlane.dist` match the
 *   accessors on a viewer-side SectionPlane verbatim, so a cap can
 *   be built directly from any clipping plane the host already drives.
 * - **Cross-Scene** — source and target
 *   {@link model!scene.SceneModel | SceneModels} may live in different
 *   Scenes.
 * - **Object filtering** — restrict the cap pass with
 *   `includeObjectIds`, `excludeObjectIds`, and/or an arbitrary
 *   `includeObject` predicate. Right for "cap walls + slabs but not
 *   furniture" or "cap whatever's visible right now."
 * - **ViewLayer parking** — pass `layerId` to assign every emitted
 *   SceneObject to a named
 *   {@link viewing!viewer.ViewLayer | ViewLayer}; the host can then hide,
 *   show, or style caps collectively.
 * - **Progressive emission** — yield between batches so very large
 *   models cap progressively without blocking the main thread.
 * - **Diagnostic counts** — `numUnclosedMeshes` flags non-watertight
 *   source geometry that produced no cap.
 *
 * <br>
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * <br>
 *
 * ## Quick Start
 *
 * The snippets below assume a {@link model!scene.Scene | Scene} with a
 * source {@link model!scene.SceneModel | SceneModel} already loaded (via any
 * SDK importer — for example, `DotBIMLoader` or `IFCLoader`).
 *
 * <br>
 *
 * ### 1) Import the entry points
 *
 * ```javascript
 * import {
 *   buildSectionCaps,
 *   canBuildSectionCaps,
 *   clearSectionCaps
 * } from "@xeokit/sdk/studio/systems/sectionCaps";
 * ```
 *
 * <br>
 *
 * ### 2) Cap one source model against one plane
 *
 * The caller creates the target {@link model!scene.SceneModel | SceneModel}
 * and passes it in — `buildSectionCaps` populates it. The plane
 * convention matches {@link viewing!viewer.SectionPlane | SectionPlane}: the
 * half-space `dot(dir, p) + dist > 0` is clipped (discarded) and the
 * cap's face normal is `+dir`.
 *
 * ```javascript
 * const sourceModel = scene.models["myModel"];
 * const targetModel = scene.createModel({ id: "myModel__caps" }).value;
 *
 * const result = await buildSectionCaps({
 *   sourceModel,
 *   targetModel,
 *   capPlanes: [
 *     { dir: [0, 1, 0], dist: -1.2 }   // horizontal cut at y = 1.2
 *   ]
 * });
 *
 * if (!result.ok) {
 *   console.error(result.error);
 *   targetModel.destroy();              // partial state may exist
 * } else {
 *   const { numObjectsWithCaps, numCapMeshes } = result.value;
 *   console.log(`${numCapMeshes} caps across ${numObjectsWithCaps} objects`);
 * }
 * ```
 *
 * <br>
 *
 * ### 3) Multi-plane caps
 *
 * Pass several planes to cut along independent axes. Each plane
 * produces its own cap set per source object, trimmed against the
 * kept half-space of every other plane so intersecting cuts don't
 * overlap at their shared corner.
 *
 * ```javascript
 * await buildSectionCaps({
 *   sourceModel,
 *   targetModel,
 *   capPlanes: [
 *     { dir: [0, 1, 0], dist:  -1.2 },  // floor cut
 *     { dir: [1, 0, 0], dist:  -5.0 },  // east-west cut
 *     { dir: [0, 0, 1], dist: -10.0 }   // north-south cut
 *   ]
 * });
 * ```
 *
 * <br>
 *
 * ### 4) Match an existing viewer SectionPlane
 *
 * {@link CapPlane} mirrors the `dir` / `dist` accessors on a
 * {@link viewing!viewer.SectionPlane | SectionPlane}, so the host's existing
 * clipping plane can be reused verbatim — cap geometry lands on the
 * same plane the viewer is already clipping against.
 *
 * ```javascript
 * const sectionPlane = view.sectionPlanes["floor"];
 *
 * await buildSectionCaps({
 *   sourceModel,
 *   targetModel,
 *   capPlanes: [
 *     { dir: sectionPlane.dir, dist: sectionPlane.dist }
 *   ]
 * });
 * ```
 *
 * <br>
 *
 * ### 5) Multiple cap passes into one target model
 *
 * `idPrefix` namespaces every emitted geometry, material, mesh, and
 * object id (`"{idPrefix}__{sourceObjectId}__…"`). Pick a unique
 * prefix per pass when running the extractor more than once into the
 * same target — e.g. one prefix per cap-plane set, or one per
 * source model when capping a federation against the same plane.
 *
 * ```javascript
 * await buildSectionCaps({
 *   sourceModel: scene.models["architectural"],
 *   targetModel,
 *   capPlanes,
 *   idPrefix: "cap_arch"
 * });
 *
 * await buildSectionCaps({
 *   sourceModel: scene.models["structural"],
 *   targetModel,
 *   capPlanes,
 *   idPrefix: "cap_struct"
 * });
 * ```
 *
 * <br>
 *
 * ### 6) Colour and hatch pattern
 *
 * `capColor` sets the RGB base colour of every emitted cap
 * {@link model!scene.SceneMaterial | SceneMaterial}. Omit `capColor` to
 * inherit each cap's tint from its source mesh's effective colour
 * (material colour first, then mesh-level colour, then a neutral
 * grey fallback) — useful on multi-material BIM models where a
 * single global tint would erase material differences. When the
 * corresponding source mesh's material carries a `hatchPattern`,
 * the cap material inherits it — sectioned masonry, concrete, or
 * metal then renders with the same engineering hatch as the rest
 * of the model.
 *
 * ```javascript
 * // Inherit per-mesh colour from the source material:
 * await buildSectionCaps({ sourceModel, targetModel, capPlanes });
 *
 * // Or override every cap with a uniform paper-white:
 * await buildSectionCaps({
 *   sourceModel, targetModel, capPlanes,
 *   capColor: [0.92, 0.93, 0.95]
 * });
 * ```
 *
 * <br>
 *
 * ### 7) Park caps on their own ViewLayer
 *
 * Pass `layerId` to assign every emitted SceneObject to a named
 * {@link viewing!viewer.ViewLayer | ViewLayer}. The host can then hide,
 * show, or restyle the caps collectively without touching the
 * source model.
 *
 * ```javascript
 * await buildSectionCaps({
 *   sourceModel,
 *   targetModel,
 *   capPlanes,
 *   layerId: "sectionCaps"
 * });
 * ```
 *
 * <br>
 *
 * ### 8) Filter which source objects get capped
 *
 * Restrict the cap pass with any combination of an id whitelist, an
 * id blacklist, and an arbitrary predicate. All three conditions
 * AND together when present.
 *
 * ```javascript
 * // Cap only specific objects:
 * await buildSectionCaps({
 *   sourceModel, targetModel, capPlanes,
 *   includeObjectIds: ["wall_01", "wall_02", "slab_03"]
 * });
 *
 * // Cap everything except a transient hidden set (large set ->
 * // prefer Set membership):
 * const hidden = new Set(currentlyHiddenIds);
 * await buildSectionCaps({
 *   sourceModel, targetModel, capPlanes,
 *   excludeObjectIds: hidden
 * });
 *
 * // Predicate filter — "cap walls + slabs only", from the semantic
 * // Data graph:
 * await buildSectionCaps({
 *   sourceModel, targetModel, capPlanes,
 *   includeObject: (obj) => {
 *     const ifcType = data.objects[obj.id]?.type;
 *     return ifcType === "IfcWallStandardCase"
 *         || ifcType === "IfcSlab";
 *   }
 * });
 *
 * // Predicate filter — "cap whatever's visible in this View":
 * await buildSectionCaps({
 *   sourceModel, targetModel, capPlanes,
 *   includeObject: (obj) => view.objects[obj.id]?.visible === true
 * });
 * ```
 *
 * <br>
 *
 * ### 9) Progressive emission
 *
 * For large source models, pass `progressive: true` so the function
 * yields between batches of source-object emissions and the caps
 * paint into the View as they build. Pass a {@link ProgressiveSpec}
 * for finer control.
 *
 * ```javascript
 * await buildSectionCaps({
 *   sourceModel,
 *   targetModel,
 *   capPlanes,
 *   progressive: {
 *     batchSize: 50,                        // source objects per yield
 *     yield: () => new Promise(resolve =>
 *       requestAnimationFrame(() => resolve())
 *     )
 *   }
 * });
 * ```
 *
 * <br>
 *
 * ### 10) Source and target in different Scenes
 *
 * The function only reads source geometry and writes to the target,
 * so the two {@link model!scene.SceneModel | SceneModels} may live in
 * different {@link model!scene.Scene | Scenes}. Useful when capping a
 * federation loaded in one Scene into a "drawings" Scene that the
 * host renders on a separate canvas / view.
 *
 * ```javascript
 * const liveScene     = new Scene();
 * const drawingsScene = new Scene();
 *
 * // ... load the building into liveScene["building"] ...
 *
 * const capTarget = drawingsScene.createModel({ id: "caps" }).value;
 *
 * await buildSectionCaps({
 *   sourceModel: liveScene.models["building"],
 *   targetModel: capTarget,
 *   capPlanes: [{ dir: [0, 1, 0], dist: -1.2 }]
 * });
 * ```
 *
 * <br>
 *
 * ### 11) Guard against unprojectable sources
 *
 * Point clouds and line-only models produce no caps.
 * {@link canBuildSectionCaps} reports whether the source has any
 * triangle-bearing geometry the cap builder can usefully consume,
 * so callers can skip the call instead of running it for nothing.
 *
 * ```javascript
 * if (canBuildSectionCaps(sourceModel)) {
 *   const targetModel = scene.createModel({ id: "caps" }).value;
 *   await buildSectionCaps({ sourceModel, targetModel, capPlanes });
 * }
 * ```
 *
 * <br>
 *
 * ### 12) Inspecting results
 *
 * {@link BuildSectionCapsResult} reports per-pass counts. The
 * `numUnclosedMeshes` field is a diagnostic — non-zero means the
 * source had non-watertight meshes whose cap segments didn't stitch
 * into closed loops. Cap coverage degrades on those meshes; meshes
 * with stitched loops still produce caps.
 *
 * ```javascript
 * const result = await buildSectionCaps({ / * ... * / });
 *
 * if (result.ok) {
 *   const { numObjectsWithCaps, numCapMeshes, numUnclosedMeshes } = result.value;
 *
 *   if (numUnclosedMeshes > 0) {
 *     console.warn(`${numUnclosedMeshes} source meshes were non-watertight`);
 *   }
 * }
 * ```
 *
 * <br>
 *
 * ### 13) Tearing down
 *
 * The caller owns the target SceneModel, so teardown is just
 * `targetModel.destroy()`. {@link clearSectionCaps} is a convenience
 * wrapper that no-ops if the target is null or already destroyed.
 * Running `buildSectionCaps` repeatedly into a freshly-created
 * target lets the host swap cap sets as the user moves the cut
 * plane.
 *
 * ```javascript
 * clearSectionCaps(targetModel);
 * ```
 *
 * @module sectionCaps
 */
export * from "./CapPlane";
export * from "./BuildSectionCapsParams";
export * from "./BuildSectionCapsResult";
export * from "./ProgressiveSpec";
export * from "./buildSectionCaps";
