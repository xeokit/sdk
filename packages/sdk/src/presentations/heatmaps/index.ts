/**
 * # xeokit Heat Maps
 *
 * ---
 *
 * **Per-geometry heat-map painting for {@link model!scene.SceneModel | SceneModels}
 * — bake a scalar field into a coloured texture, then optionally
 * paint live brush strokes onto individual meshes' textures
 * afterwards.**
 *
 * ---
 *
 * The `heatmaps` module mutates a SceneModel in place to display a
 * per-vertex scalar field (elevation, temperature, FEA stress,
 * daylight irradiance, anything indexable per vertex) as a coloured
 * heat map on every triangle-bearing geometry. Two entry points:
 *
 * - {@link applyHeatMapMaterials} — bulk: walk a SceneModel, paint
 *   each geometry's heat-map texture, swap in heat-map materials on
 *   every mesh.
 * - {@link paintHeatMapPoint} — per-brush: draw a single radial
 *   brush of texels onto one mesh's already-painted heat-map
 *   texture, given a world-space point.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction LR
 *     class applyHeatMapMaterials {
 *       +(params) SDKResult~void~
 *     }
 *     class paintHeatMapPoint {
 *       +(params) SDKResult~PaintHeatMapPointResult~
 *     }
 *     class ApplyHeatMapMaterialsParams {
 *       +sceneModel               : SceneModel
 *       +scalars?                 : (geom) =&gt; ArrayLike~number~
 *       +range?                   : Vec2 | "perGeometry"
 *       +textureSize?             : number
 *       +ramp?                    : HeatMapStop[]
 *       +roughness? / metallic?
 *       +backgroundColor?         : Vec3
 *       +grid?                    : boolean | HeatMapGridOptions
 *       +preserveExistingUvs?     : boolean
 *       +transparentOpacityFloor? : number
 *     }
 *     class PaintHeatMapPointParams {
 *       +sceneMesh : SceneMesh
 *       +worldPos  : Vec3
 *       +color     : Vec3
 *       +radius?   : number
 *       +opacity?  : number
 *       +falloff?  : number
 *       +worldUp?  : Vec3
 *     }
 *     class PaintHeatMapPointResult {
 *       +texture     : SceneTexture
 *       +centerTexel : Vec2
 *       +bounds      : Vec4
 *     }
 *     class SceneModel {
 *       <<scene>>
 *     }
 *     class SceneMesh {
 *       <<scene>>
 *     }
 *     class SceneTexture {
 *       <<scene>>
 *     }
 *     class paintHeatMap {
 *       <<procgen>>
 *     }
 *     applyHeatMapMaterials ..> ApplyHeatMapMaterialsParams : reads
 *     applyHeatMapMaterials ..> SceneModel : mutates in place
 *     applyHeatMapMaterials ..> paintHeatMap : bakes textures
 *     paintHeatMapPoint ..> PaintHeatMapPointParams : reads
 *     paintHeatMapPoint ..> SceneMesh : reads world-up axis
 *     paintHeatMapPoint ..> PaintHeatMapPointResult : returns
 *     paintHeatMapPoint ..> SceneTexture : mutates imageData
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Per-geometry texture + UV layout** — heat maps are only
 *   meaningful for the geometry they were painted for, so each
 *   {@link model!scene.SceneGeometry | SceneGeometry} ends up with its
 *   own bespoke colour map and UV unwrap. Heat maps don't pool
 *   across geometries.
 * - **Caller-supplied scalar field** — pass a `scalars` callback
 *   that returns `geometry.positionsCompressed.length / 3` values
 *   per geometry; the default is per-vertex world-space elevation
 *   along `worldUp`, useful as a smoke-test "low = blue, high = red"
 *   gradient.
 * - **Three normalisation strategies** — fixed `[lo, hi]` for
 *   cross-scene comparability, auto-computed union range, or
 *   `"perGeometry"` for per-geometry stretch (each geometry uses
 *   its full ramp regardless of where it sits in the global
 *   distribution).
 * - **Debug grid overlay** — `grid: true` paints a coordinate grid
 *   onto every heat map so the planar UV unwrap is visible at a
 *   glance; useful for diagnosing collapsed projections.
 * - **Transparent passthrough** — when a mesh's original material
 *   was translucent (IFC glass, curtain wall), the heat map adopts
 *   `max(originalOpacity, transparentOpacityFloor)` and the
 *   original `alphaMode`, so glass still reads as glass while
 *   showing the gradient.
 * - **Preserve pre-baked UVs** — `preserveExistingUvs: true`
 *   honours `uvsCompressed` already on a SceneGeometry instead of
 *   re-projecting. Right for shapes where planar projection
 *   collapses faces (axis-aligned boxes, cylinders aligned with
 *   worldUp) and the caller has a hand-built unwrap.
 * - **Live brush updates** — {@link paintHeatMapPoint} mutates a
 *   single mesh's heat-map {@link model!scene.SceneTexture | SceneTexture}
 *   in place; useful for "splat sensor readings as they arrive"
 *   without rebaking the whole model. Returns the bounds of mutated
 *   texels so the host can re-upload just that sub-region if
 *   needed.
 * - **Detach + destroy + recreate pattern** — `applyHeatMapMaterials`
 *   uses the SDK's supported mesh-mutation pattern: snapshot mesh
 *   params, detach + destroy the old mesh, create a fresh mesh with
 *   the same id bound to the heat-map material, re-attach to the
 *   same SceneObject. The object keeps its identity; only the mesh
 *   churn happens. Why: the renderer packs meshes into batches
 *   sized for the GPU, so changing a mesh's material in place would
 *   require batch migration — destroy + recreate keeps the renderer
 *   bookkeeping to two simple events.
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
 * ### 1) Import the entry points
 *
 * ```javascript
 * import {
 *   applyHeatMapMaterials,
 *   paintHeatMapPoint
 * } from "@xeokit/sdk/presentations/heatmaps";
 * ```
 *
 * <br>
 *
 * ### 2) Bake elevation heat maps (default scalar field)
 *
 * Walks the SceneModel and paints every triangle-bearing geometry
 * with a per-vertex elevation gradient (world-space height along
 * `worldUp`). Useful as a smoke test before wiring a real field.
 *
 * ```javascript
 * const result = applyHeatMapMaterials({
 *   sceneModel: scene.models["building"]
 * });
 *
 * if (!result.ok) console.error(result.error);
 * ```
 *
 * <br>
 *
 * ### 3) Supply a custom scalar field
 *
 * Pass a `scalars` callback that returns one value per vertex.
 * The example below treats `geom.id` as a key into a precomputed
 * temperature buffer.
 *
 * ```javascript
 * applyHeatMapMaterials({
 *   sceneModel,
 *   scalars: (geom) => temperaturesByGeometryId[geom.id],
 *   range:   [-10, 40],                // °C, fixed scale across the scene
 *   textureSize: 1024
 * });
 * ```
 *
 * <br>
 *
 * ### 4) Pick a normalisation strategy
 *
 * The `range` field drives how each geometry's scalar values map
 * to the colour ramp's `[0, 1]` domain.
 *
 * ```javascript
 * applyHeatMapMaterials({ sceneModel });                                 // auto union range
 * applyHeatMapMaterials({ sceneModel, range: [0, 100] });                // fixed range
 * applyHeatMapMaterials({ sceneModel, range: "perGeometry" });           // stretch each geometry
 * ```
 *
 * <br>
 *
 * ### 5) Debug the UV unwrap with a grid
 *
 * Set `grid: true` to overlay a grid onto every heat map — handy
 * when planar projection collapsed a face and the gradient looks
 * wrong. Pass a `HeatMapGridOptions` object to tune cell size and
 * colour.
 *
 * ```javascript
 * applyHeatMapMaterials({
 *   sceneModel,
 *   grid: true
 * });
 * ```
 *
 * <br>
 *
 * ### 6) Keep glass translucent
 *
 * `transparentOpacityFloor` controls the heat map's opacity floor
 * when the original mesh material was transparent. The heat map
 * adopts `max(originalOpacity, this)` so glass stays glass-like
 * while showing the gradient.
 *
 * ```javascript
 * applyHeatMapMaterials({
 *   sceneModel,
 *   transparentOpacityFloor: 0.5      // glass-readable
 * });
 *
 * applyHeatMapMaterials({
 *   sceneModel,
 *   transparentOpacityFloor: 1.0      // force opaque
 * });
 * ```
 *
 * <br>
 *
 * ### 7) Brush onto a single mesh's heat map
 *
 * After `applyHeatMapMaterials` has painted the model,
 * {@link paintHeatMapPoint} mutates one mesh's heat-map texture in
 * place — useful for "splat sensor readings as they arrive" or for
 * letting the user mark up a heat map interactively.
 *
 * ```javascript
 * const result = paintHeatMapPoint({
 *   sceneMesh: scene.models["building"].meshes["wall_42"],
 *   worldPos: [12.0, 1.5, 4.2],
 *   color:    [1, 0, 0],               // sRGB red
 *   radius:   8,
 *   opacity:  0.8,
 *   falloff:  1.5
 * });
 *
 * if (result.ok) {
 *   const { texture, bounds } = result.value;
 *   // `bounds` is the inclusive [x0,y0,x1,y1] of mutated texels.
 * }
 * ```
 *
 * <br>
 *
 * ### 8) Lifetime
 *
 * Both functions mutate `sceneModel` directly — there is no
 * separate "heat-map state" to dispose. To revert a model, reload
 * it (or hold the original meshes' params for a manual restore).
 *
 * @module heatmaps
 */

export * from "./ApplyHeatMapMaterialsParams";
export * from "./applyHeatMapMaterials";
export * from "./PaintHeatMapPointParams";
export * from "./PaintHeatMapPointResult";
export * from "./paintHeatMapPoint";
