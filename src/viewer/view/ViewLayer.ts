import {Component} from '../Component';
import * as utils from "../utils/index";
import {ViewObject} from "./ViewObject";
import {Viewer} from "../Viewer";
import {Scene, SceneModel} from "../scene/index";
import {View} from "./View";

/**
 * Optional component that organizes {@link ViewObject}s into bins within a {@link View}.
 *
 * ## Usage
 *
 * Create a viewer with a WebGL-based scene renderer:
 *
 *````javascript
 * import {Viewer, FastRender, WebGLRenderer} from "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/xeokit-viewer.es.min.js";
 *
 * const myViewer = new Viewer({
 *      id: "myViewer",
 *      renderer: new WebGLRenderer({ })
 * });
 *
 * const mySceneModel = myViewer.scene.createModel({
 *      id: "myModel"
 * });
 *
 * mySceneModel.createMesh({
 *      id: "myMesh",
 *      primitive: SolidPrimitive,
 *      positions: [...],
 *      indices: [...]
 *      //...
 * });
 *
 * mySceneModel.createObject({
 *      id: "myObject1",
 *      meshIds: ["myMesh}],
 *      viewLayer: "foo"
 *      //...
 * });
 *
 * mySceneModel.createObject({
 *      id: "myObject2",
 *      meshIds: ["myMesh}],
 *      viewLayer: "foo"
 *      //...
 * });
 *
 * mySceneModel.createObject({
 *      id: "myObject3",
 *      meshIds: ["myMesh}],
 *      viewLayer: "baz"
 *      //...
 * });
 *
 * myModel.finalize();
 * ````
 *
 * Create a view of the model:
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *      id: "myView",
 *      canvasId: "myCanvas1"
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 *
 * view1.layers["foo"].objects["myObject1"].highlighted = true;
 * view1.layers["foo"].objects["myObject2"].highlighted = true;
 * view1.layers["foo"].setObjectsXRayed(["myObject1", "myObject2"], true);
 *
 * view1.layers["bar"].objects["myObject3"].highlighted = true;
 * view1.layers["bar"].setObjectsSelected(["myObject3"], true);
 * ````
 */
class ViewLayer extends Component {

    /**
     ID of this ViewLayer, unique within the {@link View}.

     This ViewLayer is mapped by this ID in {@link View.layers}.
     */
    declare public readonly id: string;

    /**
     * The Viewer to which this ViewLayer belongs.
     */
    declare public readonly viewer: Viewer;

    /**
     * The View to which this ViewLayer belongs.
     */
    declare public readonly view: View;

    /**
     * Map of the all {@link ViewObject}s in this ViewLayer.
     *
     * These are the ViewObjects for which {@link ViewObject.viewLayer} has the same value as {@link ViewLayer.id}.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     *
     * The ViewLayer automatically ensures that there is a {@link ViewObject} here for
     * each {@link SceneObject} in the {@link Viewer}'s {@link Scene}.
     */
    public readonly objects: { [key: string]: ViewObject };

