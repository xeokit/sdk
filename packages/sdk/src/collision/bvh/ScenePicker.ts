import {SDKErrorType, type SDKResult} from "../../core";
import {createVec3Float64, type Vec3, type Vec3Float} from "../../math/vector";
import type {Scene} from "../../scene";
import type {View} from "../../viewer";
import {getSceneCollisionIndex, type SceneCollisionIndex} from "./SceneCollisionIndex";
import {intersectSceneRayTriangle} from "./intersectSceneRayTriangle";
import type {ScenePickParams} from "./ScenePickParams";
import type {ScenePickResult} from "./ScenePickResult";


/**
 * Unified ray picker layered on top of {@link SceneCollisionIndex} and
 * {@link intersectSceneRayTriangle}.
 *
 * One call, three input shapes:
 *   - canvas-pixel cursor position (with a {@link View});
 *   - a world-space `{origin, dir}` ray;
 *   - a 4×4 transform that maps a canonical local ray to world space.
 *
 * The picker resolves whichever shape was supplied to a world-space ray,
 * runs the BVH-narrowed triangle-precise raycast, and returns a single
 * {@link ScenePickResult} (hit or miss) wrapped in {@link SDKResult}.
 *
 * One picker per Scene; the underlying BVH is shared via
 * {@link getSceneCollisionIndex}, so multiple Pickers on the same Scene
 * cooperate cleanly.
 */
export class ScenePicker {

  /** Scene this picker is bound to. */
  public readonly scene: Scene;

  /** BVH index used to narrow ray-vs-AABB candidates before triangle work. */
  public readonly collisionIndex: SceneCollisionIndex;

  // Reusable scratch for the canvas-pos branch — reused across calls,
  // never read between callers, so safe.
  #screenPos:    Vec3Float = createVec3Float64();
  #viewPos:      Vec3Float = createVec3Float64();
  #worldPosFar:  Vec3Float = createVec3Float64();

  /**
   * Creates a picker for the given Scene. Lazily borrows the shared
   * collision index — destroying this picker doesn't destroy the index.
   */
  constructor(scene: Scene) {
    this.scene = scene;
    this.collisionIndex = getSceneCollisionIndex(scene);
  }

  /**
   * Performs one pick.
   *
   * Always returns `{ok: true, value: ScenePickResult}` for a successful test —
   * a "miss" is `value.hit === false`, not an error. `{ok: false}` is
   * reserved for invalid input (no spatial spec, more than one spatial
   * spec, canvasPos without a view).
   */
  pick(params: ScenePickParams): SDKResult<ScenePickResult> {
    // Exactly-one-of-three input check.
    let count = 0;
    if (params.canvasPos) count++;
    if (params.ray)       count++;
    if (params.matrix)    count++;
    if (count !== 1) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[ScenePicker.pick] Exactly one of canvasPos, ray, matrix must be provided"
      };
    }

    let originX: number, originY: number, originZ: number;
    let dirX: number,    dirY: number,    dirZ: number;

    if (params.canvasPos) {
      if (!params.view) {
        return {
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: "[ScenePicker.pick] canvasPos requires a view"
        };
      }
      // Same canvas-pos → world-ray construction as PivotController:
      // unproject at NDC z = +1 to get a world point along the cursor's
      // line of sight, then take origin = camera.eye, dir = far - eye.
      const camera = params.view.camera;
      camera.projection.unproject(
        params.canvasPos, 1,
        this.#screenPos, this.#viewPos, this.#worldPosFar
      );
      const eye = camera.eye;
      originX = eye[0]; originY = eye[1]; originZ = eye[2];
      dirX = this.#worldPosFar[0] - eye[0];
      dirY = this.#worldPosFar[1] - eye[1];
      dirZ = this.#worldPosFar[2] - eye[2];

    } else if (params.ray) {
      const o = params.ray.origin;
      const d = params.ray.dir;
      originX = o[0]; originY = o[1]; originZ = o[2];
      dirX    = d[0]; dirY    = d[1]; dirZ    = d[2];

    } else {
      // matrix branch. Translation column is the world-space ray origin;
      // third basis column is the world-space ray direction. See ScenePickParams.matrix
      // doc-comment for the exact convention.
      const m = params.matrix!;
      originX = m[12]; originY = m[13]; originZ = m[14];
      dirX    = m[8];  dirY    = m[9];  dirZ    = m[10];
    }

    // Compose the candidate filter. View-side visible/pickable check runs
    // first (it short-circuits common skips); user filter runs after for
    // application-specific exclusions.
    const userFilter = params.filter;
    const useViewFilter = params.view && params.visiblePickableOnly !== false;
    const view = params.view;

    let combinedFilter: ((id: string) => boolean) | undefined;
    if (useViewFilter && userFilter) {
      combinedFilter = (id) => {
        const obj = view!.objects[id];
        if (!obj || !obj.visible || obj.pickable === false) return false;
        return userFilter(id);
      };
    } else if (useViewFilter) {
      combinedFilter = (id) => {
        const obj = view!.objects[id];
        return !!(obj && obj.visible && obj.pickable !== false);
      };
    } else {
      combinedFilter = userFilter;
    }

    // Reuse the same Float64 array shape for both rayOrigin/rayDir
    // captures and pass-through to the helper.
    const origin: Vec3 = [originX, originY, originZ];
    const dir:    Vec3 = [dirX,    dirY,    dirZ];

    const triHit = intersectSceneRayTriangle(this.collisionIndex, origin, dir, {
      tMin: params.tMin,
      tMax: params.tMax,
      filter: combinedFilter
    });

    const resultRayOrigin = createVec3Float64(origin);
    const resultRayDir    = createVec3Float64(dir);

    if (triHit === null) {
      return {
        ok: true,
        value: {
          hit: false,
          objectId: null,
          meshId: null,
          worldPos: null,
          tHit: null,
          triangleIndex: -1,
          rayOrigin: resultRayOrigin,
          rayDir: resultRayDir
        }
      };
    }

    return {
      ok: true,
      value: {
        hit: true,
        objectId: triHit.objectId,
        meshId: triHit.meshId,
        worldPos: triHit.worldPos,
        tHit: triHit.tHit,
        triangleIndex: triHit.triangleIndex,
        rayOrigin: resultRayOrigin,
        rayDir: resultRayDir
      }
    };
  }
}
