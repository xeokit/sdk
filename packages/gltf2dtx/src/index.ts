/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fgltfviewer.svg)](https://badge.fury.io/js/%40xeokit%2Fgltfviewer)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/gltfviewer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/gltfviewer)
 *
 * <img style="padding:0px; padding-top:30px; padding-bottom:30px;" src="media://images/tree_view_icon.png"/>
 *
 * <br>
 *
 * ## gltf2dtx
 *
 * NodeJS CLI tool to convert glTF files into xeokit's compact [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) geometry format.
 *
 * ## Features
 *
 * * Converts glTF and GLB files to xeokit's DTX geometry format. Note that textures are not supported by DTX.
 * * Optionally creates an additional JSON file containing a simple data model that expresses the glTF scene hierarchy.
 * * Supports all DTX versions.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/gltf2dtx
 * ````
 *
 * ## Usage
 *
 * ````bash
 * node gltf2dtx.js -h
 * Usage: gltf2dtx [options]
 *
 * CLI to convert glTF files into xeokit's compact DTX format
 *
 * Options:
 *   -v, --version          output the version number
 *   -i, --source [file]    path to source glTF file
 *   -o, --output [file]    path to target DTX file
 *   -f, --format [number]  target DTX version - supported DTX version is 1, default is 1
 *   -h, --help             display help for command
 * ````
 *
 * ### Converting glTF geometry
 *
 * The invocation below converts a binary glTF file to DTX. The DTX objects will have geometries and material colors
 * parsed from the glTF. The DTX file can then be loaded into a xeokit {@link @xeokit/scene!SceneModel | SceneModel}
 * using {@link @xeokit/dtx!loadDTX | loadDTX()}.
 *
 * ````bash
 * node gltf2dtx -i duplex.glb -o duplex.dtx
 * ````
 *
 * ### Converting glTF geometry and scene hierarchy
 *
 * In the next example, we'll convert a binary glTF file to DTX, while also creating a JSON file that defines
 * a simple data model that expresses the hierarchy of the `nodes` within the glTF `scene`. The JSON file can
 * then be loaded into a xeokit {@link @xeokit/data!DataModel | DataModel}
 * using {@link @xeokit/data!Data.createModel | Data.createModel()}.
 *
 * ````bash
 * node gltf2dtx -i duplex.glb -o duplex.dtx -m duplex.json
 * ````
 *
 * ### Converting glTF to a specific DTX version
 *
 * In our previous examples, we converted to the latest version of DTX by default. In the next example, we'll convert a
 * binary glTF file to a specific version of DTX.
 *
 * ````bash
 * gltf2dtx -i duplex.glb -o duplex.dtx -f 1
 * ````
 *
 * @module @xeokit/gltf2dtx
 */
export * from "./gltf2dtx";