    /**
     * Map of the currently visible {@link ViewObject}s in this ViewLayer.
     *
     * A ViewObject is visible when {@link ViewObject.visible} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly visibleObjects: { [key: string]: ViewObject };

    /**
     * Map of currently x-rayed {@link ViewObject}s in this ViewLayer.
     *
     * A ViewObject is x-rayed when {@link ViewObject.xrayed} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly xrayedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently highlighted {@link ViewObject}s in this ViewLayer.
     *
     * A ViewObject is highlighted when {@link ViewObject.highlighted} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly highlightedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently selected {@link ViewObject}s in this ViewLayer.
     *
     * A ViewObject is selected when {@link ViewObject.selected} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly selectedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently colorized {@link ViewObject}s in this ViewLayer.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly colorizedObjects: { [key: string]: ViewObject };

    /**
     * Map of {@link ViewObject}s in this ViewLayer whose opacity has been updated.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly opacityObjects: { [key: string]: ViewObject };

    #numObjects: number;
    #objectIds: string[] | null;
    #numVisibleObjects: number;
    #visibleObjectIds: string[] | null;
    #numXRayedObjects: number;
    #xrayedObjectIds: string[] | null;
    #numHighlightedObjects: number;
    #highlightedObjectIds: string[] | null;
    #numSelectedObjects: number;
    #selectedObjectIds: string[] | null;
    #numColorizedObjects: number;
    #colorizedObjectIds: string[] | null;
    #numOpacityObjects: number;
    #opacityObjectIds: string[] | null;

    #qualityRender: boolean;

    gammaOutput: boolean;

    constructor(options: {
        id: string;
        viewer: Viewer;
        view: View;
        qualityRender?: boolean;
    }) {

        super(options.view, options);

        this.id = options.id;
        this.viewer = options.viewer;
        this.view = options.view;

        this.objects = {};
        this.visibleObjects = {};
        this.xrayedObjects = {};
        this.highlightedObjects = {};
        this.selectedObjects = {};
        this.colorizedObjects = {};
        this.opacityObjects = {};

        this.#numObjects = 0;
        this.#numVisibleObjects = 0;
        this.#numXRayedObjects = 0
        this.#numHighlightedObjects = 0;
        this.#numSelectedObjects = 0;
        this.#numColorizedObjects = 0;
        this.#numOpacityObjects = 0;

        this.#qualityRender = !!options.qualityRender;

        this.#initObjects();
    }

    /**
     * Gets the gamma factor.
     */
    get gammaFactor() { // TODO
        return 1.0;
    }

    /**
     * Sets whether quality rendering is enabled for this ViewLayer.
     *
     * Default is ````false````.
     */
    set qualityRender(value: boolean) {
        if (this.#qualityRender === value) {
            return;
        }
        this.#qualityRender = value;
        this.redraw();
    }

    /**
     * Gets whether quality rendering is enabled for this ViewLayer.
     *
     * Default is ````false````.
     */
    get qualityRender(): boolean {
        return this.#qualityRender;
    }

    /**
     * Gets the number of {@link ViewObject}s in this ViewLayer.
     */
    get numObjects(): number {
        return this.#numObjects;
    }

    /**
     * Gets the IDs of the {@link ViewObject}s in this ViewLayer.
     */
    get objectIds(): string[] {
        if (!this.#objectIds) {
            this.#objectIds = Object.keys(this.objects);
        }
        return this.#objectIds;
    }

    /**
     * Gets the number of visible {@link ViewObject}s in this ViewLayer.
     */
    get numVisibleObjects(): number {
        return this.#numVisibleObjects;
    }

    /**
     * Gets the IDs of the visible {@link ViewObject}s in this ViewLayer.
     */
    get visibleObjectIds(): string[] {
        if (!this.#visibleObjectIds) {
            this.#visibleObjectIds = Object.keys(this.visibleObjects);
        }
        return this.#visibleObjectIds;
    }

    /**
     * Gets the number of X-rayed {@link ViewObject}s in this ViewLayer.
     */
    get numXRayedObjects(): number {
        return this.#numXRayedObjects;
    }

    /**
     * Gets the IDs of the X-rayed {@link ViewObject}s in this ViewLayer.
     */
    get xrayedObjectIds(): string[] {
        if (!this.#xrayedObjectIds) {
            this.#xrayedObjectIds = Object.keys(this.xrayedObjects);
        }
        return this.#xrayedObjectIds;
    }

    /**
     * Gets the number of highlighted {@link ViewObject}s in this ViewLayer.
     */
    get numHighlightedObjects(): number {
        return this.#numHighlightedObjects;
    }

    /**
     * Gets the IDs of the highlighted {@link ViewObject}s in this ViewLayer.
     */
    get highlightedObjectIds(): string[] {
        if (!this.#highlightedObjectIds) {
            this.#highlightedObjectIds = Object.keys(this.highlightedObjects);
        }
        return this.#highlightedObjectIds;
    }

    /**
     * Gets the number of selected {@link ViewObject}s in this ViewLayer.
     */
    get numSelectedObjects(): number {
        return this.#numSelectedObjects;
    }

