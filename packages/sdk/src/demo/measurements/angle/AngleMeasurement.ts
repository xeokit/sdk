import type {Vec3} from "../../../math/vector";
import type {AngleMeasurementParams} from "./AngleMeasurementParams";

const SVG_NS = "http://www.w3.org/2000/svg";

const COLOR_DEFAULT = "#9C27B0"; // purple — distinct from DistanceMeasurement's orange

/**
 * One angle measurement — three world-space anchors (origin,
 * corner, target) plus the overlay DOM/SVG that shows the two
 * arms and the angle at the corner.
 *
 * Instances are created and owned by {@link AngleMeasurementsTool};
 * external callers should go through the tool's
 * {@link AngleMeasurementsTool.createMeasurement} factory and
 * call {@link AngleMeasurementsTool.destroyMeasurement} (or
 * {@link AngleMeasurementsTool.clear}) to tear them down.
 *
 * ### Layout
 *
 * The measurement composes 2 arm wires, 3 anchor dots, 1 angle
 * label, and a small arc that hints at which angle is being
 * measured (always the *interior* angle ≤ 180° formed at the
 * corner).
 *
 * | Element | Goes from … to …                                      |
 * | ------- | ----------------------------------------------------- |
 * | arm A   | origin → corner                                       |
 * | arm B   | corner → target                                       |
 * | arc     | small SVG path swept at corner between the two arms   |
 * | label   | floats just outside the arc, in the angle bisector    |
 *
 * Toggles {@link visible}, {@link wireVisible}, {@link labelsVisible}
 * compose like CSS visibility — hiding the whole measurement
 * (`visible = false`) overrides the others.
 */
export class AngleMeasurement {

  /** Stable id for this measurement. Used as the registry key. */
  readonly id: string;

  private _origin: Vec3;
  private _corner: Vec3;
  private _target: Vec3;

  private _visible: boolean;
  private _wireVisible: boolean;
  private _labelsVisible: boolean;
  private _color: string;

  // ── DOM / SVG elements ──────────────────────────────────────────

  private readonly _wireA: SVGLineElement;
  private readonly _wireB: SVGLineElement;
  private readonly _arc:   SVGPathElement;

  private readonly _dotOrigin: HTMLDivElement;
  private readonly _dotCorner: HTMLDivElement;
  private readonly _dotTarget: HTMLDivElement;

  private readonly _labelAngle: HTMLDivElement;

  private _destroyed = false;

  /** @internal */
  constructor(
    id: string,
    params: AngleMeasurementParams,
    svgRoot: SVGSVGElement,
    htmlRoot: HTMLDivElement,
  ) {
    this.id = id;
    this._origin = [params.origin[0], params.origin[1], params.origin[2]];
    this._corner = [params.corner[0], params.corner[1], params.corner[2]];
    this._target = [params.target[0], params.target[1], params.target[2]];
    this._visible = params.visible !== false;
    this._wireVisible = params.wireVisible !== false;
    this._labelsVisible = params.labelsVisible !== false;
    this._color = params.color ?? COLOR_DEFAULT;

    // Wires + arc.
    this._wireA = makeWire(svgRoot, this._color, 2);
    this._wireB = makeWire(svgRoot, this._color, 2);
    this._arc   = makeArc(svgRoot,  this._color, 1.5);

    // Dots.
    this._dotOrigin = makeDot(htmlRoot, this._color);
    this._dotCorner = makeDot(htmlRoot, this._color, true);
    this._dotTarget = makeDot(htmlRoot, this._color);

    // Label.
    this._labelAngle = makeLabel(htmlRoot, this._color, "#fff");

    this._applyVisibility();
  }

  // ── Endpoints / metrics ──────────────────────────────────────────

  get origin(): Vec3 { return [this._origin[0], this._origin[1], this._origin[2]]; }
  get corner(): Vec3 { return [this._corner[0], this._corner[1], this._corner[2]]; }
  get target(): Vec3 { return [this._target[0], this._target[1], this._target[2]]; }

  /**
   * Move all three anchors in one shot. The tool will re-project
   * on its next sync tick.
   */
  setAnchors(origin: Vec3, corner: Vec3, target: Vec3): void {
    this._origin[0] = origin[0]; this._origin[1] = origin[1]; this._origin[2] = origin[2];
    this._corner[0] = corner[0]; this._corner[1] = corner[1]; this._corner[2] = corner[2];
    this._target[0] = target[0]; this._target[1] = target[1]; this._target[2] = target[2];
  }

  /**
   * Interior angle at the corner, in **radians**, between the
   * two arms (origin → corner) and (corner → target). Always in
   * `[0, π]`. Returns `0` when an arm has zero length.
   */
  get angle(): number {
    const ax = this._origin[0] - this._corner[0];
    const ay = this._origin[1] - this._corner[1];
    const az = this._origin[2] - this._corner[2];
    const bx = this._target[0] - this._corner[0];
    const by = this._target[1] - this._corner[1];
    const bz = this._target[2] - this._corner[2];
    const la = Math.hypot(ax, ay, az);
    const lb = Math.hypot(bx, by, bz);
    if (la === 0 || lb === 0) return 0;
    let cos = (ax*bx + ay*by + az*bz) / (la * lb);
    // Clamp to defend against fp drift past ±1.
    if (cos >  1) cos =  1;
    if (cos < -1) cos = -1;
    return Math.acos(cos);
  }

