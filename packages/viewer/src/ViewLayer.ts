import {EventDispatcher} from "strongly-typed-events";
import {Component, EventEmitter} from "@xeokit/core";

import {ViewObject} from "./ViewObject";
import type {Viewer} from "./Viewer";
import type {View} from "./View";
import type {Scene, SceneModel} from "@xeokit/scene";



/**
 * A layer of {@link @xeokit/viewer!ViewObject | ViewObjects} in a {@link @xeokit/viewer!View}.
 *
 * See {@link "@xeokit/viewer"} for usage.
 *
 * ## Summary
 *
 * * Automatically stores a {@link @xeokit/viewer!ViewObject} for each existing {@link RendererObject} that has a matching {@link RendererObject.layerId | ViewerObject.layerId}
 * * Useful for segreggating {@link @xeokit/viewer!ViewObject | ViewObjects} into layers
 * * Created automatically or manually (see {@link View.createLayer | View.createLayer})
 * * Stored in {@link View.layers | View.layers}
 *
 * ## Overview
 *
 * ViewLayers organize a {@link View |View's} {@link @xeokit/viewer!ViewObject | ViewObjects} into layers, according to which aspects of
 * the view they represent. They make it easier for us to focus our interactions on the ViewObjects that are relevant
 * to the particular aspects we're interested in.
 *
 * ### Typical use case: segregating model objects from environment objects
 *
 * A typical use case for this feature is to group environmental {@link @xeokit/viewer!ViewObject | ViewObjects} (e.g. ground, skybox) in an "environment" ViewLayer,
 * and group model ViewObjects in a "model" ViewLayer. Then we can focus our model interactions (show, hide, highlight,
 * save/load BCF viewpoints, etc.) on the ViewObjects in the "model" ViewLayer, without involving the "environment"
 * ViewObjects at all, which are effectively in the background. We can basically ignore the environment objects as we
 * do various batch operations on our model objects, i.e. "X-ray all", "X-ray everything except for walls" and so on.
 *
 * ### Automatic ViewLayers
 *
 * By default, each {@link @xeokit/viewer!View} automatically lazy-creates ViewLayers within itself as required. As {@link RendererObject | ViewerObjects} appear in the
 * {@link @xeokit/viewer!Viewer}, {@link @xeokit/viewer!ViewObject | ViewObjects} and Viewlayers magically appear in each existing View.
 *
 * Recall that, whenever a {@link RendererObject} is created, each existing {@link @xeokit/viewer!View} will automatically create a
 * corresponding {@link @xeokit/viewer!ViewObject} to represent and control that ViewerObject's appearance within the View's canvas.
 *
 * If the {@link RendererObject} also happens to have a value set on its {@link RendererObject.layerId} ID property, then the View
 * will also automatically ensure that it contains a matching {@link @xeokit/viewer!ViewLayer}, and will register the new ViewObject
 * in that ViewLayer. Note that each ViewObject can belong to a maximum of one ViewLayer.
 *
 * When a {@link @xeokit/viewer!View} automatically creates Viewlayers, it will also automatically destroy them again whenever
 * their {@link RendererObject | ViewerObjects} have all been destroyed.
 *
 * ### Manual ViewLayers
 *
 * We can configure a {@link @xeokit/viewer!View} to **not** automatically create ViewLayers, and instead rely on us to manually create them.
 *
 * When we do that, the View will only create the {@link @xeokit/viewer!ViewObject | ViewObjects} within itself for the ViewLayers that we created. The
 * View will ignore all ViewerObjects that don't have {@link RendererObject.layerId} values that match the IDs of our
 * manually-created ViewLayers.
 *
 * This feature is useful for ensuring that aspect-focused Views don't contain huge numbers of unused ViewObjects for
 * ViewerObjects that they never need to show.
 *
 * When we manually create ViewLayers like this, then the View will not automatically destroy them whenever
 * their {@link RendererObject | ViewerObjects} have all been destroyed. This keeps the ViewLayers around, in case
 * we create matching ViewerObjects again in future.
 *
 * ## Examples
 *
 * ### Exampe 1: Automatic ViewLayers
 *
 * Create a {@link @xeokit/viewer!Viewer}:
 *
 *````javascript
 * import {Viewer} from "@xeokit/viewer";
 *
 * const myViewer = new Viewer({
 *      id: "myViewer"
 * });
 *````
 *
 * Create a {@link @xeokit/viewer!View}, with the default setting of ````false```` for {@link ViewParams.autoLayers}:
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *      id: "myView",
 *      elementId: "myView1",
 *      autoLayers: true // <<----------- Default
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 * ````
 *
 * Next, we'll create a {@link @xeokit/scene!SceneModel | SceneModel} containing two model {@link RendererObject | ViewerObjects} that represent a building
 * foundation and walls, along with two environmental ViewerObjects that represent a skybox and ground plane.
 *
 * The ground and skybox ViewerObjects specify that their {@link @xeokit/viewer!ViewObject | ViewObjects} belong
 * to "environment" ViewLayers, while the model ViewerObjects specify that their ViewObjects belong to "model" ViewLayers.
 *
 * ````javascript
 * const sceneModel = myViewer.scene.createModel({
 *      id: "myModel"
 * });
 *
 * // (calls to SceneModel createGeometry and
 * // createLayerMesh omitted for brevity)
 *
 * sceneModel.createObject({
 *      id: "ground",
 *      meshIds: ["groundMesh}],
 *      layerId: "environment"
 * });
 *
 * sceneModel.createObject({
 *      id: "skyBox",
 *      meshIds: ["skyBoxMesh}],
 *      layerId: "environment"
 * });
 *
 * sceneModel.createObject({
 *      id: "houseFoundation",
 *      meshIds: ["myMesh}],
 *      layerId: "model"
 * });
 *
 * sceneModel.createObject({
 *      id: "houseWalls",
 *      meshIds: ["myMesh}],
 *      layerId: "model"
 * });
 *
 * sceneModel.build();
 * ````
 *
 * Our {@link @xeokit/viewer!View} has now automatically created an "environment" {@link @xeokit/viewer!ViewLayer}, which contains {@link @xeokit/viewer!ViewObject | ViewObjects} for the skybox and
 * ground plane ViewerObjects, and a "model" ViewLayer, which contains ViewObjects for the house foundation and walls.
 *
 * We can now batch-update the ViewObjects in each ViewLayer independently. As mentioned, this is useful when we need to ignore things
 * like UI or environmental objects in batch-updates, BCF viewpoints etc.
 *
 * ````javascript
 * // viewer.objects contains four ViewerObjects with IDs "ground", "skyBox", "houseFoundation" and "houseWalls"
 *
 * // viewer.views.view1.objects contains four ViewObjects with IDs "ground", "skyBox", "houseFoundation" and "houseWalls"
 *
 * // viewer.views.view1.layers contains two ViewLayers with IDs "environment" and "model"
 *
 * const environmentLayer = view1.layers["environment"];
 * environmentLayer.setObjectsVisible(environmentLayer.objectIds, true);

 * const modelLayer = view1.layers["model"];
 * modelLayer.setObjectsVisible(modelLayer.objectIds, true);
 * ````
 *
 * ### Example 2: Manual ViewLayers
 *
 * Create a {@link @xeokit/viewer!Viewer}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 *
 * const myViewer = new Viewer({
 *      id: "myViewer"
 * });
 * ````
 *
 * Create a {@link @xeokit/viewer!View}, this time with ````false```` for {@link ViewParams.autoLayers}, in order to **not**
 * automatically create ViewLayers on demand:
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *      id: "myView",
 *      elementId: "myCanvas1",
 *      autoLayers: false // <<----------- Override default
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 * ````
 *
 * We'll manually create the "model" ViewLayer, and won't create an "environment" ViewLayer:
 *
 * ````javascript
 * const modelViewLayer = view1.createLayer({
 *     id: "model",
 *     visible: true
 * });
 * ````
 *
 * As we did in the previous example, we'll now create a {@link @xeokit/scene!SceneModel | SceneModel} containing two model
 * {@link RendererObject | ViewerObjects} that represent a building foundation and walls, along with two environmental
 * ViewerObjects that represent a skybox and ground plane.
 *
 * As before, the ground and skybox ViewerObjects specify that their {@link @xeokit/viewer!ViewObject | ViewObjects} belong to "environment" ViewLayers,
 * while the model ViewerObjects specify that their ViewObjects belong to "model" ViewLayers.
 *
 * ````javascript
 * const sceneModel = myViewer.scene.createModel({
 *      id: "myModel"
 * });
 *
 * // (calls to SceneModel createGeometry and
 * // createLayerMesh omitted for brevity)
 *
 * sceneModel.createObject({
 *      id: "ground",
 *      meshIds: ["groundMesh}],
 *      layerId: "environment"
 * });
 *
 * sceneModel.createObject({
 *      id: "skyBox",
 *      meshIds: ["skyBoxMesh}],
 *      layerId: "environment"
 * });
 *
 * sceneModel.createObject({
 *      id: "houseFoundation",
 *      meshIds: ["myMesh}],
 *      layerId: "model"
 * });
 *
 * sceneModel.createObject({
 *      id: "houseWalls",
 *      meshIds: ["myMesh}],
 *      layerId: "model"
 * });
 *
 * sceneModel.build();
 * ````
 *
 * This time, however, our {@link @xeokit/viewer!View} has now created {@link @xeokit/viewer!ViewObject | ViewObjects} for the "model" ViewerObjects, while
 * ignoring the "environment" ViewerObjects.
 *
 * As far as this View is concerned, the "environment" ViewerObjects do not exist.
 *
 * ````javascript
 * // viewer.scene.objects contains four SceneObjects with IDs "ground", "skyBox", "houseFoundation" and "houseWalls"
 *
 * // viewer.views.view1.objects contains two ViewObjects with IDs "houseFoundation" and "houseWalls"
 *
 * // viewer.views.view1.layers contains one ViewLayer with ID "model"
 *
 * const modelLayer = view1.layers["model"];
 * modelLayer.setObjectsVisible(modelLayer.objectIds, true);
 * ````
 */
