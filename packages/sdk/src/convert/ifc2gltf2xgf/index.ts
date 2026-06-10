/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="../../assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit gltf → XGF Converter
 *
 * ---
 *
 * **CLI tool that drives the canonical "IFC → glTF/MetaModel → XGF /
 * DataModel" pipeline, producing xeokit's compact
 * [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf)
 * geometry format plus matching DataModel JSON for streamed loading.**
 *
 * ---
 *
 * Bridges the two-stage conversion that BIM workflows typically run:
 *
 * 1. **IFC → glTF + MetaModel** — done by an external converter
 *    (e.g. `ifc2gltfcxconverter`); produces a JSON manifest listing
 *    every output chunk.
 * 2. **glTF + MetaModel → XGF + DataModel** — done by `xgf` (this
 *    CLI); batch-loads the manifest and emits xeokit-native chunks.
 *
 * Pair the output with
 * {@link model!streaming.ModelChunksLoader | ModelChunksLoader} for
 * streamed loading in a Viewer.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * flowchart LR
 *     A[model.ifc] --> B[ifc2gltf — external]
 *     B --> C[ifc2gltfManifest.json<br/>+ model.glb + model.json chunks]
 *     C --> D[xgf CLI]
 *     D --> E[xgfManifest.json<br/>+ model.xgf + model.json chunks]
 *     E --> F[ModelChunksLoader]
 *     F --> G[SceneModel + DataModel<br/>in browser]
 *     C -. convertIfc2gltfManifest .-> H[ModelChunksManifestParams]
 *     H --> F
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Batch-converts a manifest** — point `xgf` at an IFC→glTF
 *   manifest and the CLI walks every chunk, emitting matching XGF
 *   geometry + DataModel JSON.
 * - **Manifest adapter** — {@link convertIfc2gltfManifest} converts
 *   the IFC-converter manifest shape into the
 *   {@link model!streaming.ModelChunksManifestParams | ModelChunksManifestParams}
 *   shape, so the browser-side loader can consume both manifest
 *   styles uniformly.
 * - **XGF version selection** — `-f / --format` chooses the target
 *   XGF format version; the CLI registers every supported XGF
 *   exporter so older viewer releases stay compatible.
 * - **Optimised geometry** — XGF is xeokit's compact binary
 *   format; chunks are smaller than the glTF source and load
 *   ~10× faster in the viewer.
 *
 * <br>
 *
 * ## Installation
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage
 *
 * ### Converting a Batch of glTF + MetaModel Files
 *
 * Use the `xgf` tool to convert a batch of glTF+MetaModel files into a batch of XGF+DataModel files.
 *
 * ```bash
 * node xgf.js -h
 * Usage: xgf [options]
 *
 * CLI to batch-convert a manifest of glTF/GLB files into XGF SceneModel files and/or JSON DataModel files
 *
 * Options:
 *   -v, --version          Output the version number
 *   -i, --input [file]     Path to input manifest of glTF+JSON files (required)
 *   -o, --output [file]    Path to target manifest of XGF+JSON files (required)
 *   -f, --format [number]  Target XGF version (optional, default: 1)
 *   -l, --log              Enable logging (optional)
 *   -h, --help             Display help for command
 * ```
 *
 * The input manifest, `ifc2gltfManifest.json`, follows this structure:
 *
 * ```json
 * {
 *     "inputFile": "model.ifc",
 *     "converterApplication": "ifc2gltfcxconverter",
 *     "converterApplicationVersion": "4.14",
 *     "conversionDate": "2024-09-13 21:43:58",
 *     "gltfOutFiles": ["model.glb", "model2.glb", "model3.glb"],
 *     "metadataOutFiles": ["model.json", "model2.json"],
 *     "numCreatedGltfMeshes": 871,
 *     "numCreatedMetaObjects": 246,
 *     "numExportedPropertySetsOrElementQuantities": 0,
 *     "modelBoundsMax": [9.0415, 5.0175, 9.0],
 *     "modelBoundsMin": [-0.2415, -22.1827, -1.55],
 *     "generalMessages": ["Detected IFC version: IFC4X3"],
 *     "warnings": [],
 *     "errors": []
 * }
 * ```
 *
 * Convert to XGF using:
 * ```bash
 * node xgf -i ifc2gltfManifest.json -o xgfManifest.json
 * ```
 *
 * To load `ifc2gltfManifest.json` into a SceneModel and DataModel:
 *
 * ```javascript
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Data } from "@xeokit/sdk/model/data";
 * import { ModelChunksLoader } from "@xeokit/sdk/model/streaming";
 * import { GLTFLoader } from "@xeokit/sdk/formats/gltf";
 * import { loadMetaModel } from "@xeokit/sdk/metamodel";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 * const sceneModel = sceneModelResult.value;
 *
 * const dataModelResult = data.createModel({ id: "myModel" });
 * const dataModel = dataModelResult.value;
 *
 * const modelChunksLoader = new ModelChunksLoader({
 *     sceneModelLoader: GLTFLoader,
 *     dataModelLoader: loadMetaModel
 * });
 *
 * fetch("ifc2gltfManifest.json").then(response => {
 *     response.json().then(ifc2gltfManifest => {
 *         const modelChunksManifest = xeokit.xgf.convertIfc2gltfManifest(ifc2gltfManifest);
 *         modelChunksLoader.load({
 *             modelChunksManifest,
 *             baseDir: ".",
 *             sceneModel,
 *             dataModel
 *         }).then(() => {
 *             // Loaded
 *         });
 *     });
 * });
 * ```
 *
 * The generated `xgfManifest.json`:
 *
 * ```json
 * {
 *     "sceneModelMIMEType": "arraybuffer",
 *     "sceneModelFiles": ["model.xgf", "model2.xgf", "model3.xgf"],
 *     "dataModelFiles": ["model.json", "model2.json", "model3.json"]
 * }
 * ```
 *
 * To load `xgfManifest.json`:
 *
 * ```javascript
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Data } from "@xeokit/sdk/model/data";
 * import { ModelChunksLoader } from "@xeokit/sdk/model/streaming";
 * import { XGFLoader } from "@xeokit/sdk/formats/xgf";
 * import { DataModelImporter } from "@xeokit/sdk/model/data";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 * const sceneModel = sceneModelResult.value;
 *
 * const dataModelResult = data.createModel({ id: "myModel" });
 * const dataModel = dataModelResult.value;
 *
 * const modelChunksLoader = new ModelChunksLoader({
 *     sceneModelLoader: new XGFLoader(),
 *     dataModelLoader: new DataModelImporter()
 * });
 *
 * fetch("xgfManifest.json").then(response => {
 *     response.json().then(xgfManifest => {
 *         modelChunksLoader.load({
 *             modelChunksManifest: xgfManifest,
 *             baseDir: ".",
 *             sceneModel,
 *             dataModel
 *         }).then(() => {
 *             // Loaded
 *         });
 *     });
 * });
 * ```
 *
 * @module ifc2gltf2xgf
 */
export * from "./Ifc2gltfManifestParams";
export * from "./convertIfc2gltfManifest";
