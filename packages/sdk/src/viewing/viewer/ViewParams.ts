import type {CameraParams} from "./CameraParams";
import type {EffectParams} from "./EffectParams";
import type {EffectsParams} from "./EffectsParams";
import type {FloatArrayParam} from "../../base/math";
import type {PointsMaterialParams} from "./PointsMaterialParams";
import type {ResolutionScaleParams} from "./ResolutionScaleParams";
import type {LightsParams} from "./LightsParams";
import type {SectionPlaneParams} from "./SectionPlaneParams";
import type {TexturingParams} from "./TexturingParams";
import type {ViewLayerParams} from "./ViewLayerParams";

/**
 * Parameters for a {@link viewing!viewer.View | View}.
 *
 * * Returned by {@link View.toParams | View.toParams}
 * * Passed to {@link View.fromParams | View.fromParams} and {@link Viewer.createView | Viewer.createView}
 * * Located at {@link ViewerParams.views | ViewerParams.views}
 */
export interface ViewParams {

  /**
   * Optional ID, genarated automatically by {@link Viewer.createView} if omitted.
   */
  id?: string;

  /**
   * ID of an HTMLCanvasElement in the DOM.
   */
  elementId?: string;

  /**
   * An HTMLElement in the DOM.
   *
   * Overrides {@link ViewParams.elementId | ViewParams.elementId}
   */
  htmlElement?: HTMLCanvasElement;

  /**
   * RGB clear color for the {@link View | View's} canvas.
   *
   * Only works when canvas is not transparent.
   *
   * Default value is `[1,1,1]`.
   */
  backgroundColor?: FloatArrayParam;

  /**
   * Set true to attempt to derive the {@link View | View's} canvas RGB clear color from
   * any {@link AmbientLight | AmbientLights} defined in the {@link viewing!viewer.View | View} .
   *
   * Only works when canvas is not transparent.
   *
   * Falls back on {@link View.backgroundColor | }
   *
   * Default value is `[1,1,1]`.
   */
  backgroundColorFromAmbientLight?: boolean;

  /**
   * Whether the {@link View | View} performs alpha composition with premultiplied alpha. Highlighting and selection works best when
   * this is ````false````.
   *
   * Default value is `false`.
   */
  premultipliedAlpha?: boolean;

  /**
   * Configures whether the {@link View | View's} canvas is transparent.
   *
   * Default value is `false`.
   */
  transparent?: boolean;

  /**
   * Whether the {@link viewing!viewer.View | View} will automatically create {@link ViewLayer | ViewLayers} on-demand
   * as {@link ViewObject | ViewObjects} are created.
   *
   * When ````true```` (default), the {@link viewing!viewer.View | View} will automatically create {@link ViewLayer | ViewLayers} as needed for each new
   * {@link model!scene.SceneObject.layerId | SceneObject.layerId} encountered, including a "default" ViewLayer for ViewerObjects corresponding to
   * SceneObjects that have no layerId. This default setting therefore ensures that a ViewObject is created in the {@link viewing!viewer.View | View} for every
   * SceneObject that is created.
   *
   * If you set this ````false````, however, then the {@link viewing!viewer.View | View} will only create {@link ViewObject | ViewObjects}
   * for {@link model!scene.SceneObject | SceneObjects} that have
   * a {@link model!scene.SceneObject.layerId | SceneObject.layerId} that matches the ID of some {@link ViewLayer} that you
   * explicitly created earlier with {@link View.createLayer}.
   *
   * Setting this parameter ````false```` enables a View to contain only the ViewObjects that it actually needs to show, i.e. to
   * represent only SceneObjects that it needs to view. This enables a View to avoid wastefully creating and maintaining
   * ViewObjects for SceneObjects that it never needs to show.
   *
   * Default value is `true`.
   */
  autoLayers?: boolean;

  /**
   * Parameters for the View's renderer-effect components,
   * {@link Effects} — covering {@link SAO}, {@link Edges},
   * {@link Bloom}, {@link Tonemap}, {@link AntiAliasing}, and
   * {@link Shadows}.
   */
  effects?: EffectsParams;

  /**
   * Parameters for the View's environment-illumination components,
   * {@link Lights} — covering both {@link IBL} (cubemap) and
   * {@link HemisphereAmbient} (analytical hemispheric).
   */
  lights?: LightsParams;

  /**
   * Parameters for the View's {@link Texturing} component.
   */
  texturing?: TexturingParams;

  /**
   * Parameters for the appearance of {@link ViewObject | ViewObjects} in the View when they are selected.
   */
  selectedMaterial?: EffectParams;

  /**
   * Parameters for the appearance of {@link ViewObject | ViewObjects} in the View when they are highlighted.
   */
  highlightMaterial?: EffectParams;

  /**
   * Parameters for the appearance of {@link ViewObject | ViewObjects} in the View when they are X-rayed.
   */
  xrayMaterial?: EffectParams;

  /**
   * Parameters for the {@link View | View's} {@link PointsMaterial}.
   */
  pointsMaterial?: PointsMaterialParams;

  /**
   * Parameters for the View's {@link ViewLayer | ViewLayers}.
   */
  layers?: ViewLayerParams[];

  /**
   * Parameters for the View's {@link Camera}.
   */
  camera?: CameraParams;

  /**
   * Paramaters for the View's {@link SectionPlane | SectionPlanes}.
   */
  sectionPlanes?: SectionPlaneParams[];

  /**
   * Paramaters the View's {@link ResolutionScale}.
   */
  resolutionScale?: ResolutionScaleParams;
}
