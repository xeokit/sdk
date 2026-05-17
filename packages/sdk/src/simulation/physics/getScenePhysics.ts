import type {Scene} from "../../model/scene";
import {ScenePhysics} from "./ScenePhysics";
import type {ScenePhysicsParams} from "./ScenePhysicsParams";


// One ScenePhysics per Scene, regardless of how many demos / panels ask
// for it. Mirrors getSceneCollisionIndex's caching behaviour so multiple
// consumers cooperate without rebuilding the world.
const scenePhysicsCache: Record<string, ScenePhysics | undefined> = {};


/**
 * Lazily creates the {@link ScenePhysics} for a Scene, or returns the
 * existing one. Auto-destroyed when the Scene fires `onSceneDestroyed`.
 *
 * The first caller decides the rapier module and gravity; subsequent
 * callers are handed the same instance and the `params.rapier` /
 * `params.gravity` they pass in are ignored.
 */
export function getScenePhysics(scene: Scene, params: ScenePhysicsParams): ScenePhysics {
  let physics = scenePhysicsCache[scene.id];
  if (!physics) {
    physics = new ScenePhysics(scene, params);
    scenePhysicsCache[scene.id] = physics;
    scene.events.onSceneDestroyed.subscribe((destroyedScene) => {
      scenePhysicsCache[destroyedScene.id]?.destroy();
      delete scenePhysicsCache[destroyedScene.id];
    });
  }
  return physics;
}
