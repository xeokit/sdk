/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%webifc.svg)](https://badge.fury.io/js/%40xeokit%webifc)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/webifc/badge)](https://www.jsdelivr.com/package/npm/@xeokit/webifc)
 *
 * <img style="width:150px; padding-top:20px; padding-bottom: 20px;" src="media://images/ifc_logo.png"/>
 *
 * # xeokit IFC Importer
 *
 * ---
 *
 * ### *Import BIM models from IFC STEP files using the web-ifc API*
 *
 * ---
 *
 * The xeokit SDK can import 3D building models from  Industry Foundation Classes ([IFC](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ifc)) files,
 * a standard file format used in the field of Building Information Modeling (BIM) to exchange information between
 * different software applications used in the construction and building industries.
 *
 * To import a medium-sized IFC model into xeokit, use the {@link @xeokit/webifc!loadWebIFC | loadWebIFC} function, which will load the file into
 * a {@link @xeokit/scene!SceneModel | SceneModel} and a {@link @xeokit/data!DataModel | DataModel}. Internally, loadWebIFC
 * uses the [web-ifc](https://github.com/IFCjs/web-ifc) API to parse geometry and data from the IFC file.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNUsFqwzAM_ZWg0zY62K6hFLaVQaFlpTns4otiK6uHYwfbYYTSf58dJ03bQVkuznt6lp5kHYAbQZADV-jcUuKXxZpppoW0xL00OlvvIu7jWcFJ0ybcUNmB6Sx8UqTTlN9B7xLgltDTR0_d3SeubKUSIxDkvDVdhMeYfcy_RI99-lvZG2sasr4r6Fa9xO1IYezC7WVzGdlOWf5lMRlcGxSfVK7e37YYJuXGMcznTcTkyS4WiUJrsXttq4psItxpeEOFsdkEf6iUFb-opk7VpjpVq_t3iWXOpEn2sl31yiF07ZbBE4PHxwWDZwbFmZ2bwuXk86_uYdKdLDA9GR-D1zdhBjXZGqUIy9c3x8DvqSYGefgVVGGrPIPQSZBi603RaQ65ty3NoG3C8GhYV8grVC6wJKQ3djMsdDyOv8sQ9og?type=png)](https://mermaid.live/edit#pako:eNqNUsFqwzAM_ZWg0zY62K6hFLaVQaFlpTns4otiK6uHYwfbYYTSf58dJ03bQVkuznt6lp5kHYAbQZADV-jcUuKXxZpppoW0xL00OlvvIu7jWcFJ0ybcUNmB6Sx8UqTTlN9B7xLgltDTR0_d3SeubKUSIxDkvDVdhMeYfcy_RI99-lvZG2sasr4r6Fa9xO1IYezC7WVzGdlOWf5lMRlcGxSfVK7e37YYJuXGMcznTcTkyS4WiUJrsXttq4psItxpeEOFsdkEf6iUFb-opk7VpjpVq_t3iWXOpEn2sl31yiF07ZbBE4PHxwWDZwbFmZ2bwuXk86_uYdKdLDA9GR-D1zdhBjXZGqUIy9c3x8DvqSYGefgVVGGrPIPQSZBi603RaQ65ty3NoG3C8GhYV8grVC6wJKQ3djMsdDyOv8sQ9og)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/webifc
 * ````
 *
 * ## Usage
 *
 * The example below shows how to use {@link @xeokit/webifc!loadWebIFC | loadWebIFC} in context.
 *
 * In this example, we will create a {@link @xeokit/viewer!Viewer | Viewer} with
 * a {@link @xeokit/webglrenderer!WebGLRenderer | WebGLRenderer}  and a {@link @xeokit/scene!Scene | Scene}, which holds model geometry
 * and materials. We'll also create a {@link @xeokit/data!Data | Data}, which will hold semantic data for our model.
 *
 * On our Viewer, we will create a single {@link @xeokit/viewer!View | View} to render it to a canvas element on the page. We will
 * also attach a {@link @xeokit/cameracontrol!CameraControl | CameraControl} to our View, allowing us to control its camera with mouse and touch input.
 *
 * Within the Scene, we will create a {@link @xeokit/scene!SceneModel | SceneModel} to hold model geometry and materials. Within Data, we will
 * create a {@link @xeokit/data!DataModel | DataModel} to hold semantic IFC data, which includes IFC elements and property sets.
 *
 * We will then use
 * {@link @xeokit/webifc!loadWebIFC | loadWebIFC} to load an IFC file into our SceneModel and DataModel. Before we do that, however,
 * we need to successfully instantiate and initialize the WebIFC API, which we pass into loadWebIFC.
 *
 * The {@link @xeokit/core!SDKError | SDKError} class will be used to handle any errors that may occur during this process.
 *
 * * [Run this example]()
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
 *     elementId: "myCanvas" // << Ensure that this HTMLElement exists in the page
 * });
 *
 * view.camera.eye = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * new CameraControl(view, {});
 *
 * const ifcAPI = new WebIFC.IfcAPI();
 *
 * ifcAPI.SetWasmPath("https://cdn.jsdelivr.net/npm/web-ifc@0.0.51/");
 *
 * ifcAPI.Init().then(() => {
 *
 *     const sceneModel = scene.createModel({
 *         id: "myModel"
 *     });
 *
 *     const dataModel = data.createModel({
 *         id: "myModel"
 *     });
 *
 *     fetch("model.ifc").then(response => {
 *
 *         response.arrayBuffer().then(fileData => {
 *
 *             loadWebIFC({
 *                 ifcAPI,
 *                 fileData,
 *                 sceneModel,
 *                 dataModel
 *             }).then(() => {
 *
 *                 sceneModel.build();
 *                 dataModel.build();
 *
 *             }).catch(err => {
 *
 *                 sceneModel.destroy();
 *                 dataModel.destroy();
 *
 *                 console.error(`Error loading IFC file with WebIFC: ${err}`);
 *             });
 *
 *         }).catch(err => {
 *              console.error(`Error creating ArrayBuffer from fetch response: ${err}`);
 *         });
 *
 *      }).catch(err => {
 *          console.error(`Error fetching IFC file: ${err}`);
 *      });
 *
 *  }).catch(err => {
 *      console.error(`Error initializing WebIFC.IfcAPI: ${err}`);
 *  });
 * ````
 *
 * @module @xeokit/webifc
 */
export * from "./loadWebIFC";
