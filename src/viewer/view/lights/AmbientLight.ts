import {Scene} from "../../scene/Scene";
import {View} from "../View";
import {Component} from "../../Component";
import * as math from '../../math/index';

/**
 * An ambient light source within a {@link View}.
 *
 * ## Overview
 *
 * * Has fixed color and intensity that illuminates all objects equally.
 * * {@link AmbientLight}s, {@link DirLight}s and {@link PointLight}s are registered by their {@link Component.id} on {@link View.lights}.
 */
class AmbientLight extends Component {

    /**
     ID of this AmbientLight, unique within the {@link View}.
     */
    declare public id: string;

    /**
     * The View to which this AmbientLight belongs.
     */
    public readonly view: View;

    /**
     * @private
     */
    readonly state: {
        intensity: number;
        color: Float32Array;
        type: string
    };

    /**
     * @param view Owner component. When destroyed, the owner will destroy this AmbientLight as well.
     * @param cfg AmbientLight configuration
     */
    constructor(view: View, cfg: {
        /** Optional ID, unique among all components in the parent {@link Scene}, generated automatically when omitted.*/
        id?: string;
        /** Intensity factor in range ````[0..1]````.  Default is ````1````.*/
        intensity?: number;
        /** RGB color in range ````[0..1,0..1,0..1]````. Default is ````[0.7, 0.7, 0.7]````.*/
        color?: math.FloatArrayParam
    } = {}) {
        super(view, cfg);
        this.view = view;
        this.state = {
            type: "ambient",
            color: new Float32Array(cfg.color || [0.7, 0.7, 0.7]),
            intensity: (cfg.intensity !== undefined && cfg.intensity !== null) ? cfg.intensity : 1.0
        };
        this.view.registerLight(this);
    }

    /**
     * Sets the RGB color of this AmbientLight.
     *
     * Default value is ````[0.7, 0.7, 0.7]````.
     *
     * @param color The AmbientLight's RGB color.
     */
    set color(color: math.FloatArrayParam) {
        this.state.color.set(color);
        this.view.redraw();
    }

    /**
     * Gets the RGB color of this AmbientLight.
     *
     * Default value is ````[0.7, 0.7, 0.7]````.
     */
    get color(): math.FloatArrayParam {
        return this.state.color;
    }

    /**
     * Sets the intensity of this AmbientLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @param intensity The AmbientLight's intensity.
     */
    set intensity(intensity: number) {
        this.state.intensity = intensity !== undefined ? intensity : 1.0;
        this.view.redraw();
    }

    /**
     * Gets the intensity of this AmbientLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @returns {Number} The AmbientLight's intensity.
     */
    get intensity(): number {
        return this.state.intensity;
    }

    /**
     * Destroys this AmbientLight.
     */
    destroy() {
        super.destroy();
        this.view.deregisterLight(this);
    }
}

export {AmbientLight};
