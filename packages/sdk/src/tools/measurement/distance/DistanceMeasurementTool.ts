import type {View} from "../../../viewing/viewer";
import {BVHPickStrategy, type PickStrategy} from "../../../spatial/picking";
import {EventEmitter} from "../../../base/core";
import type {Vec3} from "../../../base/math/vector";
import {EventDispatcher} from "strongly-typed-events";
import {DistanceMeasurement} from "./DistanceMeasurement";
import type {DistanceMeasurementParams} from "./DistanceMeasurementParams";
import type {DistanceMeasurementToolParams} from "./DistanceMeasurementToolParams";
import {MouseDistanceMeasurementsControl} from "./MouseDistanceMeasurementsControl";
import {getElementCssSize} from "../../../viewing/viewer/getElementCssSize";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * DistanceMeasurementTool — overlay widget that renders one or
 * more {@link DistanceMeasurement | DistanceMeasurements} on a
 * {@link viewing!viewer.View | View}'s canvas.
 *
 * Mirrors the shape of V2's `DistanceMeasurementsPlugin` but
 * rendered with SVG + DOM (no second renderer or off-screen canvas).
 *
 * Interactive creation lives on {@link mouseControl} — see
 * {@link MouseDistanceMeasurementsControl}.
 *
 * ### Lifecycle
 *
 * One tool per View; the registry key is the View itself, so
 * {@link openFor} / {@link getFor} are idempotent.
 * `destroy()` tears down the overlay, all child measurements, and
 * the camera-update subscription.
 */
export class DistanceMeasurementTool {

  /** Per-View instance registry. */
  private static readonly _instances = new WeakMap<View, DistanceMeasurementTool>();

