/**
 * <img style="width:150px; padding-top:20px; padding-bottom: 20px;" src="https://xeokit.github.io/sdk/docs/assets/ifc_logo.png"/>
 *
 * # xeokit IFC Importer
 *
 * ---
 *
 * ### *Import BIM models from IFC STEP files using the web-ifc API*
 *
 * ---
 *
 * The xeokit SDK provides functionality to import 3D building models from Industry Foundation Classes ([IFC](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ifc)) files, which are commonly used in the field of Building Information Modeling (BIM). IFC files facilitate the exchange of information between different software applications used in the construction and building industries.
 *
 * The {@link webifc!loadWebIFC | loadWebIFC} function can be used to import medium-sized IFC models into xeokit. This function loads the IFC file data into both a {@link scene!SceneModel | SceneModel} (which holds the model's geometry and materials) and a {@link data!DataModel | DataModel} (which holds the model's semantic data). The `loadWebIFC` function internally leverages the [web-ifc](https://github.com/IFCjs/web-ifc) API to parse geometry and data from the IFC file.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNUsFqwzAM_ZWg0zY62K6hFLaVQaFlpTns4otiK6uHYwfbYYTSf58dJ03bQVkuznt6lp5kHYAbQZADV-jcUuKXxZpppoW0xL00OlvvIu7jWcFJ0ybcUNmB6Sx8UqTTlN9B7xLgltDTR0_d3SeubKUSIxDkvDVdhMeYfcy_RI99-lvZG2sasr4r6Fa9xO1IYezC7WVzGdlOWf5lMRlcGxSfVK7e37YYJuXGMcznTcTkyS4WiUJrsXttq4psItxpeEOFsdkEf6iUFb-opk7VpjpVq_t3iWXOpEn2sl31yiF07ZbBE4PHxwWDZwbFmZ2bwuXk86_uYdKdLDA9GR-D1zdhBjXZGqUIy9c3x8DvqSYGefgVVGGrPIPQSZBi603RaQ65ty3NoG3C8GhYV8grVC6wJKQ3djMsdDyOv8sQ9og?type=png)](https://mermaid.live/edit#pako:eNqNUsFqwzAM_ZWg0zY62K6hFLaVQaFlpTns4otiK6uHYwfbYYTSf58dJ03bQVkuznt6lp5kHYAbQZADV-jcUuKXxZpppoW0xL00OlvvIu7jWcFJ0ybcUNmB6Sx8UqTTlN9B7xLgltDTR0_d3SeubKUSIxDkvDVdhMeYfcy_RI99-lvZG2sasr4r6Fa9xO1IYezC7WVzGdlOWf5lMRlcGxSfVK7e37YYJuXGMcznTcTkyS4WiUJrsXttq4psItxpeEOFsdkEf6iUFb-opk7VpjpVq_t3iWXOpEn2sl31yiF07ZbBE4PHxwWDZwbFmZ2bwuXk86_uYdKdLDA9GR-D1zdhBjXZGqUIy9c3x8DvqSYGefgVVGGrPIPQSZBi603RaQ65ty3NoG3C8GhYV8grVC6wJKQ3djMsdDyOv8sQ9og)
 *
 * <br>
 *
 * ## Installation
 *
 * To install the xeokit SDK, use the following npm command:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ## Usage Example
 *
 * The example below demonstrates how to use {@link webifc!loadWebIFC | loadWebIFC} in the xeokit context.
 *
 * This example sets up a {@link viewer!Viewer | Viewer} using a {@link webglrenderer!WebGLRenderer | WebGLRenderer} and a {@link scene!Scene | Scene} to hold the model's geometry and materials. We also create a {@link data!Data | Data} instance to store the model's semantic data.
 *
 * In the Viewer, we create a {@link viewer!View | View} to render the model to an HTML canvas, and attach a {@link cameracontrol!CameraControl | CameraControl} to allow mouse and touch input for camera control.
 *
 * The Scene will include a {@link scene!SceneModel | SceneModel} for geometry and materials, and the Data will include a {@link data!DataModel | DataModel} to hold the IFC elements and property sets.
 *
 * Before using {@link webifc!loadWebIFC | loadWebIFC}, we initialize the WebIFC API, which is then passed into the `loadWebIFC` function. The example also demonstrates error handling using the {@link core!SDKError | SDKError} class.
 *
 * Example JavaScript code:
 *
 * ````javascript
 * import {SDKError} from "@xeokit/core";
 * import {Scene} from "@xeokit/scene";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {Viewer} from "@xeokit/viewer";
 * import {CameraControl} from "@xeokit/cameracontrol";
 * import {loadWebIFC} from "@xeokit/webifc";
 * import * as WebIFC from "https://cdn.jsdelivr.net/npm/web-ifc@0.0.51/web-ifc-api.js";
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
 * const ifcAPI = new WebIFC.IfcAPI();
 * ifcAPI.SetWasmPath("https://cdn.jsdelivr.net/npm/web-ifc@0.0.51/");
 *
 * ifcAPI.Init().then(() => {
 *
 *     const sceneModel = scene.createModel({ id: "myModel" });
 *     const dataModel = data.createModel({ id: "myModel" });
 *
 *     fetch("model.ifc").then(response => {
 *         response.arrayBuffer().then(fileData => {
 *             loadWebIFC({
 *                 ifcAPI,
 *                 fileData,
 *                 sceneModel,
 *                 dataModel
 *             }).then(() => {
 *                 sceneModel.build();
 *                 dataModel.build();
 *             }).catch(err => {
 *                 sceneModel.destroy();
 *                 dataModel.destroy();
 *                 console.error(`Error loading IFC file with WebIFC: ${err}`);
 *             });
 *         }).catch(err => {
 *             console.error(`Error creating ArrayBuffer from fetch response: ${err}`);
 *         });
 *     }).catch(err => {
 *         console.error(`Error fetching IFC file: ${err}`);
 *     });
 * }).catch(err => {
 *     console.error(`Error initializing WebIFC.IfcAPI: ${err}`);
 * });
 * ````
 *
 * @module webifc
 */
export * from "./loadWebIFC";
