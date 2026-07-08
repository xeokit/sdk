import type {Vec2, Vec3} from "../../base/math/vector";
import type {View} from "../../viewing/viewer";

/**
 * Which backend produced the {@link PickResult}.
 *
 * The picker exposes this so callers can reason about diagnostics
 * (e.g. "snap was requested but only BVH ran ⇒ no renderer attached")
 * without us baking that branching into hidden state. Routing decisions
 * stay opaque; the *outcome* is observable.
 */
export type PickStrategyId = "bvh" | "gpu";

/**
 * Snap landing site. Present on a {@link PickResult} only when the
 * renderer landed a vertex or edge within {@link PickParams.snapRadius}
 * pixels of the cursor.
 *
 * The snap is *independent* of whether a surface ray hit anything: a
 * snap may exist with no underlying surface hit (cursor in empty
 * space), or vice versa.
 */
export interface PickSnap {
  /** What the renderer snapped to. Vertex preferred on ties. */
  type: "vertex" | "edge";

  /** Canvas-pixel position of the snapped vertex / edge midpoint. */
  canvasPos: Vec2;

  /** World-space position of the snap. Always populated when this object exists. */
  worldPos: Vec3;
}

/**
 * Result of one {@link PickStrategy.pick} call. Plain immutable struct —
 * unlike the renderer's transient `PickResult`, the picker returns a
 * fresh object per call that callers can keep, serialise, etc.
 *
 * Field semantics:
 *
 *   - {@link hit} is `true` when *either* a surface ray hit or a snap
 *     landed (or both). It is the single source of truth for "did
 *     anything come back".
 *   - {@link worldPos}, {@link objectId}, {@link meshId} prefer the
 *     snap-landed site when {@link snap} is set, otherwise come from
 *     the surface ray. Callers reading `result.worldPos` get the most
 *     accurate point available without having to branch on snap.
 *   - {@link snap} is the raw snap info, kept separate so callers who
 *     need to distinguish "snapped to a vertex" from "hit a surface"
 *     (e.g. for UX feedback) can do so.
 *
 * Fields that don't apply to the chosen backend are `null` (BVH
 * picks set `worldNormal: null` for example — the BVH primitive
 * doesn't compute normals). The {@link strategyUsed} field tells you
 * which backend ran, so this isn't ambiguous.
 */
export interface PickResult {
  /** True iff the surface ray hit *or* a snap landed. */
  hit: boolean;

  /** The view this pick was scoped to. */
  view: View;

  /**
   * ID of the picked SceneObject. From snap when {@link snap} is set
   * and the renderer resolved an object id for it; otherwise from
   * the surface ray.
   */
  objectId: string | null;

  /** ID of the picked mesh, when the backend exposes one. */
  meshId: string | null;

  /**
   * Best-available world-space hit point. Snap-landed point when
   * {@link snap} is set, otherwise the surface-ray hit. `null` when
   * neither was found.
   */
  worldPos: Vec3 | null;

  /** World-space normal at the surface hit, when requested and supported. */
  worldNormal: Vec3 | null;

  /** GPU-only. Local-space hit point on the picked mesh. `null` from BVH. */
  localPos: Vec3 | null;

  /** GPU-only. UV at the surface hit. `null` when not requested or not available. */
  uv: Vec2 | null;

  /** Echo of {@link PickParams.canvasPos} when a canvas pick was used. */
  canvasPos: Vec2 | null;

  /** World-space ray origin used for the test. Always populated. */
  rayOrigin: Vec3 | null;

  /** World-space ray direction used for the test. Always populated. */
  rayDir: Vec3 | null;

  /**
   * BVH-only. Index of the hit triangle (offset into geometry indices
   * ÷ 3). `-1` when n/a (GPU branch, or ray miss).
   */
  triangleIndex: number;

  /**
   * Snap landing. `null` when snap wasn't requested, GPU was
   * unavailable, or the snap radius found nothing.
   */
  snap: PickSnap | null;

  /** Which backend produced this result. */
  strategyUsed: PickStrategyId;

  /**
   * Internal state epoch from the strategy that produced this result.
   * Used by future memoising decorators to invalidate cached results
   * on strategy state changes (renderer attach, context loss, etc.).
   * Callers SHOULD NOT rely on this for application logic.
   *
   * @internal
   */
  _stateEpoch: number;
}
