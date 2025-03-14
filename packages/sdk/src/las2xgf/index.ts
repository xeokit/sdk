/**
 * <img style="padding: 30px 0 10px; height: 130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit LAS/LAZ → XGF Converter
 *
 * ---
 *
 * **Command-line tools to convert LAS/LAZ models into xeokit's compact [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) geometry format.**
 *
 * ---
 *
 * ### Features:
 * - Converts a LAS/LAZ file to an XGF geometry file, with an optional JSON file containing the data model.
 * - Supports all XGF versions for backward compatibility.
 * - XGF contains only geometry and color—no textures.
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
 * ### Converting a LAS/LAZ file
 *
 * Use the `las2xgf` CLI tool to convert a LAS/LAZ file into an XGF file.
 * You can also generate an optional JSON file containing a DataModel with semantic data.
 *
 * ```bash
 * node las2xgf.js -h
 * ```
 *
 * **Command-line options:**
 *
 * ```
 * Usage: las2xgf [options]
 *
 * CLI to convert LAS/LAZ files into xeokit's compact XGF format.
 *
 * Options:
 *   -v, --version            output the version number
 *   -i, --source [file]      path to source LAS/LAZ file
 *   -s, --scenemodel [file]  path to target XGF file
 *   -d, --datamodel [file]   path to target JSON data model file, extracted from LAS/LAZ (optional)
 *   -f, --format [number]    target XGF version - supported XGF version is 1, default is 1
 *   -h, --help               display help for command
 * ````
 *
 * **Example: Convert a LAS/LAZ file to XGF with JSON data model**
 *
 * ```bash
 * node las2xgf -i model.laz -s model.xgf -d model.json
 * ```
 *
 * The resulting XGF file can be loaded into a {@link scene!SceneModel | SceneModel} using {@link xgf!loadXGF | loadXGF()}.
 * The JSON file can be loaded into a {@link data!DataModel | DataModel} using {@link data!loadDataModel | loadDataModel()}.
 *
 * ---
 *
 * ## Converting to a Specific XGF Version
 *
 * By default, conversions target the latest XGF version.
 * To ensure backward compatibility, specify a target XGF version using the `-f` option.
 *
 * ```bash
 * node las2xgf -i model.laz -s model.xgf -f 1
 * ```
 *
 * ---
 *
 * @module las2xgf
 */
export * from "./las2xgf_core";
