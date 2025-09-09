
import type {SceneMesh} from "./SceneMesh";
import type {SceneModel} from "./SceneModel";
import type {SceneObjectParams} from "./SceneObjectParams";
import {RendererObject} from "./RendererObject";

/**
 * An object within a {@link SceneModel | SceneModel}.
 *
 * * Stored in {@link SceneModel.objects | SceneModel.objects} and {@link Scene.objects | Scene.objects}
 * * Created with {@link SceneModel.createObject | SceneModel.createObject}
 *
 * See {@link scene | @xeokit/sdk/scene}   for usage.
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
   * When the {@link Scene} is attached to a {@link viewer!View | View}, this will identify an optional {@link viewer!ViewLayer | ViewLayer}
   * to assign the object to. ViewLayers allow users to group and segregate object based on their roles or aspects in a scene,
   * simplifying interaction and focusing operations on specific object groups.
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
   *  Internal interface through which a {@link SceneObject} can load property updates into a renderer.
   *
   *  This is defined when the owner {@link SceneModel | SceneModel} has been added to
   *  a {@link viewer!Viewer | Viewer}.
   *
   * @internal
   */
  rendererObject: RendererObject | null;

  /**
   * @private
   */
  constructor(cfg: {
    model: SceneModel;
    meshes: SceneMesh[];
    id: string;
    originallSystemId?: string;
    layerId?: string;
  }) {
    this.id = cfg.id;
    this.originalSystemId = cfg.originallSystemId || this.id;
    this.layerId = cfg.layerId;
    this.model = cfg.model;
    this.meshes = cfg.meshes;
    this.rendererObject = null;
  }

  /**
   * Gets this SceneObject as SceneObjectParams.
   */
  toParams(): SceneObjectParams {
    const sceneObjectParams = <SceneObjectParams>{
      id: this.id,
      meshIds: []
    };
    if (this.layerId != undefined) {
      sceneObjectParams.layerId = this.layerId;
    }
    if (this.meshes != undefined) {
      for (let i = 0, len = this.meshes.length; i < len; i++) {
        sceneObjectParams.meshIds.push(this.meshes[i].id);
      }
    }
    return sceneObjectParams;
  }

  /**
   * Destroys this SceneObject.
   */
  destroy() {
    this.model._destroyObject(this);
  }
}
