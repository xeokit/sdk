import type {Vec3} from "../../../base/math/vector";
import type {DistanceMeasurement} from "./DistanceMeasurement";
import type {DistanceMeasurementTool} from "./DistanceMeasurementTool";

/**
 * Mouse-driven creation of {@link DistanceMeasurement}s on a
 * {@link DistanceMeasurementTool}.
 *
 * ### Workflow
 *
 *   - {@link activate} attaches `pointermove` + `click` to the
 *     tool's View canvas.
 *   - As the cursor moves over geometry the control shows a small
 *     hover dot at the picked world point (or hides it on a miss).
 *   - First click captures the *origin* anchor and starts a
 *     "draft" measurement that follows the cursor.
 *   - Second click commits the *target* anchor and adds the
 *     finished measurement to {@link DistanceMeasurementTool.measurements}.
 *   - `Esc` cancels an in-progress measurement.
 *
 * Repeats until {@link deactivate} (or {@link destroy}) is called.
 *
 * Picking goes through {@link DistanceMeasurementTool.picker} —
 * the same BVH-based path the rest of the demo helpers use, so it
 * doesn't fight the GPU pick pipeline.
 *
 * The control is *single-shot* per pair — re-activation starts
 * fresh, even if the previous activation left a half-built
 * measurement around (it is discarded).
 */
export class MouseDistanceMeasurementsControl {

  readonly tool: DistanceMeasurementTool;

  private _active = false;
  private _destroyed = false;

  // First-click anchor for the in-progress measurement, or null
  // when the user hasn't clicked yet.
  private _pendingOrigin: Vec3 | null = null;
  private _pendingMeasurement: DistanceMeasurement | null = null;

  // Hover-preview dot — visible whenever the cursor is over
  // pickable geometry while the control is active.
  private _hoverDot: HTMLDivElement | null = null;

  // DOM listeners.
  private _onPointerMove: ((e: PointerEvent) => void) | null = null;
  private _onClick:       ((e: MouseEvent)   => void) | null = null;
  private _onKeyDown:     ((e: KeyboardEvent) => void) | null = null;

  /** @internal — use {@link DistanceMeasurementTool.mouseControl}. */
  constructor(tool: DistanceMeasurementTool) {
    this.tool = tool;
  }

  /** True between {@link activate} and {@link deactivate} / {@link destroy}. */
  get active(): boolean { return this._active; }

  /** True once {@link destroy} has run. */
  get destroyed(): boolean { return this._destroyed; }

  /**
   * Begin listening for mouse / keyboard input on the tool's
   * View canvas. No-op if already active or destroyed.
   */
  activate(): void {
    if (this._destroyed || this._active) return;
    this._active = true;

    const canvas = this.tool.view.htmlElement;
    canvas.style.cursor = "crosshair";

    this._ensureHoverDot();

    this._onPointerMove = (e: PointerEvent) => this._handlePointerMove(e);
    this._onClick       = (e: MouseEvent)   => this._handleClick(e);
    this._onKeyDown     = (e: KeyboardEvent) => this._handleKeyDown(e);

    canvas.addEventListener("pointermove", this._onPointerMove);
    canvas.addEventListener("click",       this._onClick);
    window.addEventListener("keydown",     this._onKeyDown);
  }

  /**
   * Stop listening for input. Any half-built measurement is
   * discarded. Idempotent.
   */
  deactivate(): void {
    if (!this._active) return;
    this._active = false;

    const canvas = this.tool.view.htmlElement;
    canvas.style.cursor = "";

    if (this._onPointerMove) canvas.removeEventListener("pointermove", this._onPointerMove);
    if (this._onClick)       canvas.removeEventListener("click",       this._onClick);
    if (this._onKeyDown)     window.removeEventListener("keydown",     this._onKeyDown);
    this._onPointerMove = this._onClick = this._onKeyDown = null;

    this._cancelPending();
    this._removeHoverDot();
  }

  /** Tear down everything. Idempotent. */
  destroy(): void {
    if (this._destroyed) return;
    this.deactivate();
    this._destroyed = true;
  }

  // ── Handlers ────────────────────────────────────────────────────

  private _handlePointerMove(e: PointerEvent): void {
    const hit = this._pickAt(e);

    if (!hit) {
      this._setHoverDotVisible(false);
      // Keep the draft measurement at its last good target so it
      // doesn't snap to (0,0,0) — just stop following.
      return;
    }

    // Position the hover dot at the snap landing site when there is
    // one; otherwise track the cursor. Gives the user a clear visual
    // cue when snap latches.
    this._moveHoverDot(hit.viewportX, hit.viewportY);
    this._setHoverDotVisible(true);

    // If we're between clicks, drag the target along with the
    // cursor so the user sees the measurement update live.
    if (this._pendingMeasurement && this._pendingOrigin) {
      this._pendingMeasurement.setEndpoints(this._pendingOrigin, hit.worldPos);
      // Trigger a re-project right now — the camera-update
      // subscription wouldn't fire on a passive cursor move.
      (this.tool as any)._updateAll?.();
    }
  }

