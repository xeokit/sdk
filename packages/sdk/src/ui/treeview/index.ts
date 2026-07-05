/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:30px;" src="https://xeokit.github.io/sdk/docs/assets/tree_view_icon.png"/>
 *
 * <br>
 *
 * # xeokit Tree View UI
 *
 * ---
 *
 * **Fast HTML-based hierarchical tree widget bound to a
 * {@link viewing!viewer.View | View} and a semantic
 * {@link model!data.Data | Data} model — navigate federated BIM
 * (IFC and any ER-shaped schema) by drilling through aggregation
 * relationships.**
 *
 * ---
 *
 * The {@link TreeView} renders the
 * {@link model!data.DataObject | DataObject} graph as a clickable
 * tree; each node maps to the matching
 * {@link viewing!viewer.ViewObject | ViewObject}, so toggling a
 * branch's visibility / selection / highlight in the tree drives the
 * same state in the View. Works with any schema structured as an
 * entity-relationship graph with aggregation relationships, with
 * IFC as the first-class case.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class TreeView {
 *       +view : View
 *       +data : Data
 *       +containerElement
 *       +hierarchy   : ContainmentHierarchy | TypesHierarchy | GroupsHierarchy
 *       +linkType    : relationship type id
 *       +groupTypes? : object type ids
 *       +events      : TreeViewEvents
 *       +showNode(objectId) / unShowNode(objectId)
 *       +collapse() / expand()
 *       +destroy()
 *     }
 *     class TabbedTreeViewPanel {
 *       +tabs : TreeView[]
 *       +activeTab
 *     }
 *     class TreeViewParams {
 *       +view              : View
 *       +data              : Data
 *       +containerElement
 *       +hierarchy         : Hierarchy
 *       +linkType          : type id
 *       +groupTypes?       : type id[]
 *     }
 *     class TreeViewNode {
 *       +id / title / type
 *       +parent / children
 *     }
 *     class TreeViewEvents {
 *       +onNodeTitleClicked
 *       +onNodeContextMenu
 *       +onNodeFrameClicked
 *     }
 *     class View {
 *       <<viewer>>
 *     }
 *     class Data {
 *       <<data>>
 *     }
 *     TreeView ..> TreeViewParams : reads
 *     TreeView "1" *-- "1" TreeViewEvents
 *     TreeView o-- View : drives ViewObject state
 *     TreeView o-- Data : reads DataObject graph
 *     TreeView "1" *-- "*" TreeViewNode
 *     TabbedTreeViewPanel "1" *-- "*" TreeView
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **HTML-based, no canvas** — the tree is a regular `<ul>`/`<li>`
 *   DOM tree styled with CSS; trivially restylable per host.
 * - **Three hierarchy strategies** — `ContainmentHierarchy` (walks
 *   `linkType` relationships), `TypesHierarchy` (groups by
 *   `DataObject.type`), `GroupsHierarchy` (custom multi-level
 *   grouping via `groupTypes`).
 * - **IFC-native** — `linkType: IfcRelAggregates` plus
 *   `groupTypes: [IfcBuilding, IfcBuildingStorey]` is the standard
 *   IFC navigation tree by default.
 * - **Schema-agnostic** — works with any ER graph with
 *   aggregation-style relationships; pass any relationship type id
 *   for `linkType`.
 * - **Per-View bound** — clicking a node toggles state on the bound
 *   View only; multiple TreeViews can drive multiple Views
 *   independently from the same Data graph.
 * - **Per-node events** — `onNodeTitleClicked`,
 *   `onNodeContextMenu`, `onNodeFrameClicked` give the host control
 *   over selection / highlight / fly-to behaviour.
 * - **Tabbed multi-hierarchy** — {@link TabbedTreeViewPanel} mounts
 *   several TreeViews (one per hierarchy strategy) in a tab strip,
 *   so users can switch between "containment", "types", and
 *   "groups" views of the same model.
 *
 * <br>
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
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/webGLRenderer";
 * import { Data } from "@xeokit/sdk/model/data";
 * import { Scene } from "@xeokit/sdk/model/scene";
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
export {TreeView} from "./TreeView";
export {TabbedTreeViewPanel} from "./TabbedTreeViewPanel";
export type {TreeViewParams} from "./TreeViewParams";
export type {TreeViewNode} from "./TreeViewNode";
export type {TreeViewNodeContextMenuEvent} from "./TreeViewNodeContextMenuEvent";
export type {TreeViewNodeTitleClickedEvent} from "./TreeViewNodeTitleClickedEvent";
export {TreeViewEvents} from "./TreeViewEvents";
export type {TabbedTreeViewPanelParams} from "./TabbedTreeViewPanel";
