import type { View } from "../View";
import { Component } from "../../Component";
import type * as math from '../../math/index';
/**
 * A positional light source within a {@link View}.
 *
 * ## Summary
 *
 * * Originates from a single point and spreads outward in all directions, with optional attenuation over distance.
 * * Has a position in {@link PointLight.pos}, but no direction.
 * * Defined in either *World* or *View* coordinate space. When in World-space, {@link PointLight.pos} is relative to
 * the World coordinate system, and will appear to move as the {@link Camera} moves. When in View-space,
 * {@link PointLight.pos} is relative to the View coordinate system, and will behave as if fixed to the viewer's head.
 * * Has {@link PointLight.constantAttenuation}, {@link PointLight.linearAttenuation} and {@link PointLight.quadraticAttenuation}
 * factors, which indicate how intensity attenuates over distance.
 * * {@link AmbientLight}s, {@link PointLight}s and {@link PointLight}s are registered by their {@link Component.id} on {@link View.lights}.
 */
declare class PointLight extends Component {
    #private;
    /**
     ID of this PointLight, unique within the {@link View}.
     */
    id: string;
    /**
     * The View to which this PointLight belongs.
     */
    readonly view: View;
    /**
     * @param view View that owns this PointLight. When destroyed, the View will destroy this PointLight as well.
     * @param cfg The PointLight configuration
     * @param [cfg.id] Optional ID, unique among all components in the parent {@link Scene}, generated automatically when omitted.
     * @param [cfg.pos=[ 1.0, 1.0, 1.0 ]] Position, in either World or View space, depending on the value of the **space** parameter.
     * @param [cfg.color=[0.7, 0.7, 0.8 ]] Color of this PointLight.
     * @param [cfg.intensity=1.0] Intensity of this PointLight, as a factor in range ````[0..1]````.
     * @param [cfg.constantAttenuation=0] Constant attenuation factor.
     * @param [cfg.linearAttenuation=0] Linear attenuation factor.
     * @param [cfg.quadraticAttenuation=0] Quadratic attenuation factor.
     * @param [cfg.space="view"] The coordinate system this PointLight is defined in - "view" or "world".
     * @param [cfg.castsShadow=false] Flag which indicates if this PointLight casts a castsShadow.
     */
    constructor(view: View, cfg?: {
        /** Optional ID, unique among all components in the parent {@link Scene}, generated automatically when omitted.*/
        id?: string;
        /** Intensity of this PointLight, as a factor in range ````[0..1]````. */
        intensity?: number;
        /** RGB color */
        color?: math.FloatArrayParam;
        /** World-space position */
        pos?: math.FloatArrayParam;
        /** Quadratic attenuation factor. */
        quadraticAttenuation?: number;
        /** Constant attenuation factor */
        constantAttenuation?: number;
        /** The coordinate system this PointLight is defined in - "view" or "world". */
        space?: string;
        /** Linear attenuation factor */
        linearAttenuation?: number;
    });
    /**
     * Gets the position of this PointLight.
     *
     * This will be either World- or View-space, depending on the value of {@link PointLight.space}.
     *
     * Default value is ````[1.0, 1.0, 1.0]````.
     *
     * @returns {Number[]} The position.
     */
    get pos(): math.FloatArrayParam;
    /**
     * Sets the position of this PointLight.
     *
     * This will be either World- or View-space, depending on the value of {@link PointLight.space}.
     *
     * Default value is ````[1.0, 1.0, 1.0]````.
     *
     * @param pos The position.
     */
    set pos(pos: math.FloatArrayParam);
    /**
     * Gets the RGB color of this PointLight.
     *
     * Default value is ````[0.7, 0.7, 0.8]````.
     *
     * @returns {Number[]} The PointLight's RGB color.
     */
    get color(): math.FloatArrayParam;
    /**
     * Sets the RGB color of this PointLight.
     *
     * Default value is ````[0.7, 0.7, 0.8]````.
     *
     * @param color The PointLight's RGB color.
     */
    set color(color: math.FloatArrayParam);
    /**
     * Gets the intensity of this PointLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @returns {Number} The PointLight's intensity.
     */
    get intensity(): number;
    /**
     * Sets the intensity of this PointLight.
     *
     * Default intensity is ````1.0```` for maximum intensity.
     *
     * @param intensity The PointLight's intensity
     */
    set intensity(intensity: number);
    /**
     * Gets the constant attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The constant attenuation factor.
     */
    get constantAttenuation(): number;
    /**
     * Sets the constant attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @param value The constant attenuation factor.
     */
    set constantAttenuation(value: number);
    /**
     * Gets the linear attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The linear attenuation factor.
     */
    get linearAttenuation(): number;
    /**
     * Sets the linear attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @param value The linear attenuation factor.
     */
    set linearAttenuation(value: number);
    /**
     * Gets the quadratic attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The quadratic attenuation factor.
     */
    get quadraticAttenuation(): number;
    /**
     * Sets the quadratic attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @param value The quadratic attenuation factor.
     */
    set quadraticAttenuation(value: number);
    /**
     * Destroys this PointLight.
     */
    destroy(): void;
}
export { PointLight };
