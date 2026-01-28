import { Component } from "../core";
/**
 * An ambient light source within a {@link viewer!View}.
 *
 * ## Summary
 *
 * * Has fixed color and intensity that illuminates all objects equally.
 * * {@link AmbientLight}s, {@link DirLight}s and {@link PointLight}s are registered by their {@link Component.id} on {@link View.lights}.
 */
class AmbientLight extends Component {
    /**
     * The View to which this AmbientLight belongs.
     */
    view;
    #state;
    /**
     * @param view Owner component. When destroyed, the owner will destroy this AmbientLight as well.
     * @param cfg AmbientLight configuration
     */
    constructor(view, cfg = {}) {
        super(view, cfg);
        this.view = view;
        this.#state = {
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
    set color(color) {
        this.#state.color.set(color);
        this.view.needsRedraw();
    }
    /**
     * Gets the RGB color of this AmbientLight.
     *
     * Default value is ````[0.7, 0.7, 0.7]````.
     */
    get color() {
        return this.#state.color;
    }
    /**
     * Sets the intensity of this AmbientLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @param intensity The AmbientLight's intensity.
     */
    set intensity(intensity) {
        this.#state.intensity = intensity !== undefined ? intensity : 1.0;
        this.view.needsRedraw();
    }
    /**
     * Gets the intensity of this AmbientLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @returns {Number} The AmbientLight's intensity.
     */
    get intensity() {
        return this.#state.intensity;
    }
    /**
     * Destroys this AmbientLight.
     */
    destroy() {
        super.destroy();
        this.view.deregisterLight(this);
    }
}
export { AmbientLight };
//# sourceMappingURL=AmbientLight.js.map
