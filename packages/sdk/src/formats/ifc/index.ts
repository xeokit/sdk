/**
 * <img style="padding:0; padding-top:20px; padding-bottom:30px; width:180px;"
 *      src="https://xeokit.github.io/sdk/docs/assets/ifc_logo.png"/>
 *
 * # ifc — IFC Importer
 *
 * Import models using the
 * {@link https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ifc | IFC}
 * (Industry Foundation Classes) open standard.
 *
 * ## Overview
 *
 * The xeokit SDK provides support for loading **IFC STEP** files, the
 * industry-standard exchange format for Building Information Modeling (BIM)
 * in the Architecture, Engineering, and Construction (AEC) domain.
 *
 * IFC represents both **geometry** and **rich semantic structure**, enabling
 * querying, classification, and analysis workflows after import.
 *
 * ---
 *
 * ## Importing IFC
 *
 * Use {@link IFCLoader} to load an IFC file into:
 *
 * - a {@link scene!SceneModel | SceneModel} for geometry and materials
 * - a {@link data!DataModel | DataModel} for IFC semantics and relationships
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
 * ## Example: loading an IFC model (with error checking)
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/scene";
 * import { Data } from "@xeokit/sdk/data";
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { CameraControl } from "@xeokit/sdk/cameracontrol";
 * import { IFCLoader } from "@xeokit/sdk/formats/ifc";
 *
 * // 1) Create containers for geometry and IFC semantics
 * const scene = new Scene();
 * const data  = new Data();
 *
 * // 2) Create Viewer + renderer
 * const viewer = new Viewer({ scene });
 * new WebGLRenderer({ viewer });
 *
 * // 3) Create a View bound to a canvas
 * const viewResult = viewer.createView({
 *   id: "myView",
 *   elementId: "myCanvas"
 * });
 *
 * if (viewResult.ok === false) {
 *   throw new Error(viewResult.error);
 * }
 *
 * const view = viewResult.value;
 *
 * // 4) Position the camera
 * view.camera.eye  = [1841982.93, 10.03, -5173286.74];
 * view.camera.look = [1842009.49, 9.68, -5173295.85];
 * view.camera.up   = [0, 1, 0];
 *
 * new CameraControl(view, {});
 *
 * // 5) Create target models
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 *
 * if (sceneModelResult.ok === false) {
 *   throw new Error(sceneModelResult.error);
 * }
 *
 * const dataModelResult = data.createModel({ id: "myModel" });
 *
 * if (dataModelResult.ok === false) {
 *   throw new Error(dataModelResult.error);
 * }
 *
 * const sceneModel = sceneModelResult.value;
 * const dataModel  = dataModelResult.value;
 *
 * // 6) Create the IFC loader
 * const ifcLoader = new IFCLoader();
 *
 * // 7) Load the IFC STEP file
 * ifcLoader.load({
 *   filePath: "model.ifc",
 *   sceneModel,
 *   dataModel
 * })
 * .then(() => {
 *   // Model successfully loaded and visible
 * })
 * .catch(err => {
 *   sceneModel.destroy();
 *   dataModel.destroy();
 *   console.error(String(err));
 * });
 * ```
 *
 * ---
 *
 * ## Notes
 *
 * - Always check `result.ok === false` when calling xeokit factory methods.
 * - Clean up partially-created models on failure to avoid leaking state.
 * - The resulting {@link data!DataModel | DataModel} exposes full IFC entities
 *   and relationships for querying and analysis.
 *
 * @module ifc
 */
export * from "./IFCLoader";
export * from "./IFCExporter";
