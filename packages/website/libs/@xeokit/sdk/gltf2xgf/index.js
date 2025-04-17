/**
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit glTF -> XGF Converter
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
 * npm install @xeokit/sdk
 * ````
 *
 * # Usage
 *
 * ## Converting a glTF file
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
 *   -v, --version            output the version number
 *   -i, --source [file]      path to source glTF file
 *   -s, --scenemodel [file]  path to target XGF file
 *   -d, --datamodel [file]   path to target JSON data model file, extracted from glTF scene hierarchy (optional)
 *   -f, --format [number]    target XGF version - supported XGF version is 1, default is 1
 *   -h, --help               display help for command
 * ````
 *
 * The example below converts a binary glTF file to XGF. The XGF objects will have geometries and material colors
 * parsed from the glTF. The XGF file can then be loaded into a xeokit {@link scene!SceneModel | SceneModel}
 * using the {@link xgf!XGFLoader | XGFLoader()} function. We recommend converting binary glTF for best performance.
 *
 * ````bash
 * node gltf2xgf -i duplex.glb -s duplex.xgf
 * ````
 *
 * ## Converting a glTF file and extracting scene hierarchy
 *
 * In the next example, we'll convert a binary glTF file to XGF, while also creating a JSON file that defines
 * a simple data model that expresses the hierarchy of the `nodes` within the glTF `scene`. The JSON file can
 * then be loaded into a xeokit {@link data!DataModel | DataModel}
 * using {@link data!Data.createModel | Data.createModel()}.
 *
 * ````bash
 * node gltf2xgf -i duplex.glb -s duplex.xgf -d duplex.json
 * ````
 *
 * ## Converting a glTF file to a target XGF version
 *
 * In our previous examples, we converted to the latest version of XGF by default. In the next example, we'll convert a
 * binary glTF file to a specific version of XGF. The XGF format is expected to evolve in the future, so this feature
 * ensures backward-compatibility.
 *
 * ````bash
 * gltf2xgf -i duplex.glb -s duplex.xgf -f 1
 * ````
 *
 * @module gltf2xgf
 */
export * from "./gltf2xgf";
//# sourceMappingURL=index.js.map
