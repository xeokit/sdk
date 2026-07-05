/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit 3DXML Importer / Exporter
 *
 * ---
 *
 * **Import and export Dassault Systèmes 3DXML (CATIA / 3DEXPERIENCE) assemblies in the `.3dxml` format**
 *
 * ---
 *
 * 3DXML is Dassault Systèmes' lightweight, XML-based 3D format: a ZIP archive
 * holding a `Manifest.xml`, a product-structure document (the assembly tree of
 * `Reference3D` / `Instance3D` / `ReferenceRep` nodes), and one or more
 * tessellated representation documents carrying triangle geometry.
 *
 * The {@link ThreeDXMLLoader} unzips the package, walks the product structure
 * (composing each instance's `RelativeMatrix` into a world transform), and emits
 * the result into a {@link model!scene.SceneModel | SceneModel} as a first-class
 * model — one geometry per representation (reused across instances), one mesh per
 * instance with the assembly transform baked into its matrix, and one object per
 * instance. So a 3DXML scene loads, streams, transforms and picks exactly like
 * any other xeokit model.
 *
 * ### Importing `.3dxml` scenes
 *
 * Use {@link ThreeDXMLLoader} to load `.3dxml` file data into a SceneModel. The
 * loader produces geometries, meshes and objects; no
 * {@link model!data.DataModel | DataModel} is produced in this version.
 *
 * ### Exporting `.3dxml` scenes
 *
 * Use {@link ThreeDXMLExporter} to write a SceneModel's triangle geometry back to
 * `.3dxml` bytes. It round-trips with the loader: each mesh becomes a part whose
 * tessellation, transform and flat colour reproduce on re-import.
 *
 * ```ts
 * const fileData = await new ThreeDXMLExporter().write({ sceneModel });
 * ```
 *
 * ---
 *
 * ## Features
 *
 * - **Tessellated geometry** — reads `<VertexBuffer>` positions + normals and
 *   `<Face triangles="…">` index lists into `TrianglesPrimitive` geometry.
 * - **Assembly structure** — walks `Reference3D` / `Instance3D` / `ReferenceRep`
 *   and bakes each instance's `RelativeMatrix` into its mesh transform, so shared
 *   parts are instanced (geometry created once, reused across occurrences).
 * - **Flat part colours** — `<SurfaceAttributes><Color>` becomes per-mesh RGBA.
 * - **First-class SceneModel primitive** — imports as ordinary geometry/mesh/
 *   object, so it renders, picks and transforms like any other model.
 *
 * ---
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ---
 *
 * ## Usage
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { ThreeDXMLLoader } from "@xeokit/sdk/formats/threedxml";
 *
 * const scene = new Scene();
 * const sceneModel = scene.createModel({ id: "myModel" }).value;
 *
 * fetch("model.3dxml")
 *   .then(response => response.arrayBuffer())
 *   .then(fileData => {
 *     new ThreeDXMLLoader().load({ fileData, sceneModel })
 *       .then(() => { / * Loaded * / })
 *       .catch(err => { sceneModel.destroy(); console.error(err); });
 *   });
 * ```
 *
 * @module threedxml
 * @document ./README.md
 */
// Only the loader and exporter are public API. The ZIP reader/writer, XML
// helpers and the version parsers/encoders (versions/v1/*) are internal and
// intentionally NOT re-exported — they stay out of the public docs, matching the
// other format modules which keep their version parsers/encoders internal.
export {ThreeDXMLLoader} from "./ThreeDXMLLoader";
export {ThreeDXMLExporter} from "./ThreeDXMLExporter";
