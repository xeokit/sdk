import type {Scene} from "../../model/scene";
import {SceneCollisionIndex} from "./SceneCollisionIndex";

/**
 * Per-Scene singleton registry. Lazy entries; cleaned up on
 * `onSceneDestroyed`.
 */
const sceneCollisionIndexes: Record<string, SceneCollisionIndex | undefined> = {};

/**
 * Gets or lazily creates the shared {@link SceneCollisionIndex} for a
 * Scene.
 *
 * One index per Scene, destroyed automatically when the Scene fires
 * `onSceneDestroyed`.
 */
export function getSceneCollisionIndex(scene: Scene): SceneCollisionIndex {
  let index = sceneCollisionIndexes[scene.id];
  if (!index) {
    index = sceneCollisionIndexes[scene.id] = new SceneCollisionIndex(scene);
    scene.events.onSceneDestroyed.subscribe((destroyedScene) => {
      sceneCollisionIndexes[destroyedScene.id]?.destroy();
      delete sceneCollisionIndexes[destroyedScene.id];
    });
  }
  return index;
}
