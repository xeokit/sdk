/**
 * # Materials Palette
 *
 * The `materials` module wraps every applicable
 * {@link model!generation.paintMaterials | generation/paintMaterials} painter into a
 * lookup table the host can drive from a context menu or button bar.
 * Per-(SceneModel, painter) {@link model!scene.SceneMaterial | SceneMaterials}
 * are created on first use and shared across every mesh that adopts
 * them. Applying the same painter to a thousand objects produces
 * one material, not a thousand.
 *
 * Material swapping uses the SDK's supported mutation pattern:
 * snapshot the mesh's params (id, geometryId, matrix, opacity,
 * parentTransform), detach + destroy the old mesh, then create a
 * fresh mesh with the same id bound to the palette's
 * {@link model!scene.SceneMaterial | SceneMaterial} and re-attach to the
 * source {@link model!scene.SceneObject | SceneObject}. The object keeps
 * its identity; only the mesh's material binding changes.
 *
 * <br>
 *
 * ## Shape
 *
 * The palette sits over a small cast of types: a {@link MaterialsPalette}
 * owns a list of {@link PainterCatalogEntry} entries, delegates the actual
 * texture work to the generation painters in
 * {@link model!generation.paintMaterials | paintMaterials}, and reuses each
 * resulting {@link model!scene.SceneMaterial | SceneMaterial} through an
 * internal per-`SceneModel` cache.
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class MaterialsPalette {
 *       +catalog : PainterCatalogEntry[]
 *       +textureSize : number
 *       +uvScale : number
 *       +painterIds() string[]
 *       +getEntry(id) PainterCatalogEntry
 *       +paintMaterial(mesh, id) SDKResult
 *     }
 *     class PainterCatalogEntry {
 *       +id : string
 *       +label : string
 *       +category : string
 *       +paint(size) MaterialMaps
 *       +material : MaterialOverrides
 *     }
 *     class MatCache {
 *       <<internal>>
 *       +get(model, id) SceneMaterial
 *     }
 *     class SceneMesh {
 *       <<scene>>
 *     }
 *     class SceneMaterial {
 *       <<scene>>
 *     }
 *     class paintMaterials {
 *       <<generation>>
 *     }
 *     MaterialsPalette "1" *-- "*" PainterCatalogEntry : catalog
 *     MaterialsPalette "1" *-- "1" MatCache : reuses materials
 *     MaterialsPalette ..> paintMaterials : invokes painters
 *     MaterialsPalette ..> SceneMesh : repaints
 *     MatCache ..> SceneMaterial : shared per SceneModel + painterId
 * ```
 *
 * <br>
 *
 * ## Mesh repaint sequence
 *
 * A repaint call routes through a catalog lookup, an optional first-time
 * material build (painter → textures → material, cached), and the SDK's
 * supported mutation pattern for swapping a mesh's material binding —
 * snapshot the mesh's params, destroy the old mesh, then recreate it
 * with the same id and re-attach it to its {@link model!scene.SceneObject | SceneObject}.
 *
 * ```mermaid
 * flowchart TD
 *     A[paintMaterial mesh painterId] --> B[lookup entry by id]
 *     B --> C{material cached for SceneModel?}
 *     C -- no --> D[call painter → MaterialMaps]
 *     D --> E[create SceneTextures]
 *     E --> F[create SceneMaterial — cache as materialId]
 *     C -- yes --> G[reuse cached materialId]
 *     F --> H[snapshot mesh params]
 *     G --> H
 *     H --> I[detach + destroy old mesh]
 *     I --> J[create new mesh — same id, new materialId]
 *     J --> K[re-attach to SceneObject]
 * ```
 *
 * <br>
 *
 * ## Behavior
 *
 * - **Default catalog** — every applicable
 *   {@link model!generation.paintMaterials | generation/paintMaterials} painter is
 *   pre-registered (brick, concrete, marble, oak, polished steel, copper,
 *   gold, glass, etc.) and grouped into categories.
 * - **Per-(SceneModel, painter) sharing** — repainting a thousand
 *   meshes with the same painter creates one
 *   {@link model!scene.SceneMaterial | SceneMaterial}, not a thousand.
 *   Materials are cached in a WeakMap keyed by SceneModel, so a
 *   destroyed SceneModel drops its entries without explicit
 *   cleanup.
 * - **Hatch passthrough** — each catalog entry carries the painter's
 *   engineering hatch pattern (ANSI 32 steel, ANSI 36 brick, ISO
 *   concrete, etc.); the painted material binds the hatch into
 *   `hatchPattern`, so section caps and Detailed-mode body shading
 *   pick it up automatically.
 * - **Transparent dielectrics** — glass and other transparent
 *   painters carry `opacity` / `alphaMode: "BLEND"` in their entry,
 *   so no per-call override is required.
 * - **Triplanar by default** — painted materials forward
 *   {@link MaterialsPalette.uvScale | uvScale} as `triplanarScale` for
 *   UV-less geometry.
 * - **In-place repaint** — `paintMaterial` keeps the source
 *   {@link model!scene.SceneObject | SceneObject} intact; only the mesh's
 *   material binding changes, via the SDK's supported
 *   detach + destroy + recreate + reattach pattern.
 * - **Custom catalogs** — pass `catalog` to the constructor to replace
 *   the default with host-defined painter entries.
 *
 * <br>
 *
 * ## Usage
 *
 * ### 1) Import the entry points
 *
 * ```javascript
 * import { MaterialsPalette } from "../libs/presentations/dist/index.js";
 * ```
 *
 * <br>
 *
 * ### 2) Construct the palette
 *
 * With no params, the palette uses the default catalog.
 *
 * ```javascript
 * const palette = new MaterialsPalette();
 * ```
 *
 * Or override texture size and UV scale:
 *
 * ```javascript
 * const palette = new MaterialsPalette({
 *   textureSize: 512,                // sharper close-up texturing
 *   uvScale:     0.5                 // tile half as often (larger pattern)
 * });
 * ```
 *
 * <br>
 *
 * ### 3) Repaint one mesh
 *
 * Pass a {@link model!scene.SceneMesh | SceneMesh} and a painter id. The
 * returned `SDKResult` carries the new (replacement) SceneMesh on
 * success.
 *
 * ```javascript
 * const result = palette.paintMaterial(mesh, "brick");
 * if (!result.ok) console.warn(result.error);
 * ```
 *
 * <br>
 *
 * ### 4) Repaint every mesh under a SceneObject
 *
 * `paintMaterial` returns a fresh SceneMesh each call; iterate the
 * SceneObject's `meshes` array once via a snapshot so the loop
 * isn't disturbed by the in-flight detach + reattach.
 *
 * ```javascript
 * for (const m of [...sceneObject.meshes]) {
 *   const r = palette.paintMaterial(m, "polSteel");
 *   if (!r.ok) console.warn(r.error);
 * }
 * ```
 *
 * <br>
 *
 * ### 5) Drive from a UI menu
 *
 * {@link MaterialsPalette.painterIds | painterIds} returns the
 * registered ids in catalog order; {@link MaterialsPalette.getEntry | getEntry}
 * looks up an entry for label / category metadata. Together they're
 * enough to build a menu grouped by category.
 *
 * ```javascript
 * const byCategory = new Map();
 *
 * for (const id of palette.painterIds()) {
 *   const entry = palette.getEntry(id);
 *   const bucket = byCategory.get(entry.category) ?? [];
 *   bucket.push({ id, label: entry.label });
 *   byCategory.set(entry.category, bucket);
 * }
 *
 * // ...feed `byCategory` to your menu builder.
 * ```
 *
 * <br>
 *
 * ### 6) Custom catalog
 *
 * Pass a catalog to replace the default.
 *
 * ```javascript
 * import { paintBrick, paintConcrete } from "@xeokit/sdk/model/generation/paintMaterials";
 *
 * const palette = new MaterialsPalette({
 *   catalog: [
 *     {
 *       id: "brick",  label: "Brick",
 *       category: "Masonry",
 *       paint: paintBrick,
 *       material: { color: [1.6, 1.6, 1.6] }
 *     },
 *     {
 *       id: "concrete", label: "Concrete",
 *       category: "Masonry",
 *       paint: paintConcrete,
 *       material: { color: [1.6, 1.6, 1.6] }
 *     }
 *   ]
 * });
 * ```
 *
 * <br>
 *
 * ### 7) Lifetime
 *
 * The palette is stateless across SceneModels — its material cache
 * is a WeakMap, so destroying a SceneModel automatically drops its
 * cached materials. The palette itself has no `destroy` method;
 * drop the reference when you're done.
 *
 * @module materials
 */

export * from "./PainterCatalogEntry";
export * from "./MaterialsPalette";
