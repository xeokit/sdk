/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit XGF Importer and Exporter
 *
 * ---
 *
 * **Import and export SceneModels as xeokit's native binary XGF format**
 *
 * ---
 *
 * The xeokit SDK enables seamless import and export of 3D models using the XGF format — xeokit's native binary format designed
 * for fast loading.
 *
 * ### Importing XGF Models
 *
 * Use the {@link XGFLoader} class to load XGF files into:
 * - a {@link model!scene.SceneModel | SceneModel} for geometry and materials
 * - a {@link model!data.DataModel | DataModel} for semantic data
 *
 * ### Exporting XGF Models
 *
 * Use the {@link XGFExporter} class to export:
 * - a {@link model!scene.SceneModel | SceneModel}
 * - a {@link model!data.DataModel | DataModel}
 *
 * into XGF file data.
 *
 * ---
 *
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class XGFLoader {
 *       +format : "XGF"
 *       +versions : "1", "2"
 *       +load(params, options?) Promise~void~
 *     }
 *     class XGFExporter {
 *       +format : "XGF"
 *       +write(params, options?) Promise~ArrayBuffer~
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     class ModelExporter {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- XGFLoader
 *     ModelExporter <|-- XGFExporter
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Compact binary** — xeokit-native geometry format; ~5–10×
 *   smaller than equivalent glTF, ~10× faster to load.
 * - **Full visual model** — one container carries geometry,
 *   per-vertex colours, PBR materials with textures (and colour-space
 *   encoding), per-material `triplanarScale` for world-projected
 *   texturing, and 3D Gaussian Splatting geometry.
 * - **Transform hierarchies** — XGF v2 preserves SceneTransform trees and
 *   mesh parent-transform links.
 * - **Quantised positions** — vertex positions stored as 16-bit
 *   integers against per-geometry AABBs; no precision loss for
 *   typical model scales.
 * - **Octahedron-encoded normals** — 2-byte normals via oct
 *   encoding, decoded in the vertex shader.
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
 * Below is an example of loading and displaying an XGF (xeokit Geometry Format) model in a {@link viewing!viewer.Viewer | Viewer}:
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Data } from "@xeokit/sdk/model/data";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { ViewController } from "@xeokit/sdk/viewing/viewController";
 * import { XGFLoader, XGFExporter } from "@xeokit/sdk/formats/xgf";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
 * const viewer = new Viewer({
 *     scene
 * });
 *
 * const renderer = new WebGLRenderer({
 *   viewer
 * });
 *
 * const viewResult = viewer.createView({
 *     id: "myView",
 *     elementId: "myCanvas"
 * });
 *
 * const view = viewResult.view;
 *
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * new ViewController(view, {});
 *
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 * const sceneModel = sceneModelResult.model;
 *
 * const dataModelResult = data.createModel({ id: "myModel" });
 * const dataModel = dataModelResult.model;
 *
 * const xgfLoader = new XGFLoader();
 *
 * fetch("model.xgf")
 *     .then(response => response.json())
 *     .then(fileData => {
 *         xgfLoader.load({ fileData, sceneModel, dataModel })
 *             .then(() => {
 *                 // Loaded
 *             })
 *             .catch(err => {
 *                 sceneModel.destroy();
 *                 dataModel.destroy();
 *                 console.error(`Error loading XGF -> ${err}`);
 *             });
 *     })
 *     .catch(err => {
 *         console.error(`Error fetching XGF file -> ${err}`);
 *     });
 * ```
 *
 * ### Exporting to XGF
 *
 * ```ts
 * const xgfExporter = new XGFExporter();
 *
 * xgfExporter.write({
 *     sceneModel,
 *     dataModel,
 * }).then(fileData => {
 *     // Use fileData as needed
 * }).catch(err => {
 *     console.error(err);
 * });
 * ```
 *
 * @module xgf
 * @document ./README.md
 */
export * from "./XGFLoader";
export * from "./XGFExporter";
