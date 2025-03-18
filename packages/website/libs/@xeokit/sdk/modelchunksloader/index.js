/**
 * <img style="padding:50px" src="media://images/xeokit_datamodel_icon.png"/>
 *
 * # xeokit Model Chunks Loader
 *
 * ---
 *
 * ***Loads multi-part models into SceneModels and DataModels***
 *
 * ---
 *
 * # Usage
 *
 * Use a {@link modelchunksloader!ModelChunksLoader | ModelChunksLoader} to batch-load the files listed in a
 * {@link core!ModelChunksManifestParams | ModelChunksManifestParams} into a
 * {@link scene!SceneModel | SceneModel} and/or {@link data!DataModel | DataModel}.
 *
 * We'll provide our ModelChunksManifestParams in a JSON file named `modelChunksManifest.json`, the contents of which are shown below.
 *
 * ````json
 * {
 *     sceneModelMIMEType: "arraybuffer",
 *     sceneModelFiles: [
 *         "model.xgf",
 *         "model2.xgf"
 *         "model3.xgf"
 *     ],
 *     dataModelFiles: [
 *         "model.json",
 *         "model2.json"
 *         "model3.json"
 *     ]
 * }
 * ````
 *
 * In this file, `sceneModelFiles` contains a list of {@link "@xeokit/xgf" | XGF} files, and `dataModelFiles`
 * contains a list of {@link metamodel!MetaModelParams | ModelModelParams} files.
 *
 * We can now load this file into a {@link scene!SceneModel | SceneModel} and
 * {@link data!DataModel | DataModel}, using {@link xgf!loadXGF | loadXGF},
 * {@link data!loadDataModel | loadDataModel} and {@link modelchunksloader!ModelChunksLoader | ModelChunksLoader}:
 *
 * ````
 * import {Scene} from "@xeokit/sdk/scene}";
 * import {Data} from "@xeokit/sdk/data}";
 * import {ModelChunksLoader} from "@xeokit/sdk/modelChunksLoader}";
 * import {loadXGF} from "@xeokit/sdk/xgf}";
 * import {loadDataModel} from "@xeokit/sdk/data}";
 * import {SDKError} from "@xeokit/sdk/core";
 * import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {CameraControl} from "@xeokit/sdk/cameracontrol";
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
 *     elementId: "myCanvas"
 * });
 *
 * view.camera.eye = [0,0,-100];
 * view.camera.look = [0,0,0];
 * view.camera.up = [0.0, 1.0, 0.0];
 *
 * new CameraControl(view, {});
 *
 * const sceneModel = scene.createModel({
 *     id: "myModel"
 * });
 *
 * const dataModel = data.createModel({
 *     id: "myModel"
 * });
 *
 * const modelChunksLoader = new ModelChunksLoader({
 *     sceneModelLoader: loadXGF,
 *     dataModelLoader: loadDataModel
 * });
 *
 * fetch(`modelChunksManifest.json`).then(response => {
 *      response
 *      .json()
 *      .then(modelChunksManifest => {
 *
 *          modelChunksLoader.load({
 *              modelChunksManifest,
 *              baseDir: ".",
 *              sceneModel,
 *              dataModel
 *
 *        }).then(() =>{
 *              sceneModel.build();
 *              dataModel.build();
 *        });
 *    });
 * ````
 *
 * @module modelchunksloader
 */
export * from "./ModelChunksLoader";
//# sourceMappingURL=index.js.map