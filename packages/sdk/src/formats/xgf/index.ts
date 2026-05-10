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
 * - a {@link scene!SceneModel | SceneModel} for geometry and materials
 * - a {@link data!DataModel | DataModel} for semantic data
 *
 * ### Exporting XGF Models
 *
 * Use the {@link XGFExporter} class to export:
 * - a {@link scene!SceneModel | SceneModel}
 * - a {@link data!DataModel | DataModel}
 *
 * into XGF file data.
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
 * Below is an example of loading and displaying an XGF (xeokit Geometry Format) model in a {@link viewer!Viewer | Viewer}:
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Data } from "@xeokit/sdk/data";
 * import { WebGLRenderer } from "@xeokit/sdk/webGLRenderer";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { ViewController } from "@xeokit/sdk/viewController";
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
 *     version: "1.0.0", // Optional, defaults to latest
 * }).then(fileData => {
 *     // Use fileData as needed
 * }).catch(err => {
 *     console.error(err);
 * });
 * ```
 *
 * @module xgf
 */
export * from "./XGFLoader";
export * from "./XGFExporter";
export * from "./versions/v1/XGFData_v1";
export * from "./versions/v2/XGFData_v2";
