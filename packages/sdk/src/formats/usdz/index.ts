/**
 * # USDZ
 *
 * Loads Pixar USDZ (`.usdz`) packages into a
 * {@link model!scene.SceneModel | SceneModel} via {@link USDZLoader}.
 *
 * USDZ is an uncompressed ZIP package wrapping a root USD layer (binary
 * "Crate" `.usdc` or ASCII `.usda`) plus its textures. The loader unpacks
 * the ZIP and decodes the root layer with the `tinyusdz` wasm reader,
 * building geometry, transforms and UsdPreviewSurface materials.
 *
 * **Browser only (v1):** the tinyusdz wasm is web/worker-only, so loading
 * throws under Node. Packaged textures and USD animation / skinning /
 * variants are not handled yet.
 *
 * ```javascript
 * import {USDZLoader} from "@xeokit/sdk/formats/usdz";
 *
 * const fileData = await (await fetch("model.usdz")).arrayBuffer();
 * const sceneModel = scene.createModel({id: "myModel"}).value;
 * await new USDZLoader().load({fileData, sceneModel});
 * ```
 *
 * @module usdz
 * @document ./README.md
 */
export {USDZLoader} from "./USDZLoader";
