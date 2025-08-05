/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; width: 180px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
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
 * ### Architecture Overview
 *
 * ```mermaid
 * classDiagram
 *     direction LR
 *     class SceneModel {
 *         id
 *         objects
 *         createObject()
 *         destroy()
 *     }
 *     class DataModel {
 *         id
 *         objects
 *         relationships
 *         propertySets
 *         createObject()
 *         createRelationship()
 *         createPropertySet()
 *         destroy()
 *     }
 *     class ModelLoadParams {
 *         <<parameter>>
 *         fileData
 *         sceneModel
 *         dataModel
 *     }
 *     class ModelExportParams {
 *         <<parameter>>
 *         sceneModel
 *         dataModel
 *         version
 *     }
 *     class XGFLoader {
 *         load()
 *     }
 *     class XGFExporter {
 *         export(): Promise<any>
 *     }
 *     ModelLoadParams "0" --> "1" SceneModel
 *     ModelLoadParams "0" --> "1" DataModel
 *     XGFLoader --> ModelLoadParams
 *     XGFExporter --> ModelExportParams
 *     ModelExportParams "0" --> "1" SceneModel
 *     ModelExportParams "0" --> "1" DataModel
 * ```
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
 * ## Usage Example
 *
 * Below is an example of loading and displaying a XGF model in a {@link viewer!Viewer | Viewer}:
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Data } from "@xeokit/sdk/data";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { CameraControl } from "@xeokit/sdk/cameracontrol";
 * import { XGFLoader, XGFExporter } from "@xeokit/sdk/xgf";
 *
 * const scene = new Scene();
 * const data = new Data();
 * const renderer = new WebGLRenderer({});
 *
 * const viewer = new Viewer({
 *     id: "myViewer",
 *     scene,
 *     renderer
 * });
 *
 * const view = viewer.createView({
 *     id: "myView",
 *     elementId: "myCanvas"
 * });
 *
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * new CameraControl(view, {});
 *
 * const sceneModel = scene.createModel({ id: "myModel" });
 * const dataModel = data.createModel({ id: "myModel" });
 *
 * const xgfLoader = new XGFLoader();
 *
 * fetch("model.bim")
 *     .then(response => response.json())
 *     .then(fileData => {
 *         xgfLoader.load({ fileData, sceneModel, dataModel })
 *             .then(() => {
 *                 // Loaded
 *             })
 *             .catch(err => {
 *                 sceneModel.destroy();
 *                 dataModel.destroy();
 *                 console.error(`Error loading XGF: ${err}`);
 *             });
 *     })
 *     .catch(err => {
 *         console.error(`Error fetching XGF file: ${err}`);
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
