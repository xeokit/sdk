/**
 * Floating, draggable, closeable panel that visualises Scene
 * AABBs from three orthogonal axes (Top, Front, Side). A small
 * "you are here" arrow on each view shows the camera's eye +
 * look direction projected onto that plane.
 *
 * Sister widget to {@link studio/sceneStats!SceneStatsPanel | SceneStatsPanel} and
 * {@link studio/dataStats!DataStatsPanel | DataStatsPanel} — same floating chrome,
 * same colour palette, same drag / close / reopen-pill mechanics.
 *
 * ## Lazy event setup
 *
 * Listeners attach **only while the panel is visible**. While
 * hidden, the panel costs nothing per-event. A constructor-time
 * `onSceneDestroyed` watcher is the one exception — it stays
 * subscribed even when hidden so the panel can clean itself up
 * if the underlying Scene is torn down behind its back.
 *
 * ## Refresh triggers
 *
 * The panel re-paints when any of these fire (rAF-coalesced
 * into a single paint per frame):
 *
 *   - **AABB topology changes** — object / mesh create / destroy,
 *     mesh-matrix changes, mesh moves, model lifecycle.
 *   - **Camera pose changes** — `onCameraViewMatrixUpdated`
 *     keeps the "you are here" pointer current.
 *
 * ```ts
 * import {BoundariesPanel} from "@xeokit/website-studio";
 *
 * const bnd = new BoundariesPanel({scene, view});
 * bnd.show();         // attaches listeners + paints
 * bnd.hide();         // detaches; pill takes over
 * bnd.destroy();      // tears down DOM + listeners
 * ```
 *
 */
import type {Scene} from "@xeokit/sdk/model/scene";
import type {View} from "@xeokit/sdk/viewing/viewer";
import type {CameraFlightAnimation} from "@xeokit/sdk/viewing/cameraFlight";
import type {Vec3} from "@xeokit/sdk/base/math/vector";
import type {AABB3} from "@xeokit/sdk/base/math/boundaries";
import {type SceneCollisionIndex, getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";


import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface BoundariesPanelParams {

  /** The Scene whose AABBs to surface. */
  scene: Scene;

  /**
   * View used for the camera-pose "you are here" arrows on each
   * of the three orthogonal projections.
   */
  view: View;

  /**
   * {@link CameraFlightAnimation | CameraFlightAnimation} used for
   * click-to-jump transitions between section centres. Optional —
   * when omitted the panel falls back to an instant `cam.eye / cam.look`
   * snap. `cameraFlight` is held on the per-View
   * {@link studio!viewManager.ViewRecord | ViewRecord}, not the {@link View} itself, so callers that
   * want the cinematic arc-and-ease flight need to thread it through
   * explicitly:
   *
   * ```ts
   * const record = studio.viewManager.views[view.id];
   * BoundariesPanel.openFor({
   *   scene, view, cameraFlight: record.cameraFlight,
   * });
   * ```
   */
  cameraFlight?: CameraFlightAnimation;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-bnd-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-bnd-styles";
let _stylesInjected = false;

function injectStylesOnce(): void {
  if (_stylesInjected) return;
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_TAG_ID)) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
  _stylesInjected = true;
}

/** Pointer-arrow palette — each axis projection gets its own
 *  colour stripe so a glance at the section header tells you
 *  which AABB plane you're on. */
const PALETTE = [
  "#4a90e2", "#27ae60", "#c9a7ff", "#e67e22", "#e74c3c", "#7ec7e6",
  "#b3c6e0", "#8a722c", "#9c4666", "#2c7e6f"
] as const;


// ─────────────────────────────────────────────────────────────────
// CSS — every selector rooted at `.xkt-bnd-panel` / `.xkt-bnd-pill`,
// every class prefixed `xkt-bnd-`. Visually matches the other
// stats panels.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-bnd-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 540px;
  /* Auto height so the panel hugs its content — extents
     readout + each axis section adds rows and the panel
     grows / shrinks as the user expands or collapses sections.
     The max-height bound caps it at the viewport so all three
     SVG views open at once still scrolls inside the panel
     rather than overflowing the screen. */
  height: auto;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: #111;
  z-index: 200000000;
  overflow: hidden;
  box-sizing: border-box;
}
.xkt-bnd-panel *, .xkt-bnd-panel *::before, .xkt-bnd-panel *::after {
  box-sizing: border-box;
}
.xkt-bnd-panel[hidden] { display: none; }

.xkt-bnd-panel .xkt-bnd-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 12px 16px;
  border-bottom: 1px solid #ececec;
  flex: 0 0 auto;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.xkt-bnd-panel .xkt-bnd-header.xkt-bnd-dragging { cursor: grabbing; }
.xkt-bnd-panel .xkt-bnd-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  color: #111;
  display: flex;
  align-items: center;
  gap: 8px;
}
.xkt-bnd-panel .xkt-bnd-title-icon {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
  width: 24px;
  height: 24px;
  color: #2d5e8c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-bnd-panel .xkt-bnd-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-bnd-panel .xkt-bnd-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-bnd-panel .xkt-bnd-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-bnd-panel .xkt-bnd-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-bnd-panel .xkt-bnd-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  font: inherit;
  font-size: 22px;
  line-height: 1;
  color: #777;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-bnd-panel .xkt-bnd-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-bnd-pill {
  position: fixed;
  bottom: 17px;
  right: 438px;
  z-index: 200000000;
  padding: 9px 16px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #fff;
  background: #2d5e8c;
  border: 1px solid #1f4669;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-bnd-pill:hover { background: #1f4669; }
.xkt-bnd-pill[hidden] { display: none; }

.xkt-bnd-panel .xkt-bnd-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 14px;
}
.xkt-bnd-panel .xkt-bnd-empty {
  padding: 24px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}

/* Scene-AABB extents readout — sits at the top of the body. */
.xkt-bnd-panel .xkt-bnd-extents {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 10px;
  padding: 8px 12px;
  background: #fcfcfc;
  border: 1px solid #ececec;
  border-left: 3px solid #2d5e8c;
  border-radius: 6px;
  font-size: 11px;
  color: #444;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.xkt-bnd-panel .xkt-bnd-extents-label {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-size: 9.5px;
  font-weight: 600;
  color: #666;
  flex-shrink: 0;
}
.xkt-bnd-panel .xkt-bnd-extents-value {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-all;
}
.xkt-bnd-panel .xkt-bnd-json-btn {
  margin-left: auto;
  flex-shrink: 0;
  padding: 2px 8px;
  font: inherit;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #2d5e8c;
  background: transparent;
  border: 1px solid #b6cadb;
  border-radius: 999px;
  cursor: pointer;
}
.xkt-bnd-panel .xkt-bnd-json-btn:hover {
  background: #e7eef5;
  border-color: #2d5e8c;
}

