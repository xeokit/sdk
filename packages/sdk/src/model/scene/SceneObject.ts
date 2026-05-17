import type {SceneMesh} from "./SceneMesh";
import type {SceneModel} from "./SceneModel";
import type {SceneObjectParams} from "./SceneObjectParams";
import {SDKErrorType, type SDKResult} from "../../base/core";

/**
 * An object within a {@link SceneModel | SceneModel}.
 *
 * * Stored in {@link SceneModel.objects | SceneModel.objects} and {@link Scene.objects | Scene.objects}
 * * Created with {@link SceneModel.createObject | SceneModel.createObject}
 *
 * See {@link scene | @xeokit/sdk/model/scene}   for usage.
 */
export class SceneObject {

  /**
   * Unique ID of this SceneObject.
   *
   * SceneObjects are stored by ID in {@link Scene.objects | Scene.objects}
   * and {@link SceneModel.objects | SceneModel.objects}.
   */
  public readonly id: string;

  /**
   * ID of this SceneObject within the originating system.
   */
  public readonly originalSystemId: string;

  /**
   * Optional layer ID for this SceneObject.
   *
   * When the {@link model!scene.Scene | Scene} is attached to a {@link viewing!viewer.Viewer | Viewer}, this will identify an optional {@link viewing!viewer.ViewLayer | ViewLayer}
   * to assign the object to. ViewLayers allow users to group and segregate object based on their roles or aspects in a scene,
   * simplifying interaction and focusing operations on specific object groups.
   *
   * When the Scene is attached to a Viewer, if this property is defined, then you could find the ViewObject
   * corresponding to this SceneObject in the ViewLayer with the same ID, like so:
   *
   * ```typescript
   * const view = viewer.views["myViewId"];
   * const viewLayer = view.layers[this.layerId || "default"];
   * const viewObject = viewLayer.objects[this.id];
   * const sceneObject = viewObject.sceneObject;
   * ```
   */
  public readonly layerId?: string;

  /**
   * The {@link SceneModel | SceneModel} that contains this SceneObject.
   */
  public readonly model: SceneModel;

  /**
   * The {@link SceneMesh | Meshes} belonging to this SceneObject.
   */
  public readonly meshes: SceneMesh[];

  /**
   * True if this SceneObject has been destroyed.
   */
  public destroyed: boolean = false;

  /**
   * @private
   */
  constructor(cfg: {
    model: SceneModel;
    meshes: SceneMesh[];
    id: string;
    originalSystemId?: string;
    layerId?: string;
  }) {
    this.id = cfg.id;
    this.originalSystemId = cfg.originalSystemId || this.id;
    this.layerId = cfg.layerId;
    this.model = cfg.model;
    this.meshes = cfg.meshes;
  }

  /**
   * Adds a SceneMesh to this SceneObject.
   *
   * The SceneMesh must exist in the parent SceneModel and
   * must not already be assigned to a SceneObject.
   *
   * Fires {@link SceneEvents.onSceneObjectMeshAdded | SceneEvents.onSceneObjectMeshAdded} event.
   *
   * @param meshId The ID of the SceneMesh to add.
   * @returns SDKResult<void> indicating success or failure.
   */
  addMesh(meshId: string): SDKResult<void> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneObject.addMesh] SceneObject already destroyed"
      });
    }
    const mesh = this.model.meshes[meshId];
    if (!mesh) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneObject.addMesh] Mesh with ID '${meshId}' does not exist in model '${this.model.id}'`
      });
    }
    if (mesh.object) {
      if (mesh.object.id === this.id) {
        return this.model.scene.logError({
          ok: false,
          type: SDKErrorType.InvalidOperation,
          error: `[SceneObject.addMesh] Mesh with ID '${meshId}' is already added to SceneObject '${this.id}'`
        });
      }
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneObject.addMesh] Mesh with ID '${meshId}' is already added to SceneObject '${this.id}'`
      });
    }
    mesh.object = this;
    this.meshes.push(mesh);
    this.model.scene.events.onSceneObjectMeshAdded.dispatch(this, mesh);
    return {ok: true, value: undefined};
  }

  /**
   * Removes a SceneMesh from this SceneObject.
   *
   * The SceneMesh must exist in the parent SceneModel and
   * must be assigned to this SceneObject.
   *
   * Fires {@link SceneEvents.onSceneObjectMeshRemoved | SceneEvents.onSceneObjectMeshRemoved} event.
   *
   * @param meshId The ID of the SceneMesh to remove.
   * @returns SDKResult<void> indicating success or failure.
   */
  removeMesh(meshId: string): SDKResult<void> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneObject.removeMesh] SceneObject already destroyed"
      });
    }
    const mesh = this.model.meshes[meshId];
    if (!mesh) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[SceneObject.removeMesh] Mesh with ID '${meshId}' does not exist in model '${this.model.id}'`
      });
    }
    if (mesh.object === undefined) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneObject.removeMesh] Mesh with ID '${meshId}' is not part of any SceneObject`
      });
    }
    if (mesh.object?.id !== this.id) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneObject.removeMesh] Mesh with ID '${meshId}' is not part of SceneObject '${this.id}'`
      });
    }
    mesh.object = undefined;
    const index = this.meshes.indexOf(mesh);
    if (index !== -1) {
      this.meshes.splice(index, 1);
    }
    this.model.scene.events.onSceneObjectMeshRemoved.dispatch(this, mesh);
    return {ok: true, value: undefined};
  }

  /**
   * Gets this SceneObject as SceneObjectParams.
   */
  toParams(): SDKResult<SceneObjectParams> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneObject.toParams] SceneObject already destroyed"
      });
    }
    const sceneObjectParams = <SceneObjectParams>{
      id: this.id,
      meshIds: []
    };
    if (this.layerId !== undefined) {
      sceneObjectParams.layerId = this.layerId;
    }
    if (this.meshes !== undefined) {
      for (let i = 0, len = this.meshes.length; i < len; i++) {
        sceneObjectParams.meshIds.push(this.meshes[i].id);
      }
    }
    return {
      ok: true,
      value: sceneObjectParams
    };
  }

  /**
   * Destroys this SceneObject.
   *
   * Fires {@link SceneEvents.onSceneObjectDestroyed | SceneEvents.onSceneObjectDestroyed} event.
   */
  destroy(): SDKResult<void> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[SceneObject.destroy] SceneObject already destroyed"
      });
    }
    this.model._destroyObject(this);
    this.destroyed = true;
    return {
      ok: true,
      value: undefined
    };
  }
}