    /**
     * Gets the IDs of the selected {@link ViewObject}s in this ViewLayer.
     */
    get selectedObjectIds(): string[] {
        if (!this.#selectedObjectIds) {
            this.#selectedObjectIds = Object.keys(this.selectedObjects);
        }
        return this.#selectedObjectIds;
    }

    /**
     * Gets the number of colorized {@link ViewObject}s in this ViewLayer.
     */
    get numColorizedObjects(): number {
        return this.#numColorizedObjects;
    }

    /**
     * Gets the IDs of the colorized {@link ViewObject}s in this ViewLayer.
     */
    get colorizedObjectIds(): string[] {
        if (!this.#colorizedObjectIds) {
            this.#colorizedObjectIds = Object.keys(this.colorizedObjects);
        }
        return this.#colorizedObjectIds;
    }

    /**
     * Gets the IDs of the {@link ViewObject}s in this ViewLayer that have updated opacities.
     */
    get opacityObjectIds(): string[] {
        if (!this.#opacityObjectIds) {
            this.#opacityObjectIds = Object.keys(this.opacityObjects);
        }
        return this.#opacityObjectIds;
    }

    /**
     * Gets the number of {@link ViewObject}s in this ViewLayer that have updated opacities.
     */
    get numOpacityObjects(): number {
        return this.#numOpacityObjects;
    }

    /**
     * @private
     */
    registerViewObject(viewObject: ViewObject) {
        this.objects[viewObject.id] = viewObject;
        this.#numObjects++;
        this.#objectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    deregisterViewObject(viewObject: ViewObject) {
        delete this.objects[viewObject.id];
        delete this.visibleObjects[viewObject.id];
        delete this.xrayedObjects[viewObject.id];
        delete this.highlightedObjects[viewObject.id];
        delete this.selectedObjects[viewObject.id];
        delete this.colorizedObjects[viewObject.id];
        delete this.opacityObjects[viewObject.id];
        this.#numObjects--;
        this.#objectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    redraw() {
        this.viewer.renderer.setImageDirty(this.view.viewIndex);
    }

    /**
     * @private
     */
    recompile() {
        this.viewer.events.once("tick", () => {
            this.events.fire("compile", this);
        });
    }

    /**
     * @private
     */
    objectVisibilityUpdated(viewObject: ViewObject, visible: boolean, notify: boolean = true) {
        if (visible) {
            this.visibleObjects[viewObject.id] = viewObject;
            this.#numVisibleObjects++;
        } else {
            delete this.visibleObjects[viewObject.id];
            this.#numVisibleObjects--;
        }
        this.#visibleObjectIds = null; // Lazy regenerate
        if (notify) {
            this.events.fire("objectVisibility", viewObject, true);
        }
        this.view.objectVisibilityUpdated(viewObject, visible, notify);
    }

    /**
     * @private
     */
    objectXRayedUpdated(viewObject: ViewObject, xrayed: boolean) {
        if (xrayed) {
            this.xrayedObjects[viewObject.id] = viewObject;
            this.#numXRayedObjects++;
        } else {
            delete this.xrayedObjects[viewObject.id];
            this.#numXRayedObjects--;
        }
        this.#xrayedObjectIds = null; // Lazy regenerate
        this.view.objectXRayedUpdated(viewObject, xrayed);
    }

    /**
     * @private
     */
    objectHighlightedUpdated(viewObject: ViewObject, highlighted: boolean) {
        if (highlighted) {
            this.highlightedObjects[viewObject.id] = viewObject;
            this.#numHighlightedObjects++;
        } else {
            delete this.highlightedObjects[viewObject.id];
            this.#numHighlightedObjects--;
        }
        this.#highlightedObjectIds = null; // Lazy regenerate
        this.view.objectHighlightedUpdated(viewObject, highlighted);
    }

    /**
     * @private
     */
    objectSelectedUpdated(viewObject: ViewObject, selected: boolean) {
        if (selected) {
            this.selectedObjects[viewObject.id] = viewObject;
            this.#numSelectedObjects++;
        } else {
            delete this.selectedObjects[viewObject.id];
            this.#numSelectedObjects--;
        }
        this.#selectedObjectIds = null; // Lazy regenerate
        this.view.objectSelectedUpdated(viewObject, selected);
    }

