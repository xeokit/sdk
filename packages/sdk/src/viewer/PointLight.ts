import type {FloatArrayParam} from "../math";
import type {PointLightParams} from "./PointLightParams";
import type {View} from "./View";
import {createUUID} from "../utils";
import {createVec3Float64, Vec3Float} from "../math";

/**
 * A positional light source within a {@link View}.
 *
 *
 *
 * * Originates from a single point and spreads outward in all directions, with optional attenuation over distance.
 * * Has a position in {@link PointLight.pos}, but no direction.
 * * Defined in either *World* or *View* coordinate space. When in World-space, {@link PointLight.pos} is relative to
 * the World coordinate system, and will appear to move as the {@link Camera | Camera}  moves. When in View-space,
 * {@link PointLight.pos} is relative to the View coordinate system, and will behave as if fixed to the viewer's head.
 * * Has {@link PointLight.constantAttenuation}, {@link PointLight.linearAttenuation} and {@link PointLight.quadraticAttenuation}
 * factors, which indicate how intensity attenuates over distance.
 * * {@link AmbientLight}s, {@link PointLight}s and {@link PointLight}s are registered by their IDs on {@link View.lights}.
 */
class PointLight {

    /**
     ID of this PointLight, unique within the {@link View}.
     */
    public id: string;

    /**
     * The View to which this PointLight belongs.
     */
    public readonly view: View;

    private _intensity: number;
    private _attenuation: Float32Array<any>;
    private _color: Vec3Float;
    private _pos: Vec3Float;
    private _type: string;
    private _space: string;

    /**
     * @param view View that owns this PointLight. When destroyed, the View will destroy this PointLight as well.
     * @param cfg The PointLight configuration
     */
    constructor(view: View, cfg: PointLightParams = {}) {

        this.id = cfg.id || createUUID();

        this.view = view;

        this._type = "point";
        this._pos = createVec3Float64(cfg.pos);
        this._color = createVec3Float64(cfg.color || [0.7, 0.7, 0.8]);
        this._intensity = 1.0;
        // @ts-ignore
        this._attenuation = new Float32Array([cfg.constantAttenuation, cfg.linearAttenuation, cfg.quadraticAttenuation]);
        this._space = cfg.space || "view";

        this.view.registerLight(this);
    }

    /**
     * The coordinate system the PointLight is defined in - ````"view"```` or ````"space"````.
     */
    get space(): string {
        return this._space;
    }

    /**
     * Gets the position of this PointLight.
     *
     * This will be either World- or View-space, depending on the value of {@link PointLight.space}.
     *
     * Default value is ````[1.0, 1.0, 1.0]````.
     *
     * @returns {Vec3Float} The position.
     */
    get pos(): Vec3Float {
        return this._pos;
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
      // @ts-ignore
        this._pos.set(pos || [1.0, 1.0, 1.0]);
        this.view.needsRender();
    }

    /**
     * Gets the RGB color of this PointLight.
     *
     * Default value is ````[0.7, 0.7, 0.8]````.
     *
     * @returns {Number[]} The PointLight's RGB color.
     */
    get color(): FloatArrayParam {
        return this._color;
    }

    /**
     * Sets the RGB color of this PointLight.
     *
     * Default value is ````[0.7, 0.7, 0.8]````.
     *
     * @param color The PointLight's RGB color.
     */
    set color(color: FloatArrayParam) {
      // @ts-ignore
        this._color.set(color || [0.7, 0.7, 0.8]);
        this.view.needsRender();
    }

    /**
     * Gets the intensity of this PointLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @returns {Number} The PointLight's intensity.
     */
    get intensity(): number {
        return this._intensity;
    }

    /**
     * Sets the intensity of this PointLight.
     *
     * Default intensity is ````1.0```` for maximum intensity.
     *
     * @param intensity The PointLight's intensity
     */
    set intensity(intensity: number) {
        if (intensity === this._intensity) {
            return;
        }
        this._intensity = intensity;
        this.view.needsRender();
    }

    /**
     * Gets the constant attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The constant attenuation factor.
     */
    get constantAttenuation(): number {
        return this._attenuation[0];
    }

    /**
     * Sets the constant attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @param value The constant attenuation factor.
     */
    set constantAttenuation(value: number) {
        this._attenuation[0] = value;
        this.view.needsRender();
    }

    /**
     * Gets the linear attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The linear attenuation factor.
     */
    get linearAttenuation(): number {
        return this._attenuation[1];
    }

    /**
     * Sets the linear attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @param value The linear attenuation factor.
     */
    set linearAttenuation(value: number) {
        this._attenuation[1] = value;
        this.view.needsRender();
    }

    /**
     * Gets the quadratic attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @returns {Number} The quadratic attenuation factor.
     */
    get quadraticAttenuation(): number {
        return this._attenuation[2];
    }

    /**
     * Sets the quadratic attenuation factor for this PointLight.
     *
     * Default value is ````0````.
     *
     * @param value The quadratic attenuation factor.
     */
    set quadraticAttenuation(value: number) {
        this._attenuation[2] = value;
        this.view.needsRender();
    }

    /**
     * Configures this PointLight.
     *
     * Ignores {@link PointLightParams.space | PointLightParams.space}, because
     * {@link PointLight.space | PointLight.space} is not dynamically updatable.
     *
     * @param pointLightParams
     */
    fromParams(pointLightParams: PointLightParams) {
        if (pointLightParams.pos) {
            this.pos = pointLightParams.pos;
        }
        if (pointLightParams.color) {
            this.color = pointLightParams.color;
        }
        if (pointLightParams.intensity !== undefined) {
            this.intensity = pointLightParams.intensity;
        }
        // Space is not dynamicaly-updatable
    }

    /**
     * Gets the current configuration of this PointLight.
     */
    toParams(): PointLightParams {
        return {
            id: this.id,
            color: Array.from(this.color),
            pos: Array.from(this.pos),
            quadraticAttenuation: this.quadraticAttenuation,
            linearAttenuation: this.linearAttenuation,
            constantAttenuation: this.constantAttenuation,
            intensity: this.intensity,
            space: this.space
        };
    }

    /**
     * Destroys this PointLight.
     */
    destroy() {
        this.view.deregisterLight(this);
        this.view.needsRender();
    }
}

export {PointLight};
