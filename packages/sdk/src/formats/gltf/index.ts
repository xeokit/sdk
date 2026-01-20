/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_gltf_logo.svg"/>
 *
 * # xeokit glTF Importer and Exporter
 *
 * ---
 *
 * ***Import and export models in the industry-standard glTF model file format.***
 *
 * ---
 *
 * The xeokit SDK enables the import and export of 3D models as [glTF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#gltf) (GL Transmission Format),
 * a widely used format for runtime asset delivery of 3D scenes and models.
 *
 * glTF is a compact and efficient format designed for fast loading and rendering in applications and web browsers. It stores geometry, materials,
 * textures, animations, and scene hierarchy. Open and royalty-free, it has become the go-to format for 3D content distribution and exchange.
 *
 * To import a glTF model into xeokit, use the {@link GLTFLoader | GLTFLoader} class, which loads the file into
 * a {@link scene!SceneModel | SceneModel}. The function also provides the option to load a basic
 * data model into a {@link data!DataModel | DataModel}, to describe the hierarchy of the `nodes` in the glTF `scene`.
 *
 * ---
 *
 * ## Installation
 *
 * Install the xeokit SDK by running:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ---
 *
 * ## Usage
 *
 * The following example demonstrates how to create a {@link viewer!Viewer | Viewer} with a {@link webglrenderer!WebGLRenderer | WebGLRenderer}
 * and a {@link scene!Scene | Scene} that holds model geometry and materials.
 *
 * The example also creates a single {@link viewer!View | View} to render the model to a canvas element on the page,
 * and attaches a {@link cameracontrol!CameraControl | CameraControl} to control the camera using mouse and touch input.
 *
 * Within the Scene, a {@link scene!SceneModel | SceneModel} is created to hold the model. Then, the {@link gltf!GLTFLoader | GLTFLoader} class
 * is used to load a binary glTF (GLB) file into the SceneModel.
 *
 * ````javascript
 * import {SDKInternalException} from "@xeokit/sdk/core";
 * import {Scene} from "@xeokit/sdk/scene";
 * import {Data} from "@xeokit/sdk/data";
 * import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {CameraControl} from "@xeokit/sdk/cameracontrol";
 * import {GLTFLoader} from "@xeokit/sdk/formats/gltf";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
 * const viewer = new Viewer({
 *    scene
 * });
 *
 * const renderer = new WebGLRenderer({
 *   viewer
 * });
 *
 * const viewResult = viewer.createView({
 *     id: "myView",
 *     elementId: "myCanvas" // << Ensure that this HTMLElement exists in the page
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
 * const sceneModelResult = scene.createModel({
 *     id: "myModel"
 * });
 *
 * const sceneModel = sceneModelResult.value;
 *
 * const dataModelResult = data.createModel({
 *     id: "myModel"
 * });
 *
 * const dataModel = dataModelResult.value;
 *
 * const glTFLoader = new GLTFLoader();
 *
 * fetch("model.glb").then(response => {
 *
 *     response.arrayBuffer().then(fileData => {
 *
 *        glTFLoader.load({
 *            fileData,
 *            sceneModel,
 *            dataModel
 *        }).then(() => {
 *
 *            // Loaded
 *
 *        }).catch(err => {
 *            sceneModel.destroy();
 *            dataModel.destroy();
 *            console.error(`Error loading glTF data: ${err}`);
 *        });
 *
 *    }).catch(err => {
 *        console.error(`Error creating ArrayBuffer from fetch response: ${err}`);
 *    });
 *
 * }).catch(err => {
 *    console.error(`Error fetching glTF file: ${err}`);
 * });
 * ````
 *
 * @module gltf
 */
export * from "./GLTFLoader";
export * from "./GLTFExporter";
