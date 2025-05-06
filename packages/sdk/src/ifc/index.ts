/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; width: 180px;" src="https://xeokit.github.io/sdk/docs/assets/ifc_logo.png"/>
 *
 * # xeokit IFC Importer and Exporter
 *
 * ---
 *
 * **Import and export IFC STEP files**
 *
 * ---
 *
 * The xeokit SDK enables seamless import and export of 3D models
 * as
 * IFC (Industry Foundation Classes), an open, global standard file format used for exchanging
 * Building Information Modeling (BIM) data between different software applications in the
 * Architecture, Engineering, and Construction (AEC) industry.
 *
 * ### Importing IFC Models
 *
 * Use the {@link IFCLoader} class to load IFC files into:
 * - a {@link scene!SceneModel | SceneModel} for geometry and materials
 * - a {@link data!DataModel | DataModel} for semantic data
 *
 * ### Exporting IFC Models
 *
 * Use the {@link IFCExporter} class to export:
 * - a {@link scene!SceneModel | SceneModel}
 * - a {@link data!DataModel | DataModel}
 *
 * into IFC file data.
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
 *         build()
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
 *         build()
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
 *     class IFCLoader {
 *         load()
 *     }
 *     class IFCExporter {
 *         export(): Promise<any>
 *     }
 *     ModelLoadParams "0" --> "1" SceneModel
 *     ModelLoadParams "0" --> "1" DataModel
 *     IFCLoader --> ModelLoadParams
 *     IFCExporter --> ModelExportParams
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
 * Below is an example of loading and displaying a IFC model in a {@link viewer!Viewer | Viewer}:
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Data } from "@xeokit/sdk/data";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { CameraControl } from "@xeokit/sdk/cameracontrol";
 * import { IFCLoader, IFCExporter } from "@xeokit/sdk/ifc";
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
 * const ifcLoader = new IFCLoader();
 *
 * fetch("model.bim")
 *     .then(response => response.json())
 *     .then(fileData => {
 *         ifcLoader.load({ fileData, sceneModel, dataModel })
 *             .then(() => {
 *                 sceneModel.build();
 *                 dataModel.build();
 *             })
 *             .catch(err => {
 *                 sceneModel.destroy();
 *                 dataModel.destroy();
 *                 console.error(`Error loading IFC: ${err}`);
 *             });
 *     })
 *     .catch(err => {
 *         console.error(`Error fetching IFC file: ${err}`);
 *     });
 * ```
 *
 * ### Exporting to IFC
 *
 * ```ts
 * const exporter = new IFCExporter();
 *
 * exporter.export({
 *     sceneModel,
 *     dataModel,
 *     version: "IFC4", // Optional, defaults to latest
 * }).then(fileData => {
 *     // Use fileData as needed
 * }).catch(err => {
 *     console.error(err);
 * });
 * ```
 *
 * @module ifc
 */
export * from "./IFCLoader";
export * from "./IFCExporter";
