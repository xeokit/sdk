/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fifcviewer.svg)](https://badge.fury.io/js/%40xeokit%2Fifcviewer)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/webifcviewer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/webifcviewer)
 *
 * <img style="padding:0px; padding-top:30px; padding-bottom:30px;" src="media://images/tree_view_icon.png"/>
 *
 * <br>
 *
 * ## Example xeokit IFC Viewer
 *
 * A proof-of-concept IFC model viewer built from xeokit SDK components.
 *
 * The implementation of this viewer demonstrates how to integrate various
 * xeokit components to build a minimal IFC model viewer application.
 *
 * ## Features
 *
 * * Load federated IFC models
 * * Load and save BCF viewpoints
 * * Searchable semantic data graph
 * * Spatial 3D object searches (frustum, boundary, ray..)
 * * HTML tree view
 * * Extensible, white box design
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/webifcviewer
 * ````
 *
 * ## Usage
 *
 * TODO
 *
 * ````html
 * <!doctype html>
 * <html>
 * <head>
 *     <meta charset="utf-8">
 *     <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
 *     <meta name="viewport" content="width=device-width, initial-scale=1">
 *     <title>xeokit Example</title>
 * </head>
 * <body>
 *      <canvas id="myCanvas"></canvas>
 *      <div id="treeView"></div>
 * </body>
 * <script type="module">
 *
 *     import {IFCViewer} from "./dist";
 *
 *     // Create an IFC viewer
 *
 *     const ifcViewer = new IFCViewer({
 *         canvasElement: document.getElementById("myCanvas"),
 *         treeViewElement: document.getElementById("treeView")
 *     });
 *
 *     // Load a model from XKT format
 *
 *     ifcViewer.loadModel({
 *         id: "myModel",
 *         src: "./data/Duplex.xkt"
 *     }).then(()=>{
 *
 *          // Get an object in the viewer
 *
 *          const objectId = "gfhmgmfsafdqwe78";
 *
 *          const dataObject = ifcViewer.data.objects[objectId];
 *          const sceneObject = ifcViewer.scene.objects[objectId];
 *          const viewObject = ifcViewer.view.objects[objectId];
 *
 *          if (dataObject) {
 *
 *              // Object semantic data
 *
 *              console.log("Object is type: " + dataObject.type); // Integer constant
 *
 *              const resultObjectIds = [];
 *
 *              ifcViewer.data.searchObjects({
 *                  startObjectId: objectId,
 *                  resultObjectIds
 *              });
 *
 *              console.log("All related objects: " + resultObjectIds);
 *          }
 *
 *          if (sceneObject) {
 *
 *              // Object scene representation
 *
 *              ifcViewer.view.cameraFlight.flyTo({
 *                  aabb: sceneObject.aabb
 *              });
 *
 *              const meshes = sceneObject.meshes;
 *              const geometry = meshes[0].geometry;
 *              const textureSet = meshes[0].textureSet;
 *
 *              //...etc
 *          }
 *
 *          if (viewObject) {
 *
 *              // Object viewer state
 *
 *              viewObject.highlighted = true;
 *              viewObject.selected = true;
 *              viewObject.visible = false;
 *              viewObject.clippable = false;
 *
 *              //...etc
 *          }
 *     });
 *
 * </script>
 *
 * </html>
 * ````
 *
 * @module @xeokit/webifcviewer
 */
export * from "./WebIFCViewer";