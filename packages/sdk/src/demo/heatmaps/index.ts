/**
 * # Heat Maps
 *
 * Demo-grade heat-map utilities for SceneModels. Two related entry
 * points:
 *
 *   - {@link applyHeatMapMaterials} — bake a per-geometry heat map
 *     from a caller-supplied scalar field across an entire SceneModel.
 *   - {@link paintHeatMapPoint} — paint a single brush of texels onto
 *     one mesh's heat-map texture, given a world-space point.
 *
 * ## Apply Heat-Map Materials
 *
 * `applyHeatMapMaterials` walks an already-populated `SceneModel`,
 * paints a per-geometry heat map from a caller-supplied scalar field,
 * and binds the resulting `SceneMaterial` to the matching meshes.
 * Each visible `SceneGeometry` ends up with its own bespoke colour
 * map and UV layout — heat maps are only meaningful for the geometry
 * they were painted for.
 *
 * The default scalar field is vertex elevation along the
 * SceneModel's worldUp axis (handy for quick "low = blue, high =
 * red" gradients across a building). Pass a `scalars` callback to
 * supply your own — FEA stress, sensor temperatures, daylight
 * irradiance, anything that's defined per vertex.
 *
 * Supports a few useful knobs out of the box:
 *
 *   - **`range`** chooses the scalar normalisation strategy: a fixed
 *     `[lo, hi]` for cross-scene comparability, the auto-computed
 *     union range, or `"perGeometry"` to stretch each geometry to its
 *     own min/max.
 *   - **`grid`** overlays a debug grid onto every heat map so you
 *     can see how the planar UV projection laid the geometry out.
 *   - **`preserveExistingUvs`** honours pre-baked UVs (e.g. a
 *     hand-built cube unwrap) instead of re-projecting.
 *   - **`transparentOpacityFloor`** keeps glass / curtain-wall
 *     materials translucent in the painted heat map so the gradient
 *     reads through the transparency.
 *
 * ## How `SceneModel` lets you mutate an object
 *
 * `SceneModel` exposes object mutation at two levels, and this is
 * deliberate:
 *
 *   1. **Replace the object's meshes.** This is the supported
 *      channel for mutating *what* an object is — its geometry, its
 *      material binding, the bundle of meshes that make it up. The
 *      pattern is detach + destroy + recreate + reattach: snapshot a
 *      mesh's params, `sceneObj.removeMesh(id)` then `mesh.destroy()`,
 *      then `sceneModel.createMesh({…})` followed by
 *      `sceneObj.addMesh(newMesh.id)` with the new bindings. The
 *      `SceneObject` keeps its identity and id; only the meshes
 *      underneath it churn.
 *
 *      `applyHeatMapMaterials` does exactly this — for every object
 *      it destroys the loaded meshes whose geometry was painted and
 *      recreates them, this time bound to the per-geometry
 *      heat-map `SceneMaterial` (with the same `id`, `matrix`,
 *      `opacity`, and `parentTransform` so nothing else moves).
 *
 *   2. **Change view-/transform-level attributes in place.** Color,
 *      opacity, the local matrix on a `SceneMesh`, the position /
 *      rotation / scale on a `SceneTransform` — these have setters
 *      that fire change events the renderer subscribes to, so they
 *      mutate live without rebuilding anything.
 *
 * Why force the destroy + recreate at level (1) rather than allowing
 * `mesh.material = newMaterial`? It simplifies the bookkeeping for
 * everything downstream. In particular the WebGL renderer packs
 * meshes into batches sized for the GPU; when a mesh's *material*
 * changes (different texture atlas, different shader variant) the
 * mesh would have to migrate to a different batch — fragmenting the
 * source batch and disturbing every other mesh that lived alongside
 * it. Treating each mesh as immutable means the renderer can react
 * to two simple events: "mesh created — pack it" and "mesh destroyed
 * — drop its slot." No migration, no compaction, no fix-up of
 * references held by other subsystems.
 *
 * ## Usage
 *
 * ```ts
 * import {heatmaps} from "@xeokit/sdk/demo";
 *
 * const result = heatmaps.applyHeatMapMaterials({
 *   sceneModel,
 *   // Default scalar field is vertex elevation along worldUp; pass
 *   // your own to drive the gradient off real data.
 *   scalars: (geom) => geomToTemperatures(geom),
 *   range: [-10, 40],          // °C, fixed scale across the scene
 *   textureSize: 512,
 *   grid: true,                // overlay debug grid on each heat map
 *   transparentOpacityFloor: 0.5,
 * });
 * if (!result.ok) throw new Error(result.error);
 * ```
 *
 * @module demo/heatmaps
 */

export * from "./ApplyHeatMapMaterialsParams";
export * from "./applyHeatMapMaterials";
export * from "./PaintHeatMapPointParams";
export * from "./PaintHeatMapPointResult";
export * from "./paintHeatMapPoint";
