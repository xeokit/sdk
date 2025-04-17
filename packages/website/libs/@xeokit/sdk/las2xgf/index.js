/**

 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit LAS/LAZ -> XGF Converter
 *
 * ---
 *
 * ***CLI tools to convert LAS/LAZ models into xeokit's compact [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) geometry format.***
 *
 * ---
 *
 * * Converts a LAS/LAZ file to an XGF geometry file, along with an optional JSON file containing the IFC data model.
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
 * ## Converting a LAS/LAZ file
 *
 * Use the `las2xgf` CLI tool to convert a single LAS/LAZ file into a single XGF file, plus an optional JSON file containing
 * a DataModel of IFC semantic data.
 *
 * ````bash
 * node las2xgf.js -h
 * Usage: las2xgf [options]
 *
 * CLI to convert LAS/LAZ files into xeokit's compact XGF format
 *
 * Options:
 *   -v, --version            output the version number
 *   -i, --source [file]      path to source LAS/LAZ file
 *   -s, --scenemodel [file]  path to target XGF file
 *   -d, --datamodel [file]   path to target JSON IFC data model file, extracted from LAS/LAZ (optional)
 *   -f, --format [number]    target XGF version - supported XGF version is 1, default is 1
 *   -h, --help               display help for command
 * ````
 *
 * The example below converts a LAS/LAZ file to an XGF file and a JSON data model file. The XGF file can then be loaded into a
 * {@link scene!SceneModel | SceneModel} using {@link xgf!XGFLoader | XGFLoader()}. The JSON file can be
 * loaded into a {@link data!DataModel | DataModel} using {@link data!loadDataModel | loadDataModel()}.
 *
 * ````bash
 * node las2xgf -i model.laz -s model.xgf -d model.json
 * ````
 *
 * ## Converting a LAS/LAZ file to a target XGF version
 *
 * In our previous examples, we converted to the latest version of XGF by default. In the next example, we'll convert a
 * binary LAS/LAZ file to a specific version of XGF. The XGF format is expected to evolve in the future, so this feature
 * ensures backward-compatibility.
 *
 * ````bash
 * las2xgf -i modal.laz -s model.xgf -f 1
 * ````
 *
 * @module las2xgf
 */
export * from "./las2xgf";
//# sourceMappingURL=index.js.map
