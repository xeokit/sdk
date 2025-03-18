/**
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit CityJSON -> XGF Converter
 *
 * ---
 *
 * ***CLI tools to convert CityJSON models into xeokit's compact [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) geometry format.***
 *
 * ---
 *
 * * Converts CityJSON files to XGF, xeokit's compact format for large models.
 * * Optionally creates an additional JSON file containing a data model that expresses the CityJSON model's object hierarchy.
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
 * ## Converting a CityJSON file
 *
 * Use the `gltf2xgf` CLI tool to convert a single CityJSON file into a single XGF file, plus an optional JSON file containing
 * a simple DataModel derived from the CityJSON `scene` `node` hierarchy.
 *
 * ````bash
 * node gltf2xgf.js -h
 * Usage: gltf2xgf [options]
 *
 * CLI to convert CityJSON files into xeokit's compact XGF format
 *
 * Options:
 *   -v, --version            output the version number
 *   -i, --source [file]      path to source CityJSON file
 *   -s, --scenemodel [file]  path to target XGF file
 *   -d, --datamodel [file]   path to target JSON data model file, extracted from CityJSON scene hierarchy (optional)
 *   -f, --format [number]    target XGF version - supported XGF version is 1, default is 1
 *   -h, --help               display help for command
 * ````
 *
 * The example below converts a CityJSON file to XGF. The XGF objects will have geometries and material colors
 * parsed from the CityJSON. The XGF file can then be loaded into a xeokit {@link scene!SceneModel | SceneModel}
 * using the {@link xgf!loadXGF | loadXGF()} function. We recommend converting CityJSON for best performance.
 *
 * ````bash
 * node gltf2xgf -i duplex.glb -s duplex.xgf
 * ````
 *
 * ## Converting a CityJSON file and extracting scene hierarchy
 *
 * In the next example, we'll convert a CityJSON file to XGF, while also creating a JSON file that defines
 * a simple data model that expresses the hierarchy of the objects within the CityJSON model. The JSON file can
 * then be loaded into a xeokit {@link data!DataModel | DataModel}
 * using {@link data!Data.createModel | Data.createModel()}.
 *
 * ````bash
 * node cityjson2xgf -i duplex.json -s duplex.xgf -d duplex.json
 * ````
 *
 * ## Converting a CityJSON file to a specific XGF version
 *
 * In our previous examples, we converted to the latest version of XGF by default. In the next example, we'll convert a
 *  CityJSON file to a specific version of XGF. The XGF format is expected to evolve in the future, so this feature
 * ensures backward-compatibility.
 *
 * ````bash
 * cityjson2xgf -i duplex.json -s duplex.xgf -f 1
 * ````
 *
 * @module gltf2xgf
 */
export * from "./cityjson2xgf";
//# sourceMappingURL=index.js.map