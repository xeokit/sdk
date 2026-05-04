import type {View} from "../../viewer";
import type {Vec2, Vec3} from "../../math/vector";
import type {Mat4} from "../../math/matrix";

/**
 * Inputs for {@link ScenePicker.pick}.
 *
 * Exactly one of {@link canvasPos}, {@link ray}, or {@link matrix} must be
 * supplied — they all describe the same thing (a world-space ray) at three
 * different levels of pre-processing.
 */
export interface ScenePickParams {

  /**
   * Active view, required when {@link canvasPos} is used (the picker
   * unprojects through this view's camera) and used to filter non-pickable
   * objects when {@link visiblePickableOnly} is enabled.
   */
  view?: View;

  /**
   * Canvas-pixel cursor position relative to `view.htmlElement` — the
   * format you'd compute with `e.clientX/Y - canvas.getBoundingClientRect()`.
   * Required when {@link view} is the only spatial input.
   */
  canvasPos?: Vec2;

  /**
   * Pre-built world-space ray. `dir` need not be normalised; `tHit` in the
   * result is reported in `dir`-multiples either way.
   */
  ray?: { origin: Vec3; dir: Vec3 };

  /**
   * World-from-pick affine transform. The picker treats the input as a
   * matrix that maps a canonical local ray (origin `(0,0,0)`, direction
   * `(0,0,1)`) into world space:
   *
   *   - origin = matrix · `(0,0,0,1)` = the matrix's translation column.
   *   - direction = matrix · `(0,0,1,0)` = the matrix's third basis column.
   *
   * Equivalent to passing the camera's `inverseViewMatrix` for a "shoot a
   * ray straight ahead from the camera" query, except that GL view space
   * looks down `-Z`, so for that case the caller should negate the
   * resulting direction or pre-flip the third column. The picker doesn't
   * second-guess the caller's convention — it just reads the matrix at
   * face value.
   */
  matrix?: Mat4;

  /** Minimum parametric distance along the ray. Defaults to `0`. */
  tMin?: number;

  /** Maximum parametric distance along the ray. Defaults to `Infinity`. */
  tMax?: number;

  /**
   * Optional pre-filter on candidate object IDs. Returning `false` drops
   * the object before any per-mesh / per-triangle work — composes with
   * the visible/pickable filter (both must accept).
   */
  filter?: (objectId: string) => boolean;

  /**
   * When true (and {@link view} is provided), candidate objects must also
   * satisfy `view.objects[id].visible` and `view.objects[id].pickable !==
   * false`. Defaults to `true` when `view` is given, `false` otherwise —
   * a programmatic ray pick without a view inspects the entire BVH.
   */
  visiblePickableOnly?: boolean;
}