  private _handleClick(e: MouseEvent): void {
    const hit = this._pickAt(e);
    if (!hit) return;

    if (!this._pendingOrigin) {
      // First click — start a draft measurement that ends at the
      // same point so it draws as a zero-length nubbin until the
      // first pointermove updates the target.
      this._pendingOrigin = hit.worldPos;
      this._pendingMeasurement = this.tool.createMeasurement({
        origin: hit.worldPos,
        target: [hit.worldPos[0], hit.worldPos[1], hit.worldPos[2]],
      });
      return;
    }

    // Second click — commit. The draft measurement is already in
    // the tool's registry, so we just clear the pending refs.
    this._pendingMeasurement!.setEndpoints(this._pendingOrigin, hit.worldPos);
    (this.tool as any)._updateAll?.();
    this._pendingOrigin = null;
    this._pendingMeasurement = null;
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && this._pendingMeasurement) {
      this._cancelPending();
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /**
   * Pick at the given mouse event's canvas coordinates with snap
   * enabled. Returns:
   *
   *   - `worldPos`: the snapped point's world position when the
   *     renderer landed a vertex/edge, otherwise the surface hit;
   *   - `viewportX`/`viewportY`: viewport-space coords for the snap
   *     landing site (so the hover dot can jump to it), or the
   *     cursor when no snap landed.
   *
   * `null` on a complete miss.
   */
  private _pickAt(
    e: MouseEvent,
  ): { worldPos: Vec3; viewportX: number; viewportY: number } | null {
    const view = this.tool.view;
    const rect = view.htmlElement.getBoundingClientRect();
    const canvasPos: [number, number] = [
      e.clientX - rect.left,
      e.clientY - rect.top,
    ];

    const result = this.tool.picker.pick({
      view, canvasPos,
      snapToVertex: true,
      snapToEdge:   true,
      snapRadius:   30,
    });
    if (!result.hit) return null;

    const wp = result.snap?.worldPos ?? result.worldPos;
    if (!wp) return null;

    // Prefer the snap canvas position for the hover dot when snap
    // landed — gives the user a sharp visual lock onto the vertex
    // / edge. Fall back to the cursor's actual viewport position
    // for plain surface hits.
    const viewportX = result.snap
      ? rect.left + result.snap.canvasPos[0]
      : e.clientX;
    const viewportY = result.snap
      ? rect.top  + result.snap.canvasPos[1]
      : e.clientY;

    return { worldPos: [wp[0], wp[1], wp[2]], viewportX, viewportY };
  }

  private _cancelPending(): void {
    if (this._pendingMeasurement) {
      this.tool.destroyMeasurement(this._pendingMeasurement.id);
      this._pendingMeasurement = null;
    }
    this._pendingOrigin = null;
  }

  // ── Hover dot ───────────────────────────────────────────────────

  private _ensureHoverDot(): void {
    if (this._hoverDot) return;
    const dot = document.createElement("div");
    Object.assign(dot.style, {
      position:        "fixed",
      width:           "12px",
      height:          "12px",
      marginLeft:      "-6px",
      marginTop:       "-6px",
      borderRadius:    "50%",
      background:      "rgba(255,165,0,0.9)",
      border:          "1.5px solid #fff",
      boxShadow:       "0 1px 3px rgba(0,0,0,0.4)",
      pointerEvents:   "none",
      // Above floating panels (200_000_000) and loading overlays
      // (2_000_000) so the snap dot is always visible while a
      // measurement is being placed, even with chrome open over
      // the canvas.
      zIndex:          "999999999",
      display:         "none",
    });
    document.body.appendChild(dot);
    this._hoverDot = dot;
  }

  private _moveHoverDot(viewportX: number, viewportY: number): void {
    if (!this._hoverDot) return;
    this._hoverDot.style.left = `${viewportX}px`;
    this._hoverDot.style.top  = `${viewportY}px`;
  }

  private _setHoverDotVisible(v: boolean): void {
    if (!this._hoverDot) return;
    this._hoverDot.style.display = v ? "block" : "none";
  }

  private _removeHoverDot(): void {
    if (this._hoverDot && this._hoverDot.parentNode) {
      this._hoverDot.parentNode.removeChild(this._hoverDot);
    }
    this._hoverDot = null;
  }
}
