import type {Scene} from "../../model/scene";
import type {Renderer} from "../../viewing/renderer";
import {type PickParams, PickResult, type View} from "../../viewing/viewer";
import type {SDKResult} from "../../base/core";
import {SceneCollisionIndex} from "../../spatial/collision";
import {MemoisingPickStrategy, RoutingPickStrategy, type PickStrategy} from "../../spatial/picking";

/**
 * Owns Studio's picking infrastructure: the BVH-backed
 * {@link SceneCollisionIndex} and the unified {@link PickStrategy}
 * (a memoising router over BVH + GPU paths).
 *
 * Both members are lazily constructed on first access so that demos
 * that never pick anything — converters, headless tests — don't pay
 * for the BVH build or the renderer setup.
 *
 * Scene and Renderer are pulled through callback refs because Studio
 * sets them in `init()`, not in the constructor. The PickingService
 * itself can be constructed up-front; the underlying objects are
 * built on demand once `scene`/`renderer` are populated.
 */
export class PickingService {

  private _collisionIndex: SceneCollisionIndex | null = null;
  private _picker: PickStrategy | null = null;

  constructor(
    private readonly sceneRef: () => Scene,
    private readonly rendererRef: () => Renderer,
  ) {}

  /**
   * BVH index over the Scene, used for fly-to AABB queries,
   * per-object / per-mesh AABB lookups, and as the spatial back-end
   * of {@link picker}.
   *
   * Self-maintaining: invalidates on object create/destroy/move and
   * rebuilds lazily on the next query.
   */
  get collisionIndex(): SceneCollisionIndex {
    if (!this._collisionIndex) {
      this._collisionIndex = new SceneCollisionIndex(this.sceneRef());
    }
    return this._collisionIndex;
  }

  /**
   * Unified pick strategy — a {@link MemoisingPickStrategy} wrapping
   * a {@link RoutingPickStrategy}. The router decides BVH vs GPU
   * snap per call (and tracks renderer attach / context loss via the
   * routing strategy's observer); the memoiser caches the most
   * recent result so identical back-to-back picks (e.g. a same-frame
   * `pointermove` → ViewController hover + measurement hover both
   * picking the same canvas pixel) skip the underlying work.
   *
   * Tolerance is `0` (exact match) so caching is strictly
   * correctness-preserving; pass a {@link MemoisingPickStrategy}
   * directly to anything that wants pixel-jitter slack.
   */
  get picker(): PickStrategy {
    if (!this._picker) {
      this._picker = new MemoisingPickStrategy(
        new RoutingPickStrategy(this.sceneRef(), this.rendererRef()),
      );
    }
    return this._picker;
  }

  /**
   * ViewController-shape pick adapter.
   *
   * Adapts the viewer-side `PickParams`/`PickResult` contract that
   * ViewController and PickController expect onto the unified
   * `PickStrategy.pick` interface. Snap fields (`snapToVertex` /
   * `snapToEdge`) are forwarded so any ViewController consumer that
   * asks for snap gets it via the routing strategy's GPU branch.
   *
   * Populates the fields PickController + the mouse handlers actually
   * consume: `viewObject`, `canvasPos`, `worldPos`. Other fields stay
   * unset, which the consumer treats as "not picked" for those facets
   * (e.g. `worldNormal` is null → no surface-normal-aware behaviour).
   *
   * Use this as the `pick` callback when constructing a ViewController;
   * for one-off canvas-position picks reach for {@link picker} directly.
   */
  pickForViewController(view: View, pickParams: PickParams): SDKResult<PickResult> {

    const result = this.picker.pick({
      view,
      canvasPos:     pickParams.canvasPos,
      ray:           pickParams.rayPick && pickParams.rayOrigin && pickParams.rayDirection
                       ? {origin: pickParams.rayOrigin, dir: pickParams.rayDirection}
                       : undefined,
      matrix:        pickParams.rayMatrix,
      pickInvisible: pickParams.pickInvisible === true,
      pickSurfaceNormal: pickParams.pickSurfaceNormal === true,
      snapToVertex:  pickParams.snapToVertex === true,
      snapToEdge:    pickParams.snapToEdge === true,
      snapRadius:    pickParams.snapRadius,
    });

    if (!result.hit) {
      return {ok: true, value: null as any};
    }

    const viewObject = result.objectId ? view.objects[result.objectId] : undefined;
    const pickResult = new PickResult();
    pickResult.view = view;
    pickResult.viewObject = viewObject ?? null;
    if (viewObject) {
      pickResult.sceneObject = viewObject.sceneObject;
    }
    if (pickParams.canvasPos) {
      pickResult.canvasPos = pickParams.canvasPos;
    }
    pickResult.worldPos  = result.worldPos as any;
    pickResult.worldNormal = result.worldNormal as any;
    pickResult.origin    = result.rayOrigin as any;
    pickResult.direction = result.rayDir as any;
    if (result.snap) {
      pickResult.snappedCanvasPos = result.snap.canvasPos;
      pickResult.snappedToVertex  = result.snap.type === "vertex";
      pickResult.snappedToEdge    = result.snap.type === "edge";
    }

    return {ok: true, value: pickResult};
  }
}
