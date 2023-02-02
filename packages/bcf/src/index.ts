/**
 * <img src="https://xeokit.github.io/xeokit-sdk/assets/images/bcf_logo.png"/>
 *
 * ## Load and Save Viewer Snapshots as BCF Viewpoints
 *
 * * Loads and saves {@link Viewer} snapshots as BCF JSON viewpoints
 * * Exchange BCF JSON viewpoints with other BIM software for interoperability
 * * {@link loadBCFViewpoint} loads a BCF viewpoint into a {@link View}
 * * {@link saveBCFViewpoint} saves a {@link View} to a BCF viewpoint
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
 * Use {@link saveBCFViewpoint} to save a snapshot of a {@link View} to a {@link BCFViewpoint}:
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
 * //... load or build a ViewModel etc...
 *
 * const saveBCFViewpointOptions = {
 *
 * };
 *
 * const bcfViewpoint = saveBCFViewpoint(saveBCFViewpointOptions, myView);
 * ````
 *
 * Use {@link loadBCFViewpoint} to load a {@link BCFViewpoint} into a {@link View}:
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