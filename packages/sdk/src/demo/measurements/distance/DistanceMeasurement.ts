import type {Vec3} from "../../../math/vector";
import type {DistanceMeasurementParams} from "./DistanceMeasurementParams";

const SVG_NS = "http://www.w3.org/2000/svg";

const COLOR_X = "#E04848";   // red
const COLOR_Y = "#3CB371";   // green
const COLOR_Z = "#3D7DDB";   // blue
const COLOR_DIAG_DEFAULT = "#FFA500"; // orange (length wire)

/**
 * One distance measurement — two world-space anchors plus the
 * overlay DOM/SVG that shows the diagonal length and its X / Y / Z
 * component decomposition.
 *
 * Instances are created and owned by {@link DistanceMeasurementTool};
 * external callers should go through the tool's
 * {@link DistanceMeasurementTool.createMeasurement} factory and
 * call {@link DistanceMeasurementTool.destroyMeasurement} (or
 * {@link DistanceMeasurementTool.clear}) to tear them down.
 *
 * ### Layout
 *
 * The measurement composes 4 wires and 4 labels:
 *
 * | Wire     | Color  | Goes from … to …                                  |
 * | -------- | ------ | ------------------------------------------------- |
 * | length   | orange | origin → target (the actual diagonal)             |
 * | x        | red    | origin → (target.x, origin.y, origin.z)           |
 * | y        | green  | (target.x, origin.y, origin.z) → (target.x, target.y, origin.z) |
 * | z        | blue   | (target.x, target.y, origin.z) → target            |
 *
 * The X / Y / Z polyline traces the right-angled "stair-step" between
 * the two anchors so the user can visualise each component
 * separately. The four label divs sit at each wire's midpoint.
 *
 * Toggles {@link visible}, {@link wireVisible}, {@link axisVisible},
 * {@link labelsVisible} compose like CSS visibility — hiding the
 * whole measurement (`visible = false`) overrides the others.
 */
export class DistanceMeasurement {

  /** Stable id for this measurement. Used as the registry key. */
  readonly id: string;

  /** World-space origin anchor (read-only — use {@link setEndpoints} to mutate). */
  private _origin: Vec3;

  /** World-space target anchor. */
  private _target: Vec3;

  private _visible: boolean;
  private _wireVisible: boolean;
  private _axisVisible: boolean;
  private _labelsVisible: boolean;
  private _color: string;

  // ── DOM / SVG elements ──────────────────────────────────────────
  // SVG primitives all sit inside the tool's shared <svg>; the
  // dot/label elements live in the tool's HTML overlay <div>.

  private readonly _wireLen: SVGLineElement;
  private readonly _wireX:   SVGLineElement;
  private readonly _wireY:   SVGLineElement;
  private readonly _wireZ:   SVGLineElement;

  private readonly _dotOrigin: HTMLDivElement;
  private readonly _dotTarget: HTMLDivElement;

  private readonly _labelLen: HTMLDivElement;
  private readonly _labelX:   HTMLDivElement;
  private readonly _labelY:   HTMLDivElement;
  private readonly _labelZ:   HTMLDivElement;

  private _destroyed = false;

  /** @internal */
  constructor(
    id: string,
    params: DistanceMeasurementParams,
    svgRoot: SVGSVGElement,
    htmlRoot: HTMLDivElement,
  ) {
    this.id = id;
    this._origin = [params.origin[0], params.origin[1], params.origin[2]];
    this._target = [params.target[0], params.target[1], params.target[2]];
    this._visible = params.visible !== false;
    this._wireVisible = params.wireVisible !== false;
    this._axisVisible = params.axisVisible !== false;
    this._labelsVisible = params.labelsVisible !== false;
    this._color = params.color ?? COLOR_DIAG_DEFAULT;

    // Wires.
    this._wireLen = makeWire(svgRoot, this._color, 2.5);
    this._wireX   = makeWire(svgRoot, COLOR_X,     1.5);
    this._wireY   = makeWire(svgRoot, COLOR_Y,     1.5);
    this._wireZ   = makeWire(svgRoot, COLOR_Z,     1.5);

    // Dots.
    this._dotOrigin = makeDot(htmlRoot, this._color);
    this._dotTarget = makeDot(htmlRoot, this._color);

    // Labels.
    this._labelLen = makeLabel(htmlRoot, this._color, "#fff");
    this._labelX   = makeLabel(htmlRoot, COLOR_X,     "#fff");
    this._labelY   = makeLabel(htmlRoot, COLOR_Y,     "#fff");
    this._labelZ   = makeLabel(htmlRoot, COLOR_Z,     "#fff");

    this._applyVisibility();
  }

