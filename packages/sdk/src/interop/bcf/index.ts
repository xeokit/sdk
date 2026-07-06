/**
 * <img style="padding:20px; padding-bottom:10px;" src="https://xeokit.github.io/sdk/docs/assets/bcf_logo.png"/>
 *
 * # BCF Viewpoints
 *
 * Imports and exports
 * [BCF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#bcf)
 * (Building Collaboration Format) viewpoints.
 *
 * A BCF viewpoint stores viewer state for an issue or bookmark,
 * including camera, section planes, object visibility, selection,
 * coloring, translucency, annotations, bitmaps, and an optional
 * snapshot.
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class saveBCFViewpoint {
 *       +(params) SDKResult~BCFViewpoint~
 *     }
 *     class loadBCFViewpoint {
 *       +(params) SDKResult~void~
 *     }
 *     class BCFViewpoint {
 *       +perspective_camera? : BCFPerspectiveCamera
 *       +orthogonal_camera?  : BCFOrthogonalCamera
 *       +clipping_planes?    : BCFClippingPlane[]
 *       +lines?              : BCFLine[]
 *       +bitmaps?            : BCFBitmap[]
 *       +components?         : BCFComponents
 *       +snapshot?           : BCFSnapshot
 *     }
 *     class BCFComponents {
 *       +selection? / coloring? / visibility? / translucency?
 *       +view_setup_hints? : BCFViewSetupHints
 *     }
 *     class SaveBCFViewpointParams {
 *       +view              : View
 *       +renderer?         : BCFSnapshotSource
 *       +snapshot?         : boolean
 *       +includeViewLayerIds? / excludeViewLayerIds?
 *     }
 *     class LoadBCFViewpointParams {
 *       +view         : View
 *       +data         : Data
 *       +bcfViewpoint : BCFViewpoint
 *       +includeViewLayerIds? / excludeViewLayerIds?
 *     }
 *     class View {
 *       <<viewer>>
 *     }
 *     class Data {
 *       <<data>>
 *     }
 *     saveBCFViewpoint ..> SaveBCFViewpointParams : reads
 *     saveBCFViewpoint ..> BCFViewpoint : returns
 *     loadBCFViewpoint ..> LoadBCFViewpointParams : reads
 *     loadBCFViewpoint ..> View : mutates
 *     SaveBCFViewpointParams o-- View
 *     LoadBCFViewpointParams o-- View
 *     LoadBCFViewpointParams o-- Data
 *     LoadBCFViewpointParams o-- BCFViewpoint
 *     BCFViewpoint *-- BCFComponents
 * ```
 *
 * ## API
 *
 * - {@link saveBCFViewpoint}: serializes a
 *   {@link viewing!viewer.View | View} to a {@link BCFViewpoint}.
 * - {@link loadBCFViewpoint}: applies a {@link BCFViewpoint} to a
 *   {@link viewing!viewer.View | View}.
 * - {@link SaveBCFViewpointParams.renderer | renderer}: optional
 *   snapshot source used when saving a viewpoint.
 *
 * ## Installation
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage
 *
 * ### Save and Load a View
 *
 * ```javascript
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Data } from "@xeokit/sdk/model/data";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 * import { loadXKT } from "@xeokit/sdk/formats/xkt";
 * import { saveBCFViewpoint, loadBCFViewpoint } from "@xeokit/sdk/interop/bcf";
 *
 * const scene = new Scene();
 * const data = new Data();
 *
 * const viewer = new Viewer({
 *      scene
 * });
 *
 * const renderer = new WebGLRenderer({
 *    viewer
 * });
 *
 * const viewResult = viewer.createView({
 *     id: "myView",
 *     elementId: "myCanvas"
 * });
 *
 * const view = viewResult.value;
 *
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 * const sceneModel = sceneModelResult.value;
 *
 * const dataModelResult = data.createModel({ id: "myModel" });
 * const dataModel = dataModelResult.value;
 *
 * fetch("myModel.xkt").then(response => response.arrayBuffer().then(fileData => {
 *     loadXKT({ data, sceneModel, dataModel });
 * }));
 * ```
 *
 * Save the current view state:
 *
 * ```javascript
 * view.camera.eye = [0, 0, -33];
 * view.camera.look = [0, 0, 0];
 * view.camera.up = [0, 0, 1];
 *
 * view.setObjectsVisible(view.objectIds, false);
 * view.setObjectsVisible(["myObject1", "myObject2"], true);
 * view.setObjectsXRayed(["myObject1"], true);
 *
 * const bcfViewpointResult = saveBCFViewpoint({ view });
 * const bcfViewpoint = bcfViewpointResult.value;
 * ```
 *
 * Load the viewpoint:
 *
 * ```javascript
 * loadBCFViewpoint({
 *     bcfViewpoint,
 *     view
 * });
 * ```
 *
 * ### Save and Load ViewLayers
 *
 * Use `includeViewLayerIds` to save or load only selected
 * {@link viewing!viewer.ViewLayer | ViewLayers}.
 *
 * ```javascript
 * view.createLayer({ id: "foreground" });
 * view.createLayer({ id: "background" });
 *
 * scene.createModel({
 *     id: "myModel",
 *     layerId: "foreground"
 * });
 *
 * //...
 *
 * const bcfViewpointResult = saveBCFViewpoint({
 *     view,
 *     includeViewLayerIds: ["foreground"]
 * });
 *
 * const bcfViewpoint = bcfViewpointResult.value;
 * ```
 *
 * Load the viewpoint for the same layer:
 *
 * ```javascript
 * loadBCFViewpoint({
 *     bcfViewpoint,
 *     view,
 *     includeViewLayerIds: ["foreground"]
 * });
 * ```
 *
 * @module bcf
 */
export type {BCFOrthogonalCamera} from "./BCFOrthogonalCamera";
export type {BCFPerspectiveCamera} from "./BCFPerspectiveCamera";
export type {BCFVector} from "./BCFVector";
export type {BCFLine} from "./BCFLine";
export type {BCFBitmap} from "./BCFBitmap";
export type {BCFClippingPlane} from "./BCFClippingPlane";
export type {BCFSnapshot} from "./BCFSnapshot";
export type {BCFComponents} from "./BCFComponents";
export type {BCFViewSetupHints} from "./BCFViewSetupHints";
export type {BCFColoringComponent} from "./BCFColoringComponent";
export type {BCFVisibilityComponent} from "./BCFVisibilityComponent";
export type {BCFTranslucencyComponent} from "./BCFTranslucencyComponent";
export type {BCFComponent} from "./BCFComponent";
export type {BCFSelectionComponent} from "./BCFSelectionComponent";
export type {BCFViewpoint} from "./BCFViewpoint";
export {loadBCFViewpoint} from "./loadBCFViewpoint";
export {saveBCFViewpoint} from "./saveBCFViewpoint";
export type {SaveBCFViewpointParams, BCFSnapshotSource} from "./SaveBCFViewpointParams";
export type {LoadBCFViewpointParams} from "./LoadBCFViewpointParams";
