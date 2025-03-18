/**
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit ifc2gltf -> XGF Converter
 *
 * ---
 *
 * ***CLI tools to convert glTF models into xeokit's compact [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) geometry format.***
 *
 * ---
 *
 * * Post-converts the output of `ifc2gltf` for optimal loading into a xeokit Viewer.
 * * Converts glTF files to XGF, xeokit's compact binary geometry format.
 * * Converts JSON MetaModel files to JSON MetaData files, xeokit's newer data model format.
 * * Generates all XGF versions.
 *
 * # Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * # Usage
 *
 * ## Converting a batch of glTF + MetaModel files
 *
 * Use the `ifc2gltf2xgf` tool to convert a batch of glTF+MetaModel files into a batch of XGF+DataModel files.
 *
 * ````bash
 * node ifc2gltf2xgf.js -h
 * Usage: ifc2gltf2xgf [options]
 *
 * CLI to batch-convert a manifest of glTF/GLB files into XGF SceneModel files and/or JSON DataModel files
 *
 * Options:
 *   -v, --version          output the version number
 *   -i, --input [file]     path to input manifest of glTF+JSON files (required)
 *   -o, --output [file]    path to target manifest of XGF+JSON files (required)
 *   -f, --format [number]  target XGF version (optional) - supported XGF version is 1, default is 1
 *   -l, --log              enable logging (optional)
 *   -h, --help             display help for command
 * ````
 *
 * Our input {@link @xeokit/ifc2gltf2xgf!Ifc2gltfManifestParams | Ifc2gltfManifestParams} file, `ifc2gltfManifest.json`, is shown below.
 *
 * Each file in `gltfOutFiles` is a glTF, and each file in `metadataOutFiles` is a {@link @xeokit/metamodel!MetaModelParams | ModelModelParams} JSON file.
 *
 * ````json
 * {
 *     "inputFile": "model.ifc",
 *     "converterApplication": "ifc2gltfcxconverter",
 *     "converterApplicationVersion": "4.14",
 *     "conversionDate": "2024-09-13 21:43:58",
 *     "gltfOutFiles": [
 *         "model.glb",
 *         "model2.glb",
 *         "model3.glb"
 *     ],
 *     "metadataOutFiles": [
 *         "model.json",
 *         "model2.json"
 *         "model2.json"
 *     ],
 *     "numCreatedGltfMeshes": 871,
 *     "numCreatedMetaObjects": 246,
 *     "numExportedPropertySetsOrElementQuantities": 0,
 *     "modelBoundsMax": [
 *         9.041500091552734,
 *         5.017477452754974,
 *         9.0
 *     ],
 *     "modelBoundsMin": [
 *         -0.24150000512599945,
 *         -22.1827335357666,
 *         -1.550000011920929
 *     ],
 *     "generalMessages": [
 *         "Detected IFC version: IFC4X3"
 *     ],
 *     "warnings": [],
 *     "errors": []
 * }
 * ````
 *
 * We invoke `ifc2gltf2xgf` with paths to a source {@link @xeokit/ifc2gltf2xgf!Ifc2gltfManifestParams | Ifc2gltfManifestParams} file
 * to read and a target {@link @xeokit/core!ModelChunksManifestParams | ModelChunksManifestParams} file to write:
 *
 * ````bash
 * node ifc2gltf2xgf -i ifc2gltfManifest.json -o xgfManifest.json
 * ````
 *
 * If we wanted, we could load `ifc2gltfManifest.json` into a SceneModel and DataModel, using loadGLTF, loadMetaModel and ModelChunksLoader:
 *
 * ```` javascript
 * import {Scene} from ""@xeokit/sdk/scene}";
 * import {Data} from ""@xeokit/sdk/data}";
 * import {ModelChunksLoader} from ""@xeokit/sdk/modelChunksLoader}";
 * import {loadGLTF} from ""@xeokit/sdk/gltf}";
 * import {loadMetaModel} from ""@xeokit/sdk/metamodel}";
 *
 * const scene = new Scene();
 * const data = new Data();
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
 *      sceneModelLoader: loadGLTF,
 *      dataModelLoader: loadMetaModel
 * });
 *
 * fetch(`ifc2gltfManifest.json`).then(response => {
 *      response
 *      .json()
 *      .then(ifc2gltfManifest => {
 *
 *          const modelChunksManifest = xeokit.ifc2gltf2xgf.convertIfc2gltfManifest(ifc2gltfManifest);
 *
 *          modelChunksLoader.load({
 *              modelChunksManifest,
 *              baseDir: ".",
 *              sceneModel,
 *              dataModel
 *          }).then(() =>{
 *              sceneModel.build();
 *              dataModel.build();
 *          });
 *      });
 * ````
 *
 * Our `xgfManifest.json` output file is shown below. This file has the format of {@link @xeokit/core!ModelChunksManifestParams | ModelChunksManifestParams} and is shown below.
 *
 * Each file referenced in `sceneModelFiles` is an XGF geometry file (see {@link ""@xeokit/sdk/xgf" | @xeokit/xgf}). Each file referenced
 * in `dataModelFiles` is a JSON data model file with the format of {@link @xeokit/metamodel!MetaModelParams | ModelModelParams}.
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
 * If we wanted, we could now load `xgfManifest.json` into a SceneModel and DataModel, using loadGLTF, loadDataModel and ModelChunksLoader:
 *
 * ````
 * import {Scene} from ""@xeokit/sdk/scene}";
 * import {Data} from ""@xeokit/sdk/data}";
 * import {ModelChunksLoader} from ""@xeokit/sdk/modelChunksLoader}";
 * import {loadGLTF} from ""@xeokit/sdk/gltf}";
 * import {loadDataModel} from ""@xeokit/sdk/data}";
 *
 * const scene = new Scene();
 * const data = new Data();
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
 * fetch(`gxfManifest.json`).then(response => {
 *      response
 *      .json()
 *      .then(gxfManifest => {
 *
 *          modelChunksLoader.load({
 *              modelChunksManifest: gxfManifest,
 *              baseDir: ".",
 *              sceneModel,
 *              dataModel
 *          }).then(() =>{
 *              sceneModel.build();
 *              dataModel.build();
 *          });
 *      });
 * ````
 *
 * @module ifc2gltf2xgf
 */
export * from "./Ifc2gltfManifestParams";
export * from "./convertIfc2gltfManifest";
//# sourceMappingURL=index.js.map