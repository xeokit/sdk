/**
 * <img style="padding: 20px 0 30px;" src="https://xeokit.github.io/sdk/docs/assets/autzen.png"/>
 *
 * # xeokit LAS Importer
 *
 * ---
 *
 * **Import 3D LiDAR point cloud datasets into xeokit.**
 *
 * ---
 *
 * The xeokit SDK enables the import of 3D models from LAS, a widely used file format for exchanging 3D point cloud data.
 *
 * The LAS format is a standardized binary format that stores LiDAR-generated point cloud data. It includes metadata such as headers, point attributes, and supports both compressed and uncompressed data. LAS is widely used in industries like surveying, mapping, and urban planning.
 *
 * ### How it Works
 *
 * Use the {@link LASLoader} class to load LAS data into:
 * - a {@link scene!SceneModel | SceneModel} for rendering geometry
 * - a {@link data!DataModel | DataModel} for managing associated semantic information
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
 *     class LASLoader {
 *         load()
 *     }
 *     ModelLoadParams "0" --> "1" SceneModel
 *     ModelLoadParams "0" --> "1" DataModel
 *     LASLoader --> ModelLoadParams
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
 * ## Usage
 *
 * This example demonstrates how to:
 * - Set up a {@link viewer!Viewer | Viewer}, {@link scene!Scene | Scene}, and {@link webglrenderer!WebGLRenderer | WebGLRenderer}
 * - Attach a {@link cameracontrol!CameraControl | CameraControl} for interaction
 * - Load a LAS model using {@link LASLoader}
 * - Handle loading and error scenarios
 *
 * ```ts
 * import { SDKError } from "@xeokit/sdk/core";
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Data } from "@xeokit/sdk/data";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { CameraControl } from "@xeokit/sdk/cameracontrol";
 * import { LASLoader } from "@xeokit/sdk/las";
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
 *     elementId: "myCanvas" // Ensure this HTMLElement exists in the page
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
 * const sceneModel = sceneModelResult.value;
 *
 * const dataModelResult = data.createModel({ id: "myModel" });
 * const dataModel = dataModelResult.value;
 *
 * const lasLoader = new LASLoader();
 *
 * fetch("model.laz")
 *     .then(response => response.json())
 *     .then(fileData => {
 *         lasLoader.load({
 *             fileData,
 *             sceneModel,
 *             dataModel
 *         }).then(() => {
 *             // Loaded
 *         }).catch(err => {
 *             sceneModel.destroy();
 *             dataModel.destroy();
 *             console.error(`Error loading LAS: ${err}`);
 *         });
 *     })
 *     .catch(err => {
 *         console.error(`Error fetching or parsing LAS: ${err}`);
 *     });
 * ```
 *
 * @module las
 */
export * from "./LASLoader";
export * from "./LASLoaderOptions";
