import type {AmbientLightParams} from "./AmbientLightParams";
import type {CameraParams} from "./CameraParams";
import type {DirLightParams} from "./DirLightParams";
import type {EdgesParams} from "./EdgesParams";
import type {EffectParams} from "./EffectParams";
import type {FloatArrayParam} from "../math";
import type {PointLightParams} from "./PointLightParams";
import type {PointsMaterialParams} from "./PointsMaterialParams";
import type {ResolutionScaleParams} from "./ResolutionScaleParams";
import type {SAOParams} from "./SAOParams";
import type {SectionPlaneParams} from "./SectionPlaneParams";
import type {ViewLayerParams} from "./ViewLayerParams";

/**
 * Parameters for a {@link View}.
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
   * any {@link AmbientLight | AmbientLights} defined in the {@link View} .
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
   * Whether the {@link View} will automatically create {@link ViewLayer | ViewLayers} on-demand
   * as {@link ViewObject | ViewObjects} are created.
   *
   * When ````true```` (default), the {@link View} will automatically create {@link ViewLayer | ViewLayers} as needed for each new
   * {@link scene!SceneObject.layerId | SceneObject.layerId} encountered, including a "default" ViewLayer for ViewerObjects corresponding to
   * SceneObjects that have no layerId. This default setting therefore ensures that a ViewObject is created in the {@link View} for every
   * SceneObject that is created.
   *
   * If you set this ````false````, however, then the {@link View} will only create {@link ViewObject | ViewObjects}
   * for {@link scene!SceneObject | SceneObjects} that have
   * a {@link scene!SceneObject.layerId | SceneObject.layerId} that matches the ID of some {@link ViewLayer} that you
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
   * Parameters for the View's scalable ambient obscurance effect, {@link SAO}, which enhances 3D model visualization by darkening
   * areas with limited ambient light exposure.
   */
  sao?: SAOParams;

  /**
   * Parameters for the View's edge enhancement effect, {@link Edges}.
   */
  edges?: EdgesParams;

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
   * Parameters for the View's light sources.
   */
  lights?: (AmbientLightParams | PointLightParams | DirLightParams)[];

  /**
   * Paramaters for the View's {@link SectionPlane | SectionPlanes}.
   */
  sectionPlanes?: SectionPlaneParams[];

  /**
   * Paramaters the View's {@link ResolutionScale}.
   */
  resolutionScale?: ResolutionScaleParams;

  /**
   * Configures which rendering mode the View is in.
   *
   * Default is {@link constants!QualityRender | QualityRender}.
   */
  renderMode?: number;
}
