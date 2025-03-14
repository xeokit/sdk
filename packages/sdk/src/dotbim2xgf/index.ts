/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit .BIM to XGF Converter
 *
 * ---
 *
 * ***CLI tools for converting .BIM models into xeokit's compact XGF geometry format.***
 *
 * ---
 *
 * * Converts a .BIM file to an XGF geometry file, with an optional JSON file containing the IFC data model.
 * * Fully compatible with all XGF versions.
 * * XGF files contain only geometry and color—textures are not included.
 *
 * # Installation
 *
 * To install the xeokit SDK, run:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * # Usage
 *
 * ## Converting a .BIM File
 *
 * Use the `dotbim2xgf` CLI tool to convert a single .BIM file into a single XGF file, with an optional JSON file containing
 * the IFC semantic data model.
 *
 * ````bash
 * node dotbim2xgf.js -h
 * Usage: dotbim2xgf [options]
 *
 * CLI tool to convert .BIM files into xeokit's compact XGF format.
 *
 * Options:
 *   -v, --version            Output the version number.
 *   -i, --source [file]      Path to the source .BIM file.
 *   -s, --scenemodel [file]  Path to the target XGF file.
 *   -d, --datamodel [file]   Path to the target JSON IFC data model file (optional).
 *   -f, --format [number]    Target XGF version. Supported versions: 1. Default is 1.
 *   -h, --help               Display help for command.
 * ````
 *
 * The example below demonstrates converting a .BIM file into an XGF file and a JSON data model file. The XGF file can
 * then be loaded into a {@link scene!SceneModel | SceneModel} using {@link xgf!loadXGF | loadXGF()}. The JSON file can
 * be loaded into a {@link data!DataModel | DataModel} using {@link data!loadDataModel | loadDataModel()}.
 *
 * ````bash
 * node dotbim2xgf -i model.bim -s model.xgf -d model.json
 * ````
 *
 * ## Converting a .BIM File to a Specific XGF Version
 *
 * In the previous example, we converted to the latest version of XGF by default. In the next example, we will convert a
 * binary .BIM file to a specific version of XGF. This feature ensures backward compatibility as the XGF format may evolve
 * in the future.
 *
 * ````bash
 * dotbim2xgf -i duplex.glb -s duplex.xgf -f 1
 * ````
 *
 * @module dotbim2xgf
 */
export * from "./dotbim2xgf_core";
