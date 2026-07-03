import type {View} from "./View";
import type {Viewer} from "./Viewer";
import type {ViewLayerParams} from "./ViewLayerParams";
import type {ViewObject} from "./ViewObject";
import type {ViewParams} from "./ViewParams";
import {SDKErrorType, type SDKResult} from "../../base/core";
import type {Vec3} from "../../base/math/vector";


/**
 * A _layer of {@link ViewObject | ViewObjects} within a {@link viewing!viewer.View | View}.
 *
 * ViewLayers allow users to group and segregate ViewObjects based on their roles or aspects in a scene, simplifying interaction and focusing operations
 * on specific object groups.
 *
 * ViewLayers group ViewObjects based on the {@link model!scene.SceneObject.layerId | layerId} of the
 * corresponding {@link model!scene.SceneObject | SceneObject}.
 *
 * See {@link viewer | @xeokit/sdk/viewing/viewer}  for more info.
 *
 * <br>
 *
 * # Automatic vs. Manual ViewLayers
 *
 * * **Automatic ViewLayers** - Created automatically on-the-fly as SceneObjects with {@link model!scene.SceneObject.layerId | layerIds}
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
 * import {Viewer} from "@xeokit/sdk/viewing/viewer";
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
 * import {Viewer} from "@xeokit/sdk/viewing/viewer";
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
 * import {Viewer} from "@xeokit/sdk/viewing/viewer";
 * import {DotBIMLoader} from "@xeokit/sdk/formats/dotbim";
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
class ViewLayer {

  /**
   ID of this ViewLayer, unique within the {@link viewing!viewer.View | View}.

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
   * These are the ViewObjects for which {@link model!scene.SceneObject.layerId | SceneObject.layerId} has the same value as the {@link ViewLayer.id | ViewLayer.id}.
   *
   * Each {@link viewing!viewer.ViewObject | ViewObject} is mapped here by {@link ViewObject.id}.
   *
   * The ViewLayer automatically ensures that there is a {@link viewing!viewer.ViewObject | ViewObject} here for
   * each {@link model!scene.SceneObjectRendererProxy | SceneObjectRendererProxy} in the {@link Viewer | Viewer}
   */
  readonly objects: { [key: string]: ViewObject };

  /**
   * Map of the currently visible {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * A ViewObject is visible when {@link ViewObject.visible} is true.
   *
   * Each {@link viewing!viewer.ViewObject | ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly visibleObjects: { [key: string]: ViewObject };

  /**
   * Map of currently x-rayed {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * A ViewObject is x-rayed when {@link ViewObject.xrayed} is true.
   *
   * Each {@link viewing!viewer.ViewObject | ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly xrayedObjects: { [key: string]: ViewObject };

  /**
   * Map of currently highlighted {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * A ViewObject is highlighted when {@link ViewObject.highlighted} is true.
   *
   * Each {@link viewing!viewer.ViewObject | ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly highlightedObjects: { [key: string]: ViewObject };

  /**
   * Map of currently selected {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * A ViewObject is selected when {@link ViewObject.selected} is true.
   *
   * Each {@link viewing!viewer.ViewObject | ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly selectedObjects: { [key: string]: ViewObject };

  /**
   * Map of currently colorized {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * Each {@link viewing!viewer.ViewObject | ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly colorizedObjects: { [key: string]: ViewObject };

  /**
   * Map of {@link ViewObject | ViewObjects} in this ViewLayer whose opacity has been updated.
   *
   * Each {@link viewing!viewer.ViewObject | ViewObject} is mapped here by {@link ViewObject.id}.
   */
  readonly opacityObjects: { [key: string]: ViewObject };

  /**
   * When true, View destroys this ViewLayer as soon as there are no ViewObjects
   * that need it. When false, View retains it.
   * @private
   */
  readonly autoDestroy: boolean;

  _renderModes: number[];
  _numObjects: number;
  _objectIds: string[] | null;
  _numVisibleObjects: number;
  _visibleObjectIds: string[] | null;
  _numXRayedObjects: number;
  _xrayedObjectIds: string[] | null;
  _numHighlightedObjects: number;
  _highlightedObjectIds: string[] | null;
  _numSelectedObjects: number;
  _selectedObjectIds: string[] | null;
  _numColorizedObjects: number;
  _colorizedObjectIds: string[] | null;
  _numOpacityObjects: number;
  _opacityObjectIds: string[] | null;

  gammaOutput: boolean;

  /**
   * True if this ViewLayer has been destroyed.
   */
  public destroyed: boolean = false;

  constructor(options: {
    id: string;
    viewer: Viewer;
    view: View;
    renderMode?: number;
    autoDestroy?: boolean;
  }) {

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

    this._numObjects = 0;
    this._numVisibleObjects = 0;
    this._numXRayedObjects = 0;
    this._numHighlightedObjects = 0;
    this._numSelectedObjects = 0;
    this._numColorizedObjects = 0;
    this._numOpacityObjects = 0;

    this._renderModes = [];
  }

  _attachViewObject(viewObject: ViewObject) {
    if (this.objects[viewObject.id]) {
      return;
    }
    this.objects[viewObject.id] = viewObject;
    this._numObjects++;
    this._objectIds = null; // Lazy regenerate
  }

  _deattachViewObject(viewObject: ViewObject) {
    const objectId = viewObject.id;
    if (!this.objects[objectId]) {
      return;
    }
    delete this.objects[objectId];
    this._numObjects--;
    this._objectIds = null; // Lazy regenerate

    if (this.visibleObjects[objectId]) {
      delete this.visibleObjects[objectId];
      this._numVisibleObjects--;
      this._visibleObjectIds = null;
    }
    if (this.xrayedObjects[objectId]) {
      delete this.xrayedObjects[objectId];
      this._numXRayedObjects--;
      this._xrayedObjectIds = null;
    }
    if (this.highlightedObjects[objectId]) {
      delete this.highlightedObjects[objectId];
      this._numHighlightedObjects--;
      this._highlightedObjectIds = null;
    }
    if (this.selectedObjects[objectId]) {
      delete this.selectedObjects[objectId];
      this._numSelectedObjects--;
      this._selectedObjectIds = null;
    }
    if (this.colorizedObjects[objectId]) {
      delete this.colorizedObjects[objectId];
      this._numColorizedObjects--;
      this._colorizedObjectIds = null;
    }
    if (this.opacityObjects[objectId]) {
      delete this.opacityObjects[objectId];
      this._numOpacityObjects--;
      this._opacityObjectIds = null;
    }
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
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[ViewLayer.renderModes] ViewLayer already destroyed"
      });
      return;
    }
    this._renderModes = value;
    this.view.needsRender();
  }

  /**
   * Gets which rendering modes in which to render the {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * Default value is [].
   */
  get renderModes(): number[] {
    return this._renderModes;
  }

  /**
   * Gets the number of {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get numObjects(): number {
    return this._numObjects;
  }

  /**
   * Gets the IDs of the {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get objectIds(): string[] {
    if (!this._objectIds) {
      this._objectIds = Object.keys(this.objects);
    }
    return this._objectIds;
  }

  /**
   * Gets the number of visible {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get numVisibleObjects(): number {
    return this._numVisibleObjects;
  }

  /**
   * Gets the IDs of the visible {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get visibleObjectIds(): string[] {
    if (!this._visibleObjectIds) {
      this._visibleObjectIds = Object.keys(this.visibleObjects);
    }
    return this._visibleObjectIds;
  }

  /**
   * Gets the number of X-rayed {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get numXRayedObjects(): number {
    return this._numXRayedObjects;
  }

  /**
   * Gets the IDs of the X-rayed {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get xrayedObjectIds(): string[] {
    if (!this._xrayedObjectIds) {
      this._xrayedObjectIds = Object.keys(this.xrayedObjects);
    }
    return this._xrayedObjectIds;
  }

  /**
   * Gets the number of highlighted {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get numHighlightedObjects(): number {
    return this._numHighlightedObjects;
  }

  /**
   * Gets the IDs of the highlighted {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get highlightedObjectIds(): string[] {
    if (!this._highlightedObjectIds) {
      this._highlightedObjectIds = Object.keys(this.highlightedObjects);
    }
    return this._highlightedObjectIds;
  }

  /**
   * Gets the number of selected {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get numSelectedObjects(): number {
    return this._numSelectedObjects;
  }

  /**
   * Gets the IDs of the selected {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get selectedObjectIds(): string[] {
    if (!this._selectedObjectIds) {
      this._selectedObjectIds = Object.keys(this.selectedObjects);
    }
    return this._selectedObjectIds;
  }

  /**
   * Gets the number of colorized {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get numColorizedObjects(): number {
    return this._numColorizedObjects;
  }

  /**
   * Gets the IDs of the colorized {@link ViewObject | ViewObjects} in this ViewLayer.
   */
  get colorizedObjectIds(): string[] {
    if (!this._colorizedObjectIds) {
      this._colorizedObjectIds = Object.keys(this.colorizedObjects);
    }
    return this._colorizedObjectIds;
  }

  /**
   * Gets the IDs of the {@link ViewObject | ViewObjects} in this ViewLayer that have updated opacities.
   */
  get opacityObjectIds(): string[] {
    if (!this._opacityObjectIds) {
      this._opacityObjectIds = Object.keys(this.opacityObjects);
    }
    return this._opacityObjectIds;
  }

  /**
   * Gets the number of {@link ViewObject | ViewObjects} in this ViewLayer that have updated opacities.
   */
  get numOpacityObjects(): number {
    return this._numOpacityObjects;
  }


  /**
   * Called by ViewObject.visible setter.
   * @private
   */
  objectVisibilityUpdated(viewObject: ViewObject, visible: boolean, notify: boolean = true) {
    if (visible) {
      this.visibleObjects[viewObject.id] = viewObject;
      this._numVisibleObjects++;
    } else {
      delete this.visibleObjects[viewObject.id];
      this._numVisibleObjects--;
    }
    this._visibleObjectIds = null; // Lazy regenerate
    this.view.objectVisibilityUpdated(viewObject, visible, notify);
  }

  /**
   * Called by ViewObject.xrayed setter.
   * @private
   */
  objectXRayedUpdated(viewObject: ViewObject, xrayed: boolean) {
    if (xrayed) {
      this.xrayedObjects[viewObject.id] = viewObject;
      this._numXRayedObjects++;
    } else {
      delete this.xrayedObjects[viewObject.id];
      this._numXRayedObjects--;
    }
    this._xrayedObjectIds = null; // Lazy regenerate
    this.view.objectXRayedUpdated(viewObject, xrayed);
  }

  /**
   * Called by ViewObject.highlighted setter.
   * @private
   */
  objectHighlightedUpdated(viewObject: ViewObject, highlighted: boolean) {
    if (highlighted) {
      this.highlightedObjects[viewObject.id] = viewObject;
      this._numHighlightedObjects++;
    } else {
      delete this.highlightedObjects[viewObject.id];
      this._numHighlightedObjects--;
    }
    this._highlightedObjectIds = null; // Lazy regenerate
    this.view.objectHighlightedUpdated(viewObject, highlighted);
  }

  /**
   * Called by ViewObject.selected setter.
   * @private
   */
  objectSelectedUpdated(viewObject: ViewObject, selected: boolean) {
    if (selected) {
      this.selectedObjects[viewObject.id] = viewObject;
      this._numSelectedObjects++;
    } else {
      delete this.selectedObjects[viewObject.id];
      this._numSelectedObjects--;
    }
    this._selectedObjectIds = null; // Lazy regenerate
    this.view.objectSelectedUpdated(viewObject, selected);
  }

  /**
   * Called by ViewObject.colorized setter.
   * @private
   */
  objectColorizeUpdated(viewObject: ViewObject, colorized: boolean) {
    if (colorized) {
      this.colorizedObjects[viewObject.id] = viewObject;
      this._numColorizedObjects++;
    } else {
      delete this.colorizedObjects[viewObject.id];
      this._numColorizedObjects--;
    }
    this._colorizedObjectIds = null; // Lazy regenerate
    this.view.objectColorizeUpdated(viewObject, colorized);
  }

  /**
   * Called by ViewObject.opacity setter.
   * @private
   */
  objectOpacityUpdated(viewObject: ViewObject, opacityUpdated: boolean) {
    if (opacityUpdated) {
      this.opacityObjects[viewObject.id] = viewObject;
      this._numOpacityObjects++;
    } else {
      delete this.opacityObjects[viewObject.id];
      this._numOpacityObjects--;
    }
    this._opacityObjectIds = null; // Lazy regenerate
    this.view.objectOpacityUpdated(viewObject, opacityUpdated);
  }

  /**
   * Called by ViewObject.pickable setter.
   * @private
   */
  objectPickableUpdated(viewObject: ViewObject, pickable: boolean) {
    this.view.objectPickableUpdated(viewObject, pickable);
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
    if (this.destroyed) {
      this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[ViewLayer.setObjectsVisible] ViewLayer already destroyed"
      });
      return;
    }

    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.visible !== visible) {
        viewObject.visible = visible; // Triggers ViewLayer.objectVisibilityUpdated
        changed = true;
      }
    }

    return changed;
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
    if (this.destroyed) {
      this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[ViewLayer.setObjectsCollidable] ViewLayer already destroyed"
      });
      return;
    }

    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.collidable !== collidable) {
        viewObject.collidable = collidable;
        changed = true;
      }
    }

    return changed;
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
    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.culled !== culled) {
        viewObject.culled = culled;
        changed = true;
      }
    }

    return changed;
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
    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.selected !== selected) {
        viewObject.selected = selected; // Triggers ViewLayer.objectSelectedUpdated
        changed = true;
      }
    }

    return changed;
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
    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.highlighted !== highlighted) {
        viewObject.highlighted = highlighted; // Triggers ViewLayer.objectHighlightedUpdated
        changed = true;
      }
    }

    return changed;
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
    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.xrayed !== xrayed) {
        viewObject.xrayed = xrayed; // Triggers ViewLayer.objectXRayedUpdated
        changed = true;
      }
    }

    return changed;
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
  setObjectsColorized(objectIds: string[], colorize: Vec3) {
    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      viewObject.colorize = colorize; // Triggers ViewLayer.objectColorizeUpdated
      changed = true;
    }

    return changed;
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
    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.opacity !== opacity) {
        viewObject.opacity = opacity; // Triggers ViewLayer.objectOpacityUpdated
        changed = true;
      }
    }

    return changed;
  }

  /**
   * Sets the pickability of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.pickable} on the Objects with the given IDs.
   * - Enables or disables the ability to pick the given Objects with {@link viewing!viewer.View.pick | View.pick}.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param pickable Whether or not to set pickable.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsPickable(objectIds: string[], pickable: boolean): boolean {
    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.pickable !== pickable) {
        viewObject.pickable = pickable;
        changed = true;
      }
    }

    return changed;
  }

  /**
   * Sets the clippability of the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * - Updates {@link ViewObject.clippable} on the Objects with the given IDs.
   * - Enables or disables the ability to pick the given Objects with {@link viewing!viewer.View.pick | View.pick}.
   *
   * @param {String[]} objectIds Array of {@link ViewObject.id} values.
   * @param clippable Whether or not to set clippable.
   * @returns True if any {@link ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
   */
  setObjectsClippable(objectIds: string[], clippable: boolean): boolean {
    let changed = false;
    const objects = this.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const viewObject = objects[objectIds[i]];
      if (!viewObject) {
        continue;
      }
      if (viewObject.clippable !== clippable) {
        viewObject.clippable = clippable;
        changed = true;
      }
    }

    return changed;
  }

  /**
   * Iterates with a callback over the given {@link ViewObject | ViewObjects} in this ViewLayer.
   *
   * @param  objectIds One or more {@link ViewObject.id} values.
   * @param callback Callback to execute on each {@link viewing!viewer.ViewObject | ViewObject}.
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

  /**
   * Configures this ViewLayer.
   *
   * @param viewLayerParams
   */
  fromParams(viewLayerParams: ViewLayerParams) : SDKResult<void> {
    return {
      ok: true,
      value: void 0
    };
  }

  /**
   * Gets the current configuration of this ViewLayer.
   */
  toParams(): SDKResult<ViewLayerParams> {
    return {
      ok: true,
      value: {
        id: this.id,
        autoDestroy: this.autoDestroy
      }
    };
  }

  /**
   * Destroys this ViewLayer.
   *
   * Causes {@link Viewer | Viewer} to fire a "viewDestroyed" event.
   */
  destroy() {
    if (this.destroyed) {
      this.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[ViewLayer.destroy] ViewLayer already destroyed"
      });
      return;
    }
    this.view._destroyLayer(this);
    this.destroyed = true;
  }
}

export {ViewLayer};
