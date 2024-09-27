/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fgltfviewer.svg)](https://badge.fury.io/js/%40xeokit%2Fgltfviewer)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/gltfviewer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/gltfviewer)
 *
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit .BIM -> XGF Conversion Tool
 *
 * ---
 *
 * ***CLI tools to convert .BIM models into xeokit's compact [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) geometry format.***
 *
 * ---
 *
 * * Converts a .BIM file to an XGF geometry file, along with an optional JSON file containing the IFC data model.
 * * Backward support for all XGF versions.
 * * XGF does not contain textures - only geometry and color.
 *
 * # Installation
 *
 * ````bash
 * npm install @xeokit/dotbim2xgf
 * ````
 *
 * # Usage
 *
 * ## Converting a .BIM file
 *
 * Use the `dotbim2xgf` CLI tool to convert a single .BIM file into a single XGF file, plus an optional JSON file containing
 * a DataModel of IFC sementic data.
 *
 * ````bash
 * node dotbim2xgf.js -h
 * Usage: dotbim2xgf [options]
 *
 * CLI to convert .BIM files into xeokit's compact XGF format
 *
 * Options:
 *   -v, --version            output the version number
 *   -i, --source [file]      path to source .BIM file
 *   -s, --scenemodel [file]  path to target XGF file
 *   -d, --datamodel [file]   path to target JSON IFC data model file, extracted from .BIM (optional)
 *   -f, --format [number]    target XGF version - supported XGF version is 1, default is 1
 *   -h, --help               display help for command
 * ````
 *
 * The example below converts a .BIM file to an XGF file and a JSON data model file. The XGF file can then be loaded into a
 * {@link @xeokit/scene!SceneModel | SceneModel} using {@link @xeokit/xgf!loadXGF | loadXGF()}. The JSON file can be
 * loaded into a {@link @xeokit/data!DataModel | DataModel} using {@link @xeokit/data!loadDataModel | loadDataModel()}.
 *
 * ````bash
 * node dotbim2xgf -i model.bim -s model.xgf -d model.json
 * ````
 *
 * ## Converting a .BIM file to a specific XGF version
 *
 * In our previous examples, we converted to the latest version of XGF by default. In the next example, we'll convert a
 * binary .BIM file to a specific version of XGF. The XGF format is expected to evolve in the future, so this feature
 * ensures backward-compatibility.
 *
 * ````bash
 * dotbim2xgf -i duplex.glb -s duplex.xgf -f 1
 * ````
 *
 * @module @xeokit/dotbim2xgf
 */
export * from "./dotbim2xgf";
