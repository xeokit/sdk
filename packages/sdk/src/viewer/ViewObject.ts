import type { FloatArrayParam } from "../math";

import type { ViewLayer } from "./ViewLayer";
import type { SceneObject } from "../scene";
import type { RendererObject } from "../scene";
import { SDKError } from "../core";

/**
 * An object within a {@link View | View}.
 *
 * * Proxies a {@link scene!SceneObject | SceneObject} and controls its visual state in the View.
 * * Stored in {@link View.objects | View.objects} and {@link ViewLayer.objects | ViewLayer.objects}.
 * * Viewer automatically creates one of these in each {@link View | View} whenever a {@link scene!SceneModel | SceneObject} is created.
 * * {@link scene!SceneObject.layerId | SceneObject.layerId} optionally specifies a {@link ViewLayer | ViewLayer} to put the ViewObject in.
 *
 * ## Overview
 *
 * Every View automatically maintains within itself a ViewObject for each {@link scene!SceneModel | SceneObject} that exists in the {@link Viewer | Viewer}.
 *
 * Whenever we create a SceneObject, each View will automatically create a corresponding ViewObject within itself. When
 * we destroy a SceneObject, each View will automatically destroy its corresponding ViewObject. The ViewObjects in a View
 * are therefore a manifest of the ViewerObjects in the View.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage.
 */
export class ViewObject {

  /**
     * Unique ID of this ViewObject within {@link ViewLayer.objects}.
     */
  public readonly id: string;

  /**
     * ID of this ViewObject within the originating system.
     */
  public readonly originalSystemId: string;

  /**
     * The ViewLayer to which this ViewObject belongs.
     */
  public readonly layer: ViewLayer;

  /**
     * The corresponding {@link scene!SceneObject}.
     */
  public readonly sceneObject: SceneObject;

  /**
     * The corresponding {@link RendererObject}.
     * @internal
     */
  #rendererObject: RendererObject;

