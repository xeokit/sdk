/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit glTF -> XGF Converter
 *
 * ---
 *
 * ***CLI tools for converting glTF models into xeokit's compact XGF geometry format.***
 *
 * ---
 *
 * * Converts glTF files to XGF, xeokit's efficient binary format for large models.
 * * Optionally generates a JSON file containing a data model that represents the glTF scene hierarchy.
 * * Backward compatibility for all XGF versions.
 * * XGF format contains only geometry and color data; textures are not supported.
 *
 * # Installation
 *
 * Install the xeokit SDK by running:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * # Usage
 *
 * ## Converting a glTF file
 *
 * Use the `gltf2xgf` CLI tool to convert a single glTF file into an XGF file, along with an optional JSON file containing
 * a simple DataModel derived from the glTF `scene` and `node` hierarchy.
 *
 * ````bash
 * node gltf2xgf.js -h
 * Usage: gltf2xgf [options]
 *
 * CLI tool to convert glTF files into xeokit's compact XGF format.
 *
 * Options:
 *   -v, --version            output the version number
 *   -i, --source [file]      path to source glTF file
 *   -s, --scenemodel [file]  path to target XGF file
 *   -d, --datamodel [file]   path to target JSON data model file, derived from the glTF scene hierarchy (optional)
 *   -f, --format [number]    target XGF version (default is 1; supported version is 1)
 *   -h, --help               display help for the command
 * ````
 *
 * The example below converts a binary glTF file to XGF. The resulting XGF objects will contain geometry and material color
 * data parsed from the glTF file. The XGF file can then be loaded into a xeokit {@link scene!SceneModel | SceneModel}
 * using the {@link xgf!loadXGF | loadXGF()} function. For optimal performance, it is recommended to convert binary glTF files.
 *
 * ````bash
 * node gltf2xgf -i duplex.glb -s duplex.xgf
 * ````
 *
 * ## Converting a glTF file and extracting the scene hierarchy
 *
 * In the next example, we convert a binary glTF file to XGF, while also generating a JSON file that defines a simple data model
 * expressing the hierarchy of the `nodes` within the glTF `scene`. The JSON file can then be loaded into a xeokit
 * {@link data!DataModel | DataModel} using {@link data!Data.createModel | Data.createModel()}.
 *
 * ````bash
 * node gltf2xgf -i duplex.glb -s duplex.xgf -d duplex.json
 * ````
 *
 * ## Converting a glTF file to a specific XGF version
 *
 * In the previous examples, we converted the glTF file to the latest version of XGF by default. In this example, we convert
 * the binary glTF file to a specific version of XGF. The XGF format is expected to evolve over time, and this feature ensures
 * backward compatibility.
 *
 * ````bash
 * gltf2xgf -i duplex.glb -s duplex.xgf -f 1
 * ````
 *
 * @module gltf2xgf
 */
export * from "./gltf2xgf_core";
