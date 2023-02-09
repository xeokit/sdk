/**
 * <img src="https://xeokit.github.io/xeokit-sdk/assets/images/bcf_logo.png"/>
 *
 * ## Load and save BIM Collaboration Format (BCF) Viewpoints
 *
 * * {@link loadBCFViewpoint} loads a JSON-encoded BCF viewpoint into a {@link @xeokit/viewer!View}
 * * {@link saveBCFViewpoint} saves a {@link @xeokit/viewer!View} to a JSON-encoded BCF viewpoint
 * * {@link BCFViewpoint} represents a BCF viewpoint
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/bcf
 * ````
 *
 * ## Usage
 *
 * Use {@link saveBCFViewpoint} to save the state of a {@link @xeokit/viewer!View} to a {@link BCFViewpoint}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {WebGLRenderer} from "@xeokit/webgl";
 * import {loadBCFViewpoint} from "@xeokit/bcf";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({
 *         //...
 *     })
 * });
 *
 * const myView = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myView1"
 * });
 *
 * //...load or build a ViewModel etc...
 *
 * const saveBCFViewpointOptions = {
 *      //...
 * };
 *
 * const bcfViewpoint = saveBCFViewpoint(saveBCFViewpointOptions, myView);
 * ````
 *
 * Use {@link loadBCFViewpoint} to load a {@link BCFViewpoint} into a {@link @xeokit/viewer!View}:
 *
 * ````javascript
 * const loadBCFViewpointOptions = {
 *     // TODO
 * };
 *
 * loadBCFViewpoint(bcfViewpoint, loadBCFViewpointOptions, myView);
 * ````
 *
 * @module @xeokit/bcf
 */
export * from "./loadBCFViewpoint";
export * from "./saveBCFViewpoint";
export * from "./SaveBCFViewpointOptions";
export * from "./LoadBCFViewpointOptions";
export * from "./BCFViewpoint";