/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fgltfviewer.svg)](https://badge.fury.io/js/%40xeokit%2Fgltfviewer)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/gltfviewer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/gltfviewer)
 *
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit glTF -> XGF Conversion Tools
 *
 * ---
 *
 * ***CLI tools to convert glTF models into xeokit's compact [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) geometry format.***
 *
 * ---
 *
 * * Converts glTF files to XGF, xeokit's compact binary format for large models.
 * * Optionally creates an additional JSON file containing a data model that expresses the glTF scene hierarchy.
 * * Backward support for all XGF versions.
 * * XGF does not contain textures - only geometry and color.
 *
 * # Installation
 *
 * ````bash
 * npm install @xeokit/gltf2xgf
 * ````
 *
 * # Usage
 *
 * ## Converting a single glTF file
 *
 * Use the `gltf2xgf` CLI tool to convert a single glTF file into a single XGF file, plus an optional JSON file containing
 * a simple DataModel derived from the glTF `scene` `node` hierarchy.
 *
 * ````bash
 * node gltf2xgf.js -h
 * Usage: gltf2xgf [options]
 *
 * CLI to convert glTF files into xeokit's compact XGF format
 *
 * Options:
 *   -v, --version          output the version number
 *   -i, --source [file]    path to source glTF file
 *   -s, --scenemodel [file]    path to target XGF file
 *   -d, --datamodel [file]    path to target JSON data model file, extracted from glTF scene hierarchy (optional)
 *   -f, --format [number]  target XGF version - supported XGF version is 1, default is 1
 *   -h, --help             display help for command
 * ````
 *
 * The example below converts a binary glTF file to XGF. The XGF objects will have geometries and material colors
 * parsed from the glTF. The XGF file can then be loaded into a xeokit {@link @xeokit/scene!SceneModel | SceneModel}
 * using the {@link @xeokit/xgf!loadXGF | loadXGF()} function. We recommend converting binary glTF for best performance.
 *
 * ````bash
 * node gltf2xgf -i duplex.glb -s duplex.xgf
 * ````
 *
 * ## Converting a glTF file and extracting scene hierarchy
 *
 * In the next example, we'll convert a binary glTF file to XGF, while also creating a JSON file that defines
 * a simple data model that expresses the hierarchy of the `nodes` within the glTF `scene`. The JSON file can
 * then be loaded into a xeokit {@link @xeokit/data!DataModel | DataModel}
 * using {@link @xeokit/data!Data.createModel | Data.createModel()}.
 *
 * ````bash
 * node gltf2xgf -i duplex.glb -s duplex.xgf -d duplex.json
 * ````
 *
 * ## Converting a glTF file to a specific XGF version
 *
 * In our previous examples, we converted to the latest version of XGF by default. In the next example, we'll convert a
 * binary glTF file to a specific version of XGF. The XGF format is expected to evolve in the future, so this feature
 * ensures backward-compatibility.
 *
 * ````bash
 * gltf2xgf -i duplex.glb -s duplex.xgf -f 1
 * ````
 *
 * ## Converting a batch of glTF files
 *
 * Use the `splitgltf2xgf` tool to convert a batch of glTF files into a batch of XGF files.
 *
 * ````bash
 * node splitgltf2xgf.js -h
 * Usage: splitgltf2xgf [options]
 *
 * CLI to convert a manifest of glTF/GLB files into XGF SceneModel files and/or JSON DataModel files
 *
 * Options:
 *   -v, --version          output the version number
 *   -i, --input [file]     path to input manifest of glTF files (required)
 *   -o, --output [file]    path to target manifest of XGF files (required)
 *   -f, --format [number]  target XGF version (optional) - supported XGF version is 1, default is 1
 *   -l, --log              enable logging (optional)
 *   -h, --help             display help for command
 * ````
 *
 * To convert a batch of glTF files, we invoke `splitgltf2xgf` with a JSON manifest that lists them. Then
 * `splitgltf2xgf` will output the XGF files, along with another JSON manifest that lists those XGF files.
 *
 * ````bash
 * node splitgltf2xgf -i glbManifest.json -o xgfManifest.json
 * ````
 *
 * The `glbManifest.json` and `xgfManifest.json` arguments both have the
 * format of {@link @xeokit/modelchunksloader!ModelChunksManifestParams | ModelChunksManifestParams}.
 *
 * The `glbManifest.json` looks like this:
 *
 * ````json
 * {
 *     sceneModelFiles: [
 *         "myModel1.glb",
 *         "myModel2.glb"
 *         "myModel3.glb"
 *     ],
 *     dataModelFiles: [
 *         "myModel1.json",
 *         "myModel2.json"
 *         "myModel3.json"
 *     ]
 * }
 * ````
 *
 * Each file referenced in `dataModelFiles` has the schema defined in {@link @xeokit/data!DataModelParams | DataModelParams}.
 *
 * The `xgfManifest.json` looks like below.
 *
 * ````json
 * {
 *     sceneModelMIMEType: "arraybuffer",
 *     sceneModelFiles: [
 *         "myModel1.xgf",
 *         "myModel2.xgf"
 *         "myModel3.xgf"
 *     ],
 *     dataModelFiles: [
 *         "myModel1.json",
 *         "myModel2.json"
 *         "myModel3.json"
 *     ]
 * }
 * ````
 *
 * @module @xeokit/gltf2xgf
 */
export * from "./gltf2xgf";
