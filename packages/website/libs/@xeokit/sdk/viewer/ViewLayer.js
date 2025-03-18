import { EventDispatcher } from "strongly-typed-events";
import { Component, EventEmitter } from "../core";
import { ViewObject } from "./ViewObject";
/**
 * A layer of {@link viewer!ViewObject | ViewObjects} within a {@link viewer!View}.
 *
 * ViewLayers allow users to group and segregate ViewObjects based on their roles or aspects in a scene, simplifying interaction and focusing operations
 * on specific object groups.
 *
 * ViewLayers group ViewObjects based on the {@link scene!SceneObject.layerId | layerId} of the
 * corresponding {@link scene!SceneObject | SceneObject}.
 *
 * See {@link "@xeokit/viewer" | @xeokit/viewer}  for more info.
 *
 * <br>
 *
 * # Automatic vs. Manual ViewLayers
 *
 * * **Automatic ViewLayers** - Created automatically on-the-fly as SceneObjects with {@link scene!SceneObject.layerId | layerIds}
 * are created and destroyed. Ensures a dynamic and self-managing system where layers appear and disappear based on the existence of relevant objects.
 *
 * * **Manual ViewLayers** - Requires user's manual creation and destruction of {@link viewer!ViewLayer | ViewLayers}.
 * ViewLayers persist even after objects are destroyed.
 *
 * <br>
 *
 * # Automatic ViewLayers
 *
 * ViewLayers are useful for separating different types of objects, such as models and environment objects. A common use case is to
 * create separate layers for models and environment objects like the ground or skybox. This allows focusing on model objects for
 * operations like highlighting, hiding, or interacting, without affecting background objects.
 *
 * Create a {@link viewer!Viewer | Viewer}:
 *
 *````javascript
 * import {Viewer} from "@xeokit/sdk/viewer";
 *
 * const myViewer = new Viewer({
 *      id: "myViewer"
 * });
 *````
 *
 * Create a {@link viewer!View | View}, with {@link ViewParams.autoLayers | autoLayers} set true:
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
 * Next, create a SceneModel with four SceneObjects. The first two SceneObjects will represent a skybox and a ground
 * plane, while the other two will represent a building foundation and walls.
 *
 * The skybox and ground plane SceneObjects will assign their ViewObjects to the "environment" ViewLayer, and the building
 * foundation and walls will assign theirs to the "model" ViewLayer.
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
 * Our {@link viewer!View | View} now has an "environment" {@link viewer!ViewLayer | ViewLayer}, which
 * contains {@link viewer!ViewObject | ViewObjects} for the skybox and ground plane, and a "model" ViewLayer, which
 * contains ViewObjects for the house foundation and walls.
 *
 * We can now focus our updates on the ViewObjects in each ViewLayer.
 *
 * ````javascript
 * const environmentLayer = view1.layers["environment"];
 * environmentLayer.setObjectsVisible(environmentLayer.objectIds, true);

 * const modelLayer = view1.layers["model"];
 * modelLayer.setObjectsSelected(modelLayer.objectIds, true);
 * ````
 *
 * <br>
 *
 * # Manual ViewLayers
 *
 * Create a {@link viewer!Viewer | Viewer}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/sdk/viewer";
 *
 * const myViewer = new Viewer({
 *      id: "myViewer"
 * });
 * ````
 *
 * Create a {@link viewer!View | View} with {@link ViewParams.autoLayers | autoLayers} set false.
 *
 * This will prevent the View from creating ViewLayers automatically.
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
 * Create a "model" ViewLayer, but this time don't create an "environment" ViewLayer:
 *
 * ````javascript
 * const modelViewLayer = view1.createLayer({
 *     id: "model",
 *     visible: true
 * });
 * ````
 *
 * As in the previous example, we'll now create a SceneModel containing two model SceneObjects representing a building foundation and
 * walls, along with two environmental ViewerObjects representing a skybox and ground plane.
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
 * This time, however, our View has created ViewObjects only for the "model" SceneObjects, while ignoring the "environment" SceneObjects.
 *
 * From this View's perspective, the "environment" SceneObjects don't exist because no "environmnet" ViewLayer exists.
 *
 * ````javascript
 * const modelLayer = view1.layers["model"];
 * modelLayer.setObjectsVisible(modelLayer.objectIds, true);
 * ````
 *
 * <br>
 *
 * # Loading a model into a ViewLayer
 *
 * Create a Viewer:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/sdk/viewer";
 * import {loadDotBIM} from "@xeokit/sdk/dotbim";
 *
 * const myViewer = new Viewer({
 *      id: "myViewer"
 * });
 * ````
 *
 * Create a View, with autoLayers set true:
 *
 * ````javascript
 *
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
 * Create a SceneModel, with layerId "environmental", and create some environmental objects in it.
 *
 * ````javascript
 * const environentSceneModel = myViewer.scene.createModel({
 *      id: "myModel",
 *      layerId: "environment"
 * });
 *
 * //...
 *
 * environentSceneModel.createObject({
 *      id: "ground",
 *      meshIds: ["groundMesh}]
 * });
 *
 * environentSceneModel.createObject({
 *      id: "skyBox",
 *      meshIds: ["skyBoxMesh}]
 * });
 *
 * environentSceneModel.build();
 *
 * ````
 *
 * Create a second SceneModel, with layerId "model", and load a BIM model into it.
 *
 * ````javascript
 * const modelSceneModel = myViewer.scene.createModel({
 *      id: "myModel2",
 *      layerId: "model",
 * });
 *
 * fetch(`model.bim`)
 *     .then(response => {
 *         response
 *             .json()
 *             .then(fileData => {
 *                 loadDotBIM({
 *                     fileData,
 *                     modelSceneModel
 *                 })
 *                 .then(()=>{
 *                     modelSceneModel.build();
 *                 })
 *                 .catch(err => {
 *                     console.error(err);
 *                 });
 *              }).catch(err => {
 *                  console.error(err);
 *              });
 *     }).catch(err => {
 *         console.error(err);
 *     });
 * ````
 *
 * All our model objects are now in the "model" ViewLayer, and all our environmental objects are in the "environment" ViewLayer.
 *
 * Let's show all the model objects, and hide all the environmental objects:
 *
 * ````javascript
 * const modelLayer = view1.layers["model"];
 * modelLayer.setObjectsVisible(modelLayer.objectIds, true);
 *
 * const environmentLayer = view1.layers["environmentLayer"];
 * environmentLayer.setObjectsVisible(environmentLayer.objectIds, false);
 * ````
 */
