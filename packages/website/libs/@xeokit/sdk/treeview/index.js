/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:30px;" src="media://images/tree_view_icon.png"/>
 *
 * <br>
 *
 * ## xeokit Tree View UI
 *
 * * {@link treeview!TreeView}
 * * Fast HTML tree view to navigate federated models in a {@link viewer!Viewer | Viewer}
 * * Use with a {@link viewer!View | View} and a semantic {@link data!Data | Data} model
 * * Supports Industry Foundation Classes ([IFC](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ifc))
 * * Supports any schema expressable as ER graph with aggregation relationships
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ## Usage
 *
 * TODO
 *
 * ````javascript
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
 * import {Data} from "@xeokit/sdk/data";
 * import * as ifcTypes from "@xeokit/sdk/ifctypes";
 * import {TreeView} from "@xeokit/sdk/treeview";
 * import {loadXGF} from "@xeokit/sdk/xgf";
 * ````
 *
 * Create a {@link viewer!Viewer | Viewer}, configured with a {@link webglrenderer!WebGLRenderer | WebGLRenderer}:
 *
 * ````javascript
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderers: new WebGLRenderer({ })
 * });
 * ````
 *
 * Create a {@link viewer!View} and position the {@link viewer!Camera | Camera}:
 *
 * ````javascript
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
 * ````
 *
 * Create a {@link treeview!TreeView}, configured to show TODO:
 *
 * ````javascript
 * const treeView = new TreeView({
 *
 *     view: myView,
 *     data: myData,
 *
 *     containerElement: document.getElementById("myTreeViewContainer"),
 *
 *     hierarchy: TreeView.GroupsHierarchy,
 *     linkType: ifcTypes.IfcRelAggregates,
 *     groupTypes: [ifcTypes.IfcBuilding, ifcTypes.IfcBuildingStorey]
 * });
 *
 * const sceneModel = new SceneModel(); // SceneModel implements SceneModel
 *
 * const dataModel = data.createModel({
 *     id: "myModel"
 * });
 *
 * fetch("myModel.xgf").then(response => {
 *
 *     response.arrayBuffer().then(data => {
 *
 *          loadXGF({ data, sceneModel, dataModel });
 *
 *          sceneModel.build();
 *          dataModel.build();
 *
 *          myViewer.scene.addModel({ id: "myModel", sceneModel });
 *     });
 * });
 * ````
 *
 * @module treeview
 */
export * from "./TreeView";
//# sourceMappingURL=index.js.map