import { AmbientLightParams } from "./AmbientLightParams";
import { Component } from "../core";
import { DirLightParams } from "./DirLightParams";
import type { FloatArrayParam } from "../math";
import type { View } from "./View";


/**
 * An ambient light source within a {@link View}.
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

  #state: {
    intensity: number;
    color: Float32Array;
    type: string
  };

  /**
     * @param view Owner component. When destroyed, the owner will destroy this AmbientLight as well.
     * @param cfg AmbientLight configuration
     */
  constructor(view: View, cfg: AmbientLightParams = {}) {
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
  set color(color: FloatArrayParam) {
    this.#state.color.set(color);
    this.view.redraw();
  }

  /**
     * Gets the RGB color of this AmbientLight.
     *
     * Default value is ````[0.7, 0.7, 0.7]````.
     */
  get color(): FloatArrayParam {
    return this.#state.color;
  }

  /**
     * Sets the intensity of this AmbientLight.
     *
     * Default value is ````1.0```` for maximum intensity.
     *
     * @param intensity The AmbientLight's intensity.
     */
  set intensity(intensity: number) {
    this.#state.intensity = intensity !== undefined ? intensity : 1.0;
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
    return this.#state.intensity;
  }

  /**
     * Configures this AmbientLight.
     * @param ambientLightParams
     */
  fromParams(ambientLightParams: AmbientLightParams) {
    if (ambientLightParams.color) {
      this.color = ambientLightParams.color;
    }
    if (ambientLightParams.intensity !== undefined) {
      this.intensity = ambientLightParams.intensity;
    }
  }

  /**
     * Gets the current configuration of this AmbientLight.
     */
  toParams(): AmbientLightParams {
    return {
      id: this.id,
      color: Array.from(this.color),
      intensity: this.intensity
    };
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
