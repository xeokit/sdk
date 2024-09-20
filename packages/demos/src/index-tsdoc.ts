
/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdotbim.svg)](https://badge.fury.io/js/%40xeokit%2Fdotbim)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/dotbim/badge)](https://www.jsdelivr.com/package/npm/@xeokit/dotbim)
 *
 * <img  style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="media://images/xeokit_logo_mesh.png"/>
 *
 * # xeokit Demos
 *
 * * [Run demos](/packages/demos/galleries/)
 *
 * <br>
 *
 * # Re-Converting the Demo Models
 *
 * The demos come with a collection of demonstration models, in various formats. Some of these
 * models we pre-converted from other formats first, to demonstrate the various conversion and
 * viewing pipelines we support.
 *
 * We can run a script to batch re-convert the models at any time. This is particularly useful
 * for testing new updates to the SDK and converter tools.
 *
 * Before we re-convert the models however, we first need to configure the script with the location of
 * one of the CLI tools used for conversion.
 *
 * Within the `./configs.json` file of @xeokit/demos, set `ifc2gltfcxconverterDir` to the local directory
 * containing the `ifc2gltf` executable. For example:
 *
 * ````json
 * {
 *     "ifc2gltfcxconverterDir": "~/ifc2gltf/4_14_beta/linux/"
 * }
 * ````
 *
 * There are several other CLI tools used by the converter script, but the script implicitly knows
 * their locations, since they are implemented within this monorepo. The `ifc2gltf` executable is the only CLI that
 * we need to configure for @xeokit/demos.
 *
 * Now you should be ready to reconvert the models. From the root directory of the @xeokit/sdk monorepo, run the script
 * via Turbo, to convert all our demo test models to their various formats, like so:
 *
 * ````bash
 * npm run convert-demo-models
 * ````
 *
 * <br>
 *
 * @module @xeokit/demos
 */