  // ── Endpoints / metrics ──────────────────────────────────────────

  /** World-space origin anchor. */
  get origin(): Vec3 { return [this._origin[0], this._origin[1], this._origin[2]]; }

  /** World-space target anchor. */
  get target(): Vec3 { return [this._target[0], this._target[1], this._target[2]]; }

  /**
   * Move both endpoints in one shot. The tool will re-project on
   * its next sync tick.
   */
  setEndpoints(origin: Vec3, target: Vec3): void {
    this._origin[0] = origin[0]; this._origin[1] = origin[1]; this._origin[2] = origin[2];
    this._target[0] = target[0]; this._target[1] = target[1]; this._target[2] = target[2];
  }

  /** Diagonal world length between the two anchors. */
  get length(): number {
    const dx = this._target[0] - this._origin[0];
    const dy = this._target[1] - this._origin[1];
    const dz = this._target[2] - this._origin[2];
    return Math.hypot(dx, dy, dz);
  }

  // ── Visibility flags ─────────────────────────────────────────────

  get visible(): boolean { return this._visible; }
  set visible(v: boolean) { this._visible = !!v; this._applyVisibility(); }

  get wireVisible(): boolean { return this._wireVisible; }
  set wireVisible(v: boolean) { this._wireVisible = !!v; this._applyVisibility(); }

  get axisVisible(): boolean { return this._axisVisible; }
  set axisVisible(v: boolean) { this._axisVisible = !!v; this._applyVisibility(); }

  get labelsVisible(): boolean { return this._labelsVisible; }
  set labelsVisible(v: boolean) { this._labelsVisible = !!v; this._applyVisibility(); }

  /** Color for the diagonal length wire / its label / the anchor dots. */
  get color(): string { return this._color; }
  set color(c: string) {
    this._color = c;
    this._wireLen.setAttribute("stroke", c);
    this._dotOrigin.style.background = c;
    this._dotTarget.style.background = c;
    this._labelLen.style.background = c;
  }

  /** True once {@link destroy} has run. */
  get destroyed(): boolean { return this._destroyed; }

  // ── Per-frame projection ─────────────────────────────────────────

