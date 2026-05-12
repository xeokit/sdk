import type {Vec2, Vec3} from "../math/vector";
import type {Mat4} from "../math/matrix";
import type {View} from "../viewer";

/**
 * Inputs for {@link PickStrategy.pick}.
 *
 * Exactly one of {@link canvasPos}, {@link ray}, or {@link matrix} must
 * be supplied — they all describe the same thing (a world-space ray) at
 * three different levels of pre-processing.
 *
 * Snap fields ({@link snapToVertex}, {@link snapToEdge}, {@link snapRadius})
 * are GPU-only enrichments. When requested but unavailable (no renderer
 * attached, WebGL context lost, or snap finds no vertex/edge in radius),
 * the picker silently falls back to a non-snap result — the {@link snap}
 * field on {@link PickResult} simply stays `null` and {@link strategyUsed}
 * tells you what actually ran.
 *
 * Snap is fundamentally a screen-space query: it can land on a vertex or
 * edge that is not under the cursor's surface ray. So a snap-only hit
 * (cursor in empty space, vertex 3 px away ⇒ snapped) is a valid result
 * even when no surface ray hit anything.
 */
export interface PickParams {

  /**
   * Active view. Always required: the picker uses it to resolve canvas
   * coordinates, scope visibility / pickability filters, and route
   * GPU snap requests to the right rendered framebuffer.
   */
  view: View;

  /**
   * Canvas-pixel cursor position relative to `view.htmlElement`.
   * Mutually exclusive with {@link ray} and {@link matrix}.
   */
  canvasPos?: Vec2;

  /**
   * Pre-built world-space ray. `dir` need not be normalised.
   * Mutually exclusive with {@link canvasPos} and {@link matrix}.
   *
   * GPU snap is canvas-only — supplying a ray pick auto-disables the
   * snap branch and forces the BVH backend.
   */
  ray?: { origin: Vec3; dir: Vec3 };

  /**
   * World-from-pick affine transform — see {@link "../collision".SceneRaycastParams.matrix}
   * for the full convention. Mutually exclusive with {@link canvasPos}
   * and {@link ray}. Same GPU-snap caveat as {@link ray}.
   */
  matrix?: Mat4;

  /**
   * If `true`, attempt to snap to the nearest vertex within
   * {@link snapRadius} pixels of {@link canvasPos}. GPU-only.
   */
  snapToVertex?: boolean;

  /**
   * If `true`, attempt to snap to the nearest edge within
   * {@link snapRadius} pixels of {@link canvasPos}. GPU-only.
   *
   * `snapToVertex` and `snapToEdge` may be combined — the picker reports
   * whichever the renderer landed on, preferring vertex on ties.
   */
  snapToEdge?: boolean;

  /**
   * Radius in canvas pixels for snap searches. Default `30`. Ignored
   * when neither {@link snapToVertex} nor {@link snapToEdge} is set.
   */
  snapRadius?: number;

  /**
   * If `true`, include invisible objects in the candidate set. Default
   * `false` — most callers want what the user can actually see.
   */
  pickInvisible?: boolean;

  /**
   * If `true` and the underlying backend supports it, populate
   * {@link PickResult.worldNormal}. GPU-only.
   */
  pickSurfaceNormal?: boolean;

  /**
   * Optional pre-filter on candidate object IDs. BVH-only — the GPU
   * path uses the renderer's own visibility / pickability gates and
   * cannot apply an arbitrary callback per pick.
   *
   * If supplied alongside a snap request, the picker runs BVH (which
   * honours the filter) and the snap fields stay empty. Set this only
   * when filtering matters more than snap to you.
   */
  filter?: (objectId: string) => boolean;

  /** Minimum parametric distance along the ray. BVH-only. Default `0`. */
  tMin?: number;

  /** Maximum parametric distance along the ray. BVH-only. Default `Infinity`. */
  tMax?: number;
}
