import {FloatArrayParam} from "@xeokit/math/math";

import type {ViewLayer} from "./ViewLayer";
import {SceneObject} from "@xeokit/scene";
import {RendererViewObject} from "./RendererViewObject";

/**
 * Represents and controls the visual state of a {@link @xeokit/scene!SceneModel | SceneObject} in
 * a {@link @xeokit/viewer!View |View's} canvas.
 *
 * ## Summary
 *
 * * Stored in {@link View.objects | View.objects} and {@link ViewLayer.objects | ViewLayer.objects}
 * * Viewer automatically creates one of these in each existing {@link @xeokit/viewer!View} for each {@link @xeokit/scene!SceneModel | SceneObject} created
 * * {@link SceneObject.layerId | SceneObject.layerId} determines which of the View's {@link ViewLayer | ViewLayers} to put the ViewObject in
 *
 * ## Overview
 *
 * Every View automatically maintains within itself a ViewObject for each {@link @xeokit/scene!SceneModel | SceneObject} that exists in the {@link @xeokit/viewer!Viewer}.
 *
 * Whenever we create a SceneObject, each View will automatically create a corresponding ViewObject within itself. When
 * we destroy a SceneObject, each View will automatically destroy its corresponding ViewObject. The ViewObjects in a View
 * are therefore a manifest of the ViewerObjects in the View.
 *
 * {@link ViewLayer}.
 */
export class ViewObject {

    /**
     * Unique ID of this ViewObject within {@link ViewLayer.objects}.
     */
    public readonly id: string;

    /**
     * The ViewLayer to which this ViewObject belongs.
     */
    public readonly layer: ViewLayer;

    /**
     * The corresponding {@link SceneObject}.
     */
    public readonly sceneObject: SceneObject;

    /**
     * The corresponding {@link RendererViewObject}.
     * @internal
     */
    #rendererViewObject: RendererViewObject;

    #state: {
        visible: boolean;
        culled: boolean;
        pickable: boolean;
        clippable: boolean;
        collidable: boolean;
        xrayed: boolean;
        selected: boolean;
        highlighted: boolean;
        edges: boolean;
        colorize: Float32Array;
        colorized: boolean;
        opacityUpdated: boolean;
    };

    /**
     * @private
     */
    constructor(layer: ViewLayer, sceneObject: SceneObject, rendererViewObject: RendererViewObject) {

        this.id = sceneObject.id;
        this.layer = layer;
        this.sceneObject = sceneObject;
        this.#rendererViewObject = rendererViewObject;

        this.#state = {
            visible: true,
            culled: false,
            pickable: true,
            clippable: true,
            collidable: true,
            xrayed: false,
            selected: false,
            highlighted: false,
            edges: false,
            colorize: new Float32Array(4),
            colorized: false,
            opacityUpdated: false,
        };

        this.#rendererViewObject.setVisible(this.layer.view.viewIndex, this.#state.visible);
        this.layer.objectVisibilityUpdated(this, this.#state.visible, true);
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
        this.#rendererViewObject.setVisible(this.layer.view.viewIndex, visible);
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
        this.#rendererViewObject.setXRayed(this.layer.view.viewIndex, xrayed);
        this.layer.objectXRayedUpdated(this, xrayed);
        this.layer.redraw();
    }

    /**
     * Gets if this ViewObject shows edges.
     */
    get edges(): boolean {
        return this.#state.edges;
    }

    /**
     * Sets if this ViewObject shows edges.
     */
    set edges(edges: boolean) {
        if (this.#state.edges === edges) {
            return;
        }
        this.#state.edges = edges;
        this.#rendererViewObject.setEdges(this.layer.view.viewIndex, edges);
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
        this.#rendererViewObject.setHighlighted(
            this.layer.view.viewIndex,
            highlighted
        );
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
        this.#rendererViewObject.setSelected(this.layer.view.viewIndex, selected);
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
        this.#state.culled = culled;
        this.layer.redraw();
    }

    /**
     * Gets if this ViewObject is clippable.
     *
     * * Clipping is done by the {@link SectionPlane}s in {@link ViewLayer.sectionPlanes}.
     * * Use {@link ViewLayer.setObjectsClippable} to batch-update the clippable state of ViewObjects.
     */
    get clippable(): boolean {
        return this.#state.clippable;
    }

    /**
     * Sets if this ViewObject is clippable.
     *
     * * Clipping is done by the {@link SectionPlane}s in {@link ViewLayer.sectionPlanes}.
     * * Use {@link ViewLayer.setObjectsClippable} to batch-update the clippable state of ViewObjects.
     */
    set clippable(value: boolean) {
        if (value === this.#state.clippable) {
            return;
        }
        this.#state.clippable = value;
        this.layer.redraw();
    }

    /**
     * Gets if this ViewObject is included in boundary calculations.
     *
     * * When ````true````, the 3D World boundaries returned by {@link ViewLayer.aabb} will include this ViewObject's boundary.
     * * The ViewObject's 3D boundary is held in {@link SceneObject.aabb}.
     * * Use {@link ViewLayer.setObjectsCollidable} to batch-update the collidable state of ViewObjects.
     */
    get collidable(): boolean {
        return this.#state.collidable;
    }

    /**
     * Sets if this ViewObject included in boundary calculations.
     *
     * * When ````true````, the 3D World boundaries returned by {@link ViewLayer.aabb} will include this ViewObject's boundary.
     * * The ViewObject's 3D boundary is held in {@link SceneObject.aabb}.
     * * Use {@link ViewLayer.setObjectsCollidable} to batch-update the collidable state of ViewObjects.
     */
    set collidable(value: boolean) {
        if (value === this.#state.collidable) {
            return;
        }
        this.#state.collidable = value;
        // this._setAABBDirty();
        // this.layer._aabbDirty = true;
    }

    /**
     * Gets if this ViewObject is pickable.
     *
     * * Picking is done with {@link ViewLayer.pick}.
     * * Use {@link ViewLayer.setObjectsPickable} to batch-update the pickable state of ViewObjects.
     */
    get pickable(): boolean {
        return this.#state.pickable;
    }

    /**
     * Sets if this ViewObject is pickable.
     *
     * * Picking is done with {@link ViewLayer.pick}.
     * * Use {@link ViewLayer.setObjectsPickable} to batch-update the pickable state of ViewObjects.
     */
    set pickable(pickable: boolean) {
        if (this.#state.pickable === pickable) {
            return;
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
        let colorize = this.#state.colorize;
        if (value) {
            colorize[0] = value[0];
            colorize[1] = value[1];
            colorize[2] = value[2];
        } else {
            colorize[0] = 1;
            colorize[1] = 1;
            colorize[2] = 1;
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
        let colorize = this.#state.colorize;
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

