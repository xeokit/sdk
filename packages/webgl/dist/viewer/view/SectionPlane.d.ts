import { Component } from '../Component';
import type { View } from "./View";
import * as math from '../math/index';
import { EventEmitter } from "./../EventEmitter";
import type { FloatArrayParam } from "../math/index";
/**
 *  An arbitrarily-aligned World-space clipping plane.
 *
 * ## Summary
 *
 * * Belongs to a {@link View}.
 * * Slices portions off {@link ViewObject|ViewObjects} to create cross-section views or reveal interiors.
 * * Registered by {@link SectionPlane.id} in {@link View.sectionPlanes}.
 * * Indicates its World-space position in {@link SectionPlane.pos} and orientation vector in {@link SectionPlane.dir}.
 * * Discards elements from the half-space in the direction of {@link SectionPlane.dir}.
 * * Can be be enabled or disabled via {@link SectionPlane.active}.
 *
 * ## Usage
 *
 * In the example below, we'll create two SectionPlanes to slice a model loaded from glTF. Note that we could also create them
 * using a {@link SectionPlanesPlugin}.
 *
 * ````javascript
 * import {WebViewer, GLTFLoaderPlugin, SectionPlane} from "xeokit-viewer.es.js";
 *
 * const viewer = new WebViewer({
 *      canvasId: "myCanvas"
 * });
 *
 * const gltfLoaderPlugin = new GLTFModelsPlugin(viewer, {
 *      id: "GLTFModels"
 * });
 *
 * const model = gltfLoaderPlugin.load({
 *      id: "myModel",
 *      src: "./models/gltf/mygltfmodel.gltf"
 * });
 *
 * // Create a SectionPlane on negative diagonal
 * const sectionPlane1 = new SectionPlane(viewer.scene, {
 *     pos: [1.0, 1.0, 1.0],
 *     dir: [-1.0, -1.0, -1.0],
 *     active: true
 * }),
 *
 * // Create a SectionPlane on positive diagonal
 * const sectionPlane2 = new SectionPlane(viewer.scene, {
 *     pos: [-1.0, -1.0, -1.0],
 *     dir: [1.0, 1.0, 1.0],
 *     active: true
 * });
 * ````
 */
declare class SectionPlane extends Component {
    #private;
    /**
     ID of this SectionPlane, unique within the {@link View}.
     */
    id: string;
    /**
     * The View to which this DirLight belongs.
     *
     * @property view
     * @type {View}
     * @final
     */
    readonly view: View;
    /**
     * Emits an event each time {@link SectionPlane.pos} changes.
     *
     * @event
     */
    readonly onPos: EventEmitter<SectionPlane, FloatArrayParam>;
    /**
     * Emits an event each time {@link SectionPlane.dir} changes.
     *
     * @event
     */
    readonly onDir: EventEmitter<SectionPlane, FloatArrayParam>;
    /**
     * Emits an event each time {@link SectionPlane.active} changes.
     *
     * @event
     */
    readonly onActive: EventEmitter<SectionPlane, boolean>;
    /**
     * @private
     * @constructor
     */
    constructor(view: View, cfg?: {
        pos?: math.FloatArrayParam;
        active?: boolean;
        dir?: math.FloatArrayParam;
    });
    /**
     * Gets if this SectionPlane is active or not.
     *
     * Default value is ````true````.
     *
     * @returns Returns ````true```` if active.
     */
    get active(): boolean;
    /**
     * Sets if this SectionPlane is active or not.
     *
     * Default value is ````true````.
     *
     * @param value Set ````true```` to activate else ````false```` to deactivate.
     */
    set active(value: boolean);
    /**
     * Gets the World-space position of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, 0]````.
     *
     * @returns  Current position.
     */
    get pos(): Float64Array;
    /**
     * Sets the World-space position of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, 0]````.
     *
     * @param value New position.
     */
    set pos(value: math.FloatArrayParam);
    /**
     * Gets the direction of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, -1]````.
     *
     * @returns value Current direction.
     */
    get dir(): Float32Array;
    /**
     * Sets the direction of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, -1]````.
     *
     * @param value New direction.
     */
    set dir(value: math.FloatArrayParam);
    /**
     * Gets this SectionPlane's distance to the origin of the World-space coordinate system.
     *
     * This is the dot product of {@link SectionPlane.pos} and {@link SectionPlane.dir} and is automatically re-calculated
     * each time either of two properties are updated.
     *
     * @returns Distance to the origin of the World-space coordinate system.
     */
    get dist(): number;
    /**
     * Inverts the direction of {@link SectionPlane.dir}.
     */
    flipDir(): void;
    /**
     * Destroys this SectionPlane.
     */
    destroy(): void;
}
export { SectionPlane };
