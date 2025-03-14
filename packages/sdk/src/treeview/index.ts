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
 * import * as ifcTypes from "@xeokit/sdk/ifctypes";
 * import { TreeView } from "@xeokit/sdk/treeview";
 * import { loadXGF } from "@xeokit/sdk/xgf";
 * ```
 *
 * ### Initialize a Viewer with a WebGL Renderer
 *
 * ```javascript
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({})
 * });
 * ```
 *
 * ### Create a View and Set Up the Camera
 *
 * ```javascript
 * const view1 = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myView1"
 * });
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
 *     view: myView,
 *     data: myData,
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
 * const sceneModel = new SceneModel();
 * const dataModel = data.createModel({ id: "myModel" });
 *
 * fetch("myModel.xgf").then(response => {
 *     response.arrayBuffer().then(data => {
 *         loadXGF({ data, sceneModel, dataModel });
 *         sceneModel.build();
 *         dataModel.build();
 *         myViewer.scene.addModel({ id: "myModel", sceneModel });
 *     });
 * });
 * ```
 *
 * @module treeview
 */
export * from "./TreeView";
export { TreeViewParams } from "./TreeViewParams";
export { TreeViewNode } from "./TreeViewNode";
export { TreeViewNodeContextMenuEvent } from "./TreeViewNodeContextMenuEvent";
export { TreeViewNodeTitleClickedEvent } from "./TreeViewNodeTitleClickedEvent";
