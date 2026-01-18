import {SDKErrorType, type SDKResult} from "../core";
import {SceneModel} from "./SceneModel";
import type {SceneModelParams} from "./SceneModelParams";
import type {SceneObject} from "./SceneObject";
import {CoordinateSystem} from "./CoordinateSystem";
import {type SceneParams} from "./SceneParams";
import {SceneMesh} from "./SceneMesh";
import {SceneGeometry} from "./SceneGeometry";
import {SceneEvents} from "./SceneEvents";
import {createUUID} from "../utils";

/**
 * Represents the root container for all scene‑level state, including models, objects,
 * meshes, geometries, textures and runtime events.
 *
 * A `Scene` serves as the authoritative registry and lifecycle manager of:
 *
 * - {@link SceneModel | SceneModels}
 * - {@link SceneObject | SceneObjects}
 * - {@link SceneMesh | SceneMeshes}
 * - {@link SceneGeometry | SceneGeometries}
 * - Texture sets and textures (when applicable)
 *
 * It provides:
 * - A shared {@link CoordinateSystem | coordinate system}
 * - A central event hub via {@link SceneEvents}
 * - Lifecycle management (creation, destruction, registration)
 * - Error reporting with optional console logging
 *
 * See {@link scene | @xeokit/sdk/scene} for general usage examples.
 */
export class Scene {

  /**
   * Unique ID of this Scene.
   * This is generated automatically.
   */
  public readonly id: string;

  /**
   * The coordinate system used throughout this Scene.
   *
   * This determines how all positions, orientations, and transformations
   * within the Scene are interpreted.
   */
  public readonly coordinateSystem: CoordinateSystem;

  /**
   * All {@link SceneModel} instances belonging to this Scene, keyed by
   * their {@link SceneModel.id | unique model ID}.
   */
  public readonly models: { [key: string]: SceneModel };

  /**
   * All {@link SceneObject} instances currently registered in this Scene.
   *
   * Objects are stored at the Scene level so tools and utilities can
   * access them without needing to know which model they belong to.
   */
  public readonly objects: { [key: string]: SceneObject };

  /**
   * Event dispatcher for Scene‑level lifecycle events.
   */
  public readonly events: SceneEvents;

  /**
   * Indicates whether this Scene has been destroyed.
   *
   * When `true`, new models cannot be created and most operations will
   * return an error result.
   */
  public destroyed: boolean = false;

  /**
   * Enables or disables console logging of SDK errors.
   *
   * Defaults to `false`. When enabled, any dispatched error will also be
   * logged via `console.error`.
   */
  public logging: boolean = true;

  /**
   * Creates a new Scene.
   *
   * @param params Optional configuration including coordinate system settings
   * and logging preferences.
   */
  constructor(params?: SceneParams) {
    this.id = params?.id || createUUID();
    this.events = new SceneEvents();
    this.coordinateSystem = new CoordinateSystem(this, params?.coordinateSystem);
    this.models = {};
    this.objects = {};
    this.logging = params?.logging ?? false;
  }

  /**
   * Creates and registers a new {@link SceneModel} in this Scene.
   *
   * - Validates that the Scene is not destroyed and the model ID is unique.
   * - Instantiates the SceneModel and populates it from the given parameters.
   * - Registers the model and dispatches a creation event.
   * - If population fails, destroys the model and all its components (objects, meshes, geometries),
   *   dispatching destruction events for each component and the model itself.
   *
   * @param sceneModelParams Parameters for the new SceneModel.
   * @returns SDKResult containing the created SceneModel or an error.
   */
  createModel(sceneModelParams: SceneModelParams): SDKResult<SceneModel> {
    if (this.destroyed) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Scene.createModel] Scene already destroyed",
      });
    }

    const id = sceneModelParams.id ?? createUUID();

    if (this.models[id]) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[Scene.createModel] SceneModel already exists in this Scene: ${id}`,
      });
    }

    const paramsWithId: SceneModelParams = { ...sceneModelParams, id };
    const sceneModel = new SceneModel(this, paramsWithId);

    this.models[id] = sceneModel;
    this.events.onSceneModelCreated.dispatch(this, sceneModel);

    const populated = sceneModel.fromParams(paramsWithId);

    if (populated.ok===false) {
      sceneModel.destroy();
      return this.logError(populated);
    }

    return { ok: true, value: sceneModel };
  }

  /**
   * Called internally when a {@link SceneModel} is destroyed.
   *
   * Removes the model from the registry and dispatches its destruction event.
   * @private
   */
  _destroyModel(sceneModel: SceneModel) {
    delete this.models[sceneModel.id];
    this._deregisterObjects(sceneModel);
    this.events.onSceneModelDestroyed.dispatch(this, sceneModel);
  }

  /** @private */
  _deregisterObjects(model: SceneModel) {
    for (const id in model.objects) {
      this._deregisterObject(model.objects[id]);
    }
  }

  /** @private */
  _deregisterObject(sceneObject: SceneObject) {
    delete this.objects[sceneObject.id];
    this.events.onSceneObjectDestroyed.dispatch(this, sceneObject);
  }

  /** @private */
  _registerObject(sceneObject: SceneObject) {
    this.objects[sceneObject.id] = sceneObject;
    this.events.onSceneObjectCreated.dispatch(this, sceneObject);
  }

  /**
   * Destroys all {@link SceneModel} instances in this Scene.
   *
   * For each model:
   * - Calls {@link SceneModel.destroy}
   * - Dispatches `onSceneModelDestroyed`
   *
   * @returns A {@link SDKResult} indicating success or failure.
   */
  clear(): SDKResult<void> {
    if (this.destroyed) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Scene.clear] Scene already destroyed",
      });
    }

    for (const id in this.models) {
      this.models[id].destroy();
    }

    return { ok: true, value: undefined };
  }

  /**
   * Fully destroys this Scene and all of its models and objects.
   *
   * This performs:
   * - A {@link clear} of all models
   * - Dispatching of {@link SceneEvents.onSceneDestroyed}
   * - Cleanup of all Scene‑level event subscriptions
   *
   * After destruction, most Scene operations become invalid.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.clear();
    this.events.onSceneDestroyed.dispatch(this, this);
    this.events.destroy();
    this.destroyed = true;
  }

  /**
   * Emits an error event and optionally logs the error to the console.
   *
   * Called internally whenever an SDK operation fails.
   *
   * @param result The failed {@link SDKResult}.
   * @returns The same {@link SDKResult} for convenience.
   * @private
   */
  logError(result: SDKResult<any>): SDKResult<any> {
    if (result.ok === false) {
      if (this.logging) {
        console.error(result.error);
      }
      this.events.onError.dispatch(this, result);
    }
    return result;
  }
}
