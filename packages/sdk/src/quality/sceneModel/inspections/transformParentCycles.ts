import type {SceneModel, SceneTransform} from "../../../model/scene";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";


/**
 * Detect cycles in the {@link SceneTransform} parent chain. Walks
 * every transform, following `parentTransform` pointers; a hit on a
 * transform that's already on the current walk's stack means a
 * cycle.
 *
 * Iterative (no recursion) so deep parent chains can't blow the JS
 * stack. Per-id colours: 0 unvisited, 1 on-stack, 2 done.
 *
 * No `highlight` payload — the cyclic subtree won't render, so
 * locating it in the Viewer would land the camera on something
 * invisible.
 */
export const transformParentCycles: Inspection = {

  codes: ["TRANSFORM_CYCLE"],

  description: "Transform parent cycles",

  labels: {
    TRANSFORM_CYCLE: "Transform parent cycle",
  },

  descriptions: {
    TRANSFORM_CYCLE:
      "A chain of parentTransform references loops back on itself. World-matrix evaluation never terminates, so anything in the cyclic subtree fails to place.",
  },

  run(sceneModel: SceneModel): Issue[] {
    const issues: Issue[] = [];
    const colour: Record<string, number> = {};
    for (const tId in sceneModel.transforms) {
      if (sceneModel.transforms[tId].destroyed) continue;
      if (colour[tId]) continue;
      const onStack: string[] = [];
      let cursor: SceneTransform | null = sceneModel.transforms[tId];
      while (cursor && !cursor.destroyed) {
        if (colour[cursor.id] === 1) {
          // Cursor is on the current walk's stack → cycle.
          issues.push({
            severity: "error",
            code:     "TRANSFORM_CYCLE",
            message:  `SceneTransform parent chain forms a cycle through '${cursor.id}' (chain: ${onStack.concat(cursor.id).join(" → ")})`,
            resourceId: cursor.id,
          });
          break;
        }
        if (colour[cursor.id] === 2) break;        // already cleared on a prior walk
        colour[cursor.id] = 1;
        onStack.push(cursor.id);
        const parent = cursor.parentTransform;
        cursor = (parent && !parent.destroyed && sceneModel.transforms[parent.id] === parent)
          ? parent
          : null;
      }
      for (const id of onStack) colour[id] = 2;
    }
    return issues;
  },
};
