import {
  createVec2Float64,
  createVec3Float64,
  type Vec2,
  type Vec3,
} from "../../base/math/vector";
import type {WebGLRenderer} from "../../viewing/webGLRenderer";
import type {PickParams as RendererPickParams} from "../../viewing/viewer/PickParams";
import type {PickResult as RendererPickResult} from "../../viewing/viewer/PickResult";
import type {PickParams} from "./PickParams";
import type {PickResult, PickSnap} from "./PickResult";
import type {PickStrategy} from "./PickStrategy";

/**
 * GPU-backed picking strategy — wraps {@link WebGLRenderer.pick}.
 *
 * Handles:
 *
 *   - canvas-pos pick (with optional snap-to-vertex / snap-to-edge);
 *   - ray pick (no snap; the renderer's snap path is canvas-only);
 *   - `worldNormal` when {@link PickParams.pickSurfaceNormal} is set;
 *   - `localPos`, `uv`, `meshId` whenever the renderer surfaces them.
 *
 * Doesn't handle:
 *
 *   - {@link PickParams.filter} — the renderer pick API has no
 *     callback filter; this strategy ignores it. The router escalates
 *     filter requests to the BVH leaf instead of calling here.
 *
 * The renderer returns a *transient, renderer-owned* `PickResult`
 * whose contents are valid only until the next pick. We deep-copy the
 * fields we need into a fresh canonical {@link PickResult} so callers
 * can hold onto it.
 *
 * Stateless after construction; {@link stateEpoch} stays `0`.
 * (State changes that affect GPU readiness are tracked by the
 * {@link RoutingPickStrategy} that owns this leaf, not by the leaf
 * itself.)
 */
export class RendererPickStrategy implements PickStrategy {

  readonly stateEpoch = 0;

  /**
   * @param _renderer The renderer to drive. The strategy assumes the
   *   renderer is in {@link WebGLRenderer.rendering} state when
   *   {@link pick} is called — the {@link RoutingPickStrategy} that
   *   composes this leaf is responsible for that gate.
   */
  constructor(private readonly _renderer: WebGLRenderer) {}

  pick(params: PickParams): PickResult {
    const wantSnap = !!(params.snapToVertex || params.snapToEdge);

    // Renderer's PickParams uses `rayPick: true` + ray fields rather
    // than a `ray` object, and it doesn't take a `matrix` input that
    // matches BVH's. We forward what we can; ray/matrix-only callers
    // who need GPU pick land on a "ray with no matrix" rendering, and
    // matrix-only callers should be routed to BVH upstream.
    const rendererParams: RendererPickParams = {
      canvasPos:         params.canvasPos,
      rayPick:           !!(params.ray || params.matrix),
      rayOrigin:         params.ray?.origin,
      rayDirection:      params.ray?.dir,
      rayMatrix:         params.matrix,
      pickInvisible:     params.pickInvisible === true,
      pickSurfaceNormal: params.pickSurfaceNormal === true,
      snapToVertex:      params.snapToVertex === true,
      snapToEdge:        params.snapToEdge === true,
      snapRadius:        params.snapRadius,
    };

    const result = this._renderer.pick(params.view, rendererParams);

    if (result.ok === false) {
      return missResult(params);
    }

    const v: RendererPickResult | undefined | null = result.value;
    if (!v) {
      return missResult(params);
    }

    return adaptRendererResult(v, params, wantSnap);
  }
}

// ── Adaptation ───────────────────────────────────────────────────────

/**
 * Copy the renderer's transient {@link RendererPickResult} into a
 * fresh canonical {@link PickResult}.
 *
 * Subtleties this code defends against:
 *
 *   - The renderer's `worldPos`, `worldNormal`, `localPos`, `uv` and
 *     `snappedToVertex` / `snappedToEdge` getters all gate on
 *     `viewObject !== null`. For snap-in-empty-space picks the
 *     renderer's `viewObject` may be null even though SnapManager
 *     landed a vertex; in that case `worldPos` returns `null` and we
 *     can't construct a complete {@link PickSnap}. We treat that as
 *     "snap not delivered" — the snap field stays `null`. (Tracked
 *     as a renderer-side follow-up.)
 *   - All vector getters return mutable typed arrays owned by the
 *     renderer. We copy into fresh `Vec*Float64` so callers can hold
 *     onto the result without it being clobbered by the next pick.
 */
function adaptRendererResult(
  v: RendererPickResult,
  params: PickParams,
  wantSnap: boolean,
): PickResult {
  const surfaceWorldPos = v.worldPos ? copyVec3(v.worldPos) : null;
  const snap = wantSnap ? extractSnap(v) : null;

  // worldPos prefers the snap-landed point when available — see the
  // PickResult docstring for the precedence rule.
  const worldPos = snap ? copyVec3(snap.worldPos) : surfaceWorldPos;

  const objectId = (v.viewObject?.id as string | undefined) ?? null;
  const meshId   = (v.sceneMesh?.id  as string | undefined) ?? null;

  const hit = !!(snap || surfaceWorldPos || v.viewObject);

  return {
    hit,
    view:          params.view,
    objectId,
    meshId,
    worldPos,
    worldNormal:   v.worldNormal ? copyVec3(v.worldNormal) : null,
    localPos:      v.localPos    ? copyVec3(v.localPos)    : null,
    uv:            v.uv          ? copyVec2(v.uv)          : null,
    canvasPos:     v.canvasPos   ? copyVec2(v.canvasPos)   : (params.canvasPos ?? null),
    rayOrigin:     v.origin      ? copyVec3(v.origin)      : null,
    rayDir:        v.direction   ? copyVec3(v.direction)   : null,
    triangleIndex: -1,
    snap,
    strategyUsed:  "gpu",
    _stateEpoch:   0,
  };
}

/**
 * Build a {@link PickSnap} from the renderer's snap fields.
 *
 * Returns `null` when the snap landed but the renderer didn't supply a
 * `worldPos` for it (the empty-space gating wart). Better to surface no
 * snap than a half-populated one with `worldPos: null`.
 */
function extractSnap(v: RendererPickResult): PickSnap | null {
  const canvasPos = v.snappedCanvasPos;
  if (!canvasPos) return null;          // snap didn't land

  const worldPos = v.worldPos;
  if (!worldPos) return null;           // see docstring above

  // Vertex preferred on ties — both flags can be `true` if SnapManager
  // happens to find both within radius and `viewObject` is set.
  const type: "vertex" | "edge" = v.snappedToVertex ? "vertex" : "edge";

  return {
    type,
    canvasPos: copyVec2(canvasPos),
    worldPos:  copyVec3(worldPos),
  };
}

function copyVec2(src: Vec2): Vec2 { return createVec2Float64(src); }
function copyVec3(src: Vec3): Vec3 { return createVec3Float64(src); }

function missResult(params: PickParams): PickResult {
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
    strategyUsed:  "gpu",
    _stateEpoch:   0,
  };
}