/* Layer-filter pip row — one pip per observed SceneObject.layerId
   plus the implicit "default" bucket. Clicking a pip toggles
   inclusion of every object on that layer in the AABB projection. */
.xkt-bnd-panel .xkt-bnd-layers {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 6px 0 10px;
  padding: 8px 12px;
  background: #fcfcfc;
  border: 1px solid #ececec;
  border-radius: 6px;
  font-size: 11px;
}
.xkt-bnd-panel .xkt-bnd-layers-label {
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-size: 9.5px;
  font-weight: 600;
  color: #666;
  margin-right: 4px;
}
.xkt-bnd-panel .xkt-bnd-layer-pip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  font-size: 11px;
  color: #475569;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
}
.xkt-bnd-panel .xkt-bnd-layer-pip[data-on="1"] {
  color: #fff;
  background: #2d5e8c;
  border-color: #1f4669;
}
.xkt-bnd-panel .xkt-bnd-layer-pip[data-on="1"] .xkt-bnd-layer-dot {
  background: #fff;
}
.xkt-bnd-panel .xkt-bnd-layer-pip:hover {
  border-color: #2d5e8c;
}
.xkt-bnd-panel .xkt-bnd-layer-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #c0c0c0;
}

/* Per-axis section — collapsible. */
.xkt-bnd-panel .xkt-bnd-section {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid #2d5e8c;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-bnd-panel .xkt-bnd-section[data-axis="top"]   { border-left-color: #2d5e8c; }
.xkt-bnd-panel .xkt-bnd-section[data-axis="front"] { border-left-color: #2c7e6f; }
.xkt-bnd-panel .xkt-bnd-section[data-axis="side"]  { border-left-color: #9c4666; }
.xkt-bnd-panel .xkt-bnd-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-bnd-panel .xkt-bnd-section > summary::-webkit-details-marker { display: none; }
.xkt-bnd-panel .xkt-bnd-section > summary::marker                  { display: none; }
.xkt-bnd-panel .xkt-bnd-section > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-bnd-panel .xkt-bnd-section[open] > summary::before { transform: rotate(90deg); }
.xkt-bnd-panel .xkt-bnd-section > summary:hover { background: #fafafa; }
.xkt-bnd-panel .xkt-bnd-section-label {
  flex: 1;
  font-size: 12px;
  font-weight: 650;
  color: #222;
  letter-spacing: -0.1px;
}
.xkt-bnd-panel .xkt-bnd-section[data-axis="top"]   .xkt-bnd-section-label { color: #2d5e8c; }
.xkt-bnd-panel .xkt-bnd-section[data-axis="front"] .xkt-bnd-section-label { color: #2c7e6f; }
.xkt-bnd-panel .xkt-bnd-section[data-axis="side"]  .xkt-bnd-section-label { color: #9c4666; }
.xkt-bnd-panel .xkt-bnd-section > .xkt-bnd-section-body {
  padding: 8px 12px 10px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}
.xkt-bnd-panel .xkt-bnd-svgwrap {
  display: flex;
  justify-content: center;
}
.xkt-bnd-panel .xkt-bnd-svg {
  width: 100%;
  height: auto;
  max-width: 480px;
  background: #fff;
  border: 1px solid #ececec;
  border-radius: 6px;
}
/* Click-to-jump SVGs get a crosshair so the affordance is
   discoverable, plus a faint border-color hover hint that
   matches the per-axis section accent on each plane. */
.xkt-bnd-panel .xkt-bnd-svg-clickable {
  cursor: crosshair;
  transition: border-color 120ms ease-out;
}
.xkt-bnd-panel .xkt-bnd-section[data-axis="top"]   .xkt-bnd-svg-clickable:hover { border-color: #2d5e8c; }
.xkt-bnd-panel .xkt-bnd-section[data-axis="front"] .xkt-bnd-svg-clickable:hover { border-color: #2c7e6f; }
.xkt-bnd-panel .xkt-bnd-section[data-axis="side"]  .xkt-bnd-svg-clickable:hover { border-color: #9c4666; }
.xkt-bnd-panel .xkt-bnd-extentslabel {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10.5px;
  fill: #666;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

interface SectionRefs {
  details: HTMLDetailsElement;
  body: HTMLElement;
  axes: {ax0: number; ax1: number; flipV1: boolean};
  /**
   * `true` when the section's SVG no longer reflects the current
   * scene state (e.g. an AABB-affecting event has fired since
   * the last paint, but this section was collapsed at the time
   * so we skipped its render). The `<details>` toggle handler
   * checks this on open; if dirty, it does a one-shot render
   * and clears the flag.
   */
  dirty: boolean;
}

export class BoundariesPanel extends FloatingPanelBase {

  /**
   * Per-Scene instance registry. Lets {@link openFor} hand back
   * the existing live panel for a Scene instead of stacking
   * duplicates, and lets {@link getFor} probe for one without
   * disturbing it. Keyed by Scene rather than (Scene, View)
   * because the panel only renders one Camera at a time and a
   * second active panel for the same Scene would be redundant.
   * WeakMap so a Scene that gets dropped doesn't keep the panel
   * alive for GC.
   */
  private static readonly _instances = new WeakMap<Scene, BoundariesPanel>();

  /**
   * SVG markup for the panel's title-bar glyph (dashed AABB
   * outline with corner brackets). Strokes use `currentColor`.
   * Single source of truth — shared by `_buildDom` and external
   * callers like `ViewObjectContextMenu`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3.5" y="3.5" width="17" height="17" rx="2" ` +
            `fill="none" stroke="currentColor" stroke-width="1.4" ` +
            `stroke-dasharray="2.5 2"/>` +
      `<path d="M3 7 L3 3 L7 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M21 7 L21 3 L17 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M3 17 L3 21 L7 21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M21 17 L21 21 L17 21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
    `</svg>`;
  }

  /**
   * Returns the existing live panel bound to `scene`, or
   * `undefined` if none has been constructed (or the prior
   * instance was destroyed). Lets callers ask "is there already
   * a panel here?" without triggering the show side effect that
   * {@link openFor} performs.
   */
  static getFor(scene: Scene): BoundariesPanel | undefined {
    const inst = BoundariesPanel._instances.get(scene);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for `params.scene`.
   * Idempotent — if a panel already exists for this Scene and
   * is still alive, it's brought back to the foreground;
   * otherwise a fresh one is constructed.
   *
   * Built for the {@link demo!ViewObjectContextMenu | ViewObjectContextMenu} "Boundaries"
   * entry routed through {@link Studio.openBoundariesPanel}.
   */
  static openFor(params: BoundariesPanelParams): BoundariesPanel {
    let inst = BoundariesPanel._instances.get(params.scene);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new BoundariesPanel(params);
    return inst;
  }

  readonly scene: Scene;
  readonly view: View;
  readonly cameraFlight: CameraFlightAnimation | null;
  private readonly _index: SceneCollisionIndex;

  // DOM refs.
  private _bodyEl!: HTMLElement;
  private _extentsEl: HTMLElement | null = null;
  private _extentsValueEl: HTMLElement | null = null;
  private _jsonBtn: HTMLButtonElement | null = null;
  private _layersEl: HTMLElement | null = null;
  /**
   * Set of `layerId` values the user has *disabled* via the
   * filter pip row. Objects whose `layerId` (or the implicit
   * `"default"` bucket for objects with no layerId) is in this
   * set are excluded from the AABB collection — both the
   * Scene AABB and every per-section SVG paint skips them.
   *
   * Stored as the disabled set rather than the enabled set so
   * `"default"` doesn't need explicit population — layers the user
   * has never toggled simply aren't in the set.
   *
   * Non-`"default"` layers are auto-added to this set the first
   * time they appear (see `_seenLayers`) so the panel opens on a
   * clean default-only view; the user can then opt non-default
   * layers in via the pip row.
   */
  private readonly _disabledLayers = new Set<string>();
  /**
   * Every `layerId` value the panel has ever observed in the
   * Scene. Used to gate the one-shot auto-disable for non-default
   * layers — once a layer is in this set, the panel respects the
   * user's last pip choice for it and never auto-disables again.
   */
  private readonly _seenLayers = new Set<string>();
  private _sections: SectionRefs[] = [];

  // Lifecycle state.
  private _listenersAttached = false;
  private _refreshScheduled = false;
  private readonly _unsubs: Array<() => void> = [];
  private _onSceneDestroyedUnsub: (() => void) | null = null;

  // Drag state.

  constructor(params: BoundariesPanelParams) {
    if (!params || !params.scene || !params.view) {
      throw new Error("BoundariesPanel: scene and view are required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-bnd-panel",
      classPrefix: "xkt-bnd",
    });
    this.scene = params.scene;
    this.view  = params.view;
    // Accept the flight via params (the ViewManager-owned ViewRecord
    // holds it), and fall back to `view.cameraFlight` in case some
    // future View grows one as a property. If neither is available,
    // `_jumpCameraTo` reverts to an instant eye/look snap.
    this.cameraFlight = params.cameraFlight
      ?? ((params.view as any).cameraFlight as CameraFlightAnimation | undefined)
      ?? null;
    this._index = getSceneCollisionIndex(this.scene);

    // Replace any prior panel bound to the same Scene — keeps
    // openFor's idempotence honest and avoids stale DOM left
    // over from a hot-reload / re-import.
    const prior = BoundariesPanel._instances.get(params.scene);
    if (prior && !prior._destroyed) prior.destroy();
    BoundariesPanel._instances.set(params.scene, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireDomEvents();

    // Always-on watcher — so we can still self-clean if the
    // Scene is destroyed while the panel is hidden.
    this._onSceneDestroyedUnsub = this.scene.events.onSceneDestroyed.subscribe(() => {
      this.destroy();
    });


    if (params.visible === false) {
      this.hide();
    } else {
      this.show();
    }
  }


  // ── Public lifecycle ──────────────────────────────────────────

  /** `true` when the panel is mounted and visible. */
  get visible(): boolean {
    return this._panel.style.display !== "none";
  }

  /** Reveal panel. Attaches listeners + paints fresh content. */
  show(): void {
    if (this._destroyed) return;
    super.show();
    this._attachListeners();
    this._renderAll();
  }

  /**
   * Hide panel and detach Scene + Camera listeners. The pill
   * stands in for the panel; the panel costs nothing per-event
   * while in this state.
   */
  hide(): void {
    if (this._destroyed) return;
    super.hide();
    this._detachListeners();
  }

  /** Toggle visibility. */
  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  /** Tear down DOM + every listener. Idempotent. */
  destroy(): void {
    if (this._destroyed) return;
    this._detachListeners();
    if (this._onSceneDestroyedUnsub) {
      try { this._onSceneDestroyedUnsub(); } catch { /* ignore */ }
      this._onSceneDestroyedUnsub = null;
    }
    if (BoundariesPanel._instances.get(this.scene) === this) {
      BoundariesPanel._instances.delete(this.scene);
    }
    super.destroy();
  }


  // ── Listener attach / detach ──────────────────────────────────

  private _attachListeners(): void {
    if (this._listenersAttached || this._destroyed) return;
    this._listenersAttached = true;

    const ev = this.scene.events;
    const sub = (unsub: () => void) => this._unsubs.push(unsub);
    const onChange = () => this._scheduleRefresh();

    // Topology changes that can shift any object AABB or the
    // scene-wide AABB. Coalesced into one rAF paint.
    sub(ev.onSceneModelCreated.subscribe(onChange));
    sub(ev.onSceneModelDestroyed.subscribe(onChange));
    sub(ev.onSceneObjectCreated.subscribe(onChange));
    sub(ev.onSceneObjectDestroyed.subscribe(onChange));
    sub(ev.onSceneObjectMeshAdded.subscribe(onChange));
    sub(ev.onSceneObjectMeshRemoved.subscribe(onChange));
    sub(ev.onSceneMeshCreated.subscribe(onChange));
    sub(ev.onSceneMeshDestroyed.subscribe(onChange));
    sub(ev.onSceneMeshMatrixChanged.subscribe(onChange));
    sub(ev.onSceneMeshMoved.subscribe(onChange));

    // Camera pose changes — keeps the "you are here" pointer
    // current. Same debounce so a continuous orbit caps out at
    // one paint per frame.
    const viewerEvents = (this.view as any).viewer?.events;
    if (viewerEvents?.onCameraViewMatrixUpdated?.subscribe) {
      sub(viewerEvents.onCameraViewMatrixUpdated.subscribe(onChange));
    }
  }

  private _detachListeners(): void {
    if (!this._listenersAttached) return;
    for (const u of this._unsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._unsubs.length = 0;
    this._listenersAttached = false;
    this._refreshScheduled = false;
  }

  /**
   * Coalesce many fine-grained change events into at most one
   * paint per animation frame. Without this, an `applyFixes` run
   * mutating 1000 mesh matrices would trigger 1000 SVG rebuilds
   * mid-frame.
   */
  private _scheduleRefresh(): void {
    if (this._destroyed || !this._listenersAttached) return;
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    requestAnimationFrame(() => {
      this._refreshScheduled = false;
      if (this._destroyed || !this._listenersAttached) return;
      this._renderAll();
    });
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-bnd-pill", {
      type: "button",
      title: "Reopen the Scene Boundaries panel",
      hidden: true,
      textContent: "Scene Boundaries",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-bnd-panel");

    // Header — drag handle, title row, close.
    this._header = el("div", "xkt-bnd-header");
    const title = el("h2", "xkt-bnd-title");
    title.innerHTML =
      `<span class="xkt-bnd-title-icon">${BoundariesPanel.iconSvg()}</span>` +
      `<span class="xkt-bnd-title-stack">` +
        `<span class="xkt-bnd-title-text">Scene Boundaries</span>` +
        `<span class="xkt-bnd-subtitle">Axis-aligned views of scene object boundaries.</span>` +
      `</span>`;

    this._closeBtn = el("button", "xkt-bnd-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    // Body.
    this._bodyEl = el("div", "xkt-bnd-body");
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireDomEvents(): void {
    // Bring-to-front on any pointer-down inside the panel —
    // bubbles up so clicks on buttons / scroll thumbs / drag
  }


  // ── Layout persistence ────────────────────────────────────────



  // ── Rendering ─────────────────────────────────────────────────

  private _renderAll(): void {
    // Empty body if scene has no objects with meshes. We don't
    // build sections in this case — there's nothing to project.
    const data = this._collectFrameData();
    if (!data) {
      this._bodyEl.innerHTML = `<div class="xkt-bnd-empty">No object boundaries to display.</div>`;
      this._extentsEl = null;
      this._extentsValueEl = null;
      this._jsonBtn = null;
      this._layersEl = null;
      this._sections = [];
      return;
    }

    // First-render path: build the section list once. Subsequent
    // calls reuse the same DOM nodes so each section's open /
    // closed state survives a re-paint.
    if (this._sections.length === 0) {
      this._buildSectionShell();
    }

    // Extents readout always paints — it's not collapsible. Only the value
    // text updates; the label + JSON button persist from the shell build.
    if (this._extentsValueEl) {
      this._extentsValueEl.textContent = formatAABB(data.sceneAABB);
    }

    // Layer-filter pips — refreshed on every paint so new
    // layers appearing after the panel opens get a pip without
    // a manual rebuild.
    this._renderLayerPips(data.layers);

    // Per-view: render only the sections that are currently open.
    // Closed sections get their `dirty` flag set so the one-shot
    // toggle handler (wired in `_buildSectionShell`) renders them
    // when the user expands them. This keeps the panel cheap when
    // the user is only watching one axis — a fix run that mutates
    // 1000 mesh matrices at most rebuilds the open SVG, not all
    // three.
    for (const ref of this._sections) {
      if (ref.details.open) {
        this._renderSection(ref, data);
        ref.dirty = false;
      } else {
        ref.dirty = true;
      }
    }
  }

  /**
   * Snapshot the data each section needs for its SVG. Returns
   * `null` if there's nothing to project (no objects with meshes).
   */
  private _collectFrameData(): {
    aabbs: Array<{id: string; aabb: AABB3}>;
    sceneAABB: AABB3;
    camEye: Vec3;
    camLook: Vec3;
    /** Sorted list of every distinct `layerId` observed, including
     *  the implicit `"default"` bucket for objects without one. */
    layers: string[];
  } | null {
    const objects = (this.scene as any).objects || {};
    const aabbs: Array<{id: string; aabb: AABB3}> = [];
    const layerSet = new Set<string>();
    let unionAABB: AABB3 | null = null;
    for (const id of Object.keys(objects)) {
      const obj: any = objects[id];
      if (!obj.meshes || obj.meshes.length === 0) continue;
      const layer = obj.layerId || "default";
      // First-sighting of any non-default layer is auto-disabled
      // so the boundaries view opens on the source model only —
      // non-default layers (e.g. blueprint chrome) can be
      // confusing to a user who doesn't know what they are. The
      // user can opt them in via the pip row, and that choice
      // sticks because the layer is now in `_seenLayers`.
      if (!this._seenLayers.has(layer)) {
        this._seenLayers.add(layer);
        if (layer !== "default") this._disabledLayers.add(layer);
      }
      layerSet.add(layer);
      if (this._disabledLayers.has(layer)) continue;
      const a = this._index.getObjectAABB(id);
      if (!a) continue;
      aabbs.push({id, aabb: a});
      if (!unionAABB) {
        unionAABB = a.slice() as AABB3;
      } else {
        if (a[0] < unionAABB[0]) unionAABB[0] = a[0];
        if (a[1] < unionAABB[1]) unionAABB[1] = a[1];
        if (a[2] < unionAABB[2]) unionAABB[2] = a[2];
        if (a[3] > unionAABB[3]) unionAABB[3] = a[3];
        if (a[4] > unionAABB[4]) unionAABB[4] = a[4];
        if (a[5] > unionAABB[5]) unionAABB[5] = a[5];
      }
    }
    if (aabbs.length === 0 || !unionAABB) {
      // Even an empty frame needs to surface the layer list so
      // the pips render — fall back to the all-layers union if
      // the filter set has eaten every object, otherwise return
      // null to leave the panel in its "no boundaries" state.
      if (layerSet.size === 0) return null;
      return {
        aabbs: [],
        sceneAABB: [0, 0, 0, 0, 0, 0] as AABB3,
        camEye:    (this.view.camera as any).eye  as Vec3,
        camLook:   (this.view.camera as any).look as Vec3,
        layers:    Array.from(layerSet).sort(),
      };
    }
    const cam: any = this.view.camera;
    return {
      aabbs,
      // Use the filtered union, not the SceneCollisionIndex's
      // unconditional Scene AABB — otherwise disabling a layer
      // would still affect the readout's extents.
      sceneAABB: unionAABB,
      camEye:    cam.eye  as Vec3,
      camLook:   cam.look as Vec3,
      layers:    Array.from(layerSet).sort(),
    };
  }

  /**
   * Debug snapshot of the current boundaries as a plain JSON-serialisable
   * object: the filtered Scene AABB plus every contributing object's AABB
   * (and the layer filter state). Typed-array AABBs are converted to plain
   * arrays so they serialise as `[…]` rather than `{0:…}`.
   */
  private _boundariesJson(): unknown {
    const data = this._collectFrameData();
    if (!data) {
      return {sceneAABB: null, objectCount: 0, layers: [], objects: []};
    }
    return {
      sceneAABB: Array.from(data.sceneAABB),
      objectCount: data.aabbs.length,
      layers: data.layers,
      disabledLayers: Array.from(this._disabledLayers),
      objects: data.aabbs.map(o => ({id: o.id, aabb: Array.from(o.aabb)})),
    };
  }

  /**
   * Build the body shell on first render — extents readout +
   * three collapsible sections. Each section's `<details>` gets
   * a `toggle` handler that does a one-shot render when the user
   * expands a section that's been marked dirty since its last
   * paint.
   */
  private _buildSectionShell(): void {
    this._bodyEl.innerHTML = "";

    this._extentsEl = el("div", "xkt-bnd-extents");
    const extentsLabel = el("span", "xkt-bnd-extents-label", {textContent: "Scene AABB"});
    this._extentsValueEl = el("span", "xkt-bnd-extents-value");
    this._jsonBtn = el("button", "xkt-bnd-json-btn", {
      type: "button",
      textContent: "JSON",
      title: "Open the scene boundaries as JSON in a new tab",
    }) as HTMLButtonElement;
    this._jsonBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openJsonInNewTab(this._boundariesJson(), "Scene Boundaries JSON");
    });
    this._extentsEl.append(extentsLabel, this._extentsValueEl, this._jsonBtn);
    this._bodyEl.appendChild(this._extentsEl);

    // Per-layer toggle row. The pip list is rebuilt on every
    // re-render so newly-created layers (e.g. blueprints
    // appearing after a model load) show up without a panel
    // reopen.
    this._layersEl = el("div", "xkt-bnd-layers");
    this._bodyEl.appendChild(this._layersEl);

    const cs: any = (this.scene as any).coordinateSystem;
    const upAxis      = axisIndex(cs?.worldUp);
    const rightAxis   = axisIndex(cs?.worldRight);
    const forwardAxis = axisIndex(cs?.worldForward);
    const views: Array<{label: string; axisKey: "top" | "front" | "side"; ax0: number; ax1: number}> = [
      {label: "Top",   axisKey: "top",   ax0: rightAxis,   ax1: forwardAxis},
      {label: "Front", axisKey: "front", ax0: rightAxis,   ax1: upAxis},
      {label: "Side",  axisKey: "side",  ax0: forwardAxis, ax1: upAxis},
    ];

    this._sections = views.map((v, i) => {
      const section = el("details", "xkt-bnd-section") as HTMLDetailsElement;
      section.setAttribute("data-axis", v.axisKey);
      section.open = i === 0;     // open Top by default
      const summary = el("summary");
      const label = el("span", "xkt-bnd-section-label", {textContent: `${v.label} view`});
      summary.append(label);
      section.appendChild(summary);
      const body = el("div", "xkt-bnd-section-body");
      section.appendChild(body);
      this._bodyEl.appendChild(section);

      // Flip the SVG y mapping when the second axis is the
      // world up-axis (Front / Side views) — SVG y grows
      // downward, world up grows upward, so without the flip
      // those projections render upside down. Top doesn't
      // need it (its ax1 is the forward axis).
      const flipV1 = v.ax1 === upAxis;
      const ref: SectionRefs = {
        details: section, body,
        axes: {ax0: v.ax0, ax1: v.ax1, flipV1},
        dirty: false,
      };

      // One-shot render-on-open. While the panel is shown,
      // closed sections accumulate the `dirty` flag whenever
      // the scene mutates; opening one repays that debt with a
      // single render. While the panel is hidden, listeners are
      // detached and `dirty` doesn't change — `_renderAll` on
      // re-show paints the open sections + flags closed ones.
      section.addEventListener("toggle", () => {
        if (!section.open) return;
        if (!ref.dirty) return;
        const data = this._collectFrameData();
        if (!data) return;
        this._renderSection(ref, data);
        ref.dirty = false;
      });

      return ref;
    });
  }

  /**
   * Rebuild the layer-filter pip row. One pip per observed
   * SceneObject.layerId (including the implicit `"default"`
   * bucket). Clicking a pip toggles its layer's inclusion in
   * the AABB projection; the panel re-renders so the extents
   * readout and the open SVG section reflect the change.
   */
  private _renderLayerPips(layers: string[]): void {
    const host = this._layersEl;
    if (!host) return;
    host.replaceChildren();
    const label = el("span", "xkt-bnd-layers-label", {textContent: "Layers"});
    host.appendChild(label);
    for (const layer of layers) {
      const enabled = !this._disabledLayers.has(layer);
      const pip = el("button", "xkt-bnd-layer-pip", {
        type: "button",
        title: enabled
          ? `Click to hide objects on layer "${layer}".`
          : `Click to show objects on layer "${layer}".`,
      }) as HTMLButtonElement;
      pip.dataset.on = enabled ? "1" : "0";
      pip.dataset.layer = layer;
      const dot = el("span", "xkt-bnd-layer-dot");
      const name = el("span", undefined, {textContent: layer});
      pip.append(dot, name);
      pip.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (this._disabledLayers.has(layer)) {
          this._disabledLayers.delete(layer);
        } else {
          this._disabledLayers.add(layer);
        }
        // Mark every section dirty so the next paint redraws.
        // Open sections re-paint immediately via _renderAll;
        // closed ones repaint when next expanded.
        for (const ref of this._sections) ref.dirty = true;
        this._renderAll();
      });
      host.appendChild(pip);
    }
  }

  /** Repaint a single section's SVG using snapshotted data. */
  private _renderSection(ref: SectionRefs, data: {
    aabbs: Array<{id: string; aabb: AABB3}>;
    sceneAABB: AABB3;
    camEye: Vec3;
    camLook: Vec3;
  }): void {
    const ax0 = ref.axes.ax0;
    const ax1 = ref.axes.ax1;
    const flipV1 = ref.axes.flipV1;
    const svg = renderSVGView(
      data.aabbs, data.sceneAABB,
      ax0, ax1,
      data.camEye, data.camLook,
      (v0, v1) => this._jumpCameraTo(ax0, ax1, v0, v1),
      flipV1,
    );
    ref.body.innerHTML = "";
    const wrap = el("div", "xkt-bnd-svgwrap");
    wrap.appendChild(svg);
    ref.body.appendChild(wrap);
  }

  /**
   * Translate the camera as a rigid pair so the **look point**
   * lands at the clicked world position on the two visible
   * axes. The eye is shifted by the same delta, which preserves
   * the full eye→look offset (distance + direction) — i.e. the
   * camera's orientation is untouched, only its position
   * changes.
   *
   * Net effect per view:
   *   - **Top click**   → look slides in `right × forward` to
   *     the clicked spot; the camera follows alongside,
   *     keeping the same altitude offset and viewing angle.
   *   - **Front click** → look slides in `right × up`; camera
   *     follows, preserving forward distance + orientation.
   *   - **Side click**  → look slides in `forward × up`;
   *     camera follows, preserving lateral position +
   *     orientation.
   *
   * Best-effort setup:
   *   1. `view.cameraFlight.flyTo({eye, look})` when the View
   *      exposes one (Studio-mounted views do).
   *   2. Fall back to setting `camera.eye` / `camera.look`
   *      directly — instant snap.
   */
  private _jumpCameraTo(ax0: number, ax1: number, v0: number, v1: number): void {
    const cam: any = (this.view as any).camera;
    if (!cam) return;
    const eye  = cam.eye  as Vec3;
    const look = cam.look as Vec3;

    // Compute the translation that lands the look point at
    // the clicked spot on the two visible axes; the eye gets
    // the same delta so the eye→look vector (and therefore
    // the camera's orientation) is preserved.
    const delta: [number, number, number] = [0, 0, 0];
    delta[ax0] = v0 - look[ax0];
    delta[ax1] = v1 - look[ax1];

    const newEye:  [number, number, number] = [
      eye[0]  + delta[0], eye[1]  + delta[1], eye[2]  + delta[2],
    ];
    const newLook: [number, number, number] = [
      look[0] + delta[0], look[1] + delta[1], look[2] + delta[2],
    ];

    const flight: any = this.cameraFlight;
    if (flight && typeof flight.flyTo === "function") {
      // Cinematic transit between AABB sections:
      //   - `arc: true` lifts the camera into a parabolic apex along
      //     its look→eye axis at the flight midpoint, giving a sense
      //     of travel across the scene rather than a teleport.
      //   - `easing: "inThenOut"` is the piecewise-quadratic
      //     slow → fast → slow ease (triangular speed profile) — the
      //     camera departs and arrives at zero velocity, sweeping
      //     fastest at t = 0.5.
      //   - `up: cam.up` is required for the flight's eye/look/up
      //     interpolation branch to fire; without it `_flyingEyeLookUp`
      //     stays false and the animation tick has no branch to run.
      flight.flyTo({
        eye:      newEye,
        look:     newLook,
        up:       Array.from(cam.up),
        duration: 1.8,
        arc:      true,
        easing:   "inThenOut",
      });
    } else {
      cam.eye  = newEye;
      cam.look = newLook;
    }
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────


/**
 * Returns 0/1/2 depending on which world axis the unit-ish
 * Vec3 is closest to. Falls back to Y on degenerate / missing
 * coordinate-system data so the panel still picks a sensible
 * default rather than throwing.
 */
function axisIndex(vec: Vec3 | undefined | null): number {
  if (!vec || vec.length < 3) return 1;
  for (let i = 0; i < 3; ++i) if (Math.abs(vec[i]) > 0.5) return i;
  return 1;
}

function formatAABB(a: AABB3): string {
  return `${a[0].toFixed(3)}, ${a[1].toFixed(3)}, ${a[2].toFixed(3)}, ` +
         `${a[3].toFixed(3)}, ${a[4].toFixed(3)}, ${a[5].toFixed(3)}`;
}

function escapeHtml(s: string | number): string {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[c] as string));
}

/** Serialise `obj` to pretty JSON and open it as a styled page in a new tab. */
function openJsonInNewTab(obj: unknown, title = "JSON"): void {
  const json = JSON.stringify(obj, null, 2);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <meta charset="utf-8"/>
  <style>
    body { background: #0f1116; color: #e7e7e7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; padding: 0; }
    .json-pre { background: #0f1116; border-radius: 10px; margin: 24px 0 24px 24px; padding: 24px 32px; max-width: 900px; font-size: 15px; box-shadow: 0 4px 24px #0001; color: #e7e7e7; }
    h1 { color: #fff; font-size: 20px; font-weight: 650; margin: 24px 24px 12px 24px; }
    .meta { color: #aaa; font-size: 13px; margin: 0 24px 18px 24px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Serialized to JSON</div>
  <pre class="json-pre">${escapeHtml(json)}</pre>
</body>
</html>
  `.trim();
  const win = window.open();
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/**
 * Render one orthogonal projection of the scene onto axes
 * `ax0` × `ax1`. Returns a fully-built `<svg>` element ready to
 * mount. The rect for each object is filled at 18% opacity so
 * overlapping objects still let you see the layering.
 */
function renderSVGView(
  aabbs: Array<{id: string; aabb: AABB3}>,
  sceneAABB: AABB3,
  ax0: number,
  ax1: number,
  camEye: Vec3,
  camLook: Vec3,
  onPlaneClick?: (worldV0: number, worldV1: number) => void,
  /**
   * Invert the SVG y mapping for `v1`. SVG's y grows downward
   * but the world up-axis grows upward, so views projecting
   * onto an axis pair where `v1` is the up-axis (Front /
   * Side) need this flag to avoid rendering upside down.
   */
  flipV1: boolean = false,
): SVGSVGElement {
  const W = 480, H = 480, PAD = 36;
  const svgNS = "http://www.w3.org/2000/svg";

  // World extents — expand whichever axis is shorter so the view
  // stays aspect-preserving (avoids visually crushing thin scenes).
  const minX = sceneAABB[0], maxX = sceneAABB[3];
  const minY = sceneAABB[1], maxY = sceneAABB[4];
  const minZ = sceneAABB[2], maxZ = sceneAABB[5];
  const spans = [maxX - minX || 1, maxY - minY || 1, maxZ - minZ || 1];
  const maxSpan = Math.max(spans[0], spans[1], spans[2]);

  let min0 = sceneAABB[ax0], max0 = sceneAABB[ax0 + 3];
  let min1 = sceneAABB[ax1], max1 = sceneAABB[ax1 + 3];
  let span0 = max0 - min0 || 1;
  let span1 = max1 - min1 || 1;
  if (span0 < maxSpan) {
    const mid0 = (min0 + max0) / 2;
    min0 = mid0 - maxSpan / 2; max0 = mid0 + maxSpan / 2; span0 = maxSpan;
  }
  if (span1 < maxSpan) {
    const mid1 = (min1 + max1) / 2;
    min1 = mid1 - maxSpan / 2; max1 = mid1 + maxSpan / 2; span1 = maxSpan;
  }

  const toSvg = (v0: number, v1: number): [number, number] => {
    const ny = (v1 - min1) / span1;
    return [
      PAD + ((v0 - min0) / span0) * (W - 2 * PAD),
      PAD + (flipV1 ? 1 - ny : ny) * (H - 2 * PAD),
    ];
  };

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "xkt-bnd-svg");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  // Background 1 m grid — drawn first so AABBs sit on top of it.
  // Lines step at integer multiples of `stride` in world units;
  // axis-zero lines (where ax0 = 0 or ax1 = 0) are emphasised so
  // the user can find world origin at a glance. If the world span
  // is so large that 1 m would compress to less than 4 px we
  // bump the stride by ×10 until it's legible — the 1 m intent
  // is to scale, not to render an opaque hatch.
  {
    const minPx = 4;
    const pxPerWorld0 = (W - 2 * PAD) / span0;
    const pxPerWorld1 = (H - 2 * PAD) / span1;
    let stride = 1;
    while (stride * Math.min(pxPerWorld0, pxPerWorld1) < minPx) stride *= 10;

    const grid = document.createElementNS(svgNS, "g");
    grid.setAttribute("class", "xkt-bnd-grid");

    const drawGridLine = (
      x1: number, y1: number, x2: number, y2: number, isOrigin: boolean,
    ) => {
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute("stroke", isOrigin ? "#bcbcbc" : "#ececec");
      line.setAttribute("stroke-width", isOrigin ? "1" : "0.5");
      grid.appendChild(line);
    };

    // Vertical lines (constant ax0 = v) — clipped to scene rect.
    const start0 = Math.floor(min0 / stride) * stride;
    const end0   = Math.ceil(max0 / stride) * stride;
    const eps = stride * 0.001;
    for (let v = start0; v <= end0 + eps; v += stride) {
      const [sx, sy] = toSvg(v, min1);
      const [ex, ey] = toSvg(v, max1);
      drawGridLine(sx, sy, ex, ey, Math.abs(v) < eps);
    }
    // Horizontal lines (constant ax1 = v).
    const start1 = Math.floor(min1 / stride) * stride;
    const end1   = Math.ceil(max1 / stride) * stride;
    for (let v = start1; v <= end1 + eps; v += stride) {
      const [sx, sy] = toSvg(min0, v);
      const [ex, ey] = toSvg(max0, v);
      drawGridLine(sx, sy, ex, ey, Math.abs(v) < eps);
    }
    svg.appendChild(grid);

    // Stride caption — bottom-left corner. Shows the actual cell
    // size (1 m most of the time, 10 m / 100 m / … on huge scenes).
    const strideLabel = document.createElementNS(svgNS, "text");
    strideLabel.setAttribute("x", String(W - PAD - 4));
    strideLabel.setAttribute("y", String(H - PAD + 16));
    strideLabel.setAttribute("text-anchor", "end");
    strideLabel.setAttribute("class", "xkt-bnd-extentslabel");
    strideLabel.textContent = `grid: ${stride} m`;
    svg.appendChild(strideLabel);
  }

  // Scene AABB outline.
  {
    const [sx, sy] = toSvg(min0, min1);
    const [ex, ey] = toSvg(max0, max1);
    const r = document.createElementNS(svgNS, "rect");
    r.setAttribute("x", String(Math.min(sx, ex)));
    r.setAttribute("y", String(Math.min(sy, ey)));
    r.setAttribute("width",  String(Math.abs(ex - sx)));
    r.setAttribute("height", String(Math.abs(ey - sy)));
    r.setAttribute("fill", "#fff");
    r.setAttribute("stroke", "#b3c6e0");
    r.setAttribute("stroke-width", "2");
    svg.appendChild(r);
  }

  // Per-object AABBs.
  aabbs.forEach(({aabb}, i) => {
    const minA0 = aabb[ax0], maxA0 = aabb[ax0 + 3];
    const minA1 = aabb[ax1], maxA1 = aabb[ax1 + 3];
    const [ax, ay] = toSvg(minA0, minA1);
    const [bx, by] = toSvg(maxA0, maxA1);
    const r = document.createElementNS(svgNS, "rect");
    r.setAttribute("x", String(Math.min(ax, bx)));
    r.setAttribute("y", String(Math.min(ay, by)));
    r.setAttribute("width",  String(Math.abs(bx - ax)));
    r.setAttribute("height", String(Math.abs(by - ay)));
    const colour = PALETTE[i % PALETTE.length];
    r.setAttribute("fill", colour);
    r.setAttribute("fill-opacity", "0.18");
    r.setAttribute("stroke", colour);
    r.setAttribute("stroke-width", "1.5");
    svg.appendChild(r);
  });

  // "You are here" camera glyph — body + conical lens projected
  // onto this plane. Local +x is the gaze direction, so the
  // lens-cone widens toward the look point and the body sits
  // behind it. Whole group rotates by `atan2(look - eye)` so
  // the silhouette tracks camera orientation as the user
  // orbits.
  // Camera glyph — a foreshortened 3D camera: body + lens cone +
  // lens face. The cone shrinks as the camera's gaze tilts out
  // of the projection plane (it's a projected length); the
  // lens-face circle grows in its place, so a camera pointing
  // straight along the projection-perpendicular axis renders
  // as "body + bare lens" (we're seeing the camera face-on or
  // back-on), and a camera gazing in the projection plane
  // renders as "body + long cone" (we're seeing it in profile).
  //
  // Sign of the perpendicular component picks lens-face fill —
  // a filled circle means the lens is aimed toward the viewer
  // (along +axOther), an outlined hollow circle means it's
  // aimed away (along -axOther). That's the cue that
  // distinguishes "camera looking up at me" from "camera
  // looking down at the floor" in the Top view.
  const axOther = 3 - ax0 - ax1;     // ax0, ax1 ∈ {0,1,2} → other axis
  const eye0 = camEye[ax0],  eye1 = camEye[ax1];
  const [svgEyeX, svgEyeY] = toSvg(eye0, eye1);

  // Skip the glyph unless every value feeding an SVG numeric attribute is
  // finite. A NaN camera pose OR a degenerate scene AABB (which makes the
  // projection NaN even for a finite camera) would otherwise emit
  // "translate(NaN,NaN)" and flood the console with "transform: Expected
  // number" errors. Guarding the projected coords covers both causes.
  if (Number.isFinite(svgEyeX) && Number.isFinite(svgEyeY) &&
      camEye.every((c: number) => Number.isFinite(c)) &&
      camLook.every((c: number) => Number.isFinite(c))) {

    // Forward direction in world space, normalised. Using world
    // coords (not projected) so we can read off the
    // perpendicular component cleanly.
    let fx = camLook[0] - camEye[0];
    let fy = camLook[1] - camEye[1];
    let fz = camLook[2] - camEye[2];
    const fLen = Math.hypot(fx, fy, fz) || 1;
    fx /= fLen; fy /= fLen; fz /= fLen;
    const fwdN: [number, number, number] = [fx, fy, fz];

    const inPlaneMag = Math.hypot(fwdN[ax0], fwdN[ax1]);   // 0..1
    const perp       = fwdN[axOther];                      // -1..1

    // Rotation — derived from SVG-space direction so it
    // automatically tracks the flipV1 inversion (Front/Side
    // views). When the gaze is mostly perpendicular to the
    // plane, the in-plane direction is meaningless; fall back
    // to 0° so the body doesn't snap around with tiny
    // numerical noise.
    let angleDeg = 0;
    if (inPlaneMag > 0.05) {
      const [svgLookX, svgLookY] = toSvg(camLook[ax0], camLook[ax1]);
      const sdx = svgLookX - svgEyeX;
      const sdy = svgLookY - svgEyeY;
      angleDeg = Math.atan2(sdy, sdx) * 180 / Math.PI;
    }

    const camGroup = document.createElementNS(svgNS, "g");
    camGroup.setAttribute(
      "transform",
      `translate(${svgEyeX},${svgEyeY}) rotate(${angleDeg})`,
    );

    const STROKE = "#111";
    const FILL   = "#2d5e8c";

    // Body — always-visible anchor shape. Constant size (it's
    // a roughly box-shaped housing — the silhouette doesn't
    // change much with viewing angle).
    const bodyHalfH = 8;
    const body = document.createElementNS(svgNS, "rect");
    body.setAttribute("x", "-14");
    body.setAttribute("y", String(-bodyHalfH));
    body.setAttribute("width",  "18");
    body.setAttribute("height", String(bodyHalfH * 2));
    body.setAttribute("fill", FILL);
    body.setAttribute("stroke", STROKE);
    body.setAttribute("stroke-width", "1.6");
    body.setAttribute("stroke-linejoin", "round");
    camGroup.appendChild(body);

    // Top-edge highlight — a thin lighter stripe on the body
    // top so the body reads as a 3D box rather than a flat
    // rectangle.
    const top = document.createElementNS(svgNS, "line");
    top.setAttribute("x1", "-14");
    top.setAttribute("y1", String(-bodyHalfH));
    top.setAttribute("x2", "4");
    top.setAttribute("y2", String(-bodyHalfH));
    top.setAttribute("stroke", "#88a6c5");
    top.setAttribute("stroke-width", "1.4");
    camGroup.appendChild(top);

    // Lens cone — trapezoid whose length is the in-plane
    // projection of the gaze. When the camera is mostly
    // perpendicular to the plane, the cone collapses to
    // almost nothing (we're looking at the lens face, not
    // its profile).
    const CONE_MIN = 1;
    const CONE_MAX = 18;
    const coneLen = CONE_MIN + inPlaneMag * (CONE_MAX - CONE_MIN);
    if (coneLen > 1.5) {
      // Trapezoid: back edge at x=4 (front of body), front
      // edge at x=4+coneLen, opening from ±5 → ±10.
      const lens = document.createElementNS(svgNS, "polygon");
      const x1 = 4, y1 = 5;
      const x2 = 4 + coneLen, y2 = 10;
      lens.setAttribute(
        "points",
        `${x1},${-y1}  ${x2},${-y2}  ${x2},${y2}  ${x1},${y1}`,
      );
      lens.setAttribute("fill", FILL);
      lens.setAttribute("stroke", STROKE);
      lens.setAttribute("stroke-width", "1.6");
      lens.setAttribute("stroke-linejoin", "round");
      camGroup.appendChild(lens);
    }

    // Lens face — only drawn when the lens points TOWARD the
    // viewer (`perp > 0`). When it points away the lens is on
    // the far side of the camera body and would be occluded
    // by the cone barrel; drawing it as a hollow ring on top
    // of the cone produced visible artifacts (the ring edge
    // sticking out beyond the cone front), so we just skip
    // it. The shorter cone alone — combined with the absence
    // of a lens face — already reads as "camera looking
    // away".
    //
    // The lens is a circular disk in 3D perpendicular to the
    // camera's forward axis; projected into the picture plane
    // it appears as an ellipse:
    //   - major axis (`ry`) = disk diameter, perpendicular to
    //     the cone direction, held at the cone's front-edge
    //     half-height so the ellipse sits flush against the
    //     cone tip.
    //   - minor axis (`rx`) = `perp × ry` — the foreshortening.
    //     `perp = 0` (gaze in-plane) → ellipse collapses;
    //     `perp = 1` (gaze along the perpendicular axis) →
    //     ellipse becomes a circle (face-on lens).
    if (perp > 0.05) {
      const RY = 10;                                  // matches cone front half-height
      const rx = Math.max(0.5, perp * RY);
      const cx = 4 + coneLen;
      const face = document.createElementNS(svgNS, "ellipse");
      face.setAttribute("cx", String(cx));
      face.setAttribute("cy", "0");
      face.setAttribute("rx", String(rx));
      face.setAttribute("ry", String(RY));
      face.setAttribute("fill", FILL);
      face.setAttribute("stroke", STROKE);
      face.setAttribute("stroke-width", "1.6");
      camGroup.appendChild(face);

      // Glint — a tiny ellipse matching the lens's foreshortening
      // so it sits on the glass rather than floating in front
      // of it. Only when there's enough lens area to host it.
      if (rx > 2.5) {
        const glint = document.createElementNS(svgNS, "ellipse");
        glint.setAttribute("cx", String(cx - rx * 0.3));
        glint.setAttribute("cy", String(-RY * 0.3));
        glint.setAttribute("rx", String(Math.max(0.5, rx * 0.25)));
        glint.setAttribute("ry", String(Math.max(1.5, RY * 0.2)));
        glint.setAttribute("fill", "#fff");
        camGroup.appendChild(glint);
      }
    }

    svg.appendChild(camGroup);
  }

  // Min / max corner labels.
  {
    const minLabel = document.createElementNS(svgNS, "text");
    minLabel.setAttribute("x", String(PAD + 4));
    minLabel.setAttribute("y", String(H - PAD + 16));
    minLabel.setAttribute("class", "xkt-bnd-extentslabel");
    minLabel.textContent = `min: ${min0.toFixed(2)}, ${min1.toFixed(2)}`;
    svg.appendChild(minLabel);

    const maxLabel = document.createElementNS(svgNS, "text");
    maxLabel.setAttribute("x", String(W - PAD - 4));
    maxLabel.setAttribute("y", String(PAD - 8));
    maxLabel.setAttribute("class", "xkt-bnd-extentslabel");
    maxLabel.setAttribute("text-anchor", "end");
    maxLabel.textContent = `max: ${max0.toFixed(2)}, ${max1.toFixed(2)}`;
    svg.appendChild(maxLabel);
  }

  // Click-to-jump — wire only when the caller wants it. The
  // callback receives world coordinates on the two visible
  // axes; the panel translates that into a camera move.
  //
  // Mapping uses `getScreenCTM().inverse()` so the inverse is
  // accurate regardless of the SVG's rendered size or
  // `preserveAspectRatio` letterboxing — far more reliable
  // than measuring the bounding rect ourselves.
  if (onPlaneClick) {
    svg.classList.add("xkt-bnd-svg-clickable");
    svg.addEventListener("click", (ev) => {
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const inv = ctm.inverse();
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const local = pt.matrixTransform(inv);
      // Reject clicks outside the plot rectangle (the padding
      // around the data area carries axis labels — clicking on
      // the labels shouldn't fire a camera jump).
      if (local.x < PAD || local.x > W - PAD ||
          local.y < PAD || local.y > H - PAD) return;
      const v0 = min0 + (local.x - PAD) / (W - 2 * PAD) * span0;
      const ny = (local.y - PAD) / (H - 2 * PAD);
      const v1 = min1 + (flipV1 ? 1 - ny : ny) * span1;
      onPlaneClick(v0, v1);
    });
  }

  return svg;
}
