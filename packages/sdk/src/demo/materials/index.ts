/**
 * # Materials Palette
 *
 * Demo-grade catalog of every applicable {@link procgen/paintMaterials}
 * painter, plus a {@link MaterialsPalette.paintMaterial} action that
 * swaps a {@link SceneMesh}'s material to one of the palette's
 * SceneMaterials at runtime — one shared SceneMaterial per
 * (SceneModel, painter) pair, lazily created on first use.
 *
 * Powers the "Change Material" submenu of {@link ViewObjectContextMenu};
 * also useful as a standalone palette when wiring custom UI.
 *
 * ## Usage
 *
 * ```ts
 * import {MaterialsPalette} from "@xeokit/sdk/demo";
 *
 * const palette = new MaterialsPalette({textureSize: 256});
 * for (const m of sceneObject.meshes) {
 *   const r = palette.paintMaterial(m, "brick");
 *   if (!r.ok) console.warn(r.error);
 * }
 * ```
 *
 * @module demo/materials
 */

export * from "./PainterCatalogEntry";
export * from "./MaterialsPalette";
