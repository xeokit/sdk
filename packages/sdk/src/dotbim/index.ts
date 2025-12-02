/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; width: 180px;" src="https://xeokit.github.io/sdk/docs/assets/dotbim-logo.png"/>
 *
 * # xeokit .BIM Importer and Exporter
 *
 * ---
 *
 * **Import and export the open, free, and simple [.BIM](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dotbim) model format**
 *
 * ---
 *
 * The xeokit SDK enables seamless import and export of 3D models using the .BIM format — a lightweight, open-source, JSON-based format designed for easy sharing and human readability.
 *
 * .BIM is minimalist by design. It contains triangulated meshes and a dictionary of related metadata, making it ideal for streamlined BIM workflows.
 *
 * ### Importing .BIM Models
 *
 * Use the {@link DotBIMLoader} class to load .BIM files into:
 * - a {@link scene!SceneModel | SceneModel} for geometry and materials
 * - a {@link data!DataModel | DataModel} for semantic data
 *
 * ### Exporting .BIM Models
 *
 * Use the {@link DotBIMExporter} class to export:
 * - a {@link scene!SceneModel | SceneModel}
 * - a {@link data!DataModel | DataModel}
 *
 * into .BIM file data.
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
 *     class DotBIMLoader {
 *         load()
 *     }
 *     class DotBIMExporter {
 *         export(): Promise<any>
 *     }
 *     ModelLoadParams "0" --> "1" SceneModel
 *     ModelLoadParams "0" --> "1" DataModel
 *     DotBIMLoader --> ModelLoadParams
 *     DotBIMExporter --> ModelExportParams
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
 * Below is an example of loading and displaying a .BIM model in a {@link viewer!Viewer | Viewer}:
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Data } from "@xeokit/sdk/data";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { CameraControl } from "@xeokit/sdk/cameracontrol";
 * import { DotBIMLoader, DotBIMExporter } from "@xeokit/sdk/dotbim";
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
 * const view = viewResult.value;
 *
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * new CameraControl(view, {});
 *
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 *
 * const sceneModel = sceneModelResult.value;
 *
 * const dataModelResult = data.createModel({ id: "myModel" });
 *
 * const dataModel = dataModelResult.value;
 *
 * const dotBIMLoader = new DotBIMLoader();
 *
 * fetch("model.bim")
 *     .then(response => response.json())
 *     .then(fileData => {
 *         dotBIMLoader.load({ fileData, sceneModel, dataModel })
 *             .then(() => {
 *                 // Loaded
 *             })
 *             .catch(err => {
 *                 sceneModel.destroy();
 *                 dataModel.destroy();
 *                 console.error(`Error loading .BIM: ${err}`);
 *             });
 *     })
 *     .catch(err => {
 *         console.error(`Error fetching .BIM file: ${err}`);
 *     });
 * ```
 *
 * ### Exporting to .BIM
 *
 * ```ts
 * const exporter = new DotBIMExporter();
 *
 * exporter.write({
 *     sceneModel,
 *     dataModel,
 *     version: "1.1.0", // Optional, defaults to latest
 * }).then(fileData => {
 *     // Use fileData as needed
 * }).catch(err => {
 *     console.error(err);
 * });
 * ```
 *
 * @module dotbim
 */
export * from "./DotBIMLoader";
export * from "./DotBIMExporter";