  /** Same as {@link angle}, but in degrees. */
  get angleDegrees(): number {
    return this.angle * 180 / Math.PI;
  }

  // ── Visibility flags ─────────────────────────────────────────────

  get visible(): boolean { return this._visible; }
  set visible(v: boolean) { this._visible = !!v; this._applyVisibility(); }

  get wireVisible(): boolean { return this._wireVisible; }
  set wireVisible(v: boolean) { this._wireVisible = !!v; this._applyVisibility(); }

  get labelsVisible(): boolean { return this._labelsVisible; }
  set labelsVisible(v: boolean) { this._labelsVisible = !!v; this._applyVisibility(); }

  /** Color for the arm wires, arc, dots, and label background. */
  get color(): string { return this._color; }
  set color(c: string) {
    this._color = c;
    this._wireA.setAttribute("stroke", c);
    this._wireB.setAttribute("stroke", c);
    this._arc.setAttribute("stroke", c);
    this._dotOrigin.style.background = c;
    this._dotCorner.style.background = c;
    this._dotTarget.style.background = c;
    this._labelAngle.style.background = c;
  }

  /** True once {@link destroy} has run. */
  get destroyed(): boolean { return this._destroyed; }

  // ── Per-frame projection ─────────────────────────────────────────

  /**
   * Recompute screen positions of all sub-elements. Called by the
   * tool once per camera-update tick.
   *
   * `project(worldPos, out)` writes `[canvasX, canvasY, w]`; a
   * non-positive `w` means "behind the camera" and the whole
   * measurement is hidden for this frame.
   *
   * @internal
   */
  _update(project: (p: Vec3, out: [number, number, number]) => void): void {
    if (this._destroyed) return;

    const pO = projectScratch[0]; project(this._origin, pO);
    const pC = projectScratch[1]; project(this._corner, pC);
    const pT = projectScratch[2]; project(this._target, pT);

    const anyBehind = pO[2] <= 0 || pC[2] <= 0 || pT[2] <= 0;

    if (anyBehind || !this._visible) {
      this._setOverlayVisible(false);
      return;
    }
    this._setOverlayVisible(true);

    // Arms.
    setLine(this._wireA, pO[0], pO[1], pC[0], pC[1]);
    setLine(this._wireB, pC[0], pC[1], pT[0], pT[1]);

    // Dots.
    setDot(this._dotOrigin, pO[0], pO[1]);
    setDot(this._dotCorner, pC[0], pC[1]);
    setDot(this._dotTarget, pT[0], pT[1]);

    // Arc + label, sized in screen space using the screen-projected
    // arm directions. Doing this in 2D (rather than projecting a
    // sampled 3D arc) keeps the arc readable regardless of how
    // foreshortened the actual 3D angle is — the user judges the
    // angle by the label, not by the arc's apparent sweep.
    const ax = pO[0] - pC[0], ay = pO[1] - pC[1];
    const bx = pT[0] - pC[0], by = pT[1] - pC[1];
    const la = Math.hypot(ax, ay) || 1;
    const lb = Math.hypot(bx, by) || 1;

    // Unit screen-space arm vectors.
    const ux1 = ax / la, uy1 = ay / la;
    const ux2 = bx / lb, uy2 = by / lb;

    // Arc radius: 30% of the shorter arm in screen space, capped
    // so we don't draw a huge arc at low-angle screen projections.
    const r = Math.max(12, Math.min(50, Math.min(la, lb) * 0.3));

    // Arc endpoints sit on each arm at distance r from the corner.
    const arcStartX = pC[0] + ux1 * r;
    const arcStartY = pC[1] + uy1 * r;
    const arcEndX   = pC[0] + ux2 * r;
    const arcEndY   = pC[1] + uy2 * r;

    // Sweep direction: pick the short arc (≤ π). The cross product
    // sign tells us which way to sweep in screen-Y-down space; we
    // always want sweep-flag=0 with large-arc-flag=0 to draw the
    // short interior arc.
    const cross = ux1 * uy2 - uy1 * ux2;
    const sweep = cross < 0 ? 1 : 0;
    this._arc.setAttribute(
      "d",
      `M ${arcStartX} ${arcStartY} A ${r} ${r} 0 0 ${sweep} ${arcEndX} ${arcEndY}`,
    );

    // Label sits on the angle bisector, just past the arc.
    const bisX = ux1 + ux2;
    const bisY = uy1 + uy2;
    const bl = Math.hypot(bisX, bisY);
    let lx: number, ly: number;
    if (bl < 1e-6) {
      // Arms are anti-parallel (180° angle) — bisector degenerate;
      // place the label perpendicular to arm A.
      lx = pC[0] + (-uy1) * (r + 14);
      ly = pC[1] + ( ux1) * (r + 14);
    } else {
      lx = pC[0] + (bisX / bl) * (r + 14);
      ly = pC[1] + (bisY / bl) * (r + 14);
    }
    this._labelAngle.style.left = `${lx}px`;
    this._labelAngle.style.top  = `${ly}px`;
    this._labelAngle.textContent = formatAngle(this.angleDegrees);
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /** Tear down all DOM/SVG. Idempotent. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._wireA.parentNode?.removeChild(this._wireA);
    this._wireB.parentNode?.removeChild(this._wireB);
    this._arc.parentNode?.removeChild(this._arc);

    this._dotOrigin.parentNode?.removeChild(this._dotOrigin);
    this._dotCorner.parentNode?.removeChild(this._dotCorner);
    this._dotTarget.parentNode?.removeChild(this._dotTarget);

    this._labelAngle.parentNode?.removeChild(this._labelAngle);
  }

  // ── Internals ────────────────────────────────────────────────────

  private _applyVisibility(): void {
    const all  = this._visible;
    const wire = all && this._wireVisible;
    const lbl  = all && this._labelsVisible;

    this._wireA.style.display = wire ? "" : "none";
    this._wireB.style.display = wire ? "" : "none";
    this._arc.style.display   = wire ? "" : "none";

    this._dotOrigin.style.display = all ? "block" : "none";
    this._dotCorner.style.display = all ? "block" : "none";
    this._dotTarget.style.display = all ? "block" : "none";

    this._labelAngle.style.display = lbl ? "block" : "none";
  }

  private _setOverlayVisible(v: boolean): void {
    const vis = v ? "" : "hidden";
    this._wireA.style.visibility = vis;
    this._wireB.style.visibility = vis;
    this._arc.style.visibility   = vis;
    this._dotOrigin.style.visibility = vis;
    this._dotCorner.style.visibility = vis;
    this._dotTarget.style.visibility = vis;
    this._labelAngle.style.visibility = vis;
  }
}

// ── Tiny element factories ────────────────────────────────────────

function makeWire(svgRoot: SVGSVGElement, color: string, width: number): SVGLineElement {
  const ln = document.createElementNS(SVG_NS, "line");
  ln.setAttribute("stroke", color);
  ln.setAttribute("stroke-width", String(width));
  ln.setAttribute("stroke-linecap", "round");
  ln.setAttribute("vector-effect", "non-scaling-stroke");
  svgRoot.appendChild(ln);
  return ln;
}

function makeArc(svgRoot: SVGSVGElement, color: string, width: number): SVGPathElement {
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", color);
  p.setAttribute("stroke-width", String(width));
  p.setAttribute("stroke-linecap", "round");
  p.setAttribute("vector-effect", "non-scaling-stroke");
  svgRoot.appendChild(p);
  return p;
}

function makeDot(htmlRoot: HTMLDivElement, color: string, larger: boolean = false): HTMLDivElement {
  const el = document.createElement("div");
  const size = larger ? 12 : 10;
  Object.assign(el.style, {
    position:        "absolute",
    width:           `${size}px`,
    height:          `${size}px`,
    marginLeft:      `${-size / 2}px`,
    marginTop:       `${-size / 2}px`,
    borderRadius:    "50%",
    background:      color,
    border:          "1.5px solid #fff",
    boxShadow:       "0 1px 3px rgba(0,0,0,0.35)",
    pointerEvents:   "none",
  });
  htmlRoot.appendChild(el);
  return el;
}

function makeLabel(htmlRoot: HTMLDivElement, bg: string, fg: string): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position:        "absolute",
    transform:       "translate(-50%, -50%)",
    padding:         "1px 6px",
    borderRadius:    "4px",
    background:      bg,
    color:           fg,
    font:            '11px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontWeight:      "600",
    letterSpacing:   "0.2px",
    whiteSpace:      "nowrap",
    boxShadow:       "0 1px 3px rgba(0,0,0,0.35)",
    pointerEvents:   "none",
    userSelect:      "none",
  });
  htmlRoot.appendChild(el);
  return el;
}

function setLine(ln: SVGLineElement, x1: number, y1: number, x2: number, y2: number): void {
  ln.setAttribute("x1", String(x1));
  ln.setAttribute("y1", String(y1));
  ln.setAttribute("x2", String(x2));
  ln.setAttribute("y2", String(y2));
}

function setDot(el: HTMLDivElement, x: number, y: number): void {
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
}

/**
 * Format a degree value for the label — 1 decimal under 10°, none
 * above. Always followed by the degree sign so the user doesn't
 * confuse it with a length.
 */
function formatAngle(deg: number): string {
  const abs = Math.abs(deg);
  if (abs < 10) return `${deg.toFixed(1)}°`;
  return `${deg.toFixed(0)}°`;
}

const projectScratch: [number, number, number][] = [
  [0, 0, 0], [0, 0, 0], [0, 0, 0],
];
