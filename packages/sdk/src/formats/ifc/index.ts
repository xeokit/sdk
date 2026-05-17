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
 * - a {@link model!scene.SceneModel | SceneModel} for geometry and materials
 * - a {@link model!data.DataModel | DataModel} for IFC semantics and relationships
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class IFCLoader {
 *       +format / versions / fileDataType
 *       +load(params, options?) Promise~void~
 *     }
 *     class ifctypes_4_0_2_1 {
 *       <<sub-module>>
 *       IFC4 ObjectType / RelationshipType id constants
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- IFCLoader
 *     IFCLoader ..> ifctypes_4_0_2_1 : uses
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **IFC2x3 + IFC4 + IFC4x3** — multi-version parser; auto-detects
 *   the schema from the `FILE_SCHEMA(...)` header.
 * - **Geometry + semantics** — fills a SceneModel with implicit
 *   geometry (extrusions, sweeps, profiles) tessellated into
 *   triangle meshes, and a DataModel with the IFC entity graph
 *   (IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey → …).
 * - **Stable type ids** — IFC type constants are exported from
 *   `ifctypes_*` sub-modules so application code references them
 *   by symbol instead of magic strings.
 * - **Property-set passthrough** — every IfcPropertySet attached
 *   to an IfcObject becomes a {@link model!data.PropertySet | PropertySet}
 *   on the matching DataObject.
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
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Data } from "@xeokit/sdk/model/data";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 * import { ViewController } from "@xeokit/sdk/viewing/viewController";
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
 * new ViewController(view, {});
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
 * - The resulting {@link model!data.DataModel | DataModel} exposes full IFC entities
 *   and relationships for querying and analysis.
 *
 * @module ifc
 */
export * from "./IFCLoader";
export * from "./IFCExporter";
