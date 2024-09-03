/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fgltfviewer.svg)](https://badge.fury.io/js/%40xeokit%2Fgltfviewer)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/gltfviewer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/gltfviewer)
 *
 * <img style="width:150px; padding-top:20px; padding-bottom: 20px;" src="media://images/ifc_logo.png"/>
 *
 * <br>
 *
 * ## webifc2dtx
 *
 * NodeJS CLI tool that uses WebIFC to convert small IFC files into xeokit's compact [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) geometry format.
 *
 * ## Features
 *
 * * Uses WebIFC to convert small IFC files to xeokit's DTX geometry format.
 * * Optionally creates an additional JSON file containing a simple data model that expresses the IFC semantics.
 * * Supports all DTX versions.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/webifc2dtx
 * ````
 *
 * ## Usage
 *
 * ````bash
 * node webifc2dtx.js -h
 * Usage: webifc2dtx [options]
 *
 * CLI that uses WebIFC to convert small IFC files into xeokit's compact DTX format
 *
 * Options:
 *   -v, --version          output the version number
 *   -i, --source [file]    path to source IFC file
 *   -o, --output [file]    path to target DTX file
 *   -f, --format [number]  target DTX version - supported DTX version is 1, default is 1
 *   -h, --help             display help for command
 * ````
 *
 * ### Converting IFC geometry
 *
 * The invocation below converts an IFC file to DTX. The DTX objects will have geometries and material colors
 * parsed from the IFC. The DTX file can then be loaded into a xeokit {@link @xeokit/scene!SceneModel | SceneModel}
 * using {@link @xeokit/dtx!loadDTX | loadDTX()}.
 *
 * ````bash
 * node webifc2dtx -i duplex.ifc -o duplex.dtx
 * ````
 *
 * ### Converting IFC geometry and semantic data
 *
 * In the next example, we'll convert an IFC file to DTX, while also creating a JSON file that defines
 * a simple data model that expresses the IFC semantic data. The JSON file can
 * then be loaded into a xeokit {@link @xeokit/data!DataModel | DataModel}
 * using {@link @xeokit/data!Data.createModel | Data.createModel()}.
 *
 * ````bash
 * node webifc2dtx -i duplex.ifc -o duplex.dtx -m duplex.json
 * ````
 *
 * ### Converting IFC to a specific DTX version
 *
 * In our previous examples, we converted to the latest version of DTX by default. In the next example, we'll convert an
 * IFC file to a specific version of DTX.
 *
 * ````bash
 * webifc2dtx -i duplex.ifc -o duplex.dtx -f 1
 * ````
 *
 * @module @xeokit/webifc2dtx
 */
export * from "./webifc2dtx";