    /**
     * @private
     */
    objectColorizeUpdated(viewObject: ViewObject, colorized: boolean) {
        if (colorized) {
            this.colorizedObjects[viewObject.id] = viewObject;
            this.#numColorizedObjects++;
        } else {
            delete this.colorizedObjects[viewObject.id];
            this.#numColorizedObjects--;
        }
        this.#colorizedObjectIds = null; // Lazy regenerate
        this.view.objectColorizeUpdated(viewObject, colorized);
    }

    /**
     * @private
     */
    objectOpacityUpdated(viewObject: ViewObject, opacityUpdated: boolean) {
        if (opacityUpdated) {
            this.opacityObjects[viewObject.id] = viewObject;
            this.#numOpacityObjects++;
        } else {
            delete this.opacityObjects[viewObject.id];
            this.#numOpacityObjects--;
        }
        this.#opacityObjectIds = null; // Lazy regenerate
        this.view.objectOpacityUpdated(viewObject, opacityUpdated);
    }

    /**
     * Updates the visibility of the given {@link ViewObject}s in this ViewLayer.
     *
     * - Updates {@link ViewObject.visible} on the Objects with the given IDs.
     * - Updates {@link ViewLayer.visibleObjects} and {@link ViewLayer.numVisibleObjects}.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param visible Whether or not to cull.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsVisible(ids: string[] | string, visible: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.visible !== visible);
            viewObject.visible = visible;
            return changed;
        });
    }

    /**
     * Updates the collidability of the given {@link ViewObject}s in this ViewLayer.
     *
     * Updates {@link ViewObject.collidable} on the Objects with the given IDs.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param collidable Whether or not to cull.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCollidable(ids: string[] | string, collidable: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.collidable !== collidable);
            viewObject.collidable = collidable;
            return changed;
        });
    }

    /**
     * Updates the culled status of the given {@link ViewObject}s in this ViewLayer.
     *
     * Updates {@link ViewObject.culled} on the Objects with the given IDs.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param culled Whether or not to cull.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCulled(ids: string[] | string, culled: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.culled !== culled);
            viewObject.culled = culled;
            return changed;
        });
    }

    /**
     * Selects or deselects the given {@link ViewObject}s in this ViewLayer.
     *
     * - Updates {@link ViewObject.selected} on the Objects with the given IDs.
     * - Updates {@link ViewLayer.selectedObjects} and {@link ViewLayer.numSelectedObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param selected Whether or not to select.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsSelected(ids: string[] | string, selected: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.selected !== selected);
            viewObject.selected = selected;
            return changed;
        });
    }

    /**
     * Highlights or un-highlights the given {@link ViewObject}s in this ViewLayer.
     *
     * - Updates {@link ViewObject.highlighted} on the Objects with the given IDs.
     * - Updates {@link ViewLayer.highlightedObjects} and {@link ViewLayer.numHighlightedObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param highlighted Whether or not to highlight.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsHighlighted(ids: string[] | string, highlighted: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.highlighted !== highlighted);
            viewObject.highlighted = highlighted;
            return changed;
        });
    }

    /**
     * Applies or removes X-ray rendering for the given {@link ViewObject}s in this ViewLayer.
     *
     * - Updates {@link ViewObject.xrayed} on the Objects with the given IDs.
     * - Updates {@link ViewLayer.xrayedObjects} and {@link ViewLayer.numXRayedObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param xrayed Whether or not to xray.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsXRayed(ids: string[] | string, xrayed: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.xrayed !== xrayed);
            if (changed) {
                viewObject.xrayed = xrayed;
            }
            return changed;
        });
    }

    /**
     * Colorizes the given {@link ViewObject}s in this ViewLayer.
     *
     * - Updates {@link ViewObject.colorize} on the Objects with the given IDs.
     * - Updates {@link ViewLayer.colorizedObjects} and {@link ViewLayer.numColorizedObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param colorize - RGB colorize factors in range ````[0..1,0..1,0..1]````.
     * @returns True if any {@link ViewObject}s changed opacity, else false if all updates were redundant and not applied.
     */
    setObjectsColorized(ids: string[] | string, colorize: number[]) {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            viewObject.colorize = colorize;
        });
    }

    /**
     * Sets the opacity of the given {@link ViewObject}s in this ViewLayer.
     *
     * - Updates {@link ViewObject.opacity} on the Objects with the given IDs.
     * - Updates {@link ViewLayer.opacityObjects} and {@link ViewLayer.numOpacityObjects}.
     *
     * @param  ids - One or more {@link ViewObject.id} values.
     * @param opacity - Opacity factor in range ````[0..1]````.
     * @returns True if any {@link ViewObject}s changed opacity, else false if all updates were redundant and not applied.
     */
    setObjectsOpacity(ids: string[] | string, opacity: number): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.opacity !== opacity);
            if (changed) {
                viewObject.opacity = opacity;
            }
            return changed;
        });
    }

    /**
     * Sets the pickability of the given {@link ViewObject}s in this ViewLayer.
     *
     * - Updates {@link ViewObject.pickable} on the Objects with the given IDs.
     * - Enables or disables the ability to pick the given Objects with {@link ViewLayer.pick}.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param pickable Whether or not to set pickable.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsPickable(ids: string[] | string, pickable: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.pickable !== pickable);
            if (changed) {
                viewObject.pickable = pickable;
            }
            return changed;
        });
    }

    /**
     * Sets the clippability of the given {@link ViewObject}s in this ViewLayer.
     *
     * - Updates {@link ViewObject.clippable} on the Objects with the given IDs.
     * - Enables or disables the ability to pick the given Objects with {@link ViewLayer.pick}.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param clippable Whether or not to set clippable.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsClippable(ids: string[] | string, clippable: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.clippable !== clippable);
            if (changed) {
                viewObject.clippable = clippable;
            }
            return changed;
        });
    }

    /**
     * Iterates with a callback over the given {@link ViewObject}s in this ViewLayer.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param callback Callback to execute on each {@link ViewObject}.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    withObjects(ids: string[] | string, callback: Function): boolean {
        if (utils.isString(ids)) {
            // @ts-ignore
            ids = [ids];
        }
        let changed = false;
        for (let i = 0, len = ids.length; i < len; i++) {
            const id = ids[i];
            let viewObject = this.objects[id];
            if (viewObject) {
                changed = callback(viewObject) || changed;
            }
        }
        return changed;
    }

    #initObjects() {
        const scene = this.viewer.scene;
        const sceneModels = scene.models;
        for (const id in sceneModels) {
            const sceneModel = sceneModels[id];
            this.#createObjects(sceneModel);
        }
        scene.events.on("sceneModelCreated", (sceneModel) => {
            this.#createObjects(sceneModel);
        });
        scene.events.on("sceneModelDestroyed", (sceneModel) => {
            this.#destroyObjects(sceneModel);
        });
    }

    #createObjects(sceneModel: SceneModel) {
        const sceneObjects = sceneModel.objects;
        for (let id in sceneObjects) {
            const sceneObject = sceneObjects[id];
            if (sceneObject.viewLayer == this.id) {
                const viewObject = new ViewObject(this, sceneObject, {});
                this.objects[viewObject.id] = viewObject;
                this.#numObjects++;
                this.#objectIds = null; // Lazy regenerate
            }
        }
    }

    #destroyObjects(sceneModel: SceneModel) {
        const sceneObjects = sceneModel.objects;
        for (let id in sceneObjects) {
            const sceneObject = sceneObjects[id];
            const viewObject = this.objects[sceneObject.id];
            viewObject._destroy();
            this.#numObjects--;
            this.#objectIds = null; // Lazy regenerate
        }
    }

    /**
     * Destroys this ViewLayer.
     *
     * Causes {@link Viewer} to fire a "viewDestroyed" event.
     */
    destroy() {
        super.destroy();
    }
}

export {ViewLayer};
