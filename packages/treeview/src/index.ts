/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px;" src="media://images/autzen.png"/>
 *
 * <br>
 *
 * ## Tree View Control for a Viewer
 *
 *  A fast HTML tree view to navigate {@link @xeokit/datamodel!DataObject | DataObjects}.
 * * Each tree node has a checkbox to control the visibility of its {@link @xeokit/viewer!ViewObject | ViewObjects}.
 * * Has three hierarchy modes: "containment", "types" and "storeys".
 * * Automatically contains all models (that have metadata) that are currently in the {@link Scene}.
 * * Sorts tree nodes by default - spatially, from top-to-bottom for ````IfcBuildingStorey```` nodes, and alphanumerically for other nodes.
 * * Allows custom CSS styling.
 * * Use {@link ContextMenu} to create a context menu for the tree nodes.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/treeview
 * ````
 *
 * ## Usage
 *
 * ## Overview
 *
 * *
 *
 * ## Credits
 *
 * TreeView is based on techniques described in [*Super Fast Tree View in JavaScript*](https://chrissmith.xyz/super-fast-tree-view-in-javascript/) by [Chris Smith](https://twitter.com/chris22smith).
 *
 * ## Usage
 *
 * In the example below, we'll add a TreeView which, by default, will automatically show the structural
 * hierarchy of the IFC elements in each model we load.
 *
 * Then we'll use an {@link XKTLoaderPlugin} to load the Schependomlaan model from an
 * [.xkt file](https://github.com/xeokit/xeokit-sdk/tree/master/examples/models/xkt/schependomlaan).
 *
 * [[Run this example](https://xeokit.github.io/xeokit-sdk/examples/#BIMOffline_XKT_Schependomlaan)]
 *
 * ````javascript
 * import {Viewer, XKTLoaderPlugin, TreeView} from "xeokit-sdk.es.js";
 *
 * const viewer = new Viewer({
 *      canvasId: "myCanvas",
 *      transparent: true
 * });
 *
 * viewer.camera.eye = [-2.56, 8.38, 8.27];
 * viewer.camera.look = [13.44, 3.31, -14.83];
 * viewer.camera.up = [0.10, 0.98, -0.14];
 *
 * const treeView = new TreeView(viewer, {
 *     containerElement: document.getElementById("myTreeViewContainer")
 * });
 *
 * const xktLoader = new XKTLoaderPlugin(viewer);
 *
 * const model = xktLoader.load({
 *     id: "myModel",
 *     src: "./models/xkt/Schependomlaan.xkt",
 *     edges: true
 * });
 * ````
 *
 * ## Manually Adding Models
 *
 * Instead of adding models automatically, we can control which models appear in our TreeView by adding them manually.
 *
 * In the next example, we'll configure the TreeView to not add models automatically. Then, once the model
 * has loaded, we'll add it manually using {@link TreeView#addModel}.
 *
 * ````javascript
 * const treeView = new TreeView(viewer, {
 *      containerElement: document.getElementById("myTreeViewContainer"),
 *      autoAddModels: false  // <<---------------- Don't auto-add models
 * });
 *
 * const xktLoader = new XKTLoaderPlugin(viewer);
 *
 * const model = xktLoader.load({
 *     id: "myModel",
 *     src: "./models/xkt/Schependomlaan.xkt",
 *     edges: true
 * });
 *
 * model.on("loaded", () => {
 *      treeView.addModel(model.id);
 * });
 * ````
 *
 * Adding models manually also allows us to set some options for the model. For example, the ````rootName```` option allows us to provide a custom name for
 * the root node, which is sometimes desirable when the model's "IfcProject" element's name is not suitable:
 *
 * ````javascript
 * model.on("loaded", () => {
 *      treeView.addModel(model.id, {
 *          rootName: "Schependomlaan Model"
 *      });
 * });
 * ````
 *
 * ## Initially Expanding the Hierarchy
 *
 * We can also configure TreeView to initially expand each model's nodes to a given depth.
 *
 * Let's automatically expand the first three nodes from the root, for every model added:
 *
 * ````javascript
 * const treeView = new TreeView(viewer, {
 *      containerElement: document.getElementById("myTreeViewContainer"),
 *      autoExpandDepth: 3
 * });
 * ````
 *
 * ## Showing a TreeViewNode by ID
 *
 * We can show a given node using its ID. This causes the TreeView to collapse, then expand and scroll the node into view, then highlight the node.
 *
 * See the documentation for the {@link TreeView#showNode} method for more information, including how to define a custom highlighted appearance for the node using CSS.
 *
 * Let's make the TreeView show the node corresponding to whatever object {@link viewObject} that we pick:
 *
 * ````javascript
 * viewer.cameraControl.on("picked", function (e) {
 *     var objectId = e.viewObject.id;
 *     treeView.showNode(objectId);
 * });
 * ````
 *
 * This will de-highlight any node that was previously shown by this method.
 *
 * Note that this method only works if the picked {@link viewObject} is an object that belongs to a model that's represented in the TreeView.
 *
 * ## Customizing Appearance
 *
 * We can customize the appearance of our TreeView by defining custom CSS for its HTML
 * elements. See our example's [source code](https://github.com/xeokit/xeokit-sdk/blob/master/examples/BIMOffline_XKT_Schependomlaan.html)
 * for an example of custom CSS rules.
 *
 * ## Model Hierarchies
 *
 * TreeView has three hierarchies for organizing its nodes:
 *
 * * "containment" - organizes the tree nodes to indicate the containment hierarchy of the {@link dataObject}s.
 * * "types" - groups nodes by their IFC types.
 * * "storeys" - groups nodes within their ````IfcBuildingStoreys````, and sub-groups them by their IFC types.
 *
 * <br>
 * The table below shows what the hierarchies look like:
 * <br>
 *
 * | 1. Containment Hierarchy | 2. Types Hierarchy | 3. Storeys Hierarchy |
 * |---|---|---|
 * | <img src="http://xeokit.io/img/docs/TreeView/structureMode.png"> | <img src="http://xeokit.io/img/docs/TreeView/typesMode.png"> | <img src="http://xeokit.io/img/docs/TreeView/storeysMode.png"> |
 * <br>
 *
 * Let's create a TreeView that groups nodes by their building stories and IFC types:
 *
 * ````javascript
 * const treeView = new TreeView(viewer, {
 *      containerElement: document.getElementById("myTreeViewContainer"),
 *      hierarchy: "stories"
 * });
 * ````
 *
 * ## Sorting Nodes
 *
 * TreeView sorts its tree nodes by default. For a "storeys" hierarchy, it orders ````IfcBuildingStorey```` nodes
 * spatially, with the node for the highest story at the top, down to the lowest at the bottom.
 *
 * For all the hierarchy types ("containment", "classes" and "storeys"), TreeView sorts the other node types
 * alphanumerically on their titles.
 *
 * If for some reason you need to prevent sorting, create your TreeView with the option disabled, like so:
 *
 * ````javascript
 * const treeView = new TreeView(viewer, {
 *      containerElement: document.getElementById("myTreeViewContainer"),
 *      hierarchy: "stories",
 *      sortNodes: false // <<------ Disable node sorting
 * });
 * ````
 *
 * Note that, for all hierarchy modes, node sorting is only done for each model at the time that it is added to the TreeView, and will not
 * update dynamically if we later transform the {@link viewObject}s corresponding to the nodes.
 *
 * ## Pruning empty nodes
 *
 * Sometimes a model contains subtrees of objects that don't have any geometry. These are models whose
 * {@link DataModel} contains trees of {@link dataObject}s that don't have any {@link viewObject}s in the {@link Scene}.
 *
 * For these models, the tree view would contain nodes that don't do anything in the Scene when we interact with them,
 * which is undesirable.
 *
 * By default, TreeView will not create nodes for those objects. However, we can override that behaviour if we want
 * to have nodes for those objects (perhaps for debugging the model):
 *
 * ````javascript
 * const treeView = new TreeView(viewer, {
 *      containerElement: document.getElementById("myTreeViewContainer"),
 *      hierarchy: "stories",
 *      pruneEmptyNodes: false // <<------ Create nodes for object subtrees without geometry
 * });
 * ````
 *
 * ## Context Menu
 *
 * TreeView fires a "contextmenu" event whenever we right-click on a tree node.
 *
 * The event contains:
 *
 * * ````event```` - the original [contextmenu](https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event) [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent)
 * * ````viewer```` - the {@link Viewer}
 * * ````TreeView```` - the TreeView
 * * ````treeViewNode```` - the {@link TreeViewNode} representing the tree node
 * <br><br>
 *
 * Let's use {@link ContextMenu} to show a simple context menu for the node we clicked.
 *
 * [[Run an example](https://xeokit.github.io/xeokit-sdk/examples/#ContextMenu_Canvas_TreeView_Custom)]
 *
 * ````javascript
 * import {ContextMenu} from "../src/extras/ContextMenu/ContextMenu.js";
 *
 * const treeViewContextMenu = new ContextMenu({
 *     items: [
 *         [
 *             [
 *                 {
 *                     title: "Hide",
 *                     doAction: function (context) {
 *                         context.TreeView.withNodeTree(context.treeViewNode, (treeViewNode) => {
 *                             if (treeViewNode.objectId) {
 *                                 const viewObject = context.viewer.scene.objects[treeViewNode.objectId];
 *                                 if (viewObject) {
 *                                     viewObject.visible = false;
 *                                 }
 *                             }
 *                         });
 *                     }
 *                 },
 *                 {
 *                     title: "Hide all",
 *                     doAction: function (context) {
 *                         context.viewer.scene.setObjectsVisible(context.viewer.scene.visibleObjectIds, false);
 *                     }
 *                 }
 *             ],
 *             [
 *                 {
 *                     title: "Show",
 *                     doAction: function (context) {
 *                         context.TreeView.withNodeTree(context.treeViewNode, (treeViewNode) => {
 *                             if (treeViewNode.objectId) {
 *                                 const viewObject = context.viewer.scene.objects[treeViewNode.objectId];
 *                                 if (viewObject) {
 *                                     viewObject.visible = true;
 *                                     viewObject.xrayed = false;
 *                                     viewObject.selected = false;
 *                                 }
 *                             }
 *                         });
 *                     }
 *                 },
 *                 {
 *                     title: "Show all",
 *                     doAction: function (context) {
 *                         const scene = context.viewer.scene;
 *                         scene.setObjectsVisible(scene.objectIds, true);
 *                         scene.setObjectsXRayed(scene.xrayedObjectIds, false);
 *                         scene.setObjectsSelected(scene.selectedObjectIds, false);
 *                     }
 *                 }
 *             ]
 *         ]
 *     ]
 * });
 *
 * treeView.on("contextmenu", (e) => {
 *
 *     const event = e.event;                           // MouseEvent
 *     const viewer = e.viewer;                         // Viewer
 *     const TreeView = e.TreeView;         // TreeView
 *     const treeViewNode = e.treeViewNode;             // TreeViewNode
 *
 *     treeViewContextMenu.show(e.event.pageX, e.event.pageY);
 *
 *     treeViewContextMenu.context = {
 *         viewer: e.viewer,
 *         TreeView: e.TreeView,
 *         treeViewNode: e.treeViewNode
 *     };
 * });
 * ````
 *
 * ## Clicking TreeViewNode Titles
 *
 * TreeView fires a "nodeTitleClicked" event whenever we left-click on a tree node.
 *
 * Like the "contextmenu" event, this event contains:
 *
 * * ````event```` - the original [click](https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event) [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent)
 * * ````viewer```` - the {@link Viewer}
 * * ````TreeView```` - the TreeView
 * * ````treeViewNode```` - the {@link TreeViewNode} representing the tree node
 * <br><br>
 *
 * Let's register a callback to isolate and fit-to-view the {@link viewObject}(s) represented by the node. This callback is
 * going to X-ray all the other viewObjects, fly the camera to fit the viewObject(s) for the clicked node, then hide the other viewObjects.
 *
 * [[Run an example](https://xeokit.github.io/xeokit-sdk/examples/#ContextMenu_Canvas_TreeView_Custom)]
 *
 * ````javascript
 * treeView.on("nodeTitleClicked", (e) => {
 *     const scene = viewer.scene;
 *     const objectIds = [];
 *     e.TreeView.withNodeTree(e.treeViewNode, (treeViewNode) => {
 *         if (treeViewNode.objectId) {
 *             objectIds.push(treeViewNode.objectId);
 *         }
 *     });
 *     scene.setObjectsXRayed(scene.objectIds, true);
 *     scene.setObjectsVisible(scene.objectIds, true);
 *     scene.setObjectsXRayed(objectIds, false);
 *     viewer.cameraFlight.flyTo({
 *         aabb: scene.getAABB(objectIds),
 *         duration: 0.5
 *     }, () => {
 *         setTimeout(function () {
 *             scene.setObjectsVisible(scene.xrayedObjectIds, false);
 *             scene.setObjectsXRayed(scene.xrayedObjectIds, false);
 *         }, 500);
 *     });
 * });
 * ````
 *
 * To make the cursor change to a pointer when we hover over the node titles, and also to make the titles change to blue, we'll also define this CSS for the ````<span>```` elements
 * that represent the titles of our TreeView nodes:
 *
 * ````css
 * #treeViewContainer ul li span:hover {
 *      color: blue;
 *      cursor: pointer;
 * }
 * ````
 *
 * @module @xeokit/treeview
 */
export * from "./TreeView";