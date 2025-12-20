import type {FloatArrayParam, Vec3} from "../math";
import type {SceneObject} from "../scene";
import type {ViewLayer} from "./ViewLayer";
import {SDKErrorType} from "../core";

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

    private _visible: boolean;
    private _culled: boolean;
    private _pickable: boolean;
    private _clippable: boolean;
    private _collidable: boolean;
    private _xrayed: boolean;
    private _selected: boolean;
    private _highlighted: boolean;
    private _colorize: FloatArrayParam;
    private _colorized: boolean;
    private _opacityUpdated: boolean;

    /**
     * True if this ViewObject has been destroyed.
     */
    public destroyed: boolean = false;

    /**
     * @private
     */
    constructor(layer: ViewLayer, sceneObject: SceneObject) {

        this.id = sceneObject.id;
        this.originalSystemId = sceneObject.originalSystemId;
        this.layer = layer;
        this.sceneObject = sceneObject;

        this._visible = true;
        this._culled = false;
        this._pickable = true;
        this._clippable = true;
        this._collidable = true;
        this._xrayed = false;
        this._selected = false;
        this._highlighted = false;
        this._colorize = new Float32Array(4);
        this._colorized = false;
        this._opacityUpdated = false;

        this.layer.objectVisibilityUpdated(this, this._visible, true);
    }

    /**
     * Gets if this ViewObject is visible.
     *
     * * When {@link ViewObject.visible} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.visibleObjects}.
     * * Each ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Use {@link ViewLayer.setObjectsVisible} to batch-update the visibility of ViewObjects, which fires a single event for the batch.
     */
    get visible(): boolean {
        return this._visible;
    }

    /**
     * Sets if this ViewObject is visible.
     *
     * * When {@link ViewObject.visible} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.visibleObjects}.
     * * Each ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Fires an "objectVisibility" event on  {@link ViewerEvents}.
     * * Use {@link ViewLayer.setObjectsVisible} to batch-update the visibility of ViewObjects, which fires a single event for the batch.
     */
    set visible(visible: boolean) {
        if (this.destroyed) {
            this.layer.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[ViewObject.visible] ViewObject already destroyed"
            });
            return;
        }
        if (visible === this._visible) {
            return;
        }
        this._visible = visible;
        this.layer.objectVisibilityUpdated(this, visible, true);
    }

    /**
     * Gets if this ViewObject is X-rayed.
     *
     * * When {@link ViewObject.xrayed} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.xrayedObjects | ViewLayer.xrayedObjects}.
     * * Use {@link ViewLayer.setObjectsXRayed} to batch-update the X-rayed state of ViewObjects.
     */
    get xrayed(): boolean {
        return this._xrayed;
    }

    /**
     * Sets if this ViewObject is X-rayed.
     *
     * * When {@link ViewObject.xrayed} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.xrayedObjects | ViewLayer.xrayedObjects}.
     * * Use {@link ViewLayer.setObjectsXRayed} to batch-update the X-rayed state of ViewObjects.
     */
    set xrayed(xrayed: boolean) {
        if (this.destroyed) {
            this.layer.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[ViewObject.xrayed] ViewObject already destroyed"
            });
            return;
        }
        if (this._xrayed === xrayed) {
            return;
        }
        this._xrayed = xrayed;
        this.layer.objectXRayedUpdated(this, xrayed);
    }

    /**
     * Gets if this ViewObject is highlighted.
     *
     * * When {@link ViewObject.highlighted} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.highlightedObjects | ViewLayer.highlightedObjects}.
     * * Use {@link ViewLayer.setObjectsHighlighted} to batch-update the highlighted state of ViewObjects.
     */
    get highlighted(): boolean {
        return this._highlighted;
    }

    /**
     * Sets if this ViewObject is highlighted.
     *
     * * When {@link ViewObject.highlighted} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.highlightedObjects | ViewLayer.highlightedObjects}.
     * * Use {@link ViewLayer.setObjectsHighlighted} to batch-update the highlighted state of ViewObjects.
     */
    set highlighted(highlighted: boolean) {
        if (this.destroyed) {
            this.layer.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[ViewObject.highlighted] ViewObject already destroyed"
            });
            return;
        }
        if (highlighted === this._highlighted) {
            return;
        }
        this._highlighted = highlighted;
        this.layer.objectHighlightedUpdated(this, highlighted);
    }

    /**
     * Gets if this ViewObject is selected.
     *
     * * When {@link ViewObject.selected} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.selectedObjects | ViewLayer.selectedObjects}.
     * * Use {@link ViewLayer.setObjectsSelected} to batch-update the selected state of ViewObjects.
     */
    get selected(): boolean {
        return this._selected;
    }

    /**
     * Sets if this ViewObject is selected.
     *
     * * When {@link ViewObject.selected} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.selectedObjects | ViewLayer.selectedObjects}.
     * * Use {@link ViewLayer.setObjectsSelected} to batch-update the selected state of ViewObjects.
     */
    set selected(selected: boolean) {
        if (this.destroyed) {
            this.layer.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[ViewObject.selected] ViewObject already destroyed"
            });
            return;
        }
        if (selected === this._selected) {
            return;
        }
        this._selected = selected;
        this.layer.objectSelectedUpdated(this, selected);
    }

    /**
     * Gets if this ViewObject is culled.
     *
     * * The ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Use {@link ViewLayer.setObjectsCulled} to batch-update the culled state of ViewObjects.
     */
    get culled(): boolean {
        return this._culled;
    }

    /**
     * Sets if this ViewObject is culled.
     *
     * * The ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Use {@link ViewLayer.setObjectsCulled} to batch-update the culled state of ViewObjects.
     */
    set culled(culled: boolean) {
        if (this.destroyed) {
            this.layer.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[ViewObject.culled] ViewObject already destroyed"
            });
            return;
        }
        if (culled === this._culled) {
            return;
        }
        // this.sceneObject.sceneObjectRendererProxy.setCulled(this.layer.view.viewIndex, culled);
        this._culled = culled;
    }

    /**
     * Gets if this ViewObject is clippable.
     *
     * * Clipping is done by the {@link SectionPlane | SectionPlanes} in {@link View.sectionPlanes | View.sectionPlanes}.
     * * Use {@link View.setObjectsClippable | View.setObjectsClippable} or {@link ViewLayer.setObjectsClippable | ViewLayer.setObjectsClippable} to batch-update the clippable state of multiple ViewObjects.
     */
    get clippable(): boolean {
        return this._clippable;
    }

    /**
     * Sets if this ViewObject is clippable.
     *
     * * Clipping is done by the {@link SectionPlane | SectionPlanes} in {@link View.sectionPlanes | View.sectionPlanes}.
     * * Use {@link View.setObjectsClippable | View.setObjectsClippable} or {@link ViewLayer.setObjectsClippable | ViewLayer.setObjectsClippable} to batch-update the clippable state of multiple ViewObjects.
     */
    set clippable(clippable: boolean) {
        if (this.destroyed) {
            this.layer.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[ViewObject.clippable] ViewObject already destroyed"
            });
            return;
        }
        if (clippable === this._clippable) {
            return;
        }
        // this.sceneObject.sceneObjectRendererProxy.setCulled(this.layer.view.viewIndex, clippable);
        this._clippable = clippable;
    }

    /**
     * Gets if this ViewObject is included in boundary calculations.
     */
    get collidable(): boolean {
        return this._collidable;
    }

    /**
     * Sets if this ViewObject included in boundary calculations.
     */
    set collidable(collidable: boolean) {
        if (this.destroyed) {
            this.layer.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[ViewObject.collidable] ViewObject already destroyed"
            });
            return;
        }
        if (collidable === this._collidable) {
            return;
        }
        // const result = this.sceneObject.sceneObjectRendererProxy.setCollidable(this._layer.view.viewIndex, collidable);
        // if (result instanceof SDKError) {
        //     throw result;
        // }
        this._collidable = collidable;
        // this._setAABBDirty();
        // this._layer._aabbDirty = true;
    }

    /**
     * Gets if this ViewObject is pickable.
     *
     * * Picking is done with {@link View.pick}.
     * * Use {@link ViewLayer.setObjectsPickable} to batch-update the pickable state of ViewObjects.
     */
    get pickable(): boolean {
        return this._pickable;
    }

    /**
     * Sets if this ViewObject is pickable.
     *
     * * Picking is done with {@link View.pick}.
     * * Use {@link ViewLayer.setObjectsPickable} to batch-update the pickable state of ViewObjects.
     */
    set pickable(pickable: boolean) {
        if (this.destroyed) {
            this.layer.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[ViewObject.pickable] ViewObject already destroyed"
            });
            return;
        }
        if (this._pickable === pickable) {
            return;
        }
        //
        this._pickable = pickable;
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
    get colorize(): Vec3 {
        return this._colorize;
    }

    /**
     * Sets the RGB colorize color for this ViewObject.
     *
     * * Multiplies by rendered fragment colors.
     * * Each element of the color is in range ````[0..1]````.
     * * Set to ````null```` or ````undefined```` to reset the colorize color to its default value of ````[1,1,1]````.
     * * Use {@link ViewLayer.setObjectsColorized} to batch-update the colorized state of ViewObjects.
     */
    set colorize(value: Vec3 | undefined | null) {
        if (this.destroyed) {
            this.layer.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[ViewObject.colorize] ViewObject already destroyed"
            });
            return;
        }
        const colorize = this._colorize;
        if (value) {
            colorize[0] = value[0];
            colorize[1] = value[1];
            colorize[2] = value[2];
        } else {
            colorize[0] = 1;
            colorize[1] = 1;
            colorize[2] = 1;
        }
        this._colorized = !!value;
        this.layer.objectColorizeUpdated(this, this._colorized);
    }

    /**
     * Gets the opacity factor for this ViewObject.
     *
     * * This is a factor in range ````[0..1]```` which multiplies by the rendered fragment alphas.
     * * Use {@link ViewLayer.setObjectsOpacity} to batch-update the opacities of ViewObjects.
     */
    get opacity(): number {
        return this._colorize[3];
    }

    /**
     * Sets the opacity factor for this ViewObject.
     *
     * * This is a factor in range ````[0..1]```` which multiplies by the rendered fragment alphas.
     * * Set to ````null```` or ````undefined```` to reset the opacity to its default value of ````1````.
     * * Use {@link ViewLayer.setObjectsOpacity} to batch-update the opacities of ViewObjects.
     */
    set opacity(opacity: number | undefined | null) {
        if (this.destroyed) {
            this.layer.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[ViewObject.opacity] ViewObject already destroyed"
            });
            return;
        }
        const colorize = this._colorize;
        this._opacityUpdated = opacity !== null && opacity !== undefined;
        // @ts-ignore
        colorize[3] = this._opacityUpdated ? opacity : 1.0;
        this.layer.objectOpacityUpdated(this, this._opacityUpdated);
    }

    /**
     * @private
     */
    _destroy() {
        // Called by ViewLayer#destroyViewObjects
        if (this._visible) {
            this.layer.objectVisibilityUpdated(this, false, false);
        }
        if (this._xrayed) {
            this.layer.objectXRayedUpdated(this, false);
        }
        if (this._selected) {
            this.layer.objectSelectedUpdated(this, false);
        }
        if (this._highlighted) {
            this.layer.objectHighlightedUpdated(this, false);
        }
        if (this._colorized) {
            this.layer.objectColorizeUpdated(this, false);
        }
        if (this._opacityUpdated) {
            this.layer.objectOpacityUpdated(this, false);
        }
    }
}

