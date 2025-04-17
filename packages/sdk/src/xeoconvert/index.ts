/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit Multi-Format File Converter
 *
 * ---
 *
 * ***Component and CLI tool for converting 3D models between various formats.***
 *
 * ---
 *
 * This module provides two things:
 *
 * 1. The `Converter` class, which is responsible for converting 3D model data between different formats.
 * 2. A NodeJS CLI script that wraps a `Converter` and allows multi-format conversion on the command line.
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
 * ## Using the Converter Class
 *
 * The `Converter` class manages file format conversions using a set of predefined
 * **loaders** (parsers for input formats) and **exporters** (generators for output formats).
 * It uses **pipelines** to define structured conversion workflows. Each pipeline defines how input
 * data is processed and transformed into output formats.
 *
 *
 * ## Converting a glTF file
 *
 * Use the `convert` CLI tool to convert a single glTF file into an XGF file, along with an optional JSON file containing
 * a simple DataModel derived from the glTF `scene` and `node` hierarchy.
 *
 * ````bash
 * node convert.js -h
 * Usage: convert [options]
 *
 * CLI tool to convert glTF files into xeokit's compact XGF format.
 *
 * Options:
 *   -v, --version                output the version number
 *   -i, --source [file]          path to source glTF file
 *   -s, --scenemodel [file]      path to target XGF file
 *   -d, --datamodel [file]       path to target JSON data model file, derived from the glTF scene hierarchy (optional)
 *   -t, --version [string] target XGF version (default is 1; supported version is 1)
 *   -h, --help                   display help for the command
 * ````
 *
 * The example below converts a binary glTF file to XGF. The resulting XGF objects will contain geometry and material color
 * data parsed from the glTF file. The XGF file can then be loaded into a xeokit {@link scene!SceneModel | SceneModel}
 * using the {@link xgf!XGFLoader | XGFLoader()} function. For optimal performance, it is recommended to convert binary glTF files.
 *
 * ````bash
 * node convert -i duplex.glb -s duplex.xgf
 * ````
 *
 * ## Converting a glTF file and extracting the scene hierarchy
 *
 * In the next example, we convert a binary glTF file to XGF, while also generating a JSON file that defines a simple data model
 * expressing the hierarchy of the `nodes` within the glTF `scene`. The JSON file can then be loaded into a xeokit
 * {@link data!DataModel | DataModel} using {@link data!Data.createModel | Data.createModel()}.
 *
 * ````bash
 * node convert -i duplex.glb -s duplex.xgf -d duplex.json
 * ````
 *
 * ## Converting a glTF file to a specific XGF version
 *
 * In the previous examples, we converted the glTF file to the latest version of XGF by default. In this example, we convert
 * the binary glTF file to a specific version of XGF. The XGF format is expected to evolve over time, and this feature ensures
 * backward compatibility.
 *
 * ````bash
 * convert -i duplex.glb -s duplex.xgf -f 1
 * ````
 *
 * @module xeoconvert
 */
//export * from "./";

export const FOO = {};

// TODO: export what?
