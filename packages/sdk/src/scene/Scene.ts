import {SDKErrorType, SDKResult} from "../core";
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
 * Container of model geometry and materials.
 *
 * A Scene contains {@link SceneModel | SceneModels}, {@link SceneObject | SceneObjects},
 *  {@link SceneMesh | SceneMeshes}, {@link SceneGeometry | SceneGeometries},
 *  {@link SceneTextureSet | SceneTextureSets} and {@link SceneTexture | SceneTextures}.
 *
 * See {@link scene | @xeokit/sdk/scene} for usage.
 */
export class Scene {

  /**
   * Configures the Scene's coordinate system.
   */
  public readonly coordinateSystem: CoordinateSystem;

  /**
   * The {@link SceneModel | SceneModels} belonging to this Scene, each keyed to
   * its {@link SceneModel.id | SceneModel.id}.
   */
  public readonly models: { [key: string]: SceneModel };

  /**
   * The {@link SceneObject | SceneObjects} in this Scene, mapped to {@link SceneObject.id | SceneObject.id}.
   */
  public readonly objects: { [key: string]: SceneObject };

  /**
   * Emits events related to this Scene.
   */
  public readonly events: SceneEvents;

  /**
   * True if this Scene has been destroyed.
   */
  public destroyed: boolean = false;

    /**
     * Indicates whether to log errors to the console.
     *
     * Default value is ````false````.
     */
    public logging: boolean = false;

  /**
   * Creates a new Scene.
   */
  constructor(params?: SceneParams) {

    this.events = new SceneEvents();
    this.coordinateSystem = new CoordinateSystem(this, params?.coordinateSystem);
    this.models = {};
    this.objects = {};
    this.logging = params?.logging ?? false;
  }
  /**
   * Creates a new {@link SceneModel | SceneModel} in this Scene.
   *
   * See {@link scene|@xeokit/sdk/scene} for more details on usage.
   *
   * @param  sceneModelParams Creation parameters for the new {@link SceneModel | SceneModel}.
   * @returns *SDKResult&lt;SceneModel, string&gt;*
   */
  createModel(sceneModelParams: SceneModelParams): SDKResult<SceneModel, string> {
    if (this.destroyed) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "Scene already destroyed"
      });
    }
    const id = sceneModelParams.id ?? createUUID();
    if (this.models[id]) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `SceneModel already created in this Scene: ${id}`
      });
    }
    const paramsWithId: SceneModelParams = { ...sceneModelParams, id };
    const sceneModel = new SceneModel(this, paramsWithId);
    const populated = sceneModel.fromParams(paramsWithId);
    if (populated.ok===false) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: populated.error
      });
    }
    this.models[id] = sceneModel;
    this.events.onSceneModelCreated.dispatch(this, sceneModel); // Fires modelCreated
    return {
      ok: true,
      value: sceneModel
    };
  }

  /**
   * Called by a {@link SceneModel | SceneModel} when it is destroyed.
   * @private
   */
  _destroyModel(sceneModel: SceneModel) {
    delete this.models[sceneModel.id];
    this.#deregisterObjects(sceneModel);
    this.events.onSceneModelDestroyed.dispatch(this, sceneModel);
  }


  #deregisterObjects(model: SceneModel) {
    for (const id in model.objects) {
      this._deregisterObject(model.objects[id]);
    }
  }

  /**
   * @private
   */
  _deregisterObject(sceneObject: SceneObject) {
    delete this.objects[sceneObject.id];
    this.events.onSceneObjectDestroyed.dispatch(this, sceneObject);
  }

  /**
   * @private
   */
  _registerObject(sceneObject: SceneObject) {
    this.objects[sceneObject.id] = sceneObject;
    this.events.onSceneObjectCreated.dispatch(this, sceneObject);
  }

  /**
   * Destroys all contained {@link SceneModel | SceneModels}.
   *
   * * Fires {@link SceneEvents.onSceneModelDestroyed | SceneEvents.onSceneModelDestroyed}
   * for each existing SceneModel in this Scene.
   *
   * See {@link scene | @xeokit/sdk/scene}   for usage.
   */
  clear(): SDKResult<void, string> {
    if (this.destroyed) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Scene.clear] Scene already destroyed"
      });
    }
    for (const id in this.models) {
      this.models[id].destroy();
    }
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Destroys this Scene and all contained {@link SceneModel | SceneModels}.
   *
   * * Fires {@link SceneEvents.onSceneModelDestroyed | Scene.modelDestroyed} and {@link SceneModel.onDestroyed | SceneModel.onDestroyed}
   * for each existing SceneModels in this Data.
   * * Unsubscribes all subscribers to {@link SceneEvents.onSceneModelCreated | SceneEvents.onSceneModelCreated}, {@link SceneEvents.onSceneModelDestroyed | Scene.modelDestroyed}, {@link SceneModel.onDestroyed | SceneModel.onDestroyed}
   *
   * See {@link scene | @xeokit/sdk/scene}   for usage.
   *
   * @returns *void*
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.clear();
    this.events.onSceneDestroyed.dispatch(this, this)
    this.events.destroy();
    this.destroyed = true;
  }

  /**
   * Logs an error via the Scene's {@link SceneEvents.onError | SceneEvents.onError} event.
   * @private
   * @param result
   */
  logError(result:SDKResult<any,string>) : SDKResult<any, string>{
    if (result.ok === false) {
      if (this.logging) {
        console.error(result.error);
      }
      this.events.onError.dispatch(this, result);
    }
    return result;
  }

}
