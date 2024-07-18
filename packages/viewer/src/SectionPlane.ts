import {EventDispatcher} from "strongly-typed-events";
import {Component, EventEmitter} from "@xeokit/core";

import * as matrix from '@xeokit/matrix';


import type {View} from "./View";
import type {FloatArrayParam} from "@xeokit/math";


/**
 *  An arbitrarily-aligned World-space clipping plane.
 *
 * ## Summary
 *
 * * Belongs to a {@link @xeokit/viewer!View}.
 * * Slices portions off {@link @xeokit/viewer!ViewObject | ViewObjects} to create cross-section views or reveal interiors.
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
 * import {Viewer, GLTFLoaderPlugin, SectionPlane} from "xeokit-viewer.es.js";
 *
 * const viewer = new Viewer({
 *      elementId: "myCanvas"
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
class SectionPlane extends Component {

    /**
     ID of this SectionPlane, unique within the {@link @xeokit/viewer!View}.
     */
    declare public id: string;

    /**
     * The View to which this DirLight belongs.
     *
     * @property view
     * @type {View}
     * @final
     */
    public readonly view: View;

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

    #state: {
        pos: Float64Array;
        active: boolean;
        dist: number;
        dir: Float32Array
    };

    /**
     * @private
     * @constructor
     */
    constructor(view: View, cfg: {
        pos?: FloatArrayParam;
        active?: boolean;
        dir?: FloatArrayParam
    } = {}) {

        super(view, cfg);

        this.view = view;

        this.#state = {
            active: cfg.active !== false,
            pos: new Float64Array(cfg.pos || [0, 0, 0]),
            dir: new Float32Array(cfg.pos || [0, 0, -1]),
            dist: 0
        };

        this.onPos = new EventEmitter(new EventDispatcher<SectionPlane, FloatArrayParam>());
        this.onDir = new EventEmitter(new EventDispatcher<SectionPlane, FloatArrayParam>());
        this.onActive = new EventEmitter(new EventDispatcher<SectionPlane, boolean>());
    }

    /**
     * Gets if this SectionPlane is active or not.
     *
     * Default value is ````true````.
     *
     * @returns Returns ````true```` if active.
     */
    get active(): boolean {
        return this.#state.active;
    }

    /**
     * Sets if this SectionPlane is active or not.
     *
     * Default value is ````true````.
     *
     * @param value Set ````true```` to activate else ````false```` to deactivate.
     */
    set active(value: boolean) {
        if (this.#state.active === value) {
            return;
        }
        this.#state.active = value;
        this.view.redraw();
        this.onActive.dispatch(this, this.#state.active);
    }

    /**
     * Gets the World-space position of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, 0]````.
     *
     * @returns  Current position.
     */
    get pos(): Float64Array {
        return this.#state.pos;
    }

    /**
     * Sets the World-space position of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, 0]````.
     *
     * @param value New position.
     */
    set pos(value: FloatArrayParam) {
        this.#state.pos.set(value);
        this.#state.dist = (-matrix.dotVec3(this.#state.pos, this.#state.dir));
        this.onPos.dispatch(this, this.#state.pos);
    }

    /**
     * Gets the direction of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, -1]````.
     *
     * @returns value Current direction.
     */
    get dir(): Float32Array {
        return this.#state.dir;
    }

    /**
     * Sets the direction of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, -1]````.
     *
     * @param value New direction.
     */
    set dir(value: FloatArrayParam) {
        this.#state.dir.set(value);
        this.#state.dist = (-matrix.dotVec3(this.#state.pos, this.#state.dir));
        this.view.redraw();
        this.onDir.dispatch(this, this.#state.dir);
    }

    /**
     * Gets this SectionPlane's distance to the origin of the World-space coordinate system.
     *
     * This is the dot product of {@link SectionPlane.pos} and {@link SectionPlane.dir} and is automatically re-calculated
     * each time either of two properties are updated.
     *
     * @returns Distance to the origin of the World-space coordinate system.
     */
    get dist(): number {
        return this.#state.dist;
    }

    /**
     * Inverts the direction of {@link SectionPlane.dir}.
     */
    flipDir() {
        const dir = this.#state.dir;
        dir[0] *= -1.0;
        dir[1] *= -1.0;
        dir[2] *= -1.0;
        this.#state.dist = (-matrix.dotVec3(this.#state.pos, this.#state.dir));
        this.onDir.dispatch(this, this.#state.dir);
        this.view.redraw();
    }

    /**
     * Destroys this SectionPlane.
     */
    destroy() {
        this.onPos.clear();
        this.onActive.clear;
        this.onDir.clear();
        super.destroy();
    }
}

export {SectionPlane};
