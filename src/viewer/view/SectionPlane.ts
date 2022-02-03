import {Component} from '../Component';
import {View} from "./View";
import * as math from '../math/';

/**
 *  An arbitrarily-aligned World-space clipping plane.
 *
 * ## Overview
 *
 * * Slices portions off {@link ViewObject}s to create cross-section views or reveal interiors.
 * * Registered by {@link SectionPlane#id} in {@link View#sectionPlanes}.
 * * Indicates its World-space position in {@link SectionPlane#pos} and orientation vector in {@link SectionPlane#dir}.
 * * Discards elements from the half-space in the direction of {@link SectionPlane#dir}.
 * * Can be be enabled or disabled via {@link SectionPlane#active}.
 *
 * ## Usage
 *
 * In the example below, we'll create two SectionPlanes to slice a model loaded from glTF. Note that we could also create them
 * using a {@link SectionPlanesPlugin}.
 *
 * ````javascript
 * import {Viewer, GLTFLoaderPlugin, SectionPlane} from "xeokit-webgpu-sdk.es.js";
 *
 * const viewer = new Viewer({
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
class SectionPlane extends Component {

    /**
     * The View to which this DirLight belongs.
     *
     * @property view
     * @type {View}
     * @final
     */
    public readonly view: View;

    public readonly state: {
        pos: Float64Array;
        active: boolean;
        dist: number;
        dir: Float32Array
    };

    /**
     * @constructor
     * @param [view]  Owner component. When destroyed, the owner will destroy this SectionPlane as well.
     * @param cfg  SectionPlane configuration
     * @param  {String} [cfg.id] Optional ID, unique among all components in the parent {@link View}, generated automatically when omitted.
     * @param [cfg.active=true] Indicates whether or not this SectionPlane is active.
     * @param [cfg.pos=[0,0,0]] World-space position of the SectionPlane.
     * @param [cfg.dir=[0,0,-1]] Vector perpendicular to the plane surface, indicating the SectionPlane plane orientation.
     */
    constructor(view: View, cfg: {
        pos?: math.FloatArrayType;
        active?: boolean;
        dir?: math.FloatArrayType
    } = {}) {

        super(view, cfg);

        this.view = view;

        this.state = {
            active: cfg.active !== false,
            pos: new Float64Array(cfg.pos || [0, 0, 0]),
            dir: new Float32Array(cfg.pos || [0, 0, -1]),
            dist: 0
        };

        this.view.registerSectionPlane(this);
    }

    /**
     * Sets if this SectionPlane is active or not.
     *
     * Default value is ````true````.
     *
     * @param value Set ````true```` to activate else ````false```` to deactivate.
     */
    set active(value: boolean) {
        if (this.state.active === value) {
            return;
        }
        this.state.active = value;
        this.view.redraw();
        this.events.fire("active", this.state.active);
    }

    /**
     * Gets if this SectionPlane is active or not.
     *
     * Default value is ````true````.
     *
     * @returns Returns ````true```` if active.
     */
    get active(): boolean {
        return this.state.active;
    }

    /**
     * Sets the World-space position of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, 0]````.
     *
     * @param value New position.
     */
    set pos(value: math.FloatArrayType) {
        this.state.pos.set(value);
        this.state.dist = (-math.dotVec3(this.state.pos, this.state.dir));
        this.events.fire("pos", this.state.pos);
    }

    /**
     * Gets the World-space position of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, 0]````.
     *
     * @returns  Current position.
     */
    get pos(): Float64Array {
        return this.state.pos;
    }

    /**
     * Sets the direction of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, -1]````.
     *
     * @param value New direction.
     */
    set dir(value: math.FloatArrayType) {
        this.state.dir.set(value);
        this.state.dist = (-math.dotVec3(this.state.pos, this.state.dir));
        this.view.redraw();
        this.events.fire("dir", this.state.dir);
    }

    /**
     * Gets the direction of this SectionPlane's plane.
     *
     * Default value is ````[0, 0, -1]````.
     *
     * @returns value Current direction.
     */
    get dir(): Float32Array {
        return this.state.dir;
    }

    /**
     * Gets this SectionPlane's distance to the origin of the World-space coordinate system.
     *
     * This is the dot product of {@link SectionPlane#pos} and {@link SectionPlane#dir} and is automatically re-calculated
     * each time either of two properties are updated.
     *
     * @returns Distance to the origin of the World-space coordinate system.
     */
    get dist(): number {
        return this.state.dist;
    }

    /**
     * Inverts the direction of {@link SectionPlane#dir}.
     */
    flipDir() {
        const dir = this.state.dir;
        dir[0] *= -1.0;
        dir[1] *= -1.0;
        dir[2] *= -1.0;
        this.state.dist = (-math.dotVec3(this.state.pos, this.state.dir));
        this.events.fire("dir", this.state.dir);
        this.view.redraw();
    }

    /**
     * @private
     */
    destroy() {
        this.view.deregisterSectionPlane(this);
        super.destroy();
    }
}

export {SectionPlane};
