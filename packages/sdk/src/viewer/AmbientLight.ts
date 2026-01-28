import type {AmbientLightParams} from "./AmbientLightParams";
import type {FloatArrayParam} from "../math";
import type {View} from "./View";
import {createUUID} from "../utils";


/**
 * An ambient light source within a {@link View}.
 *
 * * Has fixed color and intensity that illuminates all objects equally.
 * * {@link AmbientLight}s, {@link DirLight}s and {@link PointLight}s are registered by their IDs on {@link View.lights}.
 */
class AmbientLight  {

  /**
   ID of this AmbientLight, unique within the {@link View}.
   */
   public id: string;

  /**
   * The View to which this AmbientLight belongs.
   */
  public readonly view: View;

  private _intensity: number;
  private _color: Float32Array<any>;
  private _type: string;

  /**
   * @param view Owner component. When destroyed, the owner will destroy this AmbientLight as well.
   * @param cfg AmbientLight configuration
   */
  constructor(view: View, cfg: AmbientLightParams = {}) {
    this.id = cfg.id || createUUID();
    this.view = view;
    this._type="ambient",
        this._color= new Float32Array(cfg.color || [0.7, 0.7, 0.7]);
        this._intensity= (cfg.intensity !== undefined && cfg.intensity !== null) ? cfg.intensity : 1.0;
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
    this._color.set(color);
    this.view.needsRender();
  }

  /**
   * Gets the RGB color of this AmbientLight.
   *
   * Default value is ````[0.7, 0.7, 0.7]````.
   */
  get color(): FloatArrayParam {
    return this._color;
  }

  /**
   * Sets the intensity of this AmbientLight.
   *
   * Default value is ````1.0```` for maximum intensity.
   *
   * @param intensity The AmbientLight's intensity.
   */
  set intensity(intensity: number) {
    this._intensity = intensity !== undefined ? intensity : 1.0;
    this.view.needsRender();
  }

  /**
   * Gets the intensity of this AmbientLight.
   *
   * Default value is ````1.0```` for maximum intensity.
   *
   * @returns {Number} The AmbientLight's intensity.
   */
  get intensity(): number {
    return this._intensity;
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
    this.view.deregisterLight(this);
  }
}

export {AmbientLight};
