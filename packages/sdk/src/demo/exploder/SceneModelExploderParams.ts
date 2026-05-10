/**
 * Construction parameters for {@link SceneModelExploder}.
 */
export type SceneModelExploderParams = {
  scene: any;
  sceneModel: any;
  /**
   * The {@link "@xeokit/sdk/collision".SceneCollisionIndex} the
   * exploder reads per-mesh world AABBs from. Typically
   * `demoHelper.collisionIndex`; any object exposing
   * `getMeshAABB(mesh)` is accepted.
   */
  collisionIndex: any;
  minFactor?: number;
  maxFactor?: number;
  step?: number;
  initialFactor?: number;
};
