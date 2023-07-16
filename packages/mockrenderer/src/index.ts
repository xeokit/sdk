/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fwebgl.svg)](https://badge.fury.io/js/%40xeokit%2Fwebgl)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/mockrenderer/badge)](https://www.jsdelivr.com/package/npm/@xeokit/mockrenderer)
 *
 * <img style="padding:50px" src="media://images/xeokit_datamodel_icon.png"/>
 *
 * # xeokit Mock Renderer
 *
 * ---
 *
 * ### *Configures a xeokit Viewer with a mock renderer*
 *
 * ---
 *
 * * Plug a {@link MockRenderer} into a {@link @xeokit/viewer!Viewer} to use a mock renderer for model storage and rendering
 * * Does not render anything
 * * Used for testing and development of custom renderers
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/mockrenderer
 * ````
 *
 * ## Usage
 *
 * Configuring a {@link @xeokit/viewer!Viewer} with a {@link MockRenderer} to use the browser's WebGL
 * graphics API for storing and rendering models:
 *
 * ````javascript
 * import {Scene} from "@xeokit/scene";
 * import {Viewer} from "@xeokit/viewer";
 * import {MockRenderer} from "@xeokit/mockrenderer";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     scene: new Scene(),
 *     renderer: new MockRenderer()
 * });
 *
 * //...
 * ````
 *
 * @module @xeokit/mockrenderer
 */
export {MockRenderer} from "./MockRenderer";