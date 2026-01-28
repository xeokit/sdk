import { SDKError } from "../core";
/**
 * An object within a {@link viewer!View | View}.
 *
 * ## Summary
 *
 * * Proxies a {@link scene!SceneObject | SceneObject} and controls its visual state in the View.
 * * Stored in {@link View.objects | View.objects} and {@link viewer!ViewLayer.objects | ViewLayer.objects}.
 * * Viewer automatically creates one of these in each {@link viewer!View | View} whenever a {@link scene!SceneModel | SceneObject} is created.
 * * {@link scene!SceneObject.layerId | SceneObject.layerId} optionally specifies a {@link viewer!ViewLayer | ViewLayers} to put the ViewObject in.
 *
 * ## Overview
 *
 * Every View automatically maintains within itself a ViewObject for each {@link scene!SceneModel | SceneObject} that exists in the {@link viewer!Viewer | Viewer}.
 *
 * Whenever we create a SceneObject, each View will automatically create a corresponding ViewObject within itself. When
 * we destroy a SceneObject, each View will automatically destroy its corresponding ViewObject. The ViewObjects in a View
 * are therefore a manifest of the ViewerObjects in the View.
 *
 * {@link viewer!ViewLayer}.
 */
export class ViewObject {
    /**
     * Unique ID of this ViewObject within {@link viewer!ViewLayer.objects}.
     */
    id;
    /**
     * ID of this ViewObject within the originating system.
     */
    originalSystemId;
    /**
     * The ViewLayer to which this ViewObject belongs.
     */
    layer;
    /**
     * The corresponding {@link scene!SceneObject}.
     */
    sceneObject;
    /**
     * The corresponding {@link RendererObject}.
     * @internal
     */
    #rendererObject;
    #state;
    /**
     * @private
     */
    constructor(layer, sceneObject, rendererObject) {
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
        // this.#sceneObjectRendererProxy.initFlags(this._layer.view.viewIndex, this.#state);
        this.layer.objectVisibilityUpdated(this, this.#state.visible, true);
        //this.#sceneObjectRendererProxy.setClippable(this._layer.view.viewIndex, this.#state.clippable);
        this.#rendererObject.setPickable(this.layer.view.viewIndex, this.#state.pickable);
    }
    /**
     * Gets the World-space axis-aligned 3D boundary of this ViewObject.
     */
    get aabb() {
        return this.sceneObject.aabb;
    }
    /**
     * Gets if this ViewObject is visible.
     *
     * * When {@link viewer!ViewObject.visible} is ````true```` the ViewObject will be registered by {@link viewer!ViewObject.id} in {@link viewer!ViewLayer.visibleObjects}.
     * * Each ViewObject is only rendered when {@link viewer!ViewObject.visible} is ````true```` and {@link viewer!ViewObject.culled} is ````false````.
     * * Use {@link viewer!ViewLayer.setObjectsVisible} to batch-update the visibility of ViewObjects, which fires a single event for the batch.
     */
    get visible() {
        return this.#state.visible;
    }
    /**
     * Sets if this ViewObject is visible.
     *
     * * When {@link viewer!ViewObject.visible} is ````true```` the ViewObject will be registered by {@link viewer!ViewObject.id} in {@link viewer!ViewLayer.visibleObjects}.
     * * Each ViewObject is only rendered when {@link viewer!ViewObject.visible} is ````true```` and {@link viewer!ViewObject.culled} is ````false````.
     * * Fires an "objectVisibility" event on associated {@link viewer!ViewLayer}s.
     * * Use {@link viewer!ViewLayer.setObjectsVisible} to batch-update the visibility of ViewObjects, which fires a single event for the batch.
     */
    set visible(visible) {
        if (visible === this.#state.visible) {
            return;
        }
        this.#state.visible = visible;
        const result = this.#rendererObject.setVisible(this.layer.view.viewIndex, visible);
        if (result instanceof SDKError) {
            throw result;
        }
        this.layer.objectVisibilityUpdated(this, visible, true);
        this.layer.needsRedraw();
    }
    /**
     * Gets if this ViewObject is X-rayed.
     *
     * * When {@link viewer!ViewObject.xrayed} is ````true```` the ViewObject will be registered by {@link viewer!ViewObject.id} in {@link viewer!ViewLayer.xrayedObjects | ViewLayer.xrayedObjects}.
     * * Use {@link viewer!ViewLayer.setObjectsXRayed} to batch-update the X-rayed state of ViewObjects.
     */
    get xrayed() {
        return this.#state.xrayed;
    }
    /**
     * Sets if this ViewObject is X-rayed.
     *
     * * When {@link viewer!ViewObject.xrayed} is ````true```` the ViewObject will be registered by {@link viewer!ViewObject.id} in {@link viewer!ViewLayer.xrayedObjects | ViewLayer.xrayedObjects}.
     * * Use {@link viewer!ViewLayer.setObjectsXRayed} to batch-update the X-rayed state of ViewObjects.
     */
    set xrayed(xrayed) {
        if (this.#state.xrayed === xrayed) {
            return;
        }
        this.#state.xrayed = xrayed;
        const result = this.#rendererObject.setXRayed(this.layer.view.viewIndex, xrayed);
        if (result instanceof SDKError) {
            throw result;
        }
        this.layer.objectXRayedUpdated(this, xrayed);
        this.layer.needsRedraw();
    }
    /**
     * Gets if this ViewObject is highlighted.
     *
     * * When {@link viewer!ViewObject.highlighted} is ````true```` the ViewObject will be registered by {@link viewer!ViewObject.id} in {@link viewer!ViewLayer.highlightedObjects | ViewLayer.highlightedObjects}.
     * * Use {@link viewer!ViewLayer.setObjectsHighlighted} to batch-update the highlighted state of ViewObjects.
     */
    get highlighted() {
        return this.#state.highlighted;
    }
    /**
     * Sets if this ViewObject is highlighted.
     *
     * * When {@link viewer!ViewObject.highlighted} is ````true```` the ViewObject will be registered by {@link viewer!ViewObject.id} in {@link viewer!ViewLayer.highlightedObjects | ViewLayer.highlightedObjects}.
     * * Use {@link viewer!ViewLayer.setObjectsHighlighted} to batch-update the highlighted state of ViewObjects.
     */
    set highlighted(highlighted) {
        if (highlighted === this.#state.highlighted) {
            return;
        }
        this.#state.highlighted = highlighted;
        const result = this.#rendererObject.setHighlighted(this.layer.view.viewIndex, highlighted);
        if (result instanceof SDKError) {
            throw result;
        }
        this.layer.objectHighlightedUpdated(this, highlighted);
        this.layer.needsRedraw();
    }
    /**
     * Gets if this ViewObject is selected.
     *
     * * When {@link viewer!ViewObject.selected} is ````true```` the ViewObject will be registered by {@link viewer!ViewObject.id} in {@link viewer!ViewLayer.selectedObjects | ViewLayer.selectedObjects}.
     * * Use {@link viewer!ViewLayer.setObjectsSelected} to batch-update the selected state of ViewObjects.
     */
    get selected() {
        return this.#state.selected;
    }
    /**
     * Sets if this ViewObject is selected.
     *
     * * When {@link viewer!ViewObject.selected} is ````true```` the ViewObject will be registered by {@link viewer!ViewObject.id} in {@link viewer!ViewLayer.selectedObjects | ViewLayer.selectedObjects}.
     * * Use {@link viewer!ViewLayer.setObjectsSelected} to batch-update the selected state of ViewObjects.
     */
    set selected(selected) {
        if (selected === this.#state.selected) {
            return;
        }
        this.#state.selected = selected;
        const result = this.#rendererObject.setSelected(this.layer.view.viewIndex, selected);
        if (result instanceof SDKError) {
            throw result;
        }
        this.layer.objectSelectedUpdated(this, selected);
        this.layer.needsRedraw();
    }
    /**
     * Gets if this ViewObject is culled.
     *
     * * The ViewObject is only rendered when {@link viewer!ViewObject.visible} is ````true```` and {@link viewer!ViewObject.culled} is ````false````.
     * * Use {@link viewer!ViewLayer.setObjectsCulled} to batch-update the culled state of ViewObjects.
     */
    get culled() {
        return this.#state.culled;
    }
    /**
     * Sets if this ViewObject is culled.
     *
     * * The ViewObject is only rendered when {@link viewer!ViewObject.visible} is ````true```` and {@link viewer!ViewObject.culled} is ````false````.
     * * Use {@link viewer!ViewLayer.setObjectsCulled} to batch-update the culled state of ViewObjects.
     */
    set culled(culled) {
        if (culled === this.#state.culled) {
            return;
        }
        const result = this.#rendererObject.setCulled(this.layer.view.viewIndex, culled);
        if (result instanceof SDKError) {
            throw result;
        }
        this.#state.culled = culled;
        this.layer.needsRedraw();
    }
    /**
     * Gets if this ViewObject is clippable.
     *
     * * Clipping is done by the {@link SectionPlane}s in {@link viewer!ViewLayer.sectionPlanes}.
     * * Use {@link viewer!ViewLayer.setObjectsClippable} to batch-update the clippable state of ViewObjects.
     */
    get clippable() {
        return this.#state.clippable;
    }
    /**
     * Sets if this ViewObject is clippable.
     *
     * * Clipping is done by the {@link SectionPlane}s in {@link viewer!ViewLayer.sectionPlanes}.
     * * Use {@link viewer!ViewLayer.setObjectsClippable} to batch-update the clippable state of ViewObjects.
     */
    set clippable(clippable) {
        if (clippable === this.#state.clippable) {
            return;
        }
        const result = this.#rendererObject.setCulled(this.layer.view.viewIndex, clippable);
        if (result instanceof SDKError) {
            throw result;
        }
        this.#state.clippable = clippable;
        this.layer.needsRedraw();
    }
    /**
     * Gets if this ViewObject is included in boundary calculations.
     *
     * * When ````true````, the 3D World boundaries returned by {@link viewer!ViewLayer.aabb} will include this ViewObject's boundary.
     * * The ViewObject's 3D boundary is held in {@link scene!SceneObject.aabb}.
     * * Use {@link viewer!ViewLayer.setObjectsCollidable} to batch-update the collidable state of ViewObjects.
     */
    get collidable() {
        return this.#state.collidable;
    }
    /**
     * Sets if this ViewObject included in boundary calculations.
     *
     * * When ````true````, the 3D World boundaries returned by {@link viewer!ViewLayer.aabb} will include this ViewObject's boundary.
     * * The ViewObject's 3D boundary is held in {@link scene!SceneObject.aabb}.
     * * Use {@link viewer!ViewLayer.setObjectsCollidable} to batch-update the collidable state of ViewObjects.
     */
    set collidable(collidable) {
        if (collidable === this.#state.collidable) {
            return;
        }
        const result = this.#rendererObject.setCollidable(this.layer.view.viewIndex, collidable);
        if (result instanceof SDKError) {
            throw result;
        }
        this.#state.collidable = collidable;
        // this._setAABBDirty();
        // this._layer._aabbDirty = true;
    }
    /**
     * Gets if this ViewObject is pickable.
     *
     * * Picking is done with {@link viewer!View.pick}.
     * * Use {@link viewer!ViewLayer.setObjectsPickable} to batch-update the pickable state of ViewObjects.
     */
    get pickable() {
        return this.#state.pickable;
    }
    /**
     * Sets if this ViewObject is pickable.
     *
     * * Picking is done with {@link viewer!View.pick}.
     * * Use {@link viewer!ViewLayer.setObjectsPickable} to batch-update the pickable state of ViewObjects.
     */
    set pickable(pickable) {
        if (this.#state.pickable === pickable) {
            return;
        }
        const result = this.#rendererObject.setPickable(this.layer.view.viewIndex, pickable);
        if (result instanceof SDKError) {
            throw result;
        }
        this.#state.pickable = pickable;
        // No need to trigger a draw;
        // state is only used when picking
    }
    /**
     * Gets the RGB colorize color for this ViewObject.
     *
     * * Multiplies by rendered fragment colors.
     * * Each element of the color is in range ````[0..1]````.
     * * Use {@link viewer!ViewLayer.setObjectsColorized} to batch-update the colorized state of ViewObjects.
     */
    get colorize() {
        return this.#state.colorize;
    }
    /**
     * Sets the RGB colorize color for this ViewObject.
     *
     * * Multiplies by rendered fragment colors.
     * * Each element of the color is in range ````[0..1]````.
     * * Set to ````null```` or ````undefined```` to reset the colorize color to its default value of ````[1,1,1]````.
     * * Use {@link viewer!ViewLayer.setObjectsColorized} to batch-update the colorized state of ViewObjects.
     */
    set colorize(value) {
        let colorize = this.#state.colorize;
        if (value) {
            colorize[0] = value[0];
            colorize[1] = value[1];
            colorize[2] = value[2];
        }
        else {
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
        this.layer.needsRedraw();
    }
    /**
     * Gets the opacity factor for this ViewObject.
     *
     * * This is a factor in range ````[0..1]```` which multiplies by the rendered fragment alphas.
     * * Use {@link viewer!ViewLayer.setObjectsOpacity} to batch-update the opacities of ViewObjects.
     */
    get opacity() {
        return this.#state.colorize[3];
    }
    /**
     * Sets the opacity factor for this ViewObject.
     *
     * * This is a factor in range ````[0..1]```` which multiplies by the rendered fragment alphas.
     * * Set to ````null```` or ````undefined```` to reset the opacity to its default value of ````1````.
     * * Use {@link viewer!ViewLayer.setObjectsOpacity} to batch-update the opacities of ViewObjects.
     */
    set opacity(opacity) {
        let colorize = this.#state.colorize;
        this.#state.opacityUpdated = opacity !== null && opacity !== undefined;
        // @ts-ignore
        colorize[3] = this.#state.opacityUpdated ? opacity : 1.0;
        this.layer.objectOpacityUpdated(this, this.#state.opacityUpdated);
        this.layer.needsRedraw();
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
        this.layer.needsRedraw();
    }
}
//# sourceMappingURL=ViewObject.js.map
