import type {SceneModel} from "../../scene";
import {createSceneModelInspectionIndex} from "./createSceneModelInspectionIndex";
import type {SceneModelInspectionIndex} from "./SceneModelInspectionIndex";


/**
 * Process-local cache of {@link SceneModelInspectionIndex} instances,
 * keyed by SceneModel. WeakMap so the entry is garbage-collected
 * automatically when a SceneModel is destroyed and dropped by its
 * holders — no SDK API change, no manual lifecycle management.
 */
const indexes = new WeakMap<SceneModel, SceneModelInspectionIndex>();


/**
 * Return the (lazily-built) {@link SceneModelInspectionIndex} for
 * `sceneModel`. Subsequent calls with the same SceneModel return
 * the same instance, so inspections + fixes share one cache.
 *
 * The index itself is per-row lazy — calling this is cheap and
 * doesn't trigger any computation. The columns build on first
 * access. After mutations, callers (typically the orchestrator)
 * call the index's `invalidate*` methods to clear the affected
 * rows.
 */
export function getInspectionIndex(sceneModel: SceneModel): SceneModelInspectionIndex {
  let ix = indexes.get(sceneModel);
  if (!ix) {
    ix = createSceneModelInspectionIndex(sceneModel);
    indexes.set(sceneModel, ix);
  }
  return ix;
}
