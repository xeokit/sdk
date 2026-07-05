/**
 * <img style="padding:10px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_components_icon.png"/>
 *
 * # USDZ
 *
 * Imports and exports Pixar USDZ (`.usdz`) packages — {@link USDZLoader}
 * reads one into a {@link model!scene.SceneModel | SceneModel};
 * {@link USDZExporter} writes a SceneModel back out.
 *
 * USDZ is an uncompressed ZIP package wrapping a root USD layer (binary
 * "Crate" `.usdc` or ASCII `.usda`) plus its textures. The loader unpacks
 * the ZIP and decodes the root layer with the `tinyusdz` wasm reader; the
 * exporter writes an ASCII `.usda` root layer in a stored, aligned ZIP.
 *
 * **Loader is browser-only (v1):** the tinyusdz wasm is web/worker-only,
 * so loading throws under Node. The **exporter is pure JS and runs
 * anywhere**, Node included. Packaged textures and USD animation /
 * skinning / variants are not handled yet.
 *
 * ```javascript
 * import {USDZLoader, USDZExporter} from "@xeokit/sdk/formats/usdz";
 *
 * const fileData = await (await fetch("model.usdz")).arrayBuffer();
 * const sceneModel = scene.createModel({id: "myModel"}).value;
 * await new USDZLoader().load({fileData, sceneModel});
 *
 * const usdzBytes = await new USDZExporter().write({sceneModel});
 * ```
 *
 * @module usdz
 * @document ./README.md
 */
export {USDZLoader} from "./USDZLoader";
export {USDZExporter} from "./USDZExporter";