class ViewLayer extends Component {

    /**
     ID of this ViewLayer, unique within the {@link @xeokit/viewer!View}.

     This ViewLayer is mapped by this ID in {@link View.layers}.
     */
    declare readonly id: string;

    /**
     * The Viewer to which this ViewLayer belongs.
     */
    declare readonly viewer: Viewer;

    /**
     * The View to which this ViewLayer belongs.
     */
    declare readonly view: View;

    /**
     * Map of the all {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * These are the ViewObjects for which {@link @xeokit/viewer!ViewObject.layerId | ViewObject.layerId} has the same value as {@link @xeokit/viewer!ViewLayer.id}.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     *
     * The ViewLayer automatically ensures that there is a {@link @xeokit/viewer!ViewObject} here for
     * each {@link RendererObject} in the {@link @xeokit/viewer!Viewer}
     */
    readonly objects: { [key: string]: ViewObject };

    /**
     * Map of the currently visible {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * A ViewObject is visible when {@link @xeokit/viewer!ViewObject.visible} is true.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     */
    readonly visibleObjects: { [key: string]: ViewObject };

    /**
     * Map of currently x-rayed {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * A ViewObject is x-rayed when {@link @xeokit/viewer!ViewObject.xrayed} is true.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     */
    readonly xrayedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently highlighted {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * A ViewObject is highlighted when {@link @xeokit/viewer!ViewObject.highlighted} is true.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     */
    readonly highlightedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently selected {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * A ViewObject is selected when {@link @xeokit/viewer!ViewObject.selected} is true.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     */
    readonly selectedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently colorized {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     */
    readonly colorizedObjects: { [key: string]: ViewObject };

    /**
     * Map of {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer whose opacity has been updated.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     */
    readonly opacityObjects: { [key: string]: ViewObject };

    /**
     * When true, View destroys this ViewLayer as soon as there are no ViewObjects
     * that need it. When false, View retains it.
     * @private
     */
    autoDestroy: boolean;

    /**
     * Emits an event each time a {@link @xeokit/viewer!ViewObject} is created in this ViewLayer.
     *
     * @event
     */
    readonly onObjectCreated: EventEmitter<ViewLayer, ViewObject>;

    /**
     * Emits an event each time a {@link @xeokit/viewer!ViewObject} is destroyed in this ViewLayer.
     *
     * @event
     */
    readonly onObjectDestroyed: EventEmitter<ViewLayer, ViewObject>;

    /**
     * Emits an event each time the visibility of a {@link @xeokit/viewer!ViewObject} changes.
     *
     * ViewObjects are shown and hidden with {@link View.setObjectsVisible}, {@link @xeokit/viewer!ViewLayer.setObjectsVisible} or {@link @xeokit/viewer!ViewObject.visible}.
     *
     * @event
     */
    readonly onObjectVisibility: EventEmitter<ViewLayer, ViewObject>;

    #renderModes: number[];

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
        autoDestroy?: boolean;
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

        this.autoDestroy = (options.autoDestroy !== false);

        this.#numObjects = 0;
        this.#numVisibleObjects = 0;
        this.#numXRayedObjects = 0
        this.#numHighlightedObjects = 0;
        this.#numSelectedObjects = 0;
        this.#numColorizedObjects = 0;
        this.#numOpacityObjects = 0;

        this.#qualityRender = !!options.qualityRender;

        this.#renderModes = [];

        this.onObjectCreated = new EventEmitter(new EventDispatcher<ViewLayer, ViewObject>());
        this.onObjectDestroyed = new EventEmitter(new EventDispatcher<ViewLayer, ViewObject>());
        this.onObjectVisibility = new EventEmitter(new EventDispatcher<ViewLayer, ViewObject>());

        this.#initViewObjects();
    }

    /**
     * Gets the gamma factor.
     */
    get gammaFactor() { // TODO
        return 1.0;
    }

    /**
     * Sets which rendering modes in which to render the {@link ViewObject | ViewObjects} in this ViewLayer.
     *
     * Default value is [].
     */
    set renderModes(value: number[]) {
        this.#renderModes = value;
        this.view.redraw();
    }

    /**
     * Gets which rendering modes in which to render the {@link ViewObject | ViewObjects} in this ViewLayer.
     *
     * Default value is [].
     */
    get renderModes(): number[] {
        return this.#renderModes;
    }

    /**
     * Gets the number of {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get numObjects(): number {
        return this.#numObjects;
    }

    /**
     * Gets the IDs of the {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get objectIds(): string[] {
        if (!this.#objectIds) {
            this.#objectIds = Object.keys(this.objects);
        }
        return this.#objectIds;
    }

    /**
     * Gets the number of visible {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get numVisibleObjects(): number {
        return this.#numVisibleObjects;
    }

    /**
     * Gets the IDs of the visible {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get visibleObjectIds(): string[] {
        if (!this.#visibleObjectIds) {
            this.#visibleObjectIds = Object.keys(this.visibleObjects);
        }
        return this.#visibleObjectIds;
    }

    /**
     * Gets the number of X-rayed {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get numXRayedObjects(): number {
        return this.#numXRayedObjects;
    }

    /**
     * Gets the IDs of the X-rayed {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get xrayedObjectIds(): string[] {
        if (!this.#xrayedObjectIds) {
            this.#xrayedObjectIds = Object.keys(this.xrayedObjects);
        }
        return this.#xrayedObjectIds;
    }

    /**
     * Gets the number of highlighted {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get numHighlightedObjects(): number {
        return this.#numHighlightedObjects;
    }

    /**
     * Gets the IDs of the highlighted {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get highlightedObjectIds(): string[] {
        if (!this.#highlightedObjectIds) {
            this.#highlightedObjectIds = Object.keys(this.highlightedObjects);
        }
        return this.#highlightedObjectIds;
    }

    /**
     * Gets the number of selected {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get numSelectedObjects(): number {
        return this.#numSelectedObjects;
    }

    /**
     * Gets the IDs of the selected {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get selectedObjectIds(): string[] {
        if (!this.#selectedObjectIds) {
            this.#selectedObjectIds = Object.keys(this.selectedObjects);
        }
        return this.#selectedObjectIds;
    }

    /**
     * Gets the number of colorized {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get numColorizedObjects(): number {
        return this.#numColorizedObjects;
    }

    /**
     * Gets the IDs of the colorized {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get colorizedObjectIds(): string[] {
        if (!this.#colorizedObjectIds) {
            this.#colorizedObjectIds = Object.keys(this.colorizedObjects);
        }
        return this.#colorizedObjectIds;
    }

    /**
     * Gets the IDs of the {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer that have updated opacities.
     */
    get opacityObjectIds(): string[] {
        if (!this.#opacityObjectIds) {
            this.#opacityObjectIds = Object.keys(this.opacityObjects);
        }
        return this.#opacityObjectIds;
    }

    /**
     * Gets the number of {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer that have updated opacities.
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
        this.onObjectCreated.dispatch(this, viewObject);
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
        this.onObjectDestroyed.dispatch(this, viewObject);
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
            this.onObjectVisibility.dispatch(this, viewObject);
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
     * Updates the visibility of the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.visible} on the Objects with the given IDs.
     * - Updates {@link @xeokit/viewer!ViewLayer.visibleObjects} and {@link @xeokit/viewer!ViewLayer.numVisibleObjects}.
     *
     * @param {String[]} objectIds Array of {@link @xeokit/viewer!ViewObject.id} values.
     * @param visible Whether or not to cull.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsVisible(objectIds: string[], visible: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = (viewObject.visible !== visible);
            viewObject.visible = visible;
            if (changed) {
                this.onObjectVisibility.dispatch(this, viewObject);
            }
            return changed;
        });
    }

    /**
     * Updates the collidability of the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * Updates {@link @xeokit/viewer!ViewObject.collidable} on the Objects with the given IDs.
     *
     * @param {String[]} objectIds Array of {@link @xeokit/viewer!ViewObject.id} values.
     * @param collidable Whether or not to cull.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCollidable(objectIds: string[], collidable: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = (viewObject.collidable !== collidable);
            viewObject.collidable = collidable;
            return changed;
        });
    }

    /**
     * Updates the culled status of the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * Updates {@link @xeokit/viewer!ViewObject.culled} on the Objects with the given IDs.
     *
     * @param {String[]} objectIds Array of {@link @xeokit/viewer!ViewObject.id} values.
     * @param culled Whether or not to cull.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCulled(objectIds: string[], culled: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = (viewObject.culled !== culled);
            viewObject.culled = culled;
            return changed;
        });
    }

    /**
     * Selects or deselects the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.selected} on the Objects with the given IDs.
     * - Updates {@link @xeokit/viewer!ViewLayer.selectedObjects} and {@link @xeokit/viewer!ViewLayer.numSelectedObjects}.
     *
     * @param  objectIds One or more {@link @xeokit/viewer!ViewObject.id} values.
     * @param selected Whether or not to select.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsSelected(objectIds: string[], selected: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = (viewObject.selected !== selected);
            viewObject.selected = selected;
            return changed;
        });
    }

    /**
     * Highlights or un-highlights the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.highlighted} on the Objects with the given IDs.
     * - Updates {@link @xeokit/viewer!ViewLayer.highlightedObjects} and {@link @xeokit/viewer!ViewLayer.numHighlightedObjects}.
     *
     * @param  objectIds One or more {@link @xeokit/viewer!ViewObject.id} values.
     * @param highlighted Whether or not to highlight.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsHighlighted(objectIds: string[], highlighted: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = (viewObject.highlighted !== highlighted);
            viewObject.highlighted = highlighted;
            return changed;
        });
    }

    /**
     * Applies or removes X-ray rendering for the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.xrayed} on the Objects with the given IDs.
     * - Updates {@link @xeokit/viewer!ViewLayer.xrayedObjects} and {@link @xeokit/viewer!ViewLayer.numXRayedObjects}.
     *
     * @param  objectIds One or more {@link @xeokit/viewer!ViewObject.id} values.
     * @param xrayed Whether or not to xray.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsXRayed(objectIds: string[], xrayed: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = (viewObject.xrayed !== xrayed);
            if (changed) {
                viewObject.xrayed = xrayed;
            }
            return changed;
        });
    }

    /**
     * Colorizes the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.colorize} on the Objects with the given IDs.
     * - Updates {@link @xeokit/viewer!ViewLayer.colorizedObjects} and {@link @xeokit/viewer!ViewLayer.numColorizedObjects}.
     *
     * @param  objectIds One or more {@link @xeokit/viewer!ViewObject.id} values.
     * @param colorize - RGB colorize factors in range ````[0..1,0..1,0..1]````.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
     */
    setObjectsColorized(objectIds: string[], colorize: number[]) {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            viewObject.colorize = colorize;
        });
    }

