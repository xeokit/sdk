/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fgltfviewer.svg)](https://badge.fury.io/js/%40xeokit%2Fgltfviewer)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/gltfviewer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/gltfviewer)
 *
 * <img style="width:150px; padding-top:20px; padding-bottom: 20px;" src="media://images/ifc_logo.png"/>
 *
 * <br>
 *
 * ## webifc2xgf
 *
 * NodeJS CLI tool that uses WebIFC to convert small IFC files into xeokit's compact [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) geometry format.
 *
 * ## Features
 *
 * * Uses WebIFC to convert small IFC files to xeokit's XGF geometry format.
 * * Optionally creates an additional JSON file containing a simple data model that expresses the IFC semantics.
 * * Supports all XGF versions.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/webifc2xgf
 * ````
 *
 * ## Usage
 *
 * ````bash
 * node webifc2xgf.js -h
 * Usage: webifc2xgf [options]
 *
 * CLI that uses WebIFC to convert small IFC files into xeokit's compact XGF format
 *
 * Options:
 *   -v, --version              output the version number
 *   -i, --source [file]        path to source IFC file
 *   -s, --scenemodel [file]    path to target XGF SceneModel file
 *   -d, --datamodel [file]     path to target JSON DataModel file (optional)
 *   -f, --format [number]      target XGF version - supported XGF version is 1, default is 1
 *   -h, --help                 display help for command
 * ````
 *
 * ### Converting IFC geometry
 *
 * The invocation below converts an IFC file to XGF. The XGF objects will have geometries and material colors
 * parsed from the IFC. The XGF file can then be loaded into a xeokit {@link @xeokit/scene!SceneModel | SceneModel}
 * using {@link @xeokit/xgf!loadXGF | loadXGF()}.
 *
 * ````bash
 * node webifc2xgf -i duplex.ifc -o duplex.xgf
 * ````
 *
 * ### Converting IFC geometry and semantic data
 *
 * In the next example, we'll convert an IFC file to XGF, while also creating a JSON file that defines
 * a simple data model that expresses the IFC semantic data. The JSON file can
 * then be loaded into a xeokit {@link @xeokit/data!DataModel | DataModel}
 * using {@link @xeokit/data!Data.createModel | Data.createModel()}.
 *
 * ````bash
 * node webifc2xgf -i duplex.ifc -s duplex.xgf -d duplex.json
 * ````
 *
 * ### Converting IFC to a specific XGF version
 *
 * In our previous examples, we converted to the latest version of XGF by default. In the next example, we'll convert an
 * IFC file to a specific version of XGF.
 *
 * ````bash
 * webifc2xgf -i duplex.ifc -s duplex.xgf -f 1
 * ````
 *
 * @module @xeokit/webifc2xgf
 */
export * from "./webifc2xgf";
