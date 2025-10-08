import type {FloatArrayParam} from "../math";

/**
 * Interface through which a {@link viewer!ViewObject | ViewObject} controls the appearance of
 * a {@link SceneObject | SceneObject} in a {@link viewer!Viewer | Viewer}.
 *
 * While a {@link Scene | Scene} is attached to a {@link viewer!Viewer | Viewer}, the Viewer
 * attaches a SceneObjectRendererProxy to {@link SceneObject.sceneObjectRendererProxy | SceneObject.sceneObjectRendererProxy} on
 * each of the Scene's {@link SceneObject | SceneObjects}, to provide an interface through which
 * the Viewer's {@link viewer!ViewObject | ViewObjects} can control the appearance of the SceneObjects
 * within their respective {@link viewer!View | Views}.
 *
 * Internally, the Viewer's {@link viewer!Renderer} attaches these
 * to {@link SceneObject.sceneObjectRendererProxy | SceneObject.sceneObjectRendererProxy}. When we update properties
 * like {@link viewer!ViewObject.visible | ViewObject.visible}, the ViewObject will upload those
 * updates through this interface into the {@link viewer!Renderer}.
 *
 * When a View
 *
 * @internal
 */
export interface SceneObjectRendererProxy {

  /**
   * Controls the visibility of the {@link viewer!ViewObject | ViewObject} in a specific {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View. Matches {@link viewer!View.viewIndex | View.viewIndex} for an attached View.
   * @param visible - Whether the {@link viewer!ViewObject | ViewObject} should be visible.
   */
  setVisible(viewIndex: number, visible: boolean): void;

  /**
   * Toggles the highlighted state of the {@link viewer!ViewObject | ViewObject} in a specified {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param highlighted - Whether to highlight the {@link viewer!ViewObject | ViewObject}.
   */
  setHighlighted(viewIndex: number, highlighted: boolean): void;

  /**
   * Sets whether the {@link viewer!ViewObject | ViewObject} should appear X-rayed in a given {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param xrayed - Whether to apply the X-ray effect.
   */
  setXRayed(viewIndex: number, xrayed: boolean): void;

  /**
   * Marks the {@link viewer!ViewObject | ViewObject} as selected within a given {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param selected - Whether the object should be selected.
   */
  setSelected(viewIndex: number, selected: boolean): void;

  /**
   * Controls whether the {@link viewer!ViewObject | ViewObject} should be culled (hidden) from a specific {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param culled - Whether to cull the object.
   */
  setCulled(viewIndex: number, culled: boolean): void;

  /**
   * Sets whether section plane clipping is applied to the {@link viewer!ViewObject | ViewObject} in a given {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param clippable - Whether clipping should be applied.
   */
  setClippable(viewIndex: number, clippable: boolean): void;

  /**
   * Determines whether the {@link viewer!ViewObject | ViewObject} participates in boundary calculations and collisions.
   *
   * @param viewIndex - Index of the View.
   * @param collidable - Whether the object should be collidable.
   */
  setCollidable(viewIndex: number, collidable: boolean): void;

  /**
   * Determines whether the {@link viewer!ViewObject | ViewObject} can be picked within a given {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param pickable - Whether the object should be pickable.
   */
  setPickable(viewIndex: number, pickable: boolean): void;

  /**
   * Applies a color to the {@link viewer!ViewObject | ViewObject} in a given {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param color - The color to apply.
   */
  setColorize(viewIndex: number, color?: FloatArrayParam): void;

  /**
   * Adjusts the opacity of the {@link viewer!ViewObject | ViewObject} in a given {@link viewer!View | View}.
   *
   * @param viewIndex - Index of the View.
   * @param opacity - The opacity level to set.
   */
  setOpacity(viewIndex: number, opacity?: number): void;
}
