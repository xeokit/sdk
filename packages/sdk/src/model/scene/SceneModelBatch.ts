import type {SceneGeometry} from "./SceneGeometry";
import type {SceneMaterial} from "./SceneMaterial";
import type {SceneMesh} from "./SceneMesh";
import type {SceneObject} from "./SceneObject";
import type {SceneTexture} from "./SceneTexture";
import type {SceneTransform} from "./SceneTransform";

/**
 * Parameters for {@link SceneModel.beginBatch}.
 */
export interface SceneModelBatchParams {
  /**
   * Unique ID for the batch within the parent SceneModel.
   */
  id: string;
}

/**
 * Tracks components created while a SceneModel batch is active.
 *
 * A batch is a SceneModel construction scope: components created between
 * {@link SceneModel.beginBatch} and {@link SceneModel.commitBatch} are recorded
 * here so callers can identify exactly what was created during that interval,
 * and so loaders can partition a larger import into explicit phases. Viewers
 * and renderers can defer partial content until the batch is committed. This is
 * independent of how a renderer groups draw calls or GPU storage.
 */
export class SceneModelBatch {

  /**
   * Unique ID of this batch within the parent SceneModel.
   */
  public readonly id: string;

  /**
   * True after the batch has been committed.
   */
  public committed = false;

  /**
   * Transforms created in this batch.
   */
  public readonly transforms: SceneTransform[] = [];

  /**
   * Geometries created in this batch.
   */
  public readonly geometries: SceneGeometry[] = [];

  /**
   * Textures created in this batch.
   */
  public readonly textures: SceneTexture[] = [];

  /**
   * Materials created in this batch.
   */
  public readonly materials: SceneMaterial[] = [];

  /**
   * Meshes created in this batch.
   */
  public readonly meshes: SceneMesh[] = [];

  /**
   * Objects created in this batch.
   */
  public readonly objects: SceneObject[] = [];

  /** @private */
  constructor(params: SceneModelBatchParams) {
    this.id = params.id;
  }

  /** @private */
  includesGeometry(sceneGeometry: SceneGeometry): boolean {
    return this.geometries.indexOf(sceneGeometry) >= 0;
  }

  /** @private */
  includesMesh(sceneMesh: SceneMesh): boolean {
    return this.meshes.indexOf(sceneMesh) >= 0;
  }

  /** @private */
  includesObject(sceneObject: SceneObject): boolean {
    return this.objects.indexOf(sceneObject) >= 0;
  }
}
