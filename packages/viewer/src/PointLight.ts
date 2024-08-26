import {Component} from "@xeokit/core";
import type {View} from "./View";
import type {FloatArrayParam} from "@xeokit/math";


/**
 * A positional light source within a {@link @xeokit/viewer!View}.
 *
 * ## Summary
 *
 * * Originates from a single point and spreads outward in all directions, with optional attenuation over distance.
 * * Has a position in {@link PointLight.pos}, but no direction.
 * * Defined in either *World* or *View* coordinate space. When in World-space, {@link PointLight.pos} is relative to
 * the World coordinate system, and will appear to move as the {@link @xeokit/viewer!Camera | Camera}  moves. When in View-space,
 * {@link PointLight.pos} is relative to the View coordinate system, and will behave as if fixed to the viewer's head.
 * * Has {@link PointLight.constantAttenuation}, {@link PointLight.linearAttenuation} and {@link PointLight.quadraticAttenuation}
 * factors, which indicate how intensity attenuates over distance.
 * * {@link AmbientLight}s, {@link PointLight}s and {@link PointLight}s are registered by their {@link Component.id} on {@link View.lights}.
 */
class PointLight extends Component {

    /**
     ID of this PointLight, unique within the {@link @xeokit/viewer!View}.
     */
    declare public id: string;

    /**
     * The View to which this PointLight belongs.
     */
    public readonly view: View;

    #state: {
        intensity: number;
        attenuation: Float32Array;
        color: Float32Array;
        pos: Float64Array;
        type: string;
        space: string
    };

    /**
     * @param view View that owns this PointLight. When destroyed, the View will destroy this PointLight as well.
     * @param cfg The PointLight configuration
     * @param [cfg.id] Optional ID, unique among all components in the parent {@link @xeokit/scene!Scene | Scene}, generated automatically when omitted.
     * @param [cfg.pos=[ 1.0, 1.0, 1.0 ]] Position, in either World or View space, depending on the value of the **space** parameter.
     * @param [cfg.color=[0.7, 0.7, 0.8 ]] Color of this PointLight.
     * @param [cfg.intensity=1.0] Intensity of this PointLight, as a factor in range ````[0..1]````.
     * @param [cfg.constantAttenuation=0] Constant attenuation factor.
     * @param [cfg.linearAttenuation=0] Linear attenuation factor.
     * @param [cfg.quadraticAttenuation=0] Quadratic attenuation factor.
     * @param [cfg.space="view"] The coordinate system this PointLight is defined in - "view" or "world".
     * @param [cfg.castsShadow=false] Flag which indicates if this PointLight casts a castsShadow.
     */
    constructor(view: View, cfg: {
        /** Optional ID, unique among all components in the parent {@link @xeokit/scene!Scene | Scene}, generated automatically when omitted.*/
        id?: string;
        /** Intensity of this PointLight, as a factor in range ````[0..1]````. */
        intensity?: number;
        /** RGB color */
        color?: FloatArrayParam;
        /** World-space position */
        pos?: FloatArrayParam;
        /** Quadratic attenuation factor. */
        quadraticAttenuation?: number;
        /** Constant attenuation factor */
        constantAttenuation?: number;
        /** The coordinate system this PointLight is defined in - "view" or "world". */
        space?: string;
        /** Linear attenuation factor */
        linearAttenuation?: number
    } = {}) {

        super(view, cfg);

        this.view = view;


        this.#state = {
            type: "point",
            pos: new Float64Array(cfg.pos || [1.0, 1.0, 1.0]),
            color: new Float32Array(cfg.color || [0.7, 0.7, 0.8]),
            intensity: 1.0,
            // @ts-ignore
            attenuation: new Float32Array([cfg.constantAttenuation, cfg.linearAttenuation, cfg.quadraticAttenuation]),
            space: cfg.space || "view"
        };

        this.view.registerLight(this);
    }

    /**
     * The coordinate system the PointLight is defined in - ````"view"```` or ````"space"````.
     */
    get space(): String {
        return this.#state.space;
    }

    /**
     * Gets the position of this PointLight.
     *
     * This will be either World- or View-space, depending on the value of {@link PointLight.space}.
     *
     * Default value is ````[1.0, 1.0, 1.0]````.
     *
     * @returns {Number[]} The position.
     */
    get pos(): FloatArrayParam {
        return this.#state.pos;
    }

    /**
     * Sets the position of this PointLight.
     *
     * This will be either World- or View-space, depending on the value of {@link PointLight.space}.
     *
     * Default value is ````[1.0, 1.0, 1.0]````.
     *
     * @param pos The position.
     */
    set pos(pos: FloatArrayParam) {
        this.#state.pos.set(pos || [1.0, 1.0, 1.0]);
        this.view.redraw();
    }

    /**
     * Gets the RGB color of this PointLight.
     *
     * Default value is ````[0.7, 0.7, 0.8]````.
     *
     * @returns {Number[]} The PointLight's RGB color.
     */
    get color(): FloatArrayParam {
        return this.#state.color;
    }

    /**
     * Sets the RGB color of this PointLight.
     *
     * Default value is ````[0.7, 0.7, 0.8]````.
     *
     * @param color The PointLight's RGB color.
     */
    set color(color: FloatArrayParam) {
        this.#state.color.set(color || [0.7, 0.7, 0.8]);
        this.view.redraw();
    }

    /**
     * Gets the intensity of this PointLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @returns {Number} The PointLight's intensity.
     */
    get intensity(): number {
        return this.#state.intensity;
    }

    /**
     * Sets the intensity of this PointLight.
     *
     * Default intensity is ````1.0```` for maximum intensity.
     *
     * @param intensity The PointLight's intensity
     */
    set intensity(intensity: number) {
        if (intensity === this.#state.intensity) {
            return;
        }
        this.#state.intensity = intensity;
        this.view.redraw();
    }

    /**
     * Gets the constant attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The constant attenuation factor.
     */
    get constantAttenuation(): number {
        return this.#state.attenuation[0];
    }

    /**
     * Sets the constant attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @param value The constant attenuation factor.
     */
    set constantAttenuation(value: number) {
        this.#state.attenuation[0] = value;
        this.view.redraw();
    }

    /**
     * Gets the linear attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The linear attenuation factor.
     */
    get linearAttenuation(): number {
        return this.#state.attenuation[1];
    }

    /**
     * Sets the linear attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @param value The linear attenuation factor.
     */
    set linearAttenuation(value: number) {
        this.#state.attenuation[1] = value;
        this.view.redraw();
    }

    /**
     * Gets the quadratic attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The quadratic attenuation factor.
     */
    get quadraticAttenuation(): number {
        return this.#state.attenuation[2];
    }

    /**
     * Sets the quadratic attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @param value The quadratic attenuation factor.
     */
    set quadraticAttenuation(value: number) {
        this.#state.attenuation[2] = value;
        this.view.redraw();
    }

    /**
     * Destroys this PointLight.
     */
    destroy() {
        super.destroy();
        this.view.deregisterLight(this);
        this.view.redraw();
    }
}

export {PointLight};
