/**
 * # xeokit Drawings
 *
 * ---
 *
 * **Builds 2D orthographic drawings from a 3D {@link model!scene.SceneModel | SceneModel} —
 * wireframes, filled silhouettes, sectioned cut-aways, and title-block chrome —
 * emitted as a new SceneModel the host can render alongside the source.**
 *
 * ---
 *
 * The `drawings` module turns a {@link model!scene.Scene | Scene}'s 3D content into a
 * technical-drawing-style 2D view. Output is a new {@link model!scene.SceneModel | SceneModel}
 * whose hierarchy mirrors the source one-to-one (one {@link model!scene.SceneObject | SceneObject}
 * per source SceneObject, one {@link model!scene.SceneMesh | SceneMesh} per source mesh),
 * so picks on the drawing map cleanly back to the source.
 *
 * ```mermaid
 * classDiagram
 * direction TB
 *    class sourceModel["sourceModel : SceneModel"] {
 *      +objects : SceneObject[]
 *      +meshes : SceneMesh[]
 *      +geometries : SceneGeometry[]
 *      +aabb : AABB3
 *    }
 *    class params["params : DrawingProjectionParams"] {
 *      +sourceModel
 *      +targetModel
 *      +direction : "top"|"front"|...|Ray
 *      +clip? : DrawingClipSpec
 *      +panel? : PanelSpec
 *      +titleBlock? : TitleBlockSpec
 *      +progressive? : ProgressiveSpec
 *    }
 *    class targetModel["targetModel : SceneModel"] {
 *      +objects : SceneObject[] (mirrors source 1:1)
 *      +meshes : LinesPrimitive + TrianglesPrimitive
 *      +chrome : panel + title block
 *    }
 *    class buildDrawing["buildDrawing(params)"]
 *    sourceModel --o params : sourceModel
 *    targetModel --o params : targetModel
 *    params --> buildDrawing : consumes
 *    buildDrawing --> targetModel : populates
 *    buildDrawing ..> hle : edges + depth buffer
 *    buildDrawing ..> fills : silhouettes
 *    buildDrawing ..> chrome : panel + cartouche
 * ```
 *
 * <br>
 *
 * ## Pipeline
 *
 * ```mermaid
 * flowchart TD
 *     src[Source SceneModel] --> basis
 *     params[DrawingProjectionParams] --> basis
 *     basis[Resolve projection basis]
 *     basis --> hle[hle]
 *     basis --> fills[fills]
 *     basis --> chrome[chrome]
 *     hle --> emit
 *     fills --> emit
 *     chrome --> emit
 *     emit[Emit meshes one-to-one with source]
 *     emit --> tgt[Target SceneModel]
 * ```
 *
 * The orchestrating entry point is {@link buildDrawing}, which accepts a
 * {@link DrawingProjectionParams} bundle and returns the new SceneModel
 * inside an {@link base!core.SDKResult | SDKResult}. Under the hood the pipeline
 * composes three independent stages, each exposed as a submodule:
 *
 * - {@link hle | hle} — CPU-side orthographic depth-buffer
 *   rasterisation and edge-visibility testing.
 * - {@link fills | fills} — per-source-object filled silhouette
 *   extraction. Shares the HLE depth buffer for pixel-aligned boundaries.
 * - {@link chrome | chrome} — translucent backing panel and
 *   standard title-cartouche metadata.
 *
 * <br>
 *
 * ## Features
 *
 * - **Wireframe projection** — projected crease and boundary edges as
 *   `LinesPrimitive` meshes, with optional hidden-line elimination.
 * - **Solid fills** — per-source-object filled silhouettes with
 *   hidden-surface removal baked in.
 * - **Section cut-aways** — clip the source against an arbitrary plane to
 *   render plans, sections, and oblique slices.
 * - **Six face presets** plus arbitrary `{forward, up}` rays for diagonal
 *   and isometric views.
 * - **Title-block chrome** — translucent backing quad and a standard
 *   technical-drawing cartouche, sized to the projection frame.
 * - **Progressive emission** — yield between batches so very large
 *   drawings paint into the View as they build, without blocking the
 *   main thread.
 * - **One-to-one pickback** — output {@link model!scene.SceneObject | SceneObject}
 *   ids encode their source so picks resolve back to the original model.
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
 * The snippets below assume a {@link model!scene.Scene | Scene} with a source
 * {@link model!scene.SceneModel | SceneModel} already loaded (via any of the
 * SDK importers — for example, `DotBIMLoader` or `GLTFLoader`).
 *
 * <br>
 *
 * ### 1) Import the entry points
 *
 * ```javascript
 * import {
 *   buildDrawing,
 *   canBuildDrawing,
 *   clearDrawing
 * } from "@xeokit/sdk/presentations/drawings";
 * ```
 *
 * <br>
 *
 * ### 2) Project onto an AABB face
 *
 * The caller creates the target {@link model!scene.SceneModel | SceneModel}
 * and passes it in — `buildDrawing` populates it. Six face presets
 * resolve to axis-aligned views of the source AABB: `"top"`,
 * `"bottom"`, `"front"`, `"back"`, `"left"`, `"right"`.
 *
 * ```javascript
 * const targetResult = scene.createModel({ id: "myModel__top" });
 * if (!targetResult.ok) {
 *   console.error(targetResult.error);
 * }
 * const targetModel = targetResult.value;
 *
 * const result = await buildDrawing({
 *   sourceModel: scene.models["myModel"],
 *   targetModel,
 *   direction:   "top"
 * });
 *
 * if (!result.ok) {
 *   console.error(result.error);
 *   targetModel.destroy();                 // partial state may exist
 * }
 * ```
 *
 * The new SceneModel renders alongside the source in the same
 * {@link viewing!viewer.View | View} and picks back to source SceneObjects
 * by stripping `"__" + targetModel.id` from the picked object's id.
 *
 * Source and target may also live in different Scenes — `buildDrawing`
 * reads world orientation and collision data from `sourceModel.scene`
 * and writes only to `targetModel`.
 *
 * <br>
 *
 * ### 3) Project along an arbitrary ray
 *
 * Pass a {@link DrawingProjectionRay} for oblique, diagonal, or isometric
 * views. `forward` is the camera-look direction; `up` (optional) selects
 * which world direction reads as "up" on the image.
 *
 * ```javascript
 * const targetModel = scene.createModel({ id: "myModel__iso" }).value;
 *
 * await buildDrawing({
 *   sourceModel: scene.models["myModel"],
 *   targetModel,
 *   direction: {
 *     forward: [1, -1, 1],     // looking down-and-forward
 *     up:      [0, 1, 0]       // world Y reads as "up" on the image
 *   }
 * });
 * ```
 *
 * <br>
 *
 * ### 4) Hidden-line elimination
 *
 * Pass `hideHidden: true` to drop edges occluded by other source meshes
 * along the projection direction. Pass an {@link hle.HLEOptions | HLEOptions} object to
 * tune resolution, per-edge sample count, and depth bias.
 *
 * <img style="padding: 8px 0" src="../../assets/buildDrawing-hle.svg" alt="HLE pipeline — triangles rasterise into a depth buffer, then each edge's samples are tested against the buffer to split it into visible and occluded sub-segments"/>
 *
 ```javascript
 * const targetModel = scene.createModel({ id: "myModel__front" }).value;
 *
 * await buildDrawing({
 *   sourceModel: scene.models["myModel"],
 *   targetModel,
 *   direction:   "front",
 *   hideHidden: {
 *     resolution: 4096,        // depth-buffer pixels (longer axis)
 *     samples:    8,           // per-edge visibility test points
 *     tolerance:  0.005        // 5 mm depth bias
 *   }
 * });
 * ```
 *
 * <br>
 *
 * ### 5) Solid fills
 *
 * Pass `fill: true` to emit a `TrianglesPrimitive` silhouette per source
 * SceneObject alongside the wireframe. Fill and wireframe derive from the
 * same depth buffer, so silhouette boundaries are pixel-aligned with the
 * line work. Pass a {@link fills.FillSpec | FillSpec} to customise.
 *
 * ```javascript
 * const targetModel = scene.createModel({ id: "myModel__solid" }).value;
 *
 * await buildDrawing({
 *   sourceModel: scene.models["myModel"],
 *   targetModel,
 *   direction:   "front",
 *   hideHidden:  true,
 *   fill: {
 *     color:   [0.92, 0.93, 0.95],
 *     opacity: 1.0
 *   }
 * });
 * ```
 *
 * To emit fills *without* wireframe lines, also set `lines: false`.
 *
 * <br>
 *
 * ### 6) Section cut-away
 *
 * Pass `clip` to render a sliced cross-section. Two shapes:
 *
 * - `{depth}` — plane perpendicular to the projection direction, at the
 *   given basis-space depth. The side closer to the camera is discarded.
 * - `{point, normal}` — arbitrary world-space plane. The side `normal`
 *   points toward is kept.
 *
 * ```javascript
 * // Architectural plan: cut at floor level, keep everything below.
 * const targetModel = scene.createModel({ id: "myModel__plan" }).value;
 *
 * await buildDrawing({
 *   sourceModel: scene.models["myModel"],
 *   targetModel,
 *   direction:   "top",
 *   hideHidden:  true,
 *   fill:        true,
 *   clip: { depth: -1.2 }      // basis-space d of the cut plane
 * });
 * ```
 *
 * <br>
 *
 * ### 7) Frame, panel, and title block
 *
 * Chrome rounds out the technical-drawing look. The frame is a rectangle
 * around the projected geometry; the panel is a translucent backing quad;
 * the title block is a standard cartouche in the bottom-right corner.
 *
 * <img style="padding: 8px 0" src="../../assets/buildDrawing-sheet.svg" alt="Composed drawing sheet showing the layering of panel, fills, wireframe, frame, and title block emitted by one buildDrawing call"/>
 *
 * ```javascript
 * const targetModel = scene.createModel({ id: "myModel__sheet" }).value;
 *
 * await buildDrawing({
 *   sourceModel: scene.models["myModel"],
 *   targetModel,
 *   direction:   "front",
 *   hideHidden:  true,
 *   fill:        true,
 *
 *   frame:      1.5,                       // 1.5 world-unit margin
 *   frameColor: [0.05, 0.25, 0.85],
 *
 *   panel: {
 *     color:   [0.96, 0.97, 0.99],
 *     opacity: 0.55
 *   },
 *
 *   titleBlock: {
 *     title: "BUILDING A — FRONT ELEVATION",
 *     rows: [
 *       { label: "PROJECT", value: "TOWER 42"   },
 *       { label: "SCALE",   value: "1 : 100"    },
 *       { label: "DATE",    value: "2026-05-14" }
 *     ]
 *   }
 * });
 * ```
 *
 * <br>
 *
 * ### 8) Progressive emission
 *
 * For drawings of large source models, pass `progressive: true` so the
 * function yields between batches of `createObject` calls and the
 * projection paints into the View as it builds. Pass a
 * {@link ProgressiveSpec} for finer control.
 *
 * ```javascript
 * const targetModel = scene.createModel({ id: "myModel__progressive" }).value;
 *
 * await buildDrawing({
 *   sourceModel: scene.models["myModel"],
 *   targetModel,
 *   direction:   "top",
 *   hideHidden:  true,
 *   progressive: {
 *     batchSize: 50,                       // SceneObjects per yield
 *     yield: () => new Promise(resolve =>
 *       requestAnimationFrame(() => resolve())
 *     )
 *   }
 * });
 * ```
 *
 * <br>
 *
 * ### 9) Park drawings on their own ViewLayer
 *
 * Pass `layerId` to assign every emitted SceneObject to a named
 * {@link viewing!viewer.ViewLayer | ViewLayer}. The host can then hide, show, or
 * style the drawing collectively without touching the source model.
 *
 * ```javascript
 * const targetModel = scene.createModel({ id: "myModel__top" }).value;
 *
 * await buildDrawing({
 *   sourceModel: scene.models["myModel"],
 *   targetModel,
 *   direction:   "top",
 *   layerId:     "drawings"
 * });
 * ```
 *
 * <br>
 *
 * ### 10) Guard against unprojectable sources
 *
 * Point clouds, line-only models, and surface meshes without
 * `edgeIndices` produce empty drawings. {@link canBuildDrawing} reports
 * whether the source has anything the projector can usefully emit, so
 * callers can skip the call instead of letting it fail with a
 * "no projectable edges or fills" error.
 *
 * ```javascript
 * const sourceModel = scene.models["myModel"];
 *
 * if (canBuildDrawing(sourceModel, "either")) {
 *   const targetModel = scene.createModel({ id: "myModel__top" }).value;
 *   await buildDrawing({ sourceModel, targetModel, / *…* / });
 * }
 * ```
 *
 * <br>
 *
 * ### 11) Tearing down
 *
 * The caller owns the target SceneModel, so teardown is just
 * `targetModel.destroy()`. {@link clearDrawing} is a convenience
 * wrapper that no-ops if the target is null or already destroyed.
 *
 * ```javascript
 * clearDrawing(targetModel);
 * ```
 *
 * @module drawings
 */
export * from "./DrawingProjectionFace";
export * from "./DrawingProjectionRay";
export * from "./DrawingProjectionDirection";
export * from "./ProjectionBasis";
export * from "./DrawingProjectionParams";
export * from "./DrawingClipSpec";
export * from "./ProgressiveSpec";

export * as hle    from "./hle";
export * as fills  from "./fills";
export * as chrome from "./chrome";
export * as labels from "./labels";

export * from "./buildDrawing";
export * from "./buildDrawingPanel";
