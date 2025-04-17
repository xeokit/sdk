/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit CityJSON → XGF Converter
 *
 * ---
 *
 * **Command-line tools for converting CityJSON models into xeokit's optimized [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) format.**
 *
 * ---
 *
 * ## Features
 * - Converts CityJSON files into XGF, xeokit's compact geometry format for large-scale models.
 * - Optionally generates a JSON file containing a data model that preserves the CityJSON model's object hierarchy.
 * - Supports all versions of XGF for backward compatibility.
 * - XGF contains only geometry and color—textures are not included.
 *
 * ---
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ---
 *
 * ## Usage
 *
 * ### Converting a CityJSON File to XGF
 *
 * Use the `cityjson2xgf` CLI tool to convert a CityJSON file into an XGF file.
 * Optionally, generate a JSON file containing a structured representation of the CityJSON model's hierarchy.
 *
 * ```bash
 * node cityjson2xgf.js -h
 * Usage: cityjson2xgf [options]
 *
 * CLI tool to convert CityJSON files into xeokit's compact XGF format.
 *
 * Options:
 *   -v, --version            Output the version number
 *   -i, --source [file]      Path to the source CityJSON file
 *   -s, --scenemodel [file]  Path to the target XGF file
 *   -d, --datamodel [file]   Path to the optional JSON data model file, extracted from the CityJSON hierarchy
 *   -f, --format [number]    Target XGF version (default: 1, supported versions: 1)
 *   -h, --help               Display help information
 * ```
 *
 * ### Example: Converting CityJSON to XGF
 *
 * The following command converts a CityJSON file into an XGF file.
 * The XGF format retains the geometry and material colors from the CityJSON file.
 * Once converted, the XGF file can be loaded into a xeokit {@link scene!SceneModel | SceneModel}
 * using the {@link xgf!XGFLoader | XGFLoader()} function for optimized visualization.
 *
 * ```bash
 * node cityjson2xgf -i duplex.json -s duplex.xgf
 * ```
 *
 * ### Example: Extracting Scene Hierarchy
 *
 * This example converts a CityJSON file to XGF and also generates a JSON file
 * that represents the CityJSON model's object hierarchy.
 * The JSON file can then be loaded into a xeokit {@link data!DataModel | DataModel}
 * using {@link data!Data.createModel | Data.createModel()}.
 *
 * ```bash
 * node cityjson2xgf -i duplex.json -s duplex.xgf -d duplex_hierarchy.json
 * ```
 *
 * ### Example: Converting to a Specific XGF Version
 *
 * By default, CityJSON files are converted to the latest XGF version.
 * If you need to generate an XGF file compatible with a specific version,
 * you can specify the format version using the `-f` flag.
 *
 * ```bash
 * node cityjson2xgf -i duplex.json -s duplex.xgf -f 1
 * ```
 *
 * ---
 *
 * @module cityjson2xgf
 */
export * from "./cityjson2xgf";
//# sourceMappingURL=index.d.ts.map
