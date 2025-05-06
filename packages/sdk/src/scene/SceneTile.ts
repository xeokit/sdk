import type {FloatArrayParam} from "../math";
import type {Scene} from "./Scene";
import type {SceneModel} from "./SceneModel";
import type {SceneObject} from "./SceneObject";

/**
 * A tile in a {@link SceneModel | SceneModel}.
 *
 * * {@link SceneMeshParams.origin | SceneMeshParams.origin}
 * * Stored in {@link SceneModel.tiles | SceneModel.tiles}
 * * Created automatically for each distinct value of {@link SceneMeshParams.origin | SceneMeshParams.origin} given to {@link SceneModel.createMesh | SceneModel.createMesh}
 * * Each SceneTile is destroyed as soon all {@link SceneTile | SceneTiles} with that origin heve been destroyed
 *
 * See {@link scene | @xeokit/sdk/scene}   for usage.
 */
export class SceneTile {

  /**
   * Unique ID of this SceneTile.
   */
  public readonly id: string;

  /**
   * The Scene that owns this SceneTile.
   */
  public readonly scene: Scene;

  /**
   * The 3D World-space origin of this SceneTile.
   */
  public readonly origin: FloatArrayParam;

  /**
   * The number of {@link SceneMesh | SceneMeshes} associated with this SceneTile.
   */
  public numObjects: number;

  /**
   * The {@link SceneModel | SceneModels} belonging to this SceneTile, each keyed to
   * its {@link SceneModel.id | SceneModel.id}.
   *
   * A SceneModel can belong to more than one SceneTile.
   */
  public readonly models: { [key: string]: SceneModel };

  /**
   * The {@link SceneObject | SceneObjects} in this SceneTile,
   * mapped to {@link SceneObject.id | SceneObject.id}.
   *
   * A SceneObject can belong to more than one SceneTile.
   */
  public readonly objects: { [key: string]: SceneObject };

  /**
   * @private
   * @param scene
   * @param id
   * @param origin
   */
  constructor(scene: Scene, id: string, origin: FloatArrayParam) {
    this.scene = scene;
    this.id = id;
    this.origin = origin;
    this.numObjects = 0;
    this.models = {};
    this.objects = {};
  }
}
