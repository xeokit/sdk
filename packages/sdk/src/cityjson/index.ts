/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="https://xeokit.github.io/sdk/docs/assets/example_cityJSON.png"/>
 *
 * # xeokit CityJSON Importer
 *
 * ---
 *
 * **Import and visualize 3D urban models in the [CityJSON](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#cityjson) format**
 *
 * ---
 *
 * The xeokit SDK supports importing 3D urban models from CityJSON — a lightweight, human-readable JSON format
 * that simplifies storage and sharing of 3D city models.
 *
 * Compared to formats like CityGML, CityJSON provides a more accessible and developer-friendly way to represent urban features
 * such as buildings, roads, vegetation, and more.
 *
 * ### How it Works
 *
 * Use the {@link CityJSONLoader} class to load CityJSON data into:
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
 *     class CityJSONLoader {
 *         load()
 *     }
 *     ModelLoadParams "0" --> "1" SceneModel
 *     ModelLoadParams "0" --> "1" DataModel
 *     CityJSONLoader --> ModelLoadParams
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
 * This example demonstrates how to:
 * - Set up a {@link viewer!Viewer | Viewer}, {@link scene!Scene | Scene}, and {@link webglrenderer!WebGLRenderer | WebGLRenderer}
 * - Attach a {@link cameracontrol!CameraControl | CameraControl} for interaction
 * - Load a CityJSON model using {@link CityJSONLoader}
 * - Handle loading and error scenarios
 *
 * ```ts
 * import { SDKError } from "@xeokit/sdk/core";
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Data } from "@xeokit/sdk/data";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { CameraControl } from "@xeokit/sdk/cameracontrol";
 * import { CityJSONLoader } from "@xeokit/sdk/cityjson";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
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
 *     elementId: "myCanvas" // Ensure this HTMLElement exists in the page
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
 * const cityJSONLoader = new CityJSONLoader();
 *
 * fetch("model.json")
 *     .then(response => response.json())
 *     .then(fileData => {
 *         cityJSONLoader.load({
 *             fileData,
 *             sceneModel,
 *             dataModel
 *         }).then(() => {
 *             // Loaded
 *         }).catch(err => {
 *             sceneModel.destroy();
 *             dataModel.destroy();
 *             console.error(`Error loading CityJSON: ${err}`);
 *         });
 *     })
 *     .catch(err => {
 *         console.error(`Error fetching or parsing CityJSON: ${err}`);
 *     });
 * ```
 *
 * @module cityjson
 */
export * from "./CityJSONLoader";
