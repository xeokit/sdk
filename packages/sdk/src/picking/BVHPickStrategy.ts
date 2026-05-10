import {SceneRaycaster, type SceneRaycastParams} from "../collision";
import type {Scene} from "../scene";
import type {PickParams} from "./PickParams";
import type {PickResult} from "./PickResult";
import type {PickStrategy} from "./PickStrategy";

/**
 * BVH-backed picking strategy — wraps {@link SceneRaycaster}.
 *
 * What works:
 *
 *   - canvas-pos / ray / matrix inputs (all three);
 *   - `objectId`, `meshId`, `worldPos`, `triangleIndex`;
 *   - `filter`, `tMin`, `tMax`, `pickInvisible` (mapped onto
 *     `visiblePickableOnly`).
 *
 * What doesn't:
 *
 *   - snap-to-vertex / snap-to-edge — silently dropped. The result's
 *     {@link PickResult.snap} is `null`.
 *   - `worldNormal`, `localPos`, `uv` — not provided by the BVH path;
 *     left `null` on the result.
 *
 * Stateless after construction; {@link stateEpoch} stays `0`.
 */
export class BVHPickStrategy implements PickStrategy {

  /** Raycaster reused across calls. Built once at construction. */
  private readonly _raycaster: SceneRaycaster;

  readonly stateEpoch = 0;

  /**
   * @param scene Scene whose BVH gets queried. The strategy borrows the
   *   scene's shared {@link "../collision".SceneCollisionIndex}, so
   *   destroying this strategy does not destroy the index — callers can
   *   keep using BVH queries directly afterwards.
   * @param raycaster Optional injected raycaster. Lets tests stub the
   *   underlying raycast and lets multiple strategies share one
   *   raycaster if a caller already has one to hand.
   */
  constructor(scene: Scene, raycaster?: SceneRaycaster) {
    this._raycaster = raycaster ?? new SceneRaycaster(scene);
  }

  pick(params: PickParams): PickResult {
    const sceneParams: SceneRaycastParams = {
      view: params.view,
      canvasPos: params.canvasPos,
      ray:       params.ray,
      matrix:    params.matrix,
      tMin:      params.tMin,
      tMax:      params.tMax,
      filter:    params.filter,
      // Our `pickInvisible` is the inverse of SceneRaycaster's
      // `visiblePickableOnly`. SceneRaycaster also defaults to `true`
      // when a view is supplied, so leave `undefined` when the caller
      // didn't ask to override that default.
      visiblePickableOnly:
        params.pickInvisible === true ? false : undefined,
    };

    const result = this._raycaster.pick(sceneParams);

    // Build the canonical result. SceneRaycaster always returns
    // {ok: true, value: SceneRaycastResult} for valid input; the only
    // {ok: false} cases are programmer errors (no spatial input,
    // canvasPos without view) which would crash the GPU branch too.
    // Surface them as a miss rather than throwing — the picker's
    // contract is "always returns a PickResult".
    if (result.ok === false) {
      return missingResult(params);
    }

    const v = result.value;
    return {
      hit:           v.hit,
      view:          params.view,
      objectId:      v.objectId,
      meshId:        v.meshId,
      worldPos:      v.worldPos,
      worldNormal:   null,
      localPos:      null,
      uv:            null,
      canvasPos:     params.canvasPos ?? null,
      rayOrigin:     v.rayOrigin,
      rayDir:        v.rayDir,
      triangleIndex: v.triangleIndex,
      snap:          null,
      strategyUsed:  "bvh",
      _stateEpoch:   0,
    };
  }
}

/** Empty miss result — used when SceneRaycaster rejects malformed params. */
function missingResult(params: PickParams): PickResult {
  return {
    hit:           false,
    view:          params.view,
    objectId:      null,
    meshId:        null,
    worldPos:      null,
    worldNormal:   null,
    localPos:      null,
    uv:            null,
    canvasPos:     params.canvasPos ?? null,
    rayOrigin:     null,
    rayDir:        null,
    triangleIndex: -1,
    snap:          null,
    strategyUsed:  "bvh",
    _stateEpoch:   0,
  };
}
