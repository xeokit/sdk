/**
 * # Apply IFC-Typed Procedural Materials
 *
 * Demo-grade utility that walks an already-populated `SceneModel` +
 * `DataModel` pair, looks up each `SceneObject`'s IFC type from the
 * matching `DataObject`, and binds a procedurally-painted PBR
 * `SceneMaterial` to that object's meshes — `IfcWall` →
 * `paintWoodPlank`, `IfcSlab` → `paintConcrete`, `IfcWindow` →
 * `paintGlass`, etc. Materials are created lazily (one shared
 * `SceneMaterial` per IFC type) and added to the same `SceneModel`
 * alongside their three textures (colour, normal, metallic-roughness).
 *
 * Geometries that ship without UVs or normals (typical for IFC
 * sources) get planar UVs and area-weighted smooth normals
 * synthesised in place so the painted textures actually tile across
 * surfaces.
 *
 * The IFC-type → painter table ({@link DEFAULT_IFC_PAINTERS}) covers
 * the common IFC4 building elements; pass a `painters` object to
 * override or extend.
 *
 * Beyond the IFC type, the resolver also inspects each `DataObject`'s
 * **name** (via {@link IfcNameRule}) and **property sets** (via
 * {@link IfcPropertyRule}). The default
 * {@link DEFAULT_IFC_NAME_RULES} catches vegetation-style proxy
 * elements (Revit RPC trees export as `IfcBuildingElementProxy` and
 * can only be identified by their name). Property rules let routing
 * decisions key off semantic IFC properties — exterior vs. interior
 * walls, load-bearing slabs, fire-rated doors. The
 * {@link getDataProperty} helper makes predicates concise.
 *
 * Resolution order per SceneObject (first non-`undefined` wins):
 *
 *   1. user-supplied `resolveIfcType` callback
 *   2. first matching {@link IfcNameRule} (defaults to
 *      {@link DEFAULT_IFC_NAME_RULES})
 *   3. first matching {@link IfcPropertyRule} (default empty)
 *   4. `dataObject.type` — the raw IFC type
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
 *      `applyIFCMaterials` does exactly this — for every object it
 *      destroys the loaded meshes and recreates them, this time
 *      bound to the IFC-typed `SceneMaterial` (with the same
 *      `id`, `matrix`, `opacity`, and `parentTransform` so nothing
 *      else moves).
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
 * references held by other subsystems. The cost is a slightly more
 * verbose pattern in user code; the gain is a renderer (and an
 * undo-tree, and a serialiser, and so on) that doesn't have to plan
 * for in-place identity changes.
 *
 * ## Usage
 *
 * ```ts
 * import {
 *   applyIFCMaterials,
 *   DEFAULT_IFC_NAME_RULES,
 *   getDataProperty,
 *   paintCopperRoof,
 *   paintBrick,
 *   paintWoodPlank,
 * } from "@xeokit/sdk/studio";
 *
 * const result = applyIFCMaterials({
 *   sceneModel,
 *   dataModel,
 *   textureSize: 256,
 *
 *   // Add an IfcCovering_Roof painter alongside the defaults.
 *   painters: {
 *     IfcCovering_Roof: {
 *       paint: paintCopperRoof,
 *       material: {color: [1, 1, 1], metallic: 1, roughness: 1},
 *     },
 *     IfcExternalWall: {paint: paintBrick,    material: {color: [1.6, 1.6, 1.6]}},
 *     IfcInternalWall: {paint: paintWoodPlank, material: {color: [1.6, 1.6, 1.6]}},
 *   },
 *
 *   // Extend the default name rules — keep the vegetation rule and
 *   // add a Dutch "dak" → roof override.
 *   nameRules: [
 *     ...DEFAULT_IFC_NAME_RULES,
 *     {pattern: /^dak/i, key: "IfcCovering_Roof"},
 *   ],
 *
 *   // Discriminate exterior vs interior walls by Pset_WallCommon.
 *   propertyRules: [
 *     {
 *       predicate: (d) =>
 *         d?.type === "IfcWall" &&
 *         getDataProperty(d, "Pset_WallCommon", "IsExternal") === true,
 *       key: "IfcExternalWall",
 *     },
 *     {
 *       predicate: (d) => d?.type === "IfcWall",
 *       key: "IfcInternalWall",
 *     },
 *   ],
 * });
 * if (!result.ok) throw new Error(result.error);
 * ```
 *
 * @module studio/applyIFCMaterials
 */

export * from "./IfcPainterEntry";
export * from "./IfcNameRule";
export * from "./IfcPropertyRule";
export * from "./DEFAULT_IFC_PAINTERS";
export * from "./DEFAULT_IFC_NAME_RULES";
export * from "./FALLBACK_IFC_PAINTER";
export * from "./getDataProperty";
export * from "./applyIFCMaterials";
export * from "./removeAttachedMaterials";