  /**
   * Recompute screen positions of all sub-elements. Called by the
   * tool once per camera-update tick — endpoints in world space,
   * canvas in pixels.
   *
   * `project(worldPos)` must return `[canvasX, canvasY, w]` where `w`
   * is the homogeneous `w`-component of the clip-space coordinate; a
   * non-positive `w` means "behind the camera" and the corresponding
   * sub-element is hidden.
   *
   * @internal
   */
  _update(project: (p: Vec3, out: [number, number, number]) => void): void {
    if (this._destroyed) return;

    // Two endpoints + the right-angled "stair-step" knee positions
    // give us the four wire segments. The knees match the
    // axis-decomposition convention: walk along world X, then Y,
    // then Z.
    const o = this._origin;
    const t = this._target;
    const kneeXY: Vec3 = [t[0], o[1], o[2]];                     // after walking X
    const kneeXYZ: Vec3 = [t[0], t[1], o[2]];                     // after walking X then Y

    const pO  = projectScratch[0]; project(o,      pO);
    const pT  = projectScratch[1]; project(t,      pT);
    const pK1 = projectScratch[2]; project(kneeXY, pK1);
    const pK2 = projectScratch[3]; project(kneeXYZ, pK2);

    // If any anchor is behind the camera the whole measurement
    // hides — partial draws look wrong (wire shoots off to infinity
    // through the corner of the screen).
    const anyBehind =
      pO[2]  <= 0 || pT[2]  <= 0 ||
      pK1[2] <= 0 || pK2[2] <= 0;

    if (anyBehind || !this._visible) {
      this._setOverlayVisible(false);
      return;
    }
    this._setOverlayVisible(true);

    // Wires.
    setLine(this._wireLen, pO[0],  pO[1],  pT[0],  pT[1]);
    setLine(this._wireX,   pO[0],  pO[1],  pK1[0], pK1[1]);
    setLine(this._wireY,   pK1[0], pK1[1], pK2[0], pK2[1]);
    setLine(this._wireZ,   pK2[0], pK2[1], pT[0],  pT[1]);

    // Dots.
    setDot(this._dotOrigin, pO[0], pO[1]);
    setDot(this._dotTarget, pT[0], pT[1]);

    // Labels at each wire's midpoint.
    const dx = t[0] - o[0];
    const dy = t[1] - o[1];
    const dz = t[2] - o[2];

    setLabel(this._labelLen, mid(pO[0], pT[0]),  mid(pO[1], pT[1]),  this.length);
    setLabel(this._labelX,   mid(pO[0], pK1[0]), mid(pO[1], pK1[1]), Math.abs(dx));
    setLabel(this._labelY,   mid(pK1[0], pK2[0]), mid(pK1[1], pK2[1]), Math.abs(dy));
    setLabel(this._labelZ,   mid(pK2[0], pT[0]),  mid(pK2[1], pT[1]),  Math.abs(dz));
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /** Tear down all DOM/SVG. Idempotent. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._wireLen.parentNode?.removeChild(this._wireLen);
    this._wireX.parentNode?.removeChild(this._wireX);
    this._wireY.parentNode?.removeChild(this._wireY);
    this._wireZ.parentNode?.removeChild(this._wireZ);

    this._dotOrigin.parentNode?.removeChild(this._dotOrigin);
    this._dotTarget.parentNode?.removeChild(this._dotTarget);

    this._labelLen.parentNode?.removeChild(this._labelLen);
    this._labelX.parentNode?.removeChild(this._labelX);
    this._labelY.parentNode?.removeChild(this._labelY);
    this._labelZ.parentNode?.removeChild(this._labelZ);
  }

  // ── Internals ────────────────────────────────────────────────────

  /**
   * Drives the per-element CSS `display` from the four flags. Kept
   * separate from {@link _update} so it runs once on flag change,
   * not every camera tick.
   */
  private _applyVisibility(): void {
    const all   = this._visible;
    const diag  = all && this._wireVisible;
    const axes  = all && this._axisVisible;
    const lbl   = all && this._labelsVisible;

    this._wireLen.style.display = diag ? "" : "none";
    this._wireX.style.display   = axes ? "" : "none";
    this._wireY.style.display   = axes ? "" : "none";
    this._wireZ.style.display   = axes ? "" : "none";

    this._dotOrigin.style.display = all ? "block" : "none";
    this._dotTarget.style.display = all ? "block" : "none";

    this._labelLen.style.display = (diag && lbl) ? "block" : "none";
    this._labelX.style.display   = (axes && lbl) ? "block" : "none";
    this._labelY.style.display   = (axes && lbl) ? "block" : "none";
    this._labelZ.style.display   = (axes && lbl) ? "block" : "none";
  }

  /**
   * Hide the whole overlay for a frame (e.g. an anchor went behind
   * the camera). Distinct from {@link _applyVisibility} — does NOT
   * touch the underlying flags, so the next frame can restore the
   * right per-element visibility.
   */
  private _setOverlayVisible(v: boolean): void {
    if (!v) {
      this._wireLen.style.visibility = "hidden";
      this._wireX.style.visibility = "hidden";
      this._wireY.style.visibility = "hidden";
      this._wireZ.style.visibility = "hidden";
      this._dotOrigin.style.visibility = "hidden";
      this._dotTarget.style.visibility = "hidden";
      this._labelLen.style.visibility = "hidden";
      this._labelX.style.visibility = "hidden";
      this._labelY.style.visibility = "hidden";
      this._labelZ.style.visibility = "hidden";
    } else {
      this._wireLen.style.visibility = "";
      this._wireX.style.visibility = "";
      this._wireY.style.visibility = "";
      this._wireZ.style.visibility = "";
      this._dotOrigin.style.visibility = "";
      this._dotTarget.style.visibility = "";
      this._labelLen.style.visibility = "";
      this._labelX.style.visibility = "";
      this._labelY.style.visibility = "";
      this._labelZ.style.visibility = "";
    }
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

function makeDot(htmlRoot: HTMLDivElement, color: string): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position:        "absolute",
    width:           "10px",
    height:          "10px",
    marginLeft:      "-5px",
    marginTop:       "-5px",
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
 * Round to a sensible precision for a length displayed as text. We
 * pick decimals based on magnitude so a 0.013m measurement reads
 * "0.013" while a 134m one reads "134". Caller can override later
 * by setting label `textContent` directly if a unit-aware formatter
 * is needed.
 */
function setLabel(el: HTMLDivElement, x: number, y: number, value: number): void {
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.textContent = formatLength(value);
}

function formatLength(v: number): string {
  const av = Math.abs(v);
  if (av >= 100)   return v.toFixed(0);
  if (av >= 10)    return v.toFixed(1);
  if (av >= 1)     return v.toFixed(2);
  if (av >= 0.01)  return v.toFixed(3);
  return v.toExponential(2);
}

function mid(a: number, b: number): number { return (a + b) * 0.5; }

// Reusable scratch — Vec3-shaped to hold canvasX / canvasY / w.
const projectScratch: [number, number, number][] = [
  [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
];
