import type {Scene, SceneModel} from "../../model/scene";
import type {SceneCollisionIndex} from "../../spatial/collision";

/**
 * Construction parameters for {@link SceneModelExploder}.
 */
export type SceneModelExploderParams = {

  /**
   * The {@link model!scene.Scene | Scene} the exploder operates in. Used
   * to read the coordinate system so the explode offset is applied
   * in the SceneModel's local frame regardless of how the Scene and
   * SceneModel coordinate systems relate.
   */
  scene: Scene;

  /**
   * The {@link model!scene.SceneModel | SceneModel} whose meshes the
   * exploder displaces away from the model centre. Read at
   * {@link SceneModelExploder.rebuild | rebuild} time; later calls
   * to {@link SceneModelExploder.setFactor | setFactor} replay the
   * cached rest pose without re-walking the SceneModel.
   */
  sceneModel: SceneModel;

  /**
   * The {@link spatial!collision.SceneCollisionIndex | SceneCollisionIndex}
   * the exploder reads per-mesh world AABBs from. Typically
   * `studio.picking.collisionIndex`; any object exposing
   * `getMeshAABB(mesh)` is accepted.
   */
  collisionIndex: SceneCollisionIndex;

  /** Slider lower bound. Default `0` (no displacement). */
  minFactor?: number;

  /** Slider upper bound. Default `2` (twice the centre→mesh distance). */
  maxFactor?: number;

  /** Slider step. Default `0.05`. */
  step?: number;

  /** Initial explode factor. Default `0`. */
  initialFactor?: number;
};
