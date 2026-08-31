import type {Vec3} from "../../base/math/vector";
import type {SceneObject} from "../../model/scene";
import type {ViewLayer} from "./ViewLayer";
import {SDKErrorType, type SDKResult} from "../../base/core";
import {View} from "./View";
import {ViewTransform} from "./ViewTransform";

/**
 * An object within a {@link View | View}.
 *
 * * Proxies a {@link model!scene.SceneObject | SceneObject} and controls its visual state in the View.
 * * Stored in {@link View.objects | View.objects} and {@link ViewLayer.objects | ViewLayer.objects}.
 * * Viewer automatically creates one of these in each {@link View | View} whenever a {@link model!scene.SceneModel | SceneObject} is created.
 * * {@link model!scene.SceneObject.layerId | SceneObject.layerId} optionally specifies a {@link ViewLayer | ViewLayer} to put the ViewObject in.
 *
 * ## Overview
 *
 * Every View automatically maintains within itself a ViewObject for each {@link model!scene.SceneModel | SceneObject} that exists in the {@link Viewer | Viewer}.
 *
 * Whenever we create a SceneObject, each View will automatically create a corresponding ViewObject within itself. When
 * we destroy a SceneObject, each View will automatically destroy its corresponding ViewObject. The ViewObjects in a View
 * are therefore a manifest of the ViewerObjects in the View.
 *
 * See {@link viewing!viewer | @xeokit/sdk/viewing/viewer} for usage.
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
     * The View to which this ViewObject belongs.
     */
    public readonly view: View;

    /**
     * The ViewLayer to which this ViewObject belongs.
     */
    public readonly layer: ViewLayer;

    /**
     * The corresponding {@link model!scene.SceneObject | SceneObject}.
     */
    public readonly sceneObject: SceneObject;

    /**
     * The {@link ViewTransform} that defines the local transform of this ViewObject, if any.
     */
    public viewTransform: ViewTransform;

    private _flags: number;
    private _styleBinIds: Set<string> | null = null;
    // RGBA: [0..2] colorize, [3] opacity. Lazily allocated — most ViewObjects
    // are never colorized or opacity-overridden, and a Float32Array(4) costs
    // ~230 B in V8 (object + ArrayBuffer overhead), dwarfing its 16 B of data.
    // Null means the defaults [1, 1, 1, 1]; gated by the COLORIZED /
    // OPACITY_UPDATED flags.
    private _colorize: Vec3 | null = null;

    /**
     * True if this ViewObject has been destroyed.
     */
    public destroyed: boolean = false;

    private static readonly VISIBLE = 1 << 0;
    private static readonly CULLED = 1 << 1;
    private static readonly PICKABLE = 1 << 2;
    private static readonly CLIPPABLE = 1 << 3;
    private static readonly COLLIDABLE = 1 << 4;
    private static readonly COLORIZED = 1 << 5;
    private static readonly OPACITY_UPDATED = 1 << 6;

    /**
     * @private
     */
    constructor(layer: ViewLayer, sceneObject: SceneObject) {

        this.id = sceneObject.id;
        this.originalSystemId = sceneObject.originalSystemId;
        this.view = layer.view;
        this.layer = layer;
        this.sceneObject = sceneObject;
        this.viewTransform = null;

        // Initial flag set. CLIPPABLE is on by default but can be
        // opted out at creation time via `SceneObjectParams.clippable:
        // false` — useful for drawings, annotations, and other
        // overlay-style objects that should remain visible
        // (and pickable) regardless of any active section planes.
        let initialFlags =
            ViewObject.VISIBLE |
            ViewObject.PICKABLE |
            ViewObject.COLLIDABLE;
        if (sceneObject.clippable !== false) {
            initialFlags |= ViewObject.CLIPPABLE;
        }
        this._flags = initialFlags;

        this.layer.objectVisibilityUpdated(this, this.visible, false);
    }

    // /**
    //  * @private
    //  * @param viewTransform
    //  */
    // set viewTransform(viewTransform: ViewTransform) {
    //       if (this.destroyed) {
    //           this.layer.view.viewer.logError({
    //               ok: false,
    //               type: SDKErrorType.InvalidOperation,
    //               error: "[ViewObject.viewTransform] ViewObject already destroyed"
    //           });
    //           return;
    //       }
    //       this._viewTransform = viewTransform;
    //   //this.view.objectViewTransformUpdated(this, visible, notify);
    //   }
    //
    //   get viewTransform(): ViewTransform {
    //       return this._viewTransform;
    //   }

    /**
     * Gets if this ViewObject is visible.
     *
     * * When {@link ViewObject.visible} is ````true```` the ViewObject will be registered by {@link ViewObject.id} in {@link ViewLayer.visibleObjects}.
     * * Each ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Use {@link ViewLayer.setObjectsVisible} to batch-update the visibility of ViewObjects, which fires a single event for the batch.
     */
    get visible(): boolean {
        return (this._flags & ViewObject.VISIBLE) !== 0;
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
        if (visible === this.visible) {
            return;
        }
        this._setFlag(ViewObject.VISIBLE, visible);
        this.layer.objectVisibilityUpdated(this, visible, true);
    }

    // /**
    //  * Sets the visibility of a specific mesh within this ViewObject.
    //  * @param meshIndex
    //  * @param visible
    // */
    // setMeshVisible(meshIndex: number, visible: boolean) {
    //     if (this.destroyed) {
    //         this.layer.view.viewer.logError({
    //             ok: false,
    //             type: SDKErrorType.InvalidOperation,
    //             error: "[ViewObject.setMeshVisible] ViewObject already destroyed"
    //         });
    //         return;
    //     }
    //     this.layer.objectMeshVisibilityUpdated(this, meshIndex, visible);
    // }

    /**
     * Returns true when this ViewObject belongs to a named style bin.
     */
    hasStyleBin(styleBinId: string): boolean {
        return this._styleBinIds?.has(styleBinId) === true;
    }

    /**
     * Adds or removes this ViewObject from a named style bin.
     */
    setStyleBin(styleBinId: string, membership: boolean): SDKResult<boolean> {
        if (this.destroyed) {
            return {
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[ViewObject.setStyleBin] ViewObject already destroyed"
            };
        }
        if (!this.view.styleBins.get(styleBinId)) {
            return {
                ok: false,
                type: SDKErrorType.InvalidInput,
                error: `[ViewObject.setStyleBin] Style bin not found: ${styleBinId}`
            };
        }
        const styleBinIds = this._styleBinIds ?? (this._styleBinIds = new Set());
        if (styleBinIds.has(styleBinId) === membership) {
            return {ok: true, value: false};
        }
        if (membership) {
            styleBinIds.add(styleBinId);
        } else {
            styleBinIds.delete(styleBinId);
            if (styleBinIds.size === 0) {
                this._styleBinIds = null;
            }
        }
        this.layer.objectStyleBinUpdated(this, styleBinId, membership);
        return {ok: true, value: true};
    }

    /**
     * Gets the IDs of style bins this ViewObject currently belongs to.
     */
    get styleBinIds(): readonly string[] {
        return this._styleBinIds ? Array.from(this._styleBinIds) : [];
    }

    /**
     * Gets if this ViewObject is culled.
     *
     * * The ViewObject is only rendered when {@link ViewObject.visible} is ````true```` and {@link ViewObject.culled} is ````false````.
     * * Use {@link ViewLayer.setObjectsCulled} to batch-update the culled state of ViewObjects.
     */
    get culled(): boolean {
        return (this._flags & ViewObject.CULLED) !== 0;
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
        if (culled === this.culled) {
            return;
        }
        this._setFlag(ViewObject.CULLED, culled);
        // Forward to the View so the renderer drops/restores this
        // object's meshes in the view's draw index. Without this the
        // flag would only flip the JS-side bit and culled objects
        // would keep rendering.
        this.layer.view.objectCulledUpdated(this, culled);
    }

    /**
     * Gets if this ViewObject is clippable.
     *
     * * Clipping is done by the {@link SectionPlane | SectionPlanes} in {@link View.sectionPlanes | View.sectionPlanes}.
     * * Use {@link View.setObjectsClippable | View.setObjectsClippable} or {@link ViewLayer.setObjectsClippable | ViewLayer.setObjectsClippable} to batch-update the clippable state of multiple ViewObjects.
     */
    get clippable(): boolean {
        return (this._flags & ViewObject.CLIPPABLE) !== 0;
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
        if (clippable === this.clippable) {
            return;
        }
        this._setFlag(ViewObject.CLIPPABLE, clippable);
        // Forward to the View so the renderer can re-encode the
        // per-mesh clippable bit in the MeshViewAttributeTexture.
        // Without this, toggling clippable at runtime would only
        // update the JS-side bitmask — the GPU would never see
        // the change and section planes would keep clipping.
        this.layer.view.objectClippableUpdated(this, clippable);
    }

    /**
     * Gets if this ViewObject is included in boundary calculations.
     */
    get collidable(): boolean {
        return (this._flags & ViewObject.COLLIDABLE) !== 0;
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
        if (collidable === this.collidable) {
            return;
        }
        // const result = this.sceneObject.sceneObjectRendererProxy.setCollidable(this._layer.view.viewIndex, collidable);
        // if (result instanceof SDKError) {
        //     throw result;
        // }
        this._setFlag(ViewObject.COLLIDABLE, collidable);
        // this._setAABBDirty();
        // this._layer._aabbDirty = true;
    }

    /**
     * Gets if this ViewObject is pickable.
     *
     * * Picking is done with {@link viewing!viewer.View.pick | View.pick}.
     * * Use {@link ViewLayer.setObjectsPickable} to batch-update the pickable state of ViewObjects.
     */
    get pickable(): boolean {
        return (this._flags & ViewObject.PICKABLE) !== 0;
    }

    /**
     * Sets if this ViewObject is pickable.
     *
     * * Picking is done with {@link viewing!viewer.View.pick | View.pick}.
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
        if (this.pickable === pickable) {
            return;
        }
        //
        this._setFlag(ViewObject.PICKABLE, pickable);
        this.layer.objectPickableUpdated(this, pickable);
    }

    /**
     * Gets the RGB colorize color for this ViewObject, if set.
     *
     * * Multiplies by rendered fragment colors.
     * * Each element of the color is in range ````[0..1]````.
     * * Use {@link ViewLayer.setObjectsColorized} to batch-update the colorized state of ViewObjects.
     */
    get colorize(): Vec3 | null{
        return (this.colorized && this._colorize) ? this._colorize : null;
    }

    /**
     * Returns the RGBA colorize/opacity store, allocating it (default
     * [1, 1, 1, 1]) on first use. Only called from the colorize/opacity
     * setters when a real override is applied.
     */
    private _ownColorize(): Vec3 {
        if (!this._colorize) {
            this._colorize = new Float32Array([1, 1, 1, 1]);
        }
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
        if (value) {
            const colorize = this._ownColorize();
            colorize[0] = value[0];
            colorize[1] = value[1];
            colorize[2] = value[2];
        } else if (this._colorize) {
            // Reset RGB to the default; keep alpha (any opacity override).
            this._colorize[0] = 1;
            this._colorize[1] = 1;
            this._colorize[2] = 1;
        }
        this._setFlag(ViewObject.COLORIZED, !!value);
        this.layer.objectColorizeUpdated(this, this.colorized);
    }

    /**
     * Gets the opacity factor for this ViewObject.
     *
     * * This is a factor in range ````[0..1]```` which multiplies by the rendered fragment alphas.
     * * Use {@link ViewLayer.setObjectsOpacity} to batch-update the opacities of ViewObjects.
     */
    get opacity(): number {
        return this._colorize ? this._colorize[3] : 1.0;
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
        const opacityUpdated = opacity !== null && opacity !== undefined;
        this._setFlag(ViewObject.OPACITY_UPDATED, opacityUpdated);
        if (opacityUpdated) {
            this._ownColorize()[3] = opacity as number;
        } else if (this._colorize) {
            this._colorize[3] = 1.0; // clear override; keep any colorize RGB
        }
        this.layer.objectOpacityUpdated(this, this.opacityUpdated);
    }

    /**
     * @private
     */
    private _destroy() {
        // Clears state-index memberships. View owns removal from the
        // View/ViewLayer object maps.
        if (this.visible) {
            this.layer.objectVisibilityUpdated(this, false, false);
        }
        if (this.colorized) {
            this.layer.objectColorizeUpdated(this, false);
        }
        if (this.opacityUpdated) {
            this.layer.objectOpacityUpdated(this, false);
        }
    }

    private _setFlag(flag: number, enabled: boolean): void {
        if (enabled) {
            this._flags |= flag;
        } else {
            this._flags &= ~flag;
        }
    }

    private get colorized(): boolean {
        return (this._flags & ViewObject.COLORIZED) !== 0;
    }

    /**
     * `true` when the ViewObject's opacity is currently overriding
     * the underlying SceneMesh material's alpha — i.e. the caller
     * has set {@link opacity} to a value (any number, including 1).
     * Cleared when the caller passes `null` / `undefined` to the
     * setter, returning the renderer to the material's native alpha.
     *
     * The renderer's mesh-batch state-update bridge reads this flag
     * to distinguish "user wants opacity = 1" (override on, alpha
     * forced to 1.0, naturally-transparent meshes routed through
     * the opaque bin) from "user has cleared the opacity override"
     * (read material alpha — typically how a 4D scheduler returns
     * finished objects to their native appearance).
     */
    get opacityUpdated(): boolean {
        return (this._flags & ViewObject.OPACITY_UPDATED) !== 0;
    }
}
