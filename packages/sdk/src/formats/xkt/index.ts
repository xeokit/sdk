/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) Importer and Exporter
 *
 * ---
 *
 * ### *Import models as xeokit's native binary [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) format*
 *
 * ---
 *
 * The xeokit SDK allows us to import 3D models from [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt), which is xeokit's
 * native runtime asset delivery format for model representations and semantics.
 *
 * The [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) format compresses large double-precision model geometry to
 * a compact payload that loads quickly over the Web into a xeokit viewer running in the browser.
 *
 * To import a [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) model into xeokit, use the {@link XKTLoader} class,
 * which will load the file into a {@link model!scene.SceneModel | SceneModel}.
 *
 * Use the {@link formats!metamodel.MetaModelLoader | MetaModelLoader} function to load legacy JSON metadata into a {@link model!data.DataModel | DataModel}.
 *
 * <br>
 *
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class XKTLoader {
 *       +format : "XKT"
 *       +versions : ["v1".."v10"]
 *       +load(params, options?) Promise~void~
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- XKTLoader
 * ```
 *
 * Legacy v1–v10 XKT formats are all read by the same loader; the
 * version is auto-detected from the file header.
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **xeokit V2 compatibility** — load every XKT vintage produced
 *   by `xeokit-convert` (v1 through v10) into the V3 SceneModel +
 *   DataModel pipeline.
 * - **Geometry + metadata** — XKT carries both meshes and the
 *   matching MetaModel; the loader splits them across SceneModel
 *   and DataModel automatically.
 * - **Read-only** — no `.xkt` exporter ships; v3 hosts produce
 *   XGF + DataModel JSON instead.
 *
 * ---
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ## Usage
 *
 * In the example below, we will create a {@link viewing!viewer.Viewer | Viewer} with
 * a {@link viewing!webGLRenderer.WebGLRenderer | WebGLRenderer}  and a {@link model!scene.Scene | Scene}, which holds model geometry and materials.
 *
 * On our Viewer, we will create a single {@link viewing!viewer.View | View} to render it to a canvas element on the page. We will
 * also show a {@link viewing!viewController.ViewController | ViewController} to our View, allowing us to control its camera with mouse and touch input.
 *
 * Within the Scene, we will create a {@link model!scene.SceneModel | SceneModel} to hold a model. We will then use
 * {@link formats!xkt.XKTLoader | XKTLoader} to load
 * any XKT file into our SceneModel.
 *
 * The  class will be used to handle any errors that may occur during this process.
 *
 * * [Run this example]()
 *
 * ````javascript
 * import {SDKError} from "@xeokit/core";
 * import {Scene} from "@xeokit/scene";
 * import {WebGLRenderer} from "@xeokit/webGLRenderer";
 * import {Viewer} from "@xeokit/viewer";
 * import {ViewController} from "@xeokit/viewController";
 * import {XKTLoader} from "@xeokit/xkt";
 *
 * const scene = new Scene();
 *
 * const viewer = new Viewer({
 *   scene
 * });
 *
 * const renderer = new WebGLRenderer({
 *   viewer
 * });
 *
 * const viewResult = viewer.createView({
 *   id: "myView",
 *   elementId: "myCanvas" // << Ensure that this HTMLElement exists in the page
 * });
 *
 * const xktLoader = new XKTLoader();
 *
 * if (!viewResult.ok) {
 *     console.error(`Error creating View -> ${viewResult.error}`);
 *
 * } else {
 *
 *     const view = viewResult.value;
 *
 *     view.camera.eye = [1841982.93, 10.03, -5173286.74];
 *     view.camera.look = [1842009.49, 9.68, -5173295.85];
 *     view.camera.up = [0.0, 1.0, 0.0];
 *
 *     new ViewController(view, {});
 *
 *     const sceneModelResult = scene.createModel({
 *         id: "myModel"
 *     });
 *
 *     if (!sceneModelResult.ok) {
 *         console.error(`Error creating SceneModel -> ${sceneModel.error}`);
 *
 *     } else {
 *
 *        const sceneModel = sceneModelResult.model;
 *
 *        fetch("model.xkt").then(response => {
 *
 *             response.arrayBuffer().then(fileData => {
 *
 *                 xktLoader.load({
 *                     fileData,
 *                     sceneModel
 *                 }).then(() => {
 *
 *                     // Loaded
 *
 *                 }).catch(sdkError => {
 *                     sceneModel.destroy();
 *                     console.error(`Error loading XKT -> ${sdkError.message}`);
 *                 });
 *
 *             }).catch(message => {
 *                 console.error(`Error creating ArrayBuffer -> ${message}`);
 *             });
 *
 *         }).catch(message => {
 *             console.error(`Error fetching model -> ${message}`);
 *         });
 *     }
 * }
 * ````
 *
 * @module xkt
 */
export * from "./XKTLoader";
export * from "./loadXKTManifest";
