import {Component} from "@xeokit/core";


import type {View} from "./View";
import type {FloatArrayParam} from "@xeokit/math";

/**
 * A directional light source within a {@link @xeokit/viewer!View}.
 *
 * ## Summary
 *
 * * Illuminates all objects equally from a given direction.
 * * Has an emission direction vector in {@link DirLight.dir}, but no position.
 * * Defined in either *World* or *View* coordinate space. When in World-space, {@link DirLight.dir} is relative to the
 * World coordinate system, and will appear to move as the {@link @xeokit/viewer!Camera | Camera}  moves. When in View-space, {@link DirLight.dir} is
 * relative to the View coordinate system, and will behave as if fixed to the viewer's head.
 * * {@link AmbientLight}s, {@link DirLight}s and {@link PointLight}s are registered by their {@link Component.id} on {@link View.lights}.
 */
class DirLight extends Component {

    /**
     ID of this DirLight, unique within the {@link @xeokit/viewer!View}.
     */
    declare public id: string;

    /**
     * The View to which this DirLight belongs.
     */
    public readonly view: View;

    #state: {
        type: "dir";
        dir: Float32Array;
        color: Float32Array;
        intensity: number;
        space: "world" | "view"
    };

    /**
     * @param view View that owns this DirLight. When destroyed, the View will destroy this DirLight as well.
     * @param options The DirLight configuration
     * @param [options.id] Optional ID, unique among all components in the parent {@link @xeokit/scene!Scene | Scene}, generated automatically when omitted.
     * @param [options.dir=[1.0, 1.0, 1.0]]  A unit vector indicating the direction that the light is shining,  given in either World or View space, depending on the value of the ````space```` parameter.
     * @param [options.color=[0.7, 0.7, 0.8 ]] The color of this DirLight.
     * @param [options.intensity=1.0] The intensity of this DirLight, as a factor in range ````[0..1]````.
     * @param [options.space="view"] The coordinate system the DirLight is defined in - ````"view"```` or ````"space"````.
     */
    constructor(view: View, options: {
        intensity?: number; color?: FloatArrayParam;
        dir?: FloatArrayParam; space?: "world" | "view"
    } = {}) {
        super(view, options);
        this.view = view;
        this.#state = {
            type: "dir",
            dir: new Float32Array(options.dir || [1.0, 1.0, 1.0]),
            color: new Float32Array(options.color || [0.7, 0.7, 0.8]),
            intensity: (options.intensity !== undefined && options.intensity !== null) ? options.intensity : 1.0,
            space: options.space || "view"
        };
        this.view.registerLight(this);
    }

    /**
     * Gets the direction in which the DirLight is shining.
     *
     * Default value is ````[1.0, 1.0, 1.0]````.
     *
     * @returns {Number[]} The direction vector.
     */
    get dir(): FloatArrayParam {
        return this.#state.dir;
    }

    /**
     * The coordinate system the DirLight is defined in - ````"view"```` or ````"space"````.
     */
    get space(): String {
        return this.#state.space;
    }

    /**
     * Sets the direction in which the DirLight is shining.
     *
     * Default value is ````[1.0, 1.0, 1.0]````.
     *
     * @param value The direction vector.
     */
    set dir(value: FloatArrayParam) {
        this.#state.dir.set(value);
        this.view.redraw();
    }

    /**
     * Gets the RGB color of this DirLight.
     *
     * Default value is ````[0.7, 0.7, 0.8]````.
     *
     * @returns {Number[]} The DirLight's RGB color.
     */
    get color(): FloatArrayParam {
        return this.#state.color;
    }

    /**
     * Sets the RGB color of this DirLight.
     *
     * Default value is ````[0.7, 0.7, 0.8]````.
     *
     * @param color The DirLight's RGB color.
     */
    set color(color: FloatArrayParam) {
        this.#state.color.set(color);
        this.view.redraw();
    }

    /**
     * Gets the intensity of this DirLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @returns {Number} The DirLight's intensity.
     */
    get intensity(): number {
        return this.#state.intensity;
    }

    /**
     * Sets the intensity of this DirLight.
     *
     * Default intensity is ````1.0```` for maximum intensity.
     *
     * @param intensity The DirLight's intensity
     */
    set intensity(intensity: number) {
        this.#state.intensity = intensity;
        this.view.redraw();
    }

    /**
     * Destroys this DirLight.
     */
    destroy() {
        super.destroy();
        this.view.deregisterLight(this);
        this.view.redraw();
    }
}

export {DirLight};
