/**
 * <img style="padding:20px; padding-bottom:10px;" src="https://xeokit.github.io/sdk/docs/assets/bcf_logo.png"/>
 *
 * # xeokit BCF Viewpoint Importer and Exporter
 *
 * ---
 *
 * ***Exchange BCF viewpoints with other BIM software to enhance collaboration and communication.***
 *
 * ---
 *
 * The xeokit SDK provides support for interoperability with other BIM software through the exchange of
 * [BCF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#bcf) (Building Collaboration Format) Viewpoints,
 * an open standard that allows exchanging bookmarks of 3D Viewer states.
 *
 * ## Understanding BCF Viewpoints
 * A *BCF viewpoint* captures a snapshot of an issue within a building project. It includes:
 * - **A problem description** to communicate issues to team members.
 * - **The exact location within the 3D model** where the issue occurs.
 *
 * This facilitates efficient collaboration among project stakeholders by allowing them to share and
 * review issues directly within the model.
 *
 * <br>
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
 *       +saveDefaultStates?
 *       +snapshotType?
 *     }
 *     class LoadBCFViewpointParams {
 *       +view       : View
 *       +viewpoint  : BCFViewpoint
 *     }
 *     class View {
 *       <<viewer>>
 *     }
 *     saveBCFViewpoint ..> SaveBCFViewpointParams : reads
 *     saveBCFViewpoint ..> BCFViewpoint : returns
 *     loadBCFViewpoint ..> LoadBCFViewpointParams : reads
 *     loadBCFViewpoint ..> View : mutates
 *     SaveBCFViewpointParams o-- View
 *     LoadBCFViewpointParams o-- View
 *     LoadBCFViewpointParams o-- BCFViewpoint
 *     BCFViewpoint *-- BCFComponents
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Capture full View state** — `saveBCFViewpoint` serialises
 *   camera (perspective + orthogonal), clipping planes, per-object
 *   visibility / selection / colour / translucency, plus optional
 *   annotation lines and bitmaps.
 * - **Restore View state** — `loadBCFViewpoint` applies a viewpoint
 *   onto a {@link viewing!viewer.View | View}, restoring camera,
 *   section planes, and per-object state in one call.
 * - **Snapshot support** — optionally embed a base-64 canvas
 *   snapshot in the viewpoint; supply a renderer via
 *   `params.renderer` to capture it, or omit for snapshot-free
 *   round-trip.
 * - **Spec-compliant JSON** — viewpoint matches the BCF JSON
 *   schema, ready to drop into a `.bcfzip` package alongside
 *   issue metadata.
 * - **Default-state filter** — `saveDefaultStates: false`
 *   (default) trims objects whose state matches the View default,
 *   keeping viewpoint payloads compact.
 * - **Cross-host interop** — viewpoints exchange cleanly with
 *   Solibri, BIMcollab, Revit BCF Manager, and any other
 *   BCF-aware client.
 *
 * <br>
 *
 * ## Installation
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * <br>
 *
 * ## Usage
 *
 * ### Saving and Loading a View as BCF
 *
 * This example demonstrates how to:
 * - Set up a xeokit {@link viewing!viewer.Viewer | Viewer}
 * - Load a BIM model from XKT format
 * - Save and load BCF viewpoints to bookmark Viewer states
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
 * Once the model is loaded, we can capture a viewpoint:
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
 * The saved {@link BCFViewpoint | BCFViewpoint} can be restored later:
 *
 * ```javascript
 * loadBCFViewpoint({
 *     bcfViewpoint,
 *     view
 * });
 * ```
 * <br>
 *
 * ### Saving and Loading a ViewLayer as BCF
 *
 * {@link viewing!viewer.ViewLayer | ViewLayers} allow selective export of {@link viewing!viewer.ViewObject | ViewObjects}. In this example:
 * - **Two ViewLayers** (`foreground` and `background`) are created.
 * - **Only the foreground _layer** is exported.
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
 * The viewpoint is restored only for the `foreground` _layer:
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