  #state: {
    visible: boolean;
    culled: boolean;
    pickable: boolean;
    clippable: boolean;
    collidable: boolean;
    xrayed: boolean;
    selected: boolean;
    highlighted: boolean;
    colorize: Float32Array;
    colorized: boolean;
    opacityUpdated: boolean;
  };

  /**
     * @private
     */
  constructor(layer: ViewLayer, sceneObject: SceneObject, rendererObject: RendererObject) {

    this.id = sceneObject.id;
    this.originalSystemId = sceneObject.originalSystemId;
    this.layer = layer;
    this.sceneObject = sceneObject;
    this.#rendererObject = rendererObject;

    this.#state = {
      visible: true,
      culled: false,
      pickable: true,
      clippable: true,
      collidable: true,
      xrayed: false,
      selected: false,
      highlighted: false,
      colorize: new Float32Array(4),
      colorized: false,
      opacityUpdated: false,
    };

    this.#rendererObject.setVisible(this.layer.view.viewIndex, this.#state.visible);

    // this.#rendererObject.initFlags(this.layer.view.viewIndex, this.#state);

    this.layer.objectVisibilityUpdated(this, this.#state.visible, true);

    //this.#rendererObject.setClippable(this.layer.view.viewIndex, this.#state.clippable);

    this.#rendererObject.setPickable(this.layer.view.viewIndex, this.#state.pickable);
  }

  /**
     * Gets the World-space axis-aligned 3D boundary of this ViewObject.
     */
  get aabb(): FloatArrayParam {
    return this.sceneObject.aabb;
  }

  /**
     * Gets if this ViewObject is visible.
     *
     * * When {@link ViewObject.visible} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.visibleObjects}.
     * * Each ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Use {@link ViewLayer.setObjectsVisible} to batch-update the visibility of ViewObjects, which fires a single event for the batch.
     */
  get visible(): boolean {
    return this.#state.visible;
  }

  /**
     * Sets if this ViewObject is visible.
     *
     * * When {@link ViewObject.visible} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.visibleObjects}.
     * * Each ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Fires an "objectVisibility" event on associated {@link ViewLayer}s.
     * * Use {@link ViewLayer.setObjectsVisible} to batch-update the visibility of ViewObjects, which fires a single event for the batch.
     */
  set visible(visible: boolean) {
    if (visible === this.#state.visible) {
      return;
    }
    this.#state.visible = visible;
    const result = this.#rendererObject.setVisible(this.layer.view.viewIndex, visible);
    if (result instanceof SDKError) {
      throw result;
    }
    this.layer.objectVisibilityUpdated(this, visible, true);
    this.layer.redraw();
  }

  /**
     * Gets if this ViewObject is X-rayed.
     *
     * * When {@link ViewObject.xrayed} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.xrayedObjects | ViewLayer.xrayedObjects}.
     * * Use {@link ViewLayer.setObjectsXRayed} to batch-update the X-rayed state of ViewObjects.
     */
  get xrayed(): boolean {
    return this.#state.xrayed;
  }

  /**
     * Sets if this ViewObject is X-rayed.
     *
     * * When {@link ViewObject.xrayed} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.xrayedObjects | ViewLayer.xrayedObjects}.
     * * Use {@link ViewLayer.setObjectsXRayed} to batch-update the X-rayed state of ViewObjects.
     */
  set xrayed(xrayed: boolean) {
    if (this.#state.xrayed === xrayed) {
      return;
    }
    this.#state.xrayed = xrayed;
    const result = this.#rendererObject.setXRayed(this.layer.view.viewIndex, xrayed);
    if (result instanceof SDKError) {
      throw result;
    }
    this.layer.objectXRayedUpdated(this, xrayed);
    this.layer.redraw();
  }

  /**
     * Gets if this ViewObject is highlighted.
     *
     * * When {@link ViewObject.highlighted} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.highlightedObjects | ViewLayer.highlightedObjects}.
     * * Use {@link ViewLayer.setObjectsHighlighted} to batch-update the highlighted state of ViewObjects.
     */
  get highlighted(): boolean {
    return this.#state.highlighted;
  }

  /**
     * Sets if this ViewObject is highlighted.
     *
     * * When {@link ViewObject.highlighted} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.highlightedObjects | ViewLayer.highlightedObjects}.
     * * Use {@link ViewLayer.setObjectsHighlighted} to batch-update the highlighted state of ViewObjects.
     */
  set highlighted(highlighted: boolean) {
    if (highlighted === this.#state.highlighted) {
      return;
    }
    this.#state.highlighted = highlighted;
    const result = this.#rendererObject.setHighlighted(this.layer.view.viewIndex, highlighted);
    if (result instanceof SDKError) {
      throw result;
    }
    this.layer.objectHighlightedUpdated(this, highlighted);
    this.layer.redraw();
  }

  /**
     * Gets if this ViewObject is selected.
     *
     * * When {@link ViewObject.selected} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.selectedObjects | ViewLayer.selectedObjects}.
     * * Use {@link ViewLayer.setObjectsSelected} to batch-update the selected state of ViewObjects.
     */
  get selected(): boolean {
    return this.#state.selected;
  }

  /**
     * Sets if this ViewObject is selected.
     *
     * * When {@link ViewObject.selected} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.selectedObjects | ViewLayer.selectedObjects}.
     * * Use {@link ViewLayer.setObjectsSelected} to batch-update the selected state of ViewObjects.
     */
  set selected(selected: boolean) {
    if (selected === this.#state.selected) {
      return;
    }
    this.#state.selected = selected;
    const result = this.#rendererObject.setSelected(this.layer.view.viewIndex, selected);
    if (result instanceof SDKError) {
      throw result;
    }
    this.layer.objectSelectedUpdated(this, selected);
    this.layer.redraw();
  }

  /**
     * Gets if this ViewObject is culled.
     *
     * * The ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Use {@link ViewLayer.setObjectsCulled} to batch-update the culled state of ViewObjects.
     */
  get culled(): boolean {
    return this.#state.culled;
  }

  /**
     * Sets if this ViewObject is culled.
     *
     * * The ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Use {@link ViewLayer.setObjectsCulled} to batch-update the culled state of ViewObjects.
     */
  set culled(culled: boolean) {
    if (culled === this.#state.culled) {
      return;
    }
    const result = this.#rendererObject.setCulled(this.layer.view.viewIndex, culled);
    if (result instanceof SDKError) {
      throw result;
    }
    this.#state.culled = culled;
    this.layer.redraw();
  }

  /**
     * Gets if this ViewObject is clippable.
     *
     * * Clipping is done by the {@link SectionPlane | SectionPlanes} in {@link View.sectionPlanes | View.sectionPlanes}.
     * * Use {@link View.setObjectsClippable | View.setObjectsClippable} or {@link ViewLayer.setObjectsClippable | ViewLayer.setObjectsClippable} to batch-update the clippable state of multiple ViewObjects.
     */
  get clippable(): boolean {
    return this.#state.clippable;
  }

  /**
     * Sets if this ViewObject is clippable.
     *
     * * Clipping is done by the {@link SectionPlane | SectionPlanes} in {@link View.sectionPlanes | View.sectionPlanes}.
     * * Use {@link View.setObjectsClippable | View.setObjectsClippable} or {@link ViewLayer.setObjectsClippable | ViewLayer.setObjectsClippable} to batch-update the clippable state of multiple ViewObjects.
     */
  set clippable(clippable: boolean) {
    if (clippable === this.#state.clippable) {
      return;
    }
    const result = this.#rendererObject.setCulled(this.layer.view.viewIndex, clippable);
    if (result instanceof SDKError) {
      throw result;
    }
    this.#state.clippable = clippable;
    this.layer.redraw();
  }

  /**
     * Gets if this ViewObject is included in boundary calculations.
     */
  get collidable(): boolean {
    return this.#state.collidable;
  }

  /**
     * Sets if this ViewObject included in boundary calculations.
     */
  set collidable(collidable: boolean) {
    if (collidable === this.#state.collidable) {
      return;
    }
    // const result = this.#rendererObject.setCollidable(this.layer.view.viewIndex, collidable);
    // if (result instanceof SDKError) {
    //     throw result;
    // }
    this.#state.collidable = collidable;
    // this._setAABBDirty();
    // this.layer._aabbDirty = true;
  }

  /**
     * Gets if this ViewObject is pickable.
     *
     * * Picking is done with {@link View.pick}.
     * * Use {@link ViewLayer.setObjectsPickable} to batch-update the pickable state of ViewObjects.
     */
  get pickable(): boolean {
    return this.#state.pickable;
  }

  /**
     * Sets if this ViewObject is pickable.
     *
     * * Picking is done with {@link View.pick}.
     * * Use {@link ViewLayer.setObjectsPickable} to batch-update the pickable state of ViewObjects.
     */
  set pickable(pickable: boolean) {
    if (this.#state.pickable === pickable) {
      return;
    }
    const result = this.#rendererObject.setPickable(this.layer.view.viewIndex, pickable);
    if (result instanceof SDKError) {
      throw result;
    }
    this.#state.pickable = pickable;
    // No need to trigger a render;
    // state is only used when picking
  }

  /**
     * Gets the RGB colorize color for this ViewObject.
     *
     * * Multiplies by rendered fragment colors.
     * * Each element of the color is in range ````[0..1]````.
     * * Use {@link ViewLayer.setObjectsColorized} to batch-update the colorized state of ViewObjects.
     */
  get colorize(): Float32Array {
    return this.#state.colorize;
  }

  /**
     * Sets the RGB colorize color for this ViewObject.
     *
     * * Multiplies by rendered fragment colors.
     * * Each element of the color is in range ````[0..1]````.
     * * Set to ````null```` or ````undefined```` to reset the colorize color to its default value of ````[1,1,1]````.
     * * Use {@link ViewLayer.setObjectsColorized} to batch-update the colorized state of ViewObjects.
     */
  set colorize(value: FloatArrayParam | undefined | null) {
    const colorize = this.#state.colorize;
    if (value) {
      colorize[0] = value[0];
      colorize[1] = value[1];
      colorize[2] = value[2];
    } else {
      colorize[0] = 1;
      colorize[1] = 1;
      colorize[2] = 1;
    }
    const result = this.#rendererObject.setColorize(this.layer.view.viewIndex, colorize);
    if (result instanceof SDKError) {
      throw result;
    }
    this.#state.colorized = !!value;
    this.layer.objectColorizeUpdated(this, this.#state.colorized);
    this.layer.redraw();
  }

  /**
     * Gets the opacity factor for this ViewObject.
     *
     * * This is a factor in range ````[0..1]```` which multiplies by the rendered fragment alphas.
     * * Use {@link ViewLayer.setObjectsOpacity} to batch-update the opacities of ViewObjects.
     */
  get opacity(): number {
    return this.#state.colorize[3];
  }

  /**
     * Sets the opacity factor for this ViewObject.
     *
     * * This is a factor in range ````[0..1]```` which multiplies by the rendered fragment alphas.
     * * Set to ````null```` or ````undefined```` to reset the opacity to its default value of ````1````.
     * * Use {@link ViewLayer.setObjectsOpacity} to batch-update the opacities of ViewObjects.
     */
  set opacity(opacity: number | undefined | null) {
    const colorize = this.#state.colorize;
    this.#state.opacityUpdated = opacity !== null && opacity !== undefined;
    // @ts-ignore
    colorize[3] = this.#state.opacityUpdated ? opacity : 1.0;
    this.layer.objectOpacityUpdated(this, this.#state.opacityUpdated);
    this.layer.redraw();
  }

  /**
     * @private
     */
  _destroy() {
    // Called by ViewLayer#destroyViewObjects
    if (this.#state.visible) {
      this.layer.objectVisibilityUpdated(this, false, false);
    }
    if (this.#state.xrayed) {
      this.layer.objectXRayedUpdated(this, false);
    }
    if (this.#state.selected) {
      this.layer.objectSelectedUpdated(this, false);
    }
    if (this.#state.highlighted) {
      this.layer.objectHighlightedUpdated(this, false);
    }
    if (this.#state.colorized) {
      this.layer.objectColorizeUpdated(this, false);
    }
    if (this.#state.opacityUpdated) {
      this.layer.objectOpacityUpdated(this, false);
    }
    this.layer.redraw();
  }
}

