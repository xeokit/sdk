/**
 * Floating, draggable, closeable panel that visualises GPU
 * tiles produced by the {@link webGLRenderer!WebGLRenderer | WebGLRenderer} —
 * three orthogonal projections (Top XZ, Front XY, Side YZ) of
 * the tile grid, with a 1 m background grid and a camera "you
 * are here" glyph. Sister widget to
 * {@link demo/boundariesPanel!BoundariesPanel} — same floating
 * chrome, same colour palette, same per-section lazy refresh.
 *
 * ## Lazy event wiring
 *
 * Listeners attach **only while the panel is visible**.
 * Constructor subscribes a single `onSceneDestroyed` watcher so
 * the panel can self-clean if the Scene is torn down behind its
 * back; everything else attaches on `show()` / detaches on
 * `hide()`.
 *
 * ## Refresh triggers
 *
 * Tiles change when objects are added, destroyed, or moved.
 * The panel re-paints when any of these fire (rAF-coalesced
 * into a single paint per frame):
 *
 *   - **Tile-affecting Scene topology** — model / object / mesh
 *     create / destroy, mesh-matrix changes, mesh moves.
 *   - **Camera pose** — `onCameraViewMatrixUpdated` keeps the
 *     camera glyph current.
 *
 * ## Per-view lazy refresh
 *
 * Only the currently-open `<details>` section repaints on each
 * refresh. Closed sections get a `dirty` flag set; opening one
 * triggers a one-shot render. So a continuous matrix stream that
 * fires hundreds of events per second only rebuilds the SVG of
 * the section the user is actually looking at.
 *
 * ```ts
 * import {TilesPanel} from "@xeokit/sdk/demo";
 *
 * const tiles = new TilesPanel({renderStats, scene, view});
 * tiles.show();
 * tiles.hide();
 * tiles.destroy();
 * ```
 *
 * @module demo/tilesPanel
 */
import type {Scene} from "../../../scene";
import type {View} from "../../../viewer";
import type {RenderStats} from "../../../webGLRenderer/internal/inspectors/RenderStats";
import type {TileStats} from "../../../webGLRenderer/internal/inspectors/TileStats";