class ViewLayer extends Component {
    /**
     * Map of the all {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * These are the ViewObjects for which {@link viewer!ViewObject.layerId | ViewObject.layerId} has the same value as {@link viewer!ViewLayer.id}.
     *
     * Each {@link viewer!ViewObject} is mapped here by {@link viewer!ViewObject.id}.
     *
     * The ViewLayer automatically ensures that there is a {@link viewer!ViewObject} here for
     * each {@link RendererObject} in the {@link viewer!Viewer | Viewer}
     */
    objects;
    /**
     * Map of the currently visible {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * A ViewObject is visible when {@link viewer!ViewObject.visible} is true.
     *
     * Each {@link viewer!ViewObject} is mapped here by {@link viewer!ViewObject.id}.
     */
    visibleObjects;
    /**
     * Map of currently x-rayed {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * A ViewObject is x-rayed when {@link viewer!ViewObject.xrayed} is true.
     *
     * Each {@link viewer!ViewObject} is mapped here by {@link viewer!ViewObject.id}.
     */
    xrayedObjects;
    /**
     * Map of currently highlighted {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * A ViewObject is highlighted when {@link viewer!ViewObject.highlighted} is true.
     *
     * Each {@link viewer!ViewObject} is mapped here by {@link viewer!ViewObject.id}.
     */
    highlightedObjects;
    /**
     * Map of currently selected {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * A ViewObject is selected when {@link viewer!ViewObject.selected} is true.
     *
     * Each {@link viewer!ViewObject} is mapped here by {@link viewer!ViewObject.id}.
     */
    selectedObjects;
    /**
     * Map of currently colorized {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * Each {@link viewer!ViewObject} is mapped here by {@link viewer!ViewObject.id}.
     */
    colorizedObjects;
    /**
     * Map of {@link viewer!ViewObject | ViewObjects} in this ViewLayer whose opacity has been updated.
     *
     * Each {@link viewer!ViewObject} is mapped here by {@link viewer!ViewObject.id}.
     */
    opacityObjects;
    /**
     * When true, View destroys this ViewLayer as soon as there are no ViewObjects
     * that need it. When false, View retains it.
     * @private
     */
    autoDestroy;
    /**
     * Emits an event each time a {@link viewer!ViewObject} is created in this ViewLayer.
     *
     * @event
     */
    onObjectCreated;
    /**
     * Emits an event each time a {@link viewer!ViewObject} is destroyed in this ViewLayer.
     *
     * @event
     */
    onObjectDestroyed;
    /**
     * Emits an event each time the visibility of a {@link viewer!ViewObject} changes.
     *
     * ViewObjects are shown and hidden with {@link View.setObjectsVisible}, {@link viewer!ViewLayer.setObjectsVisible} or {@link viewer!ViewObject.visible}.
     *
     * @event
     */
    onObjectVisibility;
    #renderModes;
    #numObjects;
    #objectIds;
    #numVisibleObjects;
    #visibleObjectIds;
    #numXRayedObjects;
    #xrayedObjectIds;
    #numHighlightedObjects;
    #highlightedObjectIds;
    #numSelectedObjects;
    #selectedObjectIds;
    #numColorizedObjects;
    #colorizedObjectIds;
    #numOpacityObjects;
    #opacityObjectIds;
    #qualityRender;
    gammaOutput;
    constructor(options) {
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
        this.#numXRayedObjects = 0;
        this.#numHighlightedObjects = 0;
        this.#numSelectedObjects = 0;
        this.#numColorizedObjects = 0;
        this.#numOpacityObjects = 0;
        this.#qualityRender = !!options.qualityRender;
        this.#renderModes = [];
        this.onObjectCreated = new EventEmitter(new EventDispatcher());
        this.onObjectDestroyed = new EventEmitter(new EventDispatcher());
        this.onObjectVisibility = new EventEmitter(new EventDispatcher());
        this.#initViewObjects();
    }
    /**
     * Gets the gamma factor.
     */
    get gammaFactor() {
        return 1.0;
    }
    /**
     * Sets which rendering modes in which to render the {@link ViewObject | ViewObjects} in this ViewLayer.
     *
     * Default value is [].
     */
    set renderModes(value) {
        this.#renderModes = value;
        this.view.redraw();
    }
    /**
     * Gets which rendering modes in which to render the {@link ViewObject | ViewObjects} in this ViewLayer.
     *
     * Default value is [].
     */
    get renderModes() {
        return this.#renderModes;
    }
    /**
     * Gets the number of {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get numObjects() {
        return this.#numObjects;
    }
    /**
     * Gets the IDs of the {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get objectIds() {
        if (!this.#objectIds) {
            this.#objectIds = Object.keys(this.objects);
        }
        return this.#objectIds;
    }
    /**
     * Gets the number of visible {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get numVisibleObjects() {
        return this.#numVisibleObjects;
    }
    /**
     * Gets the IDs of the visible {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get visibleObjectIds() {
        if (!this.#visibleObjectIds) {
            this.#visibleObjectIds = Object.keys(this.visibleObjects);
        }
        return this.#visibleObjectIds;
    }
    /**
     * Gets the number of X-rayed {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get numXRayedObjects() {
        return this.#numXRayedObjects;
    }
    /**
     * Gets the IDs of the X-rayed {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get xrayedObjectIds() {
        if (!this.#xrayedObjectIds) {
            this.#xrayedObjectIds = Object.keys(this.xrayedObjects);
        }
        return this.#xrayedObjectIds;
    }
    /**
     * Gets the number of highlighted {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get numHighlightedObjects() {
        return this.#numHighlightedObjects;
    }
    /**
     * Gets the IDs of the highlighted {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get highlightedObjectIds() {
        if (!this.#highlightedObjectIds) {
            this.#highlightedObjectIds = Object.keys(this.highlightedObjects);
        }
        return this.#highlightedObjectIds;
    }
    /**
     * Gets the number of selected {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get numSelectedObjects() {
        return this.#numSelectedObjects;
    }
    /**
     * Gets the IDs of the selected {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get selectedObjectIds() {
        if (!this.#selectedObjectIds) {
            this.#selectedObjectIds = Object.keys(this.selectedObjects);
        }
        return this.#selectedObjectIds;
    }
    /**
     * Gets the number of colorized {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get numColorizedObjects() {
        return this.#numColorizedObjects;
    }
    /**
     * Gets the IDs of the colorized {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     */
    get colorizedObjectIds() {
        if (!this.#colorizedObjectIds) {
            this.#colorizedObjectIds = Object.keys(this.colorizedObjects);
        }
        return this.#colorizedObjectIds;
    }
    /**
     * Gets the IDs of the {@link viewer!ViewObject | ViewObjects} in this ViewLayer that have updated opacities.
     */
    get opacityObjectIds() {
        if (!this.#opacityObjectIds) {
            this.#opacityObjectIds = Object.keys(this.opacityObjects);
        }
        return this.#opacityObjectIds;
    }
    /**
     * Gets the number of {@link viewer!ViewObject | ViewObjects} in this ViewLayer that have updated opacities.
     */
    get numOpacityObjects() {
        return this.#numOpacityObjects;
    }
    /**
     * @private
     */
    registerViewObject(viewObject) {
        this.objects[viewObject.id] = viewObject;
        this.#numObjects++;
        this.#objectIds = null; // Lazy regenerate
        this.onObjectCreated.dispatch(this, viewObject);
    }
    /**
     * @private
     */
    deregisterViewObject(viewObject) {
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
    objectVisibilityUpdated(viewObject, visible, notify = true) {
        if (visible) {
            this.visibleObjects[viewObject.id] = viewObject;
            this.#numVisibleObjects++;
        }
        else {
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
    objectXRayedUpdated(viewObject, xrayed) {
        if (xrayed) {
            this.xrayedObjects[viewObject.id] = viewObject;
            this.#numXRayedObjects++;
        }
        else {
            delete this.xrayedObjects[viewObject.id];
            this.#numXRayedObjects--;
        }
        this.#xrayedObjectIds = null; // Lazy regenerate
        this.view.objectXRayedUpdated(viewObject, xrayed);
    }
    /**
     * @private
     */
    objectHighlightedUpdated(viewObject, highlighted) {
        if (highlighted) {
            this.highlightedObjects[viewObject.id] = viewObject;
            this.#numHighlightedObjects++;
        }
        else {
            delete this.highlightedObjects[viewObject.id];
            this.#numHighlightedObjects--;
        }
        this.#highlightedObjectIds = null; // Lazy regenerate
        this.view.objectHighlightedUpdated(viewObject, highlighted);
    }
    /**
     * @private
     */
    objectSelectedUpdated(viewObject, selected) {
        if (selected) {
            this.selectedObjects[viewObject.id] = viewObject;
            this.#numSelectedObjects++;
        }
        else {
            delete this.selectedObjects[viewObject.id];
            this.#numSelectedObjects--;
        }
        this.#selectedObjectIds = null; // Lazy regenerate
        this.view.objectSelectedUpdated(viewObject, selected);
    }
    /**
     * @private
     */
    objectColorizeUpdated(viewObject, colorized) {
        if (colorized) {
            this.colorizedObjects[viewObject.id] = viewObject;
            this.#numColorizedObjects++;
        }
        else {
            delete this.colorizedObjects[viewObject.id];
            this.#numColorizedObjects--;
        }
        this.#colorizedObjectIds = null; // Lazy regenerate
        this.view.objectColorizeUpdated(viewObject, colorized);
    }
    /**
     * @private
     */
    objectOpacityUpdated(viewObject, opacityUpdated) {
        if (opacityUpdated) {
            this.opacityObjects[viewObject.id] = viewObject;
            this.#numOpacityObjects++;
        }
        else {
            delete this.opacityObjects[viewObject.id];
            this.#numOpacityObjects--;
        }
        this.#opacityObjectIds = null; // Lazy regenerate
        this.view.objectOpacityUpdated(viewObject, opacityUpdated);
    }
    /**
     * Updates the visibility of the given {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link viewer!ViewObject.visible} on the Objects with the given IDs.
     * - Updates {@link viewer!ViewLayer.visibleObjects} and {@link viewer!ViewLayer.numVisibleObjects}.
     *
     * @param {String[]} objectIds Array of {@link viewer!ViewObject.id} values.
     * @param visible Whether or not to cull.
     * @returns True if any {@link viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsVisible(objectIds, visible) {
        return this.withObjects(objectIds, (viewObject) => {
            const changed = (viewObject.visible !== visible);
            viewObject.visible = visible;
            if (changed) {
                this.onObjectVisibility.dispatch(this, viewObject);
            }
            return changed;
        });
    }
    /**
     * Updates the collidability of the given {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * Updates {@link viewer!ViewObject.collidable} on the Objects with the given IDs.
     *
     * @param {String[]} objectIds Array of {@link viewer!ViewObject.id} values.
     * @param collidable Whether or not to cull.
     * @returns True if any {@link viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCollidable(objectIds, collidable) {
        return this.withObjects(objectIds, (viewObject) => {
            const changed = (viewObject.collidable !== collidable);
            viewObject.collidable = collidable;
            return changed;
        });
    }
    /**
     * Updates the culled status of the given {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * Updates {@link viewer!ViewObject.culled} on the Objects with the given IDs.
     *
     * @param {String[]} objectIds Array of {@link viewer!ViewObject.id} values.
     * @param culled Whether or not to cull.
     * @returns True if any {@link viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCulled(objectIds, culled) {
        return this.withObjects(objectIds, (viewObject) => {
            const changed = (viewObject.culled !== culled);
            viewObject.culled = culled;
            return changed;
        });
    }
    /**
     * Selects or deselects the given {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link viewer!ViewObject.selected} on the Objects with the given IDs.
     * - Updates {@link viewer!ViewLayer.selectedObjects} and {@link viewer!ViewLayer.numSelectedObjects}.
     *
     * @param  objectIds One or more {@link viewer!ViewObject.id} values.
     * @param selected Whether or not to select.
     * @returns True if any {@link viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsSelected(objectIds, selected) {
        return this.withObjects(objectIds, (viewObject) => {
            const changed = (viewObject.selected !== selected);
            viewObject.selected = selected;
            return changed;
        });
    }
    /**
     * Highlights or un-highlights the given {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link viewer!ViewObject.highlighted} on the Objects with the given IDs.
     * - Updates {@link viewer!ViewLayer.highlightedObjects} and {@link viewer!ViewLayer.numHighlightedObjects}.
     *
     * @param  objectIds One or more {@link viewer!ViewObject.id} values.
     * @param highlighted Whether or not to highlight.
     * @returns True if any {@link viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsHighlighted(objectIds, highlighted) {
        return this.withObjects(objectIds, (viewObject) => {
            const changed = (viewObject.highlighted !== highlighted);
            viewObject.highlighted = highlighted;
            return changed;
        });
    }
    /**
     * Applies or removes X-ray rendering for the given {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link viewer!ViewObject.xrayed} on the Objects with the given IDs.
     * - Updates {@link viewer!ViewLayer.xrayedObjects} and {@link viewer!ViewLayer.numXRayedObjects}.
     *
     * @param  objectIds One or more {@link viewer!ViewObject.id} values.
     * @param xrayed Whether or not to xray.
     * @returns True if any {@link viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsXRayed(objectIds, xrayed) {
        return this.withObjects(objectIds, (viewObject) => {
            const changed = (viewObject.xrayed !== xrayed);
            if (changed) {
                viewObject.xrayed = xrayed;
            }
            return changed;
        });
    }
    /**
     * Colorizes the given {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link viewer!ViewObject.colorize} on the Objects with the given IDs.
     * - Updates {@link viewer!ViewLayer.colorizedObjects} and {@link viewer!ViewLayer.numColorizedObjects}.
     *
     * @param  objectIds One or more {@link viewer!ViewObject.id} values.
     * @param colorize - RGB colorize factors in range ````[0..1,0..1,0..1]````.
     * @returns True if any {@link viewer!ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
     */
    setObjectsColorized(objectIds, colorize) {
        return this.withObjects(objectIds, (viewObject) => {
            viewObject.colorize = colorize;
        });
    }
    /**
     * Sets the opacity of the given {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link viewer!ViewObject.opacity} on the Objects with the given IDs.
     * - Updates {@link viewer!ViewLayer.opacityObjects} and {@link viewer!ViewLayer.numOpacityObjects}.
     *
     * @param  objectIds - One or more {@link viewer!ViewObject.id} values.
     * @param opacity - Opacity factor in range ````[0..1]````.
     * @returns True if any {@link viewer!ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
     */
    setObjectsOpacity(objectIds, opacity) {
        return this.withObjects(objectIds, (viewObject) => {
            const changed = (viewObject.opacity !== opacity);
            if (changed) {
                viewObject.opacity = opacity;
            }
            return changed;
        });
    }
    /**
     * Sets the pickability of the given {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link viewer!ViewObject.pickable} on the Objects with the given IDs.
     * - Enables or disables the ability to pick the given Objects with {@link viewer!View.pick}.
     *
     * @param {String[]} objectIds Array of {@link viewer!ViewObject.id} values.
     * @param pickable Whether or not to set pickable.
     * @returns True if any {@link viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsPickable(objectIds, pickable) {
        return this.withObjects(objectIds, (viewObject) => {
            const changed = (viewObject.pickable !== pickable);
            if (changed) {
                viewObject.pickable = pickable;
            }
            return changed;
        });
    }
    /**
     * Sets the clippability of the given {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * - Updates {@link viewer!ViewObject.clippable} on the Objects with the given IDs.
     * - Enables or disables the ability to pick the given Objects with {@link viewer!View.pick}.
     *
     * @param {String[]} objectIds Array of {@link viewer!ViewObject.id} values.
     * @param clippable Whether or not to set clippable.
     * @returns True if any {@link viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsClippable(objectIds, clippable) {
        return this.withObjects(objectIds, (viewObject) => {
            const changed = (viewObject.clippable !== clippable);
            if (changed) {
                viewObject.clippable = clippable;
            }
            return changed;
        });
    }
    /**
     * Iterates with a callback over the given {@link viewer!ViewObject | ViewObjects} in this ViewLayer.
     *
     * @param  objectIds One or more {@link viewer!ViewObject.id} values.
     * @param callback Callback to execute on each {@link viewer!ViewObject}.
     * @returns True if any {@link viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    withObjects(objectIds, callback) {
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
        this.viewer.scene.onModelCreated.subscribe((scene, model) => {
            this.#createViewObjects(model);
        });
        // this.viewer.scene.onModelDestroyed.subscribe((scene:Scene, model: SceneModel) => {
        //     this.#destroyViewObjects(model);
        // });
    }
    #createViewObjects(model) {
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
    #destroyViewObjectsForModel(model) {
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
     * Causes {@link viewer!Viewer | Viewer} to fire a "viewDestroyed" event.
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
export { ViewLayer };
//# sourceMappingURL=ViewLayer.js.map