    /**
     * Sets the opacity of the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.opacity} on the Objects with the given IDs.
     * - Updates {@link @xeokit/viewer!ViewLayer.opacityObjects} and {@link @xeokit/viewer!ViewLayer.numOpacityObjects}.
     *
     * @param  objectIds - One or more {@link @xeokit/viewer!ViewObject.id} values.
     * @param opacity - Opacity factor in range ````[0..1]````.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
     */
    setObjectsOpacity(objectIds: string[], opacity: number): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = (viewObject.opacity !== opacity);
            if (changed) {
                viewObject.opacity = opacity;
            }
            return changed;
        });
    }

    /**
     * Sets the pickability of the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.pickable} on the Objects with the given IDs.
     * - Enables or disables the ability to pick the given Objects with {@link @xeokit/viewer!View.pick}.
     *
     * @param {String[]} objectIds Array of {@link @xeokit/viewer!ViewObject.id} values.
     * @param pickable Whether or not to set pickable.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsPickable(objectIds: string[], pickable: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = (viewObject.pickable !== pickable);
            if (changed) {
                viewObject.pickable = pickable;
            }
            return changed;
        });
    }

    /**
     * Sets the clippability of the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.clippable} on the Objects with the given IDs.
     * - Enables or disables the ability to pick the given Objects with {@link @xeokit/viewer!View.pick}.
     *
     * @param {String[]} objectIds Array of {@link @xeokit/viewer!ViewObject.id} values.
     * @param clippable Whether or not to set clippable.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsClippable(objectIds: string[], clippable: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = (viewObject.clippable !== clippable);
            if (changed) {
                viewObject.clippable = clippable;
            }
            return changed;
        });
    }

    /**
     * Iterates with a callback over the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * @param  objectIds One or more {@link @xeokit/viewer!ViewObject.id} values.
     * @param callback Callback to execute on each {@link @xeokit/viewer!ViewObject}.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    withObjects(objectIds: string[], callback: Function): boolean {
        let changed = false;
        for (let i = 0, len = objectIds.length; i < len; i++) {
            const id = objectIds[i];
            let viewObject = this.objects[id];
            if (viewObject) {
                changed = callback(viewObject) || changed;
            }
        }
        return changed;
    }

    #initViewObjects() {
        const models = this.viewer.scene.models;
        for (const id in models) {
            const model = models[id];
            this.#createViewObjects(model);
        }
        this.viewer.scene.onModelCreated.subscribe((scene: Scene, model: SceneModel) => {
            this.#createViewObjects(model);
        });
        // this.viewer.scene.onModelDestroyed.subscribe((scene:Scene, model: SceneModel) => {
        //     this.#destroyViewObjects(model);
        // });
    }

    #createViewObjects(model: SceneModel) {
        const sceneObjects = model.objects;
        for (let id in sceneObjects) {
            const sceneObject = sceneObjects[id];
            const rendererViewObject = this.viewer.renderer.rendererObjects[id];
            if (sceneObject.layerId == this.id) {
               if (!this.objects[id]) {
                   const viewObject = new ViewObject(this, sceneObject, rendererViewObject);
                   this.objects[viewObject.id] = viewObject;
                   this.#numObjects++;
                   this.#objectIds = null; // Lazy regenerate
                   this.onObjectCreated.dispatch(this, viewObject);
               }
            }
        }
    }

    #destroyViewObjectsForModel(model: SceneModel) {
        const viewerObjects = model.objects;
        for (let id in viewerObjects) {
            const viewerObject = viewerObjects[id];
            const viewObject = this.objects[viewerObject.id];
            if (viewObject) {
                viewObject._destroy();
                this.#numObjects--;
                this.#objectIds = null; // Lazy regenerate
                this.onObjectDestroyed.dispatch(this, viewObject);
            }
        }
    }

    /**
     * Destroys this ViewLayer.
     *
     * Causes {@link @xeokit/viewer!Viewer} to fire a "viewDestroyed" event.
     */
    destroy() {
        this.#destroyViewObjects();
        this.onObjectCreated.clear();
        this.onObjectDestroyed.clear();
        this.onObjectVisibility.clear();
        super.destroy();
    }

    #destroyViewObjects() {
        const objects = this.objects;
        for (let id in objects) {
            const viewObject = objects[id];
            this.deregisterViewObject(viewObject);
            this.onObjectDestroyed.dispatch(this, viewObject);
        }
    }
}

export {ViewLayer};
