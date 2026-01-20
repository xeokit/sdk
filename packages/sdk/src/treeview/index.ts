/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:30px;" src="https://xeokit.github.io/sdk/docs/assets/tree_view_icon.png"/>
 *
 * <br>
 *
 * # xeokit Tree View UI
 *
 * ## Overview
 * * {@link treeview!TreeView | TreeView} - A fast and interactive HTML-based tree view.
 * * Enables seamless navigation of federated models in a {@link viewer!Viewer | Viewer}.
 * * Designed to work with a {@link viewer!View | View} and a semantic {@link data!Data | Data} model.
 * * Supports Industry Foundation Classes ([IFC](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ifc)).
 * * Compatible with any schema structured as an ER graph with aggregation relationships.
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage
 *
 * ### Import Required Modules
 *
 * ```javascript
 * import { Viewer } from "@xeokit/sdk/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/webglrenderer";
 * import { Data } from "@xeokit/sdk/data";
 * import { Scene } from "@xeokit/sdk/scene";
 * import * as ifcTypes from "@xeokit/sdk/formats/ifc/ifctypes_4_0_2_1";
 * import { TreeView } from "@xeokit/sdk/treeview";
 * import { XGFLoader } from "@xeokit/sdk/formats/xgf";
 * ```
 *
 * ### Initialize a Viewer with a WebGL Renderer
 *
 * ```javascript
 *
 * const data = new Data();
 *
 * const scene = new Scene();
 *
 * const viewer = new Viewer({
 *     scene
 * });
 *
 * new WebGLRenderer({
 *   viewer,
 * });
 * ```
 *
 * ### Create a View and Set Up the Camera
 *
 * ```javascript
 * const view1Result = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myView1"
 * });
 *
 * const view = view1Result.value;
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 *
 * const data = new Data();
 * ```
 *
 * ### Create and Configure a TreeView
 *
 * ```javascript
 * const treeView = new TreeView({
 *     view,
 *     data,
 *     containerElement: document.getElementById("myTreeViewContainer"),
 *     hierarchy: TreeView.GroupsHierarchy,
 *     linkType: ifcTypes.IfcRelAggregates,
 *     groupTypes: [ifcTypes.IfcBuilding, ifcTypes.IfcBuildingStorey]
 * });
 * ```
 *
 * ### Load a Model and Add it to the Viewer
 *
 * ```javascript
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 * const sceneModel = sceneModelResult.value;
 *
 * const dataModelResult = data.createModel({ id: "myModel" });
 * const dataModel = dataModelResult.value;
 *
 * fetch("myModel.xgf").then(response => {
 *     response.arrayBuffer().then(fileData => {
 *         XGFLoader.load({ fileData, sceneModel, dataModel });
 *     });
 * });
 * ```
 *
 * @module treeview
 */
export * from "./TreeView";
export type {TreeViewParams} from "./TreeViewParams";
export type {TreeViewNode} from "./TreeViewNode";
export type {TreeViewNodeContextMenuEvent} from "./TreeViewNodeContextMenuEvent";
export type {TreeViewNodeTitleClickedEvent} from "./TreeViewNodeTitleClickedEvent";