  /**
   * SVG glyph used in context-menu rows that toggle this widget —
   * a slim ruler. Strokes use `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M3 9 L21 3 L21 9 L3 15 Z" ` +
        `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M7 8 V11 M11 7 V11 M15 6 V10 M19 5 V8" ` +
        `stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>` +
    `</svg>`;
  }

  /** Returns the live tool bound to `view`, if any. */
  static getFor(view: View): DistanceMeasurementTool | undefined {
    const inst = DistanceMeasurementTool._instances.get(view);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Idempotent factory — returns the existing tool for
   * {@link DistanceMeasurementToolParams.view}, or constructs one.
   * If the existing instance was hidden it's shown again.
   */
  static openFor(params: DistanceMeasurementToolParams): DistanceMeasurementTool {
    let inst = DistanceMeasurementTool._instances.get(params.view);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new DistanceMeasurementTool(params);
    return inst;
  }

  // ── Public state ─────────────────────────────────────────────────

  readonly view: View;
  readonly picker: PickStrategy;
  readonly defaultColor: string;

  /** All measurements currently mounted, keyed by id. */
  readonly measurements: { [id: string]: DistanceMeasurement } = {};

  /**
   * Fires when the {@link measurements} map changes — after every
   * {@link createMeasurement}, {@link destroyMeasurement}, and
   * {@link clear} call. Coarse-grained: a listener that needs the
   * current contents should re-read the {@link measurements} map.
   */
  readonly onMeasurementsChanged: EventEmitter<DistanceMeasurementTool, void>;

  // ── Private state ────────────────────────────────────────────────

  private readonly _container: HTMLElement;
  private readonly _root: HTMLDivElement;
  private readonly _svg: SVGSVGElement;
  private readonly _htmlOverlay: HTMLDivElement;

  private _unsubCamera: (() => void) | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  private _nextId = 1;
  private _visible: boolean;
  private _destroyed = false;

  // Lazy mouse control — only built when callers ask for it, so
  // tools used purely via `createMeasurement(...)` don't pay for
  // the mousemove / picking pipeline.
  private _mouseControl: MouseDistanceMeasurementsControl | null = null;

  /**
   * Prefer {@link openFor} — it dedupes per-View. Direct
   * construction works but will replace any prior tool on the
   * same View.
   */
  constructor(params: DistanceMeasurementToolParams) {
    if (!params || !params.view) {
      throw new Error("[DistanceMeasurementTool] params.view is required");
    }
    this.view = params.view;
    this.picker = params.picker ?? new BVHPickStrategy(params.view.viewer.scene);
    this.defaultColor = params.defaultColor ?? "#FFA500";
    this._visible = params.visible !== false;
    this.onMeasurementsChanged = new EventEmitter(
      new EventDispatcher<DistanceMeasurementTool, void>(),
    );

    this._container = params.container ?? (this.view.htmlElement.parentElement as HTMLElement) ?? document.body;

    // ── Overlay root (covers the canvas; pointer-events none so
    //    clicks fall through to the View) ──────────────────────────
    this._root = document.createElement("div");
    Object.assign(this._root.style, {
      position:      "absolute",
      pointerEvents: "none",
      userSelect:    "none",
      zIndex:        "150000",
      display:       this._visible ? "block" : "none",
    });

    // ── SVG layer for the wires ──────────────────────────────────
    this._svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    Object.assign(this._svg.style, {
      position:      "absolute",
      inset:         "0",
      width:         "100%",
      height:        "100%",
      pointerEvents: "none",
      overflow:      "visible",
    });
    this._svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
    this._root.appendChild(this._svg);

    // ── HTML layer for dots + labels ─────────────────────────────
    this._htmlOverlay = document.createElement("div");
    Object.assign(this._htmlOverlay.style, {
      position:      "absolute",
      inset:         "0",
      pointerEvents: "none",
    });
    this._root.appendChild(this._htmlOverlay);

    this._container.appendChild(this._root);
    this._syncOverlayBounds();

    // ── Camera + resize sync ─────────────────────────────────────
    const events = (this.view.viewer as any).events;
    if (events?.onCameraViewMatrixUpdated?.subscribe) {
      this._unsubCamera = events.onCameraViewMatrixUpdated.subscribe(() => this._updateAll());
    }
    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(() => {
        this._syncOverlayBounds();
        this._updateAll();
      });
      this._resizeObserver.observe(this.view.htmlElement);
    }

    // Replace any prior tool bound to the same View.
    const prior = DistanceMeasurementTool._instances.get(this.view);
    if (prior && prior !== this && !prior._destroyed) prior.destroy();
    DistanceMeasurementTool._instances.set(this.view, this);
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Create a new measurement from explicit world-space anchors.
   *
   * The tool assigns an id when the caller doesn't, and asserts
   * that supplied ids are unique within this tool.
   */
  createMeasurement(params: DistanceMeasurementParams): DistanceMeasurement {
    if (this._destroyed) {
      throw new Error("[DistanceMeasurementTool] tool is destroyed");
    }
    const id = params.id ?? `dm-${this._nextId++}`;
    if (this.measurements[id]) {
      throw new Error(`[DistanceMeasurementTool] measurement id already exists: ${id}`);
    }
    const m = new DistanceMeasurement(
      id,
      { color: this.defaultColor, ...params },
      this._svg,
      this._htmlOverlay,
    );
    this.measurements[id] = m;
    this._updateOne(m);
    this.onMeasurementsChanged.dispatch(this, undefined);
    return m;
  }

  /** Destroy a single measurement by id. No-op if unknown. */
  destroyMeasurement(id: string): void {
    const m = this.measurements[id];
    if (!m) return;
    m.destroy();
    delete this.measurements[id];
    this.onMeasurementsChanged.dispatch(this, undefined);
  }

  /** Destroy every measurement currently registered. */
  clear(): void {
    if (Object.keys(this.measurements).length === 0) return;
    for (const id of Object.keys(this.measurements)) {
      this.measurements[id].destroy();
    }
    // Reset map content. Kept as the same object so external
    // references stay live (and just see an empty map).
    for (const id of Object.keys(this.measurements)) {
      delete this.measurements[id];
    }
    this.onMeasurementsChanged.dispatch(this, undefined);
  }

  /**
   * Returns the lazily-built {@link MouseDistanceMeasurementsControl}
   * bound to this tool. The control is *inactive* until
   * {@link MouseDistanceMeasurementsControl.activate | activate()}
   * is called.
   */
  get mouseControl(): MouseDistanceMeasurementsControl {
    if (!this._mouseControl) {
      this._mouseControl = new MouseDistanceMeasurementsControl(this);
    }
    return this._mouseControl;
  }

  // ── Visibility + lifecycle ───────────────────────────────────────

  get visible(): boolean { return this._visible && !this._destroyed; }

  /** True once {@link destroy} has run. */
  get destroyed(): boolean { return this._destroyed; }

  show(): void {
    if (this._destroyed) return;
    this._visible = true;
    this._root.style.display = "block";
    this._updateAll();
  }

  hide(): void {
    if (this._destroyed) return;
    this._visible = false;
    this._root.style.display = "none";
  }

  toggle(): boolean {
    if (this._visible) this.hide();
    else this.show();
    return this._visible;
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    if (this._mouseControl) {
      try { this._mouseControl.destroy(); } catch { /* ignore */ }
      this._mouseControl = null;
    }

    if (this._unsubCamera) {
      try { this._unsubCamera(); } catch { /* ignore */ }
      this._unsubCamera = null;
    }
    if (this._resizeObserver) {
      try { this._resizeObserver.disconnect(); } catch { /* ignore */ }
      this._resizeObserver = null;
    }

    this.clear();
    this._root.parentNode?.removeChild(this._root);

    if (DistanceMeasurementTool._instances.get(this.view) === this) {
      DistanceMeasurementTool._instances.delete(this.view);
    }
  }

  // ── Internals ────────────────────────────────────────────────────

  /**
   * Project a world-space point to the overlay's CSS-pixel space,
   * writing `[canvasX, canvasY, w]` into `out`. `w` ≤ 0 ⇒ behind
   * the camera; the caller should hide the corresponding glyph.
   *
   * @internal
   */
  private _project(p: Vec3, out: [number, number, number]): void {
    const camera = this.view.camera as any;
    const v = camera.viewMatrix as ArrayLike<number>;
    const m = camera.projMatrix as ArrayLike<number>;
    const cssSize = getElementCssSize(this.view.htmlElement);

    // view-space = viewMatrix * world.
    const x = p[0], y = p[1], z = p[2];
    const vx = v[0]*x + v[4]*y + v[8] *z + v[12];
    const vy = v[1]*x + v[5]*y + v[9] *z + v[13];
    const vz = v[2]*x + v[6]*y + v[10]*z + v[14];
    const vw = v[3]*x + v[7]*y + v[11]*z + v[15];

    // clip-space = projMatrix * view.
    const cx = m[0]*vx + m[4]*vy + m[8] *vz + m[12]*vw;
    const cy = m[1]*vx + m[5]*vy + m[9] *vz + m[13]*vw;
    const cw = m[3]*vx + m[7]*vy + m[11]*vz + m[15]*vw;

    if (cw === 0) {
      out[0] = 0; out[1] = 0; out[2] = -1;
      return;
    }
    const ndcX = cx / cw;
    const ndcY = cy / cw;

    out[0] = (ndcX + 1) * 0.5 * cssSize.width;
    out[1] = (1 - ndcY) * 0.5 * cssSize.height;
    out[2] = cw;
  }

  /**
   * Match the overlay's CSS rect to the View canvas. Called on
   * mount + on canvas resize so the SVG/DOM stay aligned even
   * when the canvas's container reflows (split-pane drag, etc.).
   */
  private _syncOverlayBounds(): void {
    const canvas = this.view.htmlElement;
    const containerRect = this._container.getBoundingClientRect();
    const canvasRect    = canvas.getBoundingClientRect();
    this._root.style.left   = `${canvasRect.left - containerRect.left}px`;
    this._root.style.top    = `${canvasRect.top  - containerRect.top}px`;
    this._root.style.width  = `${canvasRect.width}px`;
    this._root.style.height = `${canvasRect.height}px`;
    this._svg.setAttribute("viewBox", `0 0 ${canvasRect.width} ${canvasRect.height}`);
  }

  private _updateAll(): void {
    if (!this._visible || this._destroyed) return;
    for (const id in this.measurements) {
      this._updateOne(this.measurements[id]);
    }
  }

  private _updateOne(m: DistanceMeasurement): void {
    m._update((p, out) => this._project(p, out));
  }
}
