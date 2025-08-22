import {Component, EventEmitter, SDKError} from "../core";
import {EventDispatcher} from "strongly-typed-events";
import {SceneModel} from "./SceneModel";
import type {SceneModelParams} from "./SceneModelParams";
import type {SceneObject} from "./SceneObject";
import {CoordinateSystem} from "./CoordinateSystem";
import {type SceneParams} from "./SceneParams";
import {SceneMesh} from "./SceneMesh";
import {SceneGeometry} from "./SceneGeometry";

/**
 * Container of model geometry and materials.
 *
 * A Scene contains {@link SceneModel | SceneModels}, {@link SceneObject | SceneObjects},
 *  {@link SceneMesh | SceneMeshes}, {@link SceneGeometry | SceneGeometries},
 *  {@link SceneTextureSet | SceneTextureSets} and {@link SceneTexture | SceneTextures}.
 *
 * See {@link scene | @xeokit/sdk/scene} for usage.
 */
export class Scene extends Component {

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
   * Emits an event each time a {@link SceneModel | SceneModel} is created in this Scene.
   *
   * @event onModelCreated
   */
  public readonly onModelCreated: EventEmitter<Scene, SceneModel>;

  /**
   * Emits an event each time a {@link SceneModel | SceneModel} is destroyed in this Scene.
   *
   * @event onModelDestroyed
   */
  public readonly onModelDestroyed: EventEmitter<Scene, SceneModel>;

  /**
   * Emits an event each time a {@link SceneObject | SceneObject} is created in this Scene.
   *
   * @event onObjectCreated
   */
  public readonly onObjectCreated: EventEmitter<Scene, SceneObject>;

  /**
   * Emits an event each time a {@link SceneMesh | SceneMesh} is moved (rotated, translated etc).
   *
   * @event onMeshMoved
   */
  public readonly onMeshMoved: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time a {@link SceneGeometry | SceneGeometry} is updated (any updates to positions, indices, primitive type etc).
   *
   * @event onGeometryUpdated
   */
  public readonly onGeometryUpdated: EventEmitter<Scene, SceneGeometry>;

  /**
   * Emits an event each time a {@link SceneObject | SceneObject} is destroyed in this Scene.
   *
   * @event onObjectDestroyed
   */
  public readonly onObjectDestroyed: EventEmitter<Scene, SceneObject>;

  /**
   * Emits an event each time a {@link SceneMesh | SceneMesh} is created in this Scene.
   *
   * @event onMeshCreated
   */
  public readonly onMeshCreated: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time a {@link SceneMesh | SceneMesh} is destroyed in this Scene.
   *
   * @event onMeshDestroyed
   */
  public readonly onMeshDestroyed: EventEmitter<Scene, SceneMesh>;

  /**
   * Emits an event each time a {@link SceneGeometry | SceneGeometry} is created in this Scene.
   *
   * @event onGeometryCreated
   */
  public readonly onGeometryCreated: EventEmitter<Scene, SceneGeometry>;

  /**
   * Emits an event each time a {@link SceneGeometry | SceneGeometry} is destroyed in this Scene.
   *
   * @event onGeometryDestroyed
   */
  public readonly onGeometryDestroyed: EventEmitter<Scene, SceneGeometry>;

  /**
   * Creates a new Scene.
   */
  constructor(params?: SceneParams) {

    super(null, {});

    this.coordinateSystem = new CoordinateSystem(this, params?.coordinateSystem);

    this.models = {};
    this.objects = {};

    this.onModelCreated = new EventEmitter(new EventDispatcher<Scene, SceneModel>());
    this.onObjectCreated = new EventEmitter(new EventDispatcher<Scene, SceneObject>());

    this.onMeshMoved = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
    this.onGeometryUpdated = new EventEmitter(new EventDispatcher<Scene, SceneGeometry>());
    this.onObjectDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneObject>());
    this.onModelDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneModel>());

    this.onMeshCreated = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());
    this.onMeshDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneMesh>());

    this.onGeometryCreated = new EventEmitter(new EventDispatcher<Scene, SceneGeometry>());
    this.onGeometryDestroyed = new EventEmitter(new EventDispatcher<Scene, SceneGeometry>());
  }

  /**
   * Creates a new {@link SceneModel | SceneModel} in this Scene.
   *
   * See {@link scene | @xeokit/sdk/scene}   for more details on usage.
   *
   * @param  sceneModelParams Creation parameters for the new {@link SceneModel | SceneModel}.
   * @returns *{@link SceneModel | SceneModel}*
   * * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * This Scene has already been destroyed.
   * * A SceneModel with the given ID already exists in this Scene.
   */
  createModel(sceneModelParams: SceneModelParams): SceneModel | SDKError {
    if (this.destroyed) {
      return new SDKError("Scene already destroyed");
    }
    const id = sceneModelParams.id;
    if (this.models[id]) {
      return new SDKError(`SceneModel already created in this Scene: ${id}`);
    }
    const sceneModel = new SceneModel(this, sceneModelParams);
    this.models[id] = sceneModel;
    sceneModel.onDestroyed.one(() => { // SceneModel#destroy() called
      delete this.models[sceneModel.id];
      this.#deregisterObjects(sceneModel);
      this.onModelDestroyed.dispatch(this, sceneModel);
    });
    this.onModelCreated.dispatch(this, sceneModel);
    return sceneModel;
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
    this.onObjectDestroyed.dispatch(this, sceneObject);
  }

  /**
   * @private
   */
  _registerObject(sceneObject: SceneObject) {
    this.objects[sceneObject.id] = sceneObject;
    this.onObjectCreated.dispatch(this, sceneObject);
  }

  /**
   * Destroys all contained {@link SceneModel | SceneModels}.
   *
   * * Fires {@link Scene.onModelDestroyed | Scene.onModelDestroyed} and
   * {@link SceneModel.onDestroyed | SceneModel.onDestroyed} for each existing SceneModel in this Scene.
   *
   * See {@link scene | @xeokit/sdk/scene}   for usage.
   * @returns *void*
   * * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * This Scene has already been destroyed.
   */
  clear(): void | SDKError {
    if (this.destroyed) {
      return new SDKError("Scene already destroyed");
    }
    for (const id in this.models) {
      this.models[id].destroy();
    }
  }

  /**
   * Destroys this Scene and all contained {@link SceneModel | SceneModels}.
   *
   * * Fires {@link Scene.onModelDestroyed | Scene.onModelDestroyed} and {@link SceneModel.onDestroyed | SceneModel.onDestroyed}
   * for each existing SceneModels in this Data.
   * * Unsubscribes all subscribers to {@link Scene.onModelCreated | Scene.onModelCreated}, {@link Scene.onModelDestroyed | Scene.onModelDestroyed}, {@link SceneModel.onDestroyed | SceneModel.onDestroyed}
   *
   * See {@link scene | @xeokit/sdk/scene}   for usage.
   *
   * @returns *void*
   * * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * This Scene has already been destroyed.
   */
  destroy(): void {
    this.clear();
    this.onModelCreated.clear();
    this.onModelDestroyed.clear();
    this.onObjectCreated.clear();
    this.onMeshMoved.clear();
    this.onGeometryUpdated.clear();
    this.onObjectDestroyed.clear();

    this.onGeometryCreated .clear();
    this.onGeometryDestroyed .clear();
    super.destroy();
  }


}