import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface TilesPanelParams {

  /**
   * Live {@link RenderStats} produced by the renderer's
   * {@link RenderInspector}. Mutated in place each frame; the
   * panel reads `renderStats.tiles` on each refresh.
   */
  renderStats: RenderStats;

  /** The Scene the renderer is attached to. */
  scene: Scene;

  /**
   * View used to derive the "you are here" camera glyph's
   * position + orientation on each projection.
   */
  view: View;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-tls-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-tls-styles";
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

/** Tile-rectangle palette — each tile gets its own colour stripe. */
const PALETTE = [
  "#6ab04c", "#22a6b3", "#f0932b", "#eb4d4b", "#be2edd",
  "#4834d4", "#7ed6df", "#8a722c", "#9c4666", "#2c7e6f",
] as const;


// ─────────────────────────────────────────────────────────────────
// CSS — every selector rooted at `.xkt-tls-panel` / `.xkt-tls-pill`,
// every class prefixed `xkt-tls-`. Visually matches the other
// floating panels.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-tls-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 540px;
  /* Auto height so the panel hugs its content — tile-count
     readout + each axis section adds rows and the panel grows
     / shrinks as the user expands or collapses sections. The
     max-height bound caps it at the viewport so all three SVG
     views open at once still scrolls inside the panel rather
     than overflowing the screen. */
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
.xkt-tls-panel *, .xkt-tls-panel *::before, .xkt-tls-panel *::after {
  box-sizing: border-box;
}
.xkt-tls-panel[hidden] { display: none; }

.xkt-tls-panel .xkt-tls-header {
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
.xkt-tls-panel .xkt-tls-header.xkt-tls-dragging { cursor: grabbing; }
.xkt-tls-panel .xkt-tls-title {
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
.xkt-tls-panel .xkt-tls-title-icon {
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
.xkt-tls-panel .xkt-tls-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-tls-panel .xkt-tls-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-tls-panel .xkt-tls-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-tls-panel .xkt-tls-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.3;
  white-space: normal;
}
.xkt-tls-panel .xkt-tls-close {
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
.xkt-tls-panel .xkt-tls-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-tls-pill {
  position: fixed;
  bottom: 17px;
  right: 568px;
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
.xkt-tls-pill:hover { background: #1f4669; }
.xkt-tls-pill[hidden] { display: none; }

.xkt-tls-panel .xkt-tls-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 14px;
}
.xkt-tls-panel .xkt-tls-empty {
  padding: 24px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}

/* Tile-count readout — sits at the top of the body. */
.xkt-tls-panel .xkt-tls-extents {
  margin: 6px 0 10px;
  padding: 8px 12px;
  background: #fcfcfc;
  border: 1px solid #ececec;
  border-left: 3px solid #2d5e8c;
  border-radius: 6px;
  font-size: 11px;
  color: #444;
  display: flex;
  align-items: center;
  gap: 12px;
}
.xkt-tls-panel .xkt-tls-extents-label {
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-size: 9.5px;
  font-weight: 600;
  color: #666;
}
.xkt-tls-panel .xkt-tls-extents-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #222;
  font-weight: 600;
}
.xkt-tls-panel .xkt-tls-json-btn {
  margin-left: auto;
  flex-shrink: 0;
  padding: 2px 8px;
  font: inherit;
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
.xkt-tls-panel .xkt-tls-json-btn:hover {
  background: #e7eef5;
  border-color: #2d5e8c;
}

/* Per-axis section — collapsible. */
.xkt-tls-panel .xkt-tls-section {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid #2d5e8c;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-tls-panel .xkt-tls-section[data-axis="top"]   { border-left-color: #2d5e8c; }
.xkt-tls-panel .xkt-tls-section[data-axis="front"] { border-left-color: #2c7e6f; }
.xkt-tls-panel .xkt-tls-section[data-axis="side"]  { border-left-color: #9c4666; }
.xkt-tls-panel .xkt-tls-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-tls-panel .xkt-tls-section > summary::-webkit-details-marker { display: none; }
.xkt-tls-panel .xkt-tls-section > summary::marker                  { display: none; }
.xkt-tls-panel .xkt-tls-section > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-tls-panel .xkt-tls-section[open] > summary::before { transform: rotate(90deg); }
.xkt-tls-panel .xkt-tls-section > summary:hover { background: #fafafa; }
.xkt-tls-panel .xkt-tls-section-label {
  flex: 1;
  font-size: 12px;
  font-weight: 650;
  color: #222;
  letter-spacing: -0.1px;
}
.xkt-tls-panel .xkt-tls-section[data-axis="top"]   .xkt-tls-section-label { color: #2d5e8c; }
.xkt-tls-panel .xkt-tls-section[data-axis="front"] .xkt-tls-section-label { color: #2c7e6f; }
.xkt-tls-panel .xkt-tls-section[data-axis="side"]  .xkt-tls-section-label { color: #9c4666; }
.xkt-tls-panel .xkt-tls-section > .xkt-tls-section-body {
  padding: 8px 12px 10px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}
.xkt-tls-panel .xkt-tls-svgwrap {
  display: flex;
  justify-content: center;
}
.xkt-tls-panel .xkt-tls-svg {
  width: 100%;
  height: auto;
  max-width: 480px;
  background: #fff;
  border: 1px solid #ececec;
  border-radius: 6px;
}
.xkt-tls-panel .xkt-tls-extentslabel {
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
  axes: {ax0: number; ax1: number};
  /**
   * `true` when the section's SVG no longer reflects current
   * scene state because a refresh was scheduled while this
   * section was collapsed. The toggle handler renders + clears.
   */
  dirty: boolean;
}

interface FrameData {
  tiles: TileStats[];
  bounds: {min0: number; max0: number; min1: number; max1: number; minTileSize: number} | null;
  camEye:  [number, number, number];
  camLook: [number, number, number];
}

export class TilesPanel extends FloatingPanelBase {

  /**
   * Per-Scene instance registry. {@link openFor} reuses the
   * existing live panel for a Scene; {@link getFor} probes for
   * one without disturbing it.
   */
  private static readonly _instances = new WeakMap<Scene, TilesPanel>();

  /**
   * SVG markup for the panel's title-bar glyph (2×2 tile grid).
   * Strokes use `currentColor`. Single source of truth — shared
   * by `_buildDom` and external callers like
   * `ViewObjectContextMenu`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3"  y="3"  width="6" height="6" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="11" y="3"  width="6" height="6" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="11" y="11" width="6" height="6" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<rect x="3"  y="11" width="6" height="6" rx="1" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
    `</svg>`;
  }

  static getFor(scene: Scene): TilesPanel | undefined {
    const inst = TilesPanel._instances.get(scene);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for `params.scene`.
   * Idempotent.
   */
  static openFor(params: TilesPanelParams): TilesPanel {
    let inst = TilesPanel._instances.get(params.scene);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new TilesPanel(params);
    return inst;
  }

  readonly scene: Scene;
  readonly view: View;
  readonly renderStats: RenderStats;

  // DOM refs.
  private _bodyEl!: HTMLElement;
  private _extentsEl: HTMLElement | null = null;
  private _extentsValueEl: HTMLElement | null = null;
  private _jsonBtn: HTMLButtonElement | null = null;
  private _sections: SectionRefs[] = [];

  // Lifecycle state.
  private _listenersAttached = false;
  private _refreshScheduled = false;
  private readonly _unsubs: Array<() => void> = [];
  private _onSceneDestroyedUnsub: (() => void) | null = null;

  // Drag state.

  constructor(params: TilesPanelParams) {
    if (!params || !params.scene || !params.view || !params.renderStats) {
      throw new Error("TilesPanel: scene, view, and renderStats are required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-tls-panel",
      classPrefix: "xkt-tls",
    });
    this.scene = params.scene;
    this.view  = params.view;
    this.renderStats = params.renderStats;

    // Replace any prior panel bound to the same Scene — keeps
    // openFor's idempotence honest and avoids stale DOM left
    // over from a hot-reload / re-import.
    const prior = TilesPanel._instances.get(params.scene);
    if (prior && !prior._destroyed) prior.destroy();
    TilesPanel._instances.set(params.scene, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireDomEvents();

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

  get visible(): boolean {
    return this._panel.style.display !== "none";
  }

  show(): void {
    if (this._destroyed) return;
    super.show();
    this._attachListeners();
    this._renderAll();
  }

  hide(): void {
    if (this._destroyed) return;
    super.hide();
    this._detachListeners();
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._detachListeners();
    if (this._onSceneDestroyedUnsub) {
      try { this._onSceneDestroyedUnsub(); } catch { /* ignore */ }
      this._onSceneDestroyedUnsub = null;
    }
    if (TilesPanel._instances.get(this.scene) === this) {
      TilesPanel._instances.delete(this.scene);
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

    // Tile topology shifts when objects / meshes are added,
    // destroyed, or moved. Same listener set as
    // BoundariesPanel; rAF-coalesced so a fix run that mutates
    // 1000 mesh matrices yields one paint.
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
    this._pill = el("button", "xkt-tls-pill", {
      type: "button",
      title: "Reopen the GPU Tiles panel",
      hidden: true,
      textContent: "GPU Tiles",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-tls-panel");

    this._header = el("div", "xkt-tls-header");
    const title = el("h2", "xkt-tls-title");
    title.innerHTML =
      `<span class="xkt-tls-title-icon">${TilesPanel.iconSvg()}</span>` +
      `<span class="xkt-tls-title-stack">` +
        `<span class="xkt-tls-title-text">GPU Tiles</span>` +
        `<span class="xkt-tls-subtitle">Live RTC tile map. An RTC tile is a region of the scene with its own local origin, used to keep geometry precise far from the world origin.</span>` +
      `</span>`;

    this._closeBtn = el("button", "xkt-tls-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    this._bodyEl = el("div", "xkt-tls-body");
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
    const data = this._collectFrameData();

    if (!data || data.tiles.length === 0) {
      this._bodyEl.innerHTML = `<div class="xkt-tls-empty">No GPU tiles to display.<br><br>Make sure the renderer's <code>RenderInspector</code> is enabled and a model has finished loading.</div>`;
      this._extentsEl = null;
      this._extentsValueEl = null;
      this._jsonBtn = null;
      this._sections = [];
      return;
    }

    if (this._sections.length === 0) {
      this._buildSectionShell();
    }

    if (this._extentsValueEl) {
      this._extentsValueEl.textContent = String(data.tiles.length);
    }

    // Per-view: render only the sections that are currently
    // open. Closed sections get `dirty = true` and lazily render
    // when expanded.
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
   * `null` only when the panel has nothing to read at all.
   */
  private _collectFrameData(): FrameData | null {
    const tiles: TileStats[] = Object.values(this.renderStats.tiles || {});
    const cam: any = this.view.camera;
    const camEye  = (cam.eye  || [0, 0, 0]) as [number, number, number];
    const camLook = (cam.look || [0, 0, 0]) as [number, number, number];

    if (tiles.length === 0) {
      return {tiles, bounds: null, camEye, camLook};
    }

    let min0 =  Infinity, min1 =  Infinity, min2 =  Infinity;
    let max0 = -Infinity, max1 = -Infinity, max2 = -Infinity;
    let minTileSize = Infinity;
    for (const t of tiles) {
      const half = t.size / 2;
      if (t.size < minTileSize) minTileSize = t.size;
      const cx = t.rtcCenter[0], cy = t.rtcCenter[1], cz = t.rtcCenter[2];
      if (cx - half < min0) min0 = cx - half;
      if (cy - half < min1) min1 = cy - half;
      if (cz - half < min2) min2 = cz - half;
      if (cx + half > max0) max0 = cx + half;
      if (cy + half > max1) max1 = cy + half;
      if (cz + half > max2) max2 = cz + half;
    }
    return {
      tiles,
      // We pack all three axes into the same tuple via min0..max2
      // and unpack per-section. Stored as a non-null bounds so the
      // section paths know there's something to draw.
      bounds: {min0, max0, min1, max1, minTileSize},
      camEye, camLook,
    };
  }

  private _buildSectionShell(): void {
    this._bodyEl.innerHTML = "";

    // Tile-count readout + JSON download.
    this._extentsEl = el("div", "xkt-tls-extents");
    const extentsLabel = el("span", "xkt-tls-extents-label", {textContent: "GPU Tiles"});
    this._extentsValueEl = el("span", "xkt-tls-extents-value", {textContent: "0"});
    this._jsonBtn = el("button", "xkt-tls-json-btn", {
      type: "button",
      textContent: "JSON",
      title: "Open the live GPUTiles array in a new tab",
    }) as HTMLButtonElement;
    this._jsonBtn.addEventListener("click", () => {
      const tiles: TileStats[] = Object.values(this.renderStats.tiles || {});
      openJsonInNewTab(tiles, "GPUTiles JSON");
    });
    this._extentsEl.append(extentsLabel, this._extentsValueEl, this._jsonBtn);
    this._bodyEl.appendChild(this._extentsEl);

    const views: Array<{label: string; axisKey: "top" | "front" | "side"; ax0: number; ax1: number; axesLabel: string}> = [
      {label: "Top",   axisKey: "top",   ax0: 0, ax1: 2, axesLabel: "X / Z"},
      {label: "Front", axisKey: "front", ax0: 0, ax1: 1, axesLabel: "X / Y"},
      {label: "Side",  axisKey: "side",  ax0: 1, ax1: 2, axesLabel: "Y / Z"},
    ];

    this._sections = views.map((v, i) => {
      const section = el("details", "xkt-tls-section") as HTMLDetailsElement;
      section.setAttribute("data-axis", v.axisKey);
      section.open = i === 0;     // open Top by default
      const summary = el("summary");
      const label = el("span", "xkt-tls-section-label", {
        textContent: `${v.label} view  ·  ${v.axesLabel}`,
      });
      summary.append(label);
      section.appendChild(summary);
      const body = el("div", "xkt-tls-section-body");
      section.appendChild(body);
      this._bodyEl.appendChild(section);

      const ref: SectionRefs = {details: section, body, axes: {ax0: v.ax0, ax1: v.ax1}, dirty: false};

      section.addEventListener("toggle", () => {
        if (!section.open) return;
        if (!ref.dirty) return;
        const data = this._collectFrameData();
        if (!data || !data.bounds) return;
        this._renderSection(ref, data);
        ref.dirty = false;
      });

      return ref;
    });
  }

  private _renderSection(ref: SectionRefs, data: FrameData): void {
    if (!data.bounds) return;
    const svg = renderSVGView(
      data.tiles,
      data.bounds,
      ref.axes.ax0, ref.axes.ax1,
      data.camEye, data.camLook,
    );
    ref.body.innerHTML = "";
    const wrap = el("div", "xkt-tls-svgwrap");
    wrap.appendChild(svg);
    ref.body.appendChild(wrap);
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────


/**
 * Render one orthogonal projection of the tile grid onto axes
 * `ax0` × `ax1`. Mirrors the BoundariesPanel renderer — same 1 m
 * grid + camera glyph treatment so the two panels read as a
 * coherent set.
 */
function renderSVGView(
  tiles: TileStats[],
  worldBounds: {min0: number; max0: number; min1: number; max1: number; minTileSize: number},
  ax0: number, ax1: number,
  camEye:  [number, number, number],
  camLook: [number, number, number],
): SVGSVGElement {
  const W = 480, H = 480, PAD = 36;
  const svgNS = "http://www.w3.org/2000/svg";

  // Per-axis bounds from the tile AABBs along this projection.
  let min0 =  Infinity, min1 =  Infinity;
  let max0 = -Infinity, max1 = -Infinity;
  for (const t of tiles) {
    const half = t.size / 2;
    const c0 = t.rtcCenter[ax0], c1 = t.rtcCenter[ax1];
    if (c0 - half < min0) min0 = c0 - half;
    if (c1 - half < min1) min1 = c1 - half;
    if (c0 + half > max0) max0 = c0 + half;
    if (c1 + half > max1) max1 = c1 + half;
  }

  // Pad ~1 tile on each side and equalise spans so the view
  // doesn't visually crush thin tile rows.
  const pad = worldBounds.minTileSize;
  min0 -= pad; max0 += pad;
  min1 -= pad; max1 += pad;
  let span0 = (max0 - min0) || 1;
  let span1 = (max1 - min1) || 1;
  const maxSpan = Math.max(span0, span1);
  if (span0 < maxSpan) {
    const mid0 = (min0 + max0) / 2;
    min0 = mid0 - maxSpan / 2; max0 = mid0 + maxSpan / 2; span0 = maxSpan;
  }
  if (span1 < maxSpan) {
    const mid1 = (min1 + max1) / 2;
    min1 = mid1 - maxSpan / 2; max1 = mid1 + maxSpan / 2; span1 = maxSpan;
  }

  const toSvg = (v0: number, v1: number): [number, number] => [
    PAD + ((v0 - min0) / span0) * (W - 2 * PAD),
    PAD + ((v1 - min1) / span1) * (H - 2 * PAD),
  ];

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "xkt-tls-svg");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  // Background 1 m grid — same treatment as BoundariesPanel.
  // Stride bumps ×10 if 1 m would compress to less than 4 px so
  // huge scenes don't draw an opaque hatch.
  {
    const minPx = 4;
    const pxPerWorld0 = (W - 2 * PAD) / span0;
    const pxPerWorld1 = (H - 2 * PAD) / span1;
    let stride = 1;
    while (stride * Math.min(pxPerWorld0, pxPerWorld1) < minPx) stride *= 10;

    const grid = document.createElementNS(svgNS, "g");
    grid.setAttribute("class", "xkt-tls-grid");

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

    const eps = stride * 0.001;
    const start0 = Math.floor(min0 / stride) * stride;
    const end0   = Math.ceil(max0  / stride) * stride;
    for (let v = start0; v <= end0 + eps; v += stride) {
      const [sx, sy] = toSvg(v, min1);
      const [ex, ey] = toSvg(v, max1);
      drawGridLine(sx, sy, ex, ey, Math.abs(v) < eps);
    }
    const start1 = Math.floor(min1 / stride) * stride;
    const end1   = Math.ceil(max1  / stride) * stride;
    for (let v = start1; v <= end1 + eps; v += stride) {
      const [sx, sy] = toSvg(min0, v);
      const [ex, ey] = toSvg(max0, v);
      drawGridLine(sx, sy, ex, ey, Math.abs(v) < eps);
    }
    svg.appendChild(grid);

    const strideLabel = document.createElementNS(svgNS, "text");
    strideLabel.setAttribute("x", String(W - PAD - 4));
    strideLabel.setAttribute("y", String(H - PAD + 16));
    strideLabel.setAttribute("text-anchor", "end");
    strideLabel.setAttribute("class", "xkt-tls-extentslabel");
    strideLabel.textContent = `grid: ${stride} m`;
    svg.appendChild(strideLabel);
  }

  // Per-tile rectangles.
  tiles.forEach((tile, i) => {
    const half = tile.size / 2;
    const c0 = tile.rtcCenter[ax0], c1 = tile.rtcCenter[ax1];
    const [ax, ay] = toSvg(c0 - half, c1 - half);
    const [bx, by] = toSvg(c0 + half, c1 + half);
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

  // "You are here" camera glyph — same shape as BoundariesPanel
  // so the two panels' overlays match.
  {
    const eye0 = camEye[ax0],  eye1 = camEye[ax1];
    const look0 = camLook[ax0], look1 = camLook[ax1];
    const [svgEyeX, svgEyeY] = toSvg(eye0, eye1);
    let dir0 = look0 - eye0, dir1 = look1 - eye1;
    const dirLen = Math.sqrt(dir0 * dir0 + dir1 * dir1) || 1;
    dir0 /= dirLen; dir1 /= dirLen;
    const angleDeg = Math.atan2(dir1, dir0) * 180 / Math.PI;

    const camGroup = document.createElementNS(svgNS, "g");
    camGroup.setAttribute(
      "transform",
      `translate(${svgEyeX},${svgEyeY}) rotate(${angleDeg})`,
    );

    const STROKE = "#111";
    const FILL   = "#2d5e8c";

    const body = document.createElementNS(svgNS, "rect");
    body.setAttribute("x", "-14");
    body.setAttribute("y", "-9");
    body.setAttribute("width",  "18");
    body.setAttribute("height", "18");
    body.setAttribute("fill", FILL);
    body.setAttribute("stroke", STROKE);
    body.setAttribute("stroke-width", "1.6");
    body.setAttribute("stroke-linejoin", "round");
    camGroup.appendChild(body);

    const lens = document.createElementNS(svgNS, "polygon");
    lens.setAttribute("points", "4,-5  22,-10  22,10  4,5");
    lens.setAttribute("fill", FILL);
    lens.setAttribute("stroke", STROKE);
    lens.setAttribute("stroke-width", "1.6");
    lens.setAttribute("stroke-linejoin", "round");
    camGroup.appendChild(lens);

    svg.appendChild(camGroup);
  }

  // Min / max corner labels.
  {
    const minLabel = document.createElementNS(svgNS, "text");
    minLabel.setAttribute("x", String(PAD + 4));
    minLabel.setAttribute("y", String(H - PAD + 16));
    minLabel.setAttribute("class", "xkt-tls-extentslabel");
    minLabel.textContent = `min: ${min0.toFixed(1)}, ${min1.toFixed(1)}`;
    svg.appendChild(minLabel);

    const maxLabel = document.createElementNS(svgNS, "text");
    maxLabel.setAttribute("x", String(W - PAD - 4));
    maxLabel.setAttribute("y", String(PAD - 8));
    maxLabel.setAttribute("class", "xkt-tls-extentslabel");
    maxLabel.setAttribute("text-anchor", "end");
    maxLabel.textContent = `max: ${max0.toFixed(1)}, ${max1.toFixed(1)}`;
    svg.appendChild(maxLabel);
  }

  return svg;
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
