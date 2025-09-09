import {Component, EventEmitter} from "../core";
import type {Scene, SceneModel} from "../scene";
import {EventDispatcher} from "strongly-typed-events";
import type {View} from "./View";
import type {Viewer} from "./Viewer";
import type {ViewLayerParams} from "./ViewLayerParams";
import {ViewObject} from "./ViewObject";
import type {ViewParams} from "./ViewParams";


/**
 * A _layer of {@link ViewObject | ViewObjects} within a {@link View}.
 *
 * ViewLayers allow users to group and segregate ViewObjects based on their roles or aspects in a scene, simplifying interaction and focusing operations
 * on specific object groups.
 *
 * ViewLayers group ViewObjects based on the {@link scene!SceneObject.layerId | layerId} of the
 * corresponding {@link scene!SceneObject | SceneObject}.
 *
 * See {@link viewer | @xeokit/sdk/viewer}  for more info.
 *
 * <br>
 *
 * # Automatic vs. Manual ViewLayers
 *
 * * **Automatic ViewLayers** - Created automatically on-the-fly as SceneObjects with {@link scene!SceneObject.layerId | layerIds}
 * are created and destroyed. Ensures a dynamic and self-managing system where layers appear and disappear based on the existence of relevant objects.
 *
 * * **Manual ViewLayers** - Requires user's manual creation and destruction of {@link ViewLayer | ViewLayers}.
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
 * Create a {@link Viewer | Viewer}:
 *
 *````javascript
 * import {Viewer} from "@xeokit/sdk/viewer";
 *
 * const myViewer = new Viewer({
 *      id: "myViewer"
 * });
 *````
 *
 * Create a {@link View | View}, with {@link ViewParams.autoLayers | autoLayers} set true:
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
 * ````
 *
 * Our {@link View | View} now has an "environment" {@link ViewLayer | ViewLayer}, which
 * contains {@link ViewObject | ViewObjects} for the skybox and ground plane, and a "model" ViewLayer, which
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
 * Create a {@link Viewer | Viewer}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/sdk/viewer";
 *
 * const myViewer = new Viewer({
 *      id: "myViewer"
 * });
 * ````
 *
 * Create a {@link View | View} with {@link ViewParams.autoLayers | autoLayers} set false.
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
 * ````
 *
 * This time, however, our View has created ViewObjects only for the "model" SceneObjects, while ignoring the "environment" SceneObjects.
 *
 * From this View's perspective, the "environment" SceneObjects don't exist because no "environment" ViewLayer exists.
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
 * import {DotBIMLoader} from "@xeokit/sdk/dotbim";
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
 *                 DotBIMLoader({
 *                     fileData,
 *                     modelSceneModel
 *                 })
 *                 .then(()=>{
 *                     // Loaded
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
   ID of this ViewLayer, unique within the {@link View}.

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
   * Map of the all {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * These are the ViewObjects for which {@link scene!SceneObject.layerId | SceneObject.layerId} has the same value as the {@link ViewLayer.id | ViewLayer.id}.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   *
   * The ViewLayer automatically ensures that there is a {@link ViewObject} here for
   * each {@link scene!RendererObject} in the {@link Viewer | Viewer}
   */
  readonly objects: { [key: string]: ViewObject };

  /**
   * Map of the currently visible {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * A ViewObject is visible when {@link ViewObject.visible} is true.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly visibleObjects: { [key: string]: ViewObject };

  /**
   * Map of currently x-rayed {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * A ViewObject is x-rayed when {@link ViewObject.xrayed} is true.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly xrayedObjects: { [key: string]: ViewObject };

  /**
   * Map of currently highlighted {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * A ViewObject is highlighted when {@link ViewObject.highlighted} is true.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly highlightedObjects: { [key: string]: ViewObject };

  /**
   * Map of currently selected {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * A ViewObject is selected when {@link ViewObject.selected} is true.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly selectedObjects: { [key: string]: ViewObject };

  /**
   * Map of currently colorized {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly colorizedObjects: { [key: string]: ViewObject };

  /**
   * Map of {@link ViewObject | ViewObjects} in this ViewLayer whose opacity has been updated.
   *
   * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly opacityObjects: { [key: string]: ViewObject };

  /**
   * When true, View destroys this ViewLayer as soon as there are no ViewObjects
   * that need it. When false, View retains it.
   * @private
   */
  autoDestroy: boolean;

  /**
   * Emits an event each time a {@link ViewObject} is created in this ViewLayer.
   *
   * @event
   */
  readonly onObjectCreated: EventEmitter<ViewLayer, ViewObject>;

  /**
   * Emits an event each time a {@link ViewObject} is destroyed in this ViewLayer.
   *
   * @event
   */
  readonly onObjectDestroyed: EventEmitter<ViewLayer, ViewObject>;

  /**
   * Emits an event each time the visibility of a {@link ViewObject} changes.
   *
   * ViewObjects are shown and hidden with {@link View.setObjectsVisible}, {@link ViewLayer.setObjectsVisible} or {@link ViewObject.visible}.
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

  gammaOutput: boolean;

  constructor(options: {
    id: string;
    viewer: Viewer;
    view: View;
    renderMode?: number;
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
    this.view.needsRender();
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
   * Gets the number of {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get numObjects(): number {
    return this.#numObjects;
  }

  /**
   * Gets the IDs of the {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get objectIds(): string[] {
    if (!this.#objectIds) {
      this.#objectIds = Object.keys(this.objects);
    }
    return this.#objectIds;
  }

  /**
   * Gets the number of visible {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get numVisibleObjects(): number {
    return this.#numVisibleObjects;
  }

  /**
   * Gets the IDs of the visible {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get visibleObjectIds(): string[] {
    if (!this.#visibleObjectIds) {
      this.#visibleObjectIds = Object.keys(this.visibleObjects);
    }
    return this.#visibleObjectIds;
  }

  /**
   * Gets the number of X-rayed {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get numXRayedObjects(): number {
    return this.#numXRayedObjects;
  }

  /**
   * Gets the IDs of the X-rayed {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get xrayedObjectIds(): string[] {
    if (!this.#xrayedObjectIds) {
      this.#xrayedObjectIds = Object.keys(this.xrayedObjects);
    }
    return this.#xrayedObjectIds;
  }

  /**
   * Gets the number of highlighted {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get numHighlightedObjects(): number {
    return this.#numHighlightedObjects;
  }

  /**
   * Gets the IDs of the highlighted {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get highlightedObjectIds(): string[] {
    if (!this.#highlightedObjectIds) {
      this.#highlightedObjectIds = Object.keys(this.highlightedObjects);
    }
    return this.#highlightedObjectIds;
  }

  /**
   * Gets the number of selected {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get numSelectedObjects(): number {
    return this.#numSelectedObjects;
  }

  /**
   * Gets the IDs of the selected {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get selectedObjectIds(): string[] {
    if (!this.#selectedObjectIds) {
      this.#selectedObjectIds = Object.keys(this.selectedObjects);
    }
    return this.#selectedObjectIds;
  }

  /**
   * Gets the number of colorized {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get numColorizedObjects(): number {
    return this.#numColorizedObjects;
  }

  /**
   * Gets the IDs of the colorized {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get colorizedObjectIds(): string[] {
    if (!this.#colorizedObjectIds) {
      this.#colorizedObjectIds = Object.keys(this.colorizedObjects);
    }
    return this.#colorizedObjectIds;
  }

  /**
   * Gets the IDs of the {@link ViewObject | ViewObjects} in this ViewLayer that have updated opacities.
   */
  get opacityObjectIds(): string[] {
    if (!this.#opacityObjectIds) {
      this.#opacityObjectIds = Object.keys(this.opacityObjects);
    }
    return this.#opacityObjectIds;
  }

  /**
   * Gets the number of {@link ViewObject | ViewObjects} in this ViewLayer that have updated opacities.
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
   * Updates the visibility of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.visible} on the Objects with the given IDs.
   * - Updates {@link ViewLayer.visibleObjects} and {@link ViewLayer.numVisibleObjects}.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param visible Whether or not to cull.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
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
   * Updates the collidability of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * Updates {@link ViewObject.collidable} on the Objects with the given IDs.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param collidable Whether or not to cull.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsCollidable(objectIds: string[], collidable: boolean): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = (viewObject.collidable !== collidable);
      viewObject.collidable = collidable;
      return changed;
    });
  }

  /**
   * Updates the culled status of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * Updates {@link ViewObject.culled} on the Objects with the given IDs.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param culled Whether or not to cull.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsCulled(objectIds: string[], culled: boolean): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = (viewObject.culled !== culled);
      viewObject.culled = culled;
      return changed;
    });
  }

  /**
   * Selects or deselects the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.selected} on the Objects with the given IDs.
   * - Updates {@link ViewLayer.selectedObjects} and {@link ViewLayer.numSelectedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param selected Whether or not to select.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsSelected(objectIds: string[], selected: boolean): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = (viewObject.selected !== selected);
      viewObject.selected = selected;
      return changed;
    });
  }

  /**
   * Highlights or un-highlights the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.highlighted} on the Objects with the given IDs.
   * - Updates {@link ViewLayer.highlightedObjects} and {@link ViewLayer.numHighlightedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param highlighted Whether or not to highlight.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsHighlighted(objectIds: string[], highlighted: boolean): boolean {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      const changed = (viewObject.highlighted !== highlighted);
      viewObject.highlighted = highlighted;
      return changed;
    });
  }

  /**
   * Applies or removes X-ray rendering for the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.xrayed} on the Objects with the given IDs.
   * - Updates {@link ViewLayer.xrayedObjects} and {@link ViewLayer.numXRayedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param xrayed Whether or not to xray.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
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
   * Colorizes the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.colorize} on the Objects with the given IDs.
   * - Updates {@link ViewLayer.colorizedObjects} and {@link ViewLayer.numColorizedObjects}.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param colorize - RGB colorize factors in range ````[0..1,0..1,0..1]````.
   * @returns True if any {@link ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
   */
  setObjectsColorized(objectIds: string[], colorize: number[]) {
    return this.withObjects(objectIds, (viewObject: ViewObject) => {
      viewObject.colorize = colorize;
    });
  }

  /**
   * Sets the opacity of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.opacity} on the Objects with the given IDs.
   * - Updates {@link ViewLayer.opacityObjects} and {@link ViewLayer.numOpacityObjects}.
   *
   * @param  objectIds - One or more {@link ViewObject.id} values.
   * @param opacity - Opacity factor in range ````[0..1]````.
   * @returns True if any {@link ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
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
   * Sets the pickability of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.pickable} on the Objects with the given IDs.
   * - Enables or disables the ability to pick the given Objects with {@link View.pick}.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param pickable Whether or not to set pickable.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
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
   * Sets the clippability of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.clippable} on the Objects with the given IDs.
   * - Enables or disables the ability to pick the given Objects with {@link View.pick}.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param clippable Whether or not to set clippable.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
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
   * Iterates with a callback over the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param callback Callback to execute on each {@link ViewObject}.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  withObjects(objectIds: string[], callback: Function): boolean {
    let changed = false;
    for (let i = 0, len = objectIds.length; i < len; i++) {
      const id = objectIds[i];
      const viewObject = this.objects[id];
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
    for (const id in sceneObjects) {
      const sceneObject = sceneObjects[id];
      if (!sceneObject.rendererObject) {
        throw "Cannot create ViewObject for SceneObject that has no RendererObject: " + sceneObject.id;
      }
      if (sceneObject.layerId == this.id) {
        if (!this.objects[id]) {
          const viewObject = new ViewObject(this, sceneObject);
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
    for (const id in viewerObjects) {
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
   * Configures this ViewLayer.
   *
   * @param viewLayerParams
   */
  fromParams(viewLayerParams: ViewLayerParams) {
    if (viewLayerParams.autoDestroy) {
      this.autoDestroy = viewLayerParams.autoDestroy;
    }
  }

  /**
   * Gets the current configuration of this ViewLayer.
   */
  toParams(): ViewLayerParams {
    return {
      id: this.id,
      autoDestroy: this.autoDestroy
    };
  }

  /**
   * Destroys this ViewLayer.
   *
   * Causes {@link Viewer | Viewer} to fire a "viewDestroyed" event.
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
    for (const id in objects) {
      const viewObject = objects[id];
      this.deregisterViewObject(viewObject);
      this.onObjectDestroyed.dispatch(this, viewObject);
    }
  }
}

export {ViewLayer};
