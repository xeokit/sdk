import type {FloatArrayParam} from "../math";
import type {RendererModel} from "./RendererModel";
import type {SDKError} from "../core";

/**
 * Interface through which a {@link viewer!ViewObject | ViewObject} controls the appearance of
 * a {@link SceneObject | SceneObject} in a {@link viewer!Viewer | Viewer}.
 *
 * While a {@link Scene | Scene} is attached to a {@link viewer!Viewer | Viewer}, the Viewer
 * attaches a RendererObject to {@link SceneObject.rendererObject | SceneObject.rendererObject} on
 * each of the Scene's {@link SceneObject | SceneObjects}, to provide an interface through which
 * the Viewer's {@link viewer!ViewObject | ViewObjects} can control the appearance of the SceneObjects
 * within their respective {@link viewer!View | Views}.
 *
 * Internally, the Viewer's {@link viewer!Renderer} attaches these
 * to {@link SceneObject.rendererObject | SceneObject.rendererObject}. When we update properties
 * like {@link viewer!ViewObject.visible | ViewObject.visible}, the ViewObject will upload those
 * updates through this interface into the {@link viewer!Renderer}.
 *
 * When a View
 *
 * @internal
 */
export interface RendererObject {

  /**
   * Unique identifier for this RendererObject.
   */
  readonly id: string;

  /**
   * The {@link RendererModel | RendererModel} containing this RendererObject.
   */
  readonly rendererModel: RendererModel;

  /**
   * The ID of a {@link viewer!ViewLayer | ViewLayer} in which the {@link viewer!ViewObject | ViewObject} exclusively appears.
   */
  readonly layerId: string | null;

  /**
   * Controls the visibility of the {@link viewer!ViewObject | ViewObject} in a specific {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View. Matches {@link viewer!View.viewIndex | View.viewIndex} for an attached View.
   * @param visible - Whether the {@link viewer!ViewObject | ViewObject} should be visible.
   * @returns *void* - Success.
   * @returns *{@link core!SDKError | SDKError}* - If no corresponding {@link viewer!View | View} is found.
   */
  setVisible(viewIndex: number, visible: boolean): void | SDKError;

  /**
   * Toggles the highlighted state of the {@link viewer!ViewObject | ViewObject} in a specified {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param highlighted - Whether to highlight the {@link viewer!ViewObject | ViewObject}.
   * @returns *void* - Success.
   * @returns *{@link core!SDKError | SDKError}* - If no corresponding {@link viewer!View | View} is found.
   */
  setHighlighted(viewIndex: number, highlighted: boolean): void | SDKError;

  /**
   * Sets whether the {@link viewer!ViewObject | ViewObject} should appear X-rayed in a given {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param xrayed - Whether to apply the X-ray effect.
   * @returns *void* - Success.
   * @returns *{@link core!SDKError | SDKError}* - If no corresponding {@link viewer!View | View} is found.
   */
  setXRayed(viewIndex: number, xrayed: boolean): void | SDKError;

  /**
   * Marks the {@link viewer!ViewObject | ViewObject} as selected within a given {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param selected - Whether the object should be selected.
   * @returns *void* - Success.
   * @returns *{@link core!SDKError | SDKError}* - If no corresponding {@link viewer!View | View} is found.
   */
  setSelected(viewIndex: number, selected: boolean): void | SDKError;

  /**
   * Controls whether the {@link viewer!ViewObject | ViewObject} should be culled (hidden) from a specific {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param culled - Whether to cull the object.
   * @returns *void* - Success.
   * @returns *{@link core!SDKError | SDKError}* - If no corresponding {@link viewer!View | View} is found.
   */
  setCulled(viewIndex: number, culled: boolean): void | SDKError;

  /**
   * Sets whether section plane clipping is applied to the {@link viewer!ViewObject | ViewObject} in a given {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param clippable - Whether clipping should be applied.
   * @returns *void* - Success.
   * @returns *{@link core!SDKError | SDKError}* - If no corresponding {@link viewer!View | View} is found.
   */
  setClippable(viewIndex: number, clippable: boolean): void | SDKError;

  /**
   * Determines whether the {@link viewer!ViewObject | ViewObject} participates in boundary calculations and collisions.
   *
   * @param viewIndex - Index of the View.
   * @param collidable - Whether the object should be collidable.
   * @returns *void* - Success.
   * @returns *{@link core!SDKError | SDKError}* - If no corresponding {@link viewer!View | View} is found.
   */
  setCollidable(viewIndex: number, collidable: boolean): void | SDKError;

  /**
   * Determines whether the {@link viewer!ViewObject | ViewObject} can be picked within a given {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param pickable - Whether the object should be pickable.
   * @returns *void* - Success.
   * @returns *{@link core!SDKError | SDKError}* - If no corresponding {@link viewer!View | View} is found.
   */
  setPickable(viewIndex: number, pickable: boolean): void | SDKError;

  /**
   * Applies a color to the {@link viewer!ViewObject | ViewObject} in a given {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param color - The color to apply.
   * @returns *void* - Success.
   * @returns *{@link core!SDKError | SDKError}* - If no corresponding {@link viewer!View | View} is found.
   */
  setColorize(viewIndex: number, color?: FloatArrayParam): void | SDKError;

  /**
   * Adjusts the opacity of the {@link viewer!ViewObject | ViewObject} in a given {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param opacity - The opacity level to set.
   * @returns *void* - Success.
   * @returns *{@link core!SDKError | SDKError}* - If no corresponding {@link viewer!View | View} is found.
   */
  setOpacity(viewIndex: number, opacity?: number): void | SDKError;
}
