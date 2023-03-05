/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Ftreeview.svg)](https://badge.fury.io/js/%40xeokit%2Ftreeview)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/treeview/badge)](https://www.jsdelivr.com/package/npm/@xeokit/treeview)
 *
 * <img style="padding:0px; padding-top:30px; padding-bottom:30px;" src="media://images/tree_view_icon.png"/>
 *
 * <br>
 *
 * ## HTML Tree View for a {@link "@xeokit/viewer" | Viewer}
 *
 * * {@link @xeokit/treeview!TreeView}
 * * Fast HTML tree view to navigate federated models in a {@link @xeokit/viewer!Viewer}
 * * Use with a {@link @xeokit/viewer!View | View} and a semantic {@link @xeokit/data!Data} model
 * * Supports Industry Foundation Classes (IFC)
 * * Supports any schema expressable as ER graph with aggregation relationships
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/treeview
 * ````
 *
 * ## Usage
 *
 * TODO
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webglrenderer";
 * import {Data} from "@xeokit/data";
 * import * as ifcTypes from "@xeokit/datatypes/ifcTypes";
 * import {TreeView} from "@xeokit/treeview!TreeView";
 * import {loadXKT} from "@xeokit/xkt";
 * ````
 *
 * Create a {@link @xeokit/viewer!Viewer}, configured with a {@link @xeokit/webglrenderer!WebGLRenderer}:
 *
 * ````javascript
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({ })
 * });
 * ````
 *
 * Create a {@link @xeokit/viewer!View} and position the {@link @xeokit/viewer!Camera}:
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
 * Create a {@link @xeokit/treeview!TreeView}, configured to show TODO:
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
 * fetch("myModel.xkt").then(response => {
 *
 *     response.arrayBuffer().then(data => {
 *
 *          loadXKT({ data, sceneModel, dataModel });
 *
 *          sceneModel.build();
 *          dataModel.build();
 *
 *          myViewer.scene.addModel({ id: "myModel", sceneModel });
 *     });
 * });
 * ````
 *
 * @module @xeokit/treeview
 */
export * from "./TreeView";