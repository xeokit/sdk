/**
 * Floating, draggable, closeable panel that builds + drives
 * automatic camera walkthroughs for every SceneModel currently
 * loaded in the Studio.
 *
 * Each row lists one source SceneModel and exposes four actions:
 *
 *   - **Generate** — run the {@link planCameraTour} pipeline
 *     against the model's `(SceneModel, DataModel?)` pair, store
 *     the resulting {@link CameraTour}, and prime playback.
 *   - **Play / Pause** — start or pause the
 *     {@link playCameraTour} loop.
 *   - **Stop** — pause and rewind to the first waypoint.
 *   - **Delete** — destroy the playback, drop the tour, reset
 *     the row to its "not generated" state.
 *
 * Row metadata shows the room count, estimated duration, and —
 * during playback — the current room's label so the panel reads
 * as a tour HUD without the demo example needing its own.
 *
 * Same chrome / lifecycle as the sister panels (DrawingsPanel,
 * SchemaMaterialsPanel): per-Studio WeakMap registry, idempotent
 * `getFor` / `openFor`, drag header, close button + reopen pill,
 * layout persistence, scoped `xkt-ct-` CSS prefix.
 *
 */
import type {SceneModel} from "@xeokit/sdk/model/scene";
import {isDefaultLayerModel} from "@xeokit/sdk/model/scene";
import type {DataModel} from "@xeokit/sdk/model/data";
import {getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import type {Studio} from "../../Studio";

import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
import {
  planCameraTour,
  playCameraTour,
  extractSpacesFromGeometry,
  type CameraTour,
  type CameraTourWaypoint,
  type CameraTourPlayback,
} from "@xeokit/website-presentations/cameraTour";


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface CameraTourPanelParams {
  /**
   * Studio whose Scene the panel manages tours for. Doubles as
   * the WeakMap key for {@link CameraTourPanel.openFor}
   * idempotence — one panel per helper.
   */
  studio: Studio;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-ct-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


/**
 * Lifecycle states a tour row can be in.
 */
type TourStatus =
  | "none"        // no tour generated yet
  | "generating"  // planCameraTour in flight
  | "ready"       // tour generated, playback stopped at first waypoint
  | "playing"
  | "paused"
  | "failed";


/**
 * Per-source-SceneModel record. The panel keeps one of these per
 * row in {@link _rows}; `tour` / `playback` populate after a
 * successful Generate.
 */
interface TourRecord {
  status:    TourStatus;
  tour?:     CameraTour;
  playback?: CameraTourPlayback;
  /** Most-recent label fed to the row's "current room" line. */
  currentRoomLabel?: string;
  /** Index counter for the room-progress display (1-based). */
  currentRoomIndex?: number;
  /** Last error from a failed Generate, for display. */
  error?:    string;
  /**
   * Which path produced the current tour, used to surface a
   * user-facing note when a fallback was needed. Defaults to
   * `"ifc"`; flips to `"geometry"` if the geometry fallback
   * extractor was used, or `"orbit"` if even that failed and the
   * one-orbit AABB synthesis took over.
   */
  generatedVia?: "ifc" | "geometry" | "orbit";
  /**
   * Set while the user is dragging the row's seek slider.
   * `_renderBody` short-circuits when any row is dragging so a
   * waypoint-enter-driven re-render doesn't tear the slider out
   * mid-interaction.
   */
  isDragging?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-ct-styles";
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


// ─────────────────────────────────────────────────────────────────
// CSS — scoped under .xkt-ct so it can coexist with DrawingsPanel.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-ct-panel {
  position: fixed;
  top: 88px;
  right: 17px;
  width: 460px;
  max-width: calc(100vw - 34px);
  height: auto;
  max-height: calc(100vh - 116px);
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
.xkt-ct-panel *, .xkt-ct-panel *::before, .xkt-ct-panel *::after {
  box-sizing: border-box;
}
.xkt-ct-panel[hidden] { display: none; }

.xkt-ct-panel .xkt-ct-header {
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
.xkt-ct-panel .xkt-ct-header.xkt-ct-dragging { cursor: grabbing; }
.xkt-ct-panel .xkt-ct-title {
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
.xkt-ct-panel .xkt-ct-title-icon {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
  width: 24px;
  height: 24px;
  color: #6b2d8c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.xkt-ct-panel .xkt-ct-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-ct-panel .xkt-ct-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-ct-panel .xkt-ct-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-ct-panel .xkt-ct-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-ct-panel .xkt-ct-close {
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
.xkt-ct-panel .xkt-ct-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-ct-pill {
  position: fixed;
  bottom: 17px;
  right: 17px;
  z-index: 200000000;
  padding: 9px 16px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #fff;
  background: #6b2d8c;
  border: 1px solid #4a1f63;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-ct-pill:hover { background: #4a1f63; }
.xkt-ct-pill[hidden] { display: none; }

.xkt-ct-panel .xkt-ct-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 4px 0 8px;
}
.xkt-ct-panel .xkt-ct-empty {
  padding: 24px 14px;
  text-align: center;
  color: #94a3b8;
  font-style: italic;
}

.xkt-ct-panel .xkt-ct-row {
  border-top: 1px solid #f1f5f9;
  padding: 10px 14px;
}
.xkt-ct-panel .xkt-ct-row:first-child {
  border-top: none;
}
.xkt-ct-panel .xkt-ct-row-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.xkt-ct-panel .xkt-ct-row-name {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-ct-panel .xkt-ct-status {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #475569;
}
.xkt-ct-panel .xkt-ct-status[data-status="ready"]      { background: #dbeafe; color: #1d4ed8; }
.xkt-ct-panel .xkt-ct-status[data-status="playing"]    { background: #dcfce7; color: #15803d; }
.xkt-ct-panel .xkt-ct-status[data-status="paused"]     { background: #fef3c7; color: #b45309; }
.xkt-ct-panel .xkt-ct-status[data-status="generating"] { background: #ede9fe; color: #6d28d9; }
.xkt-ct-panel .xkt-ct-status[data-status="failed"]     { background: #fee2e2; color: #b91c1c; }

.xkt-ct-panel .xkt-ct-row-meta {
  margin-top: 6px;
  font-size: 11px;
  color: #475569;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}
.xkt-ct-panel .xkt-ct-room-label {
  font-weight: 600;
  color: #1d4ed8;
}
.xkt-ct-panel .xkt-ct-fallback-note {
  flex-basis: 100%;
  color: #92400e;
  font-style: italic;
  font-size: 11px;
}
.xkt-ct-panel .xkt-ct-error-wrap {
  display: inline-flex;
  align-items: flex-start;
  gap: 4px;
  max-width: 100%;
}
.xkt-ct-panel .xkt-ct-error {
  color: #b91c1c;
  white-space: pre-wrap;
  /* Make error text drag-selectable. Default browser behaviour
     already allows selection, but in a floating panel the user
     can get stuck if a parent rule sets user-select: none —
     stamping "text" here guarantees selection works regardless
     of inheritance. */
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
  word-break: break-word;
}
.xkt-ct-panel .xkt-ct-copy-btn {
  flex-shrink: 0;
  margin-top: -1px;
  padding: 1px 5px;
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  color: #475569;
  background: transparent;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  cursor: pointer;
}
.xkt-ct-panel .xkt-ct-copy-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #1f2937;
}
.xkt-ct-panel .xkt-ct-copy-btn[data-copied="1"] {
  color: #15803d;
  border-color: #86efac;
  background: #dcfce7;
}

.xkt-ct-panel .xkt-ct-row-actions {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.xkt-ct-panel .xkt-ct-btn {
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #1f2937;
  cursor: pointer;
}
.xkt-ct-panel .xkt-ct-btn:hover:not([disabled]) {
  background: #f1f5f9;
  border-color: #94a3b8;
}
.xkt-ct-panel .xkt-ct-btn[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}
.xkt-ct-panel .xkt-ct-btn-primary {
  background: #6b2d8c;
  border-color: #4a1f63;
  color: #fff;
}
.xkt-ct-panel .xkt-ct-btn-primary:hover:not([disabled]) {
  background: #4a1f63;
}
.xkt-ct-panel .xkt-ct-btn-danger {
  border-color: #fca5a5;
  color: #b91c1c;
}
.xkt-ct-panel .xkt-ct-btn-danger:hover:not([disabled]) {
  background: #fef2f2;
  border-color: #ef4444;
}

.xkt-ct-panel .xkt-ct-scrubber {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.xkt-ct-panel .xkt-ct-scrubber-count {
  flex-shrink: 0;
  min-width: 64px;
  font-size: 10.5px;
  color: #475569;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.xkt-ct-panel .xkt-ct-slider {
  flex: 1;
  margin: 0;
  accent-color: #6b2d8c;
  cursor: pointer;
}
.xkt-ct-panel .xkt-ct-slider:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class CameraTourPanel extends FloatingPanelBase {

  /** Per-Studio instance registry — one panel per helper. */
  private static readonly _instances = new WeakMap<Studio, CameraTourPanel>();

  /**
   * SVG markup for the title-bar glyph — a stylised play triangle
   * inside a film-strip frame, suggesting "playable walkthrough".
   * Strokes use `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3.5" y="5" width="17" height="14" rx="2" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<path d="M3.5 8 H6 M3.5 12 H6 M3.5 16 H6" ` +
            `stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.55"/>` +
      `<path d="M18 8 H20.5 M18 12 H20.5 M18 16 H20.5" ` +
            `stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.55"/>` +
      `<path d="M10.5 9 L15 12 L10.5 15 Z" ` +
            `fill="currentColor" opacity="0.9"/>` +
    `</svg>`;
  }

  static getFor(studio: Studio): CameraTourPanel | undefined {
    const inst = CameraTourPanel._instances.get(studio);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: CameraTourPanelParams): CameraTourPanel {
    let inst = CameraTourPanel._instances.get(params.studio);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new CameraTourPanel(params);
    return inst;
  }

  readonly studio: Studio;

  /** Per-source-SceneModel record, keyed by source model id. */
  private readonly _rows = new Map<string, TourRecord>();

  private _bodyEl!: HTMLElement;
  private readonly _unsubs: Array<() => void> = [];

  constructor(params: CameraTourPanelParams) {
    if (!params?.studio) {
      throw new Error("CameraTourPanel: studio is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-ct-panel",
      classPrefix: "xkt-ct",
    });
    this.studio = params.studio;

    const prior = CameraTourPanel._instances.get(this.studio);
    if (prior && !prior._destroyed) prior.destroy();
    CameraTourPanel._instances.set(this.studio, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._attachSubscriptions();
    this._renderBody();

    if (params.visible === false) this.hide(); else this.show();
  }


  // ── Public lifecycle ──────────────────────────────────────────

  get visible(): boolean {
    return this._panel.style.display !== "none";
  }

  show(): void {
    if (this._destroyed) return;
    super.show();
  }

  hide(): void {
    if (this._destroyed) return;
    super.hide();
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  destroy(): void {
    if (this._destroyed) return;
    // Tear down every playback we own — closing the panel
    // shouldn't leave a tour driving the camera in the background.
    for (const rec of this._rows.values()) {
      rec.playback?.destroy();
    }
    this._rows.clear();
    for (const u of this._unsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._unsubs.length = 0;
    if (CameraTourPanel._instances.get(this.studio) === this) {
      CameraTourPanel._instances.delete(this.studio);
    }
    super.destroy();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-ct-pill", {
      type: "button",
      title: "Reopen Camera Tours",
      hidden: true,
      textContent: "Camera Tours",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-ct-panel");

    this._header = el("div", "xkt-ct-header");
    const title = el("h2", "xkt-ct-title");
    title.innerHTML =
      `<span class="xkt-ct-title-icon">${CameraTourPanel.iconSvg()}</span>` +
      `<span class="xkt-ct-title-stack">` +
        `<span class="xkt-ct-title-text">Camera Tours</span>` +
        `<span class="xkt-ct-subtitle">Auto-plan + play room-by-room walkthroughs.</span>` +
      `</span>`;

    this._closeBtn = el("button", "xkt-ct-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    this._bodyEl = el("div", "xkt-ct-body");
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }


  // ── Scene subscriptions ───────────────────────────────────────

  private _attachSubscriptions(): void {
    const sceneEv = (this.studio.scene as any).events;
    if (!sceneEv) return;
    const sub = (unsub: () => void) => this._unsubs.push(unsub);

    if (sceneEv.onSceneModelCreated?.subscribe) {
      sub(sceneEv.onSceneModelCreated.subscribe((_: unknown, model: SceneModel) => {
        // Skip drawings the DrawingsPanel produces — they're not
        // tour-able. Same convention used by DrawingsPanel itself.
        if (isDrawingId(model.id)) return;
        this._renderBody();
      }));
    }
    if (sceneEv.onSceneModelDestroyed?.subscribe) {
      sub(sceneEv.onSceneModelDestroyed.subscribe((_: unknown, model: SceneModel) => {
        const rec = this._rows.get(model.id);
        if (rec) {
          rec.playback?.destroy();
          this._rows.delete(model.id);
        }
        this._renderBody();
      }));
    }
  }


  // ── Rendering ─────────────────────────────────────────────────

  private _renderBody(): void {
    // Suppress re-renders while any row's slider is being dragged
    // — pointer capture lives on the slider DOM node, and clearing
    // the body would tear it out mid-drag (cancelling the
    // interaction, snapping the value back). The drag's `pointerup`
    // handler calls _renderBody again after releasing so the
    // suspended view catches up.
    for (const r of this._rows.values()) {
      if (r.isDragging) return;
    }
    this._bodyEl.replaceChildren();
    const sourceModels = this._listSourceModels();
    if (sourceModels.length === 0) {
      this._bodyEl.appendChild(el("div", "xkt-ct-empty", {
        textContent: "No SceneModels loaded.",
      }));
      return;
    }
    for (const model of sourceModels) {
      this._bodyEl.appendChild(this._renderModelRow(model));
    }
  }

  /**
   * Every SceneModel currently in the Scene that's a valid tour
   * source — excludes the `DrawingsPanel`'s projection outputs
   * (which match `__bp_*`) and named-layer overlay models (gizmo
   * proxies, NavCube, etc.).
   */
  private _listSourceModels(): SceneModel[] {
    const out: SceneModel[] = [];
    const models = (this.studio.scene as any).models as Record<string, SceneModel>;
    if (!models) return out;
    for (const id of Object.keys(models)) {
      if (isDrawingId(id)) continue;
      if (!isDefaultLayerModel(models[id])) continue;
      out.push(models[id]);
    }
    return out;
  }

  /**
   * Build the error-text + clipboard-copy block shown on a row
   * when planning or playback fails. Spans live inside a flex
   * wrapper so the Copy button sits flush with the start of the
   * error text rather than wrapping below it.
   *
   * The text is `user-select: text` (forced via CSS) so a user
   * can drag-select instead of using the button if they want only
   * part of the message — the button is a convenience for the
   * common "copy the whole thing into a bug report" case.
   */
  private _buildErrorBlock(errorText: string): HTMLElement {
    const wrap = el("span", "xkt-ct-error-wrap");
    const span = el("span", "xkt-ct-error", {textContent: errorText});
    const btn  = el("button", "xkt-ct-copy-btn", {
      type:        "button",
      textContent: "Copy",
      title:       "Copy error message to clipboard",
    }) as HTMLButtonElement;
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      try {
        // `navigator.clipboard` is the modern path. Older
        // browsers / non-https iframes can fail here — fall back
        // to the textarea+execCommand trick so the button stays
        // useful even in less-than-ideal contexts.
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(errorText);
        } else {
          const ta = document.createElement("textarea");
          ta.value = errorText;
          ta.style.position = "fixed";
          ta.style.opacity  = "0";
          document.body.appendChild(ta);
          ta.select();
          // eslint-disable-next-line deprecation/deprecation
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        btn.textContent = "Copied";
        btn.setAttribute("data-copied", "1");
        setTimeout(() => {
          btn.textContent = "Copy";
          btn.removeAttribute("data-copied");
        }, 1200);
      } catch {
        btn.textContent = "Failed";
        setTimeout(() => { btn.textContent = "Copy"; }, 1200);
      }
    });
    wrap.append(span, btn);
    return wrap;
  }

  private _renderModelRow(model: SceneModel): HTMLElement {
    const row = el("div", "xkt-ct-row");
    const rec = this._rows.get(model.id);
    const status: TourStatus = rec?.status ?? "none";

    // ── Header line: id + status badge ──
    const head = el("div", "xkt-ct-row-head");
    head.append(
      el("span", "xkt-ct-row-name", {textContent: model.id, title: model.id}),
      el("span", "xkt-ct-status", {textContent: status, "data-status": status} as any),
    );
    row.appendChild(head);

    // ── Meta line: room count, duration, current room ──
    const meta = el("div", "xkt-ct-row-meta");
    if (rec?.tour) {
      const tour = rec.tour;
      const roomCount = tour.waypoints.filter(w => w.spaceId !== undefined).length;
      const durSec = (tour.estimatedDurationMs / 1000).toFixed(1);
      meta.append(
        el("span", undefined, {textContent: `${roomCount} rooms · ${durSec}s`}),
      );
      if (rec.currentRoomLabel) {
        const cur = el("span", "xkt-ct-room-label", {
          textContent: `Now: ${rec.currentRoomLabel}` +
                       (rec.currentRoomIndex !== undefined
                         ? ` (${rec.currentRoomIndex} / ${roomCount})`
                         : ""),
        });
        meta.appendChild(cur);
      }
      // User-facing note when a fallback was used to produce the
      // tour. Default first-attempt success → no note rendered.
      const noteText = fallbackNote(rec.generatedVia);
      if (noteText) {
        meta.appendChild(el("span", "xkt-ct-fallback-note", {textContent: noteText}));
      }
    } else if (rec?.error) {
      meta.appendChild(this._buildErrorBlock(rec.error));
    } else if (status === "generating") {
      meta.appendChild(el("span", undefined, {textContent: "Planning…"}));
    } else {
      meta.appendChild(el("span", undefined, {
        textContent: "No tour generated yet.",
      }));
    }
    row.appendChild(meta);

    // ── Actions: Generate, Play/Pause, Stop, Delete ──
    const actions = el("div", "xkt-ct-row-actions");

    const generateBtn = el("button", "xkt-ct-btn xkt-ct-btn-primary", {
      type:        "button",
      textContent: rec?.tour ? "Regenerate" : "Generate",
    }) as HTMLButtonElement;
    generateBtn.disabled = status === "generating";
    generateBtn.addEventListener("click", () => void this._generate(model));
    actions.appendChild(generateBtn);

    const playPauseBtn = el("button", "xkt-ct-btn", {
      type:        "button",
      textContent: status === "playing" ? "Pause" : "Play",
    }) as HTMLButtonElement;
    playPauseBtn.disabled = !rec?.playback || status === "generating";
    playPauseBtn.addEventListener("click", () => this._togglePlayPause(model.id));
    actions.appendChild(playPauseBtn);

    // Prev / Next step through in-space waypoints only (skipping
    // the smoother's portal-transit waypoints, which have no room
    // label and would just blank the "Now:" line). Each click
    // pauses + seeks — useful for inspecting individual rooms or
    // scrubbing back after the camera passes a detail too fast.
    const prevIdx = rec?.tour && rec.playback
      ? findRoomWaypoint(rec.tour, rec.playback.currentWaypointIndex, -1)
      : -1;
    const prevBtn = el("button", "xkt-ct-btn", {
      type: "button", textContent: "◀ Prev", title: "Step back one room",
    }) as HTMLButtonElement;
    prevBtn.disabled = prevIdx < 0 || status === "generating";
    prevBtn.addEventListener("click", () => this._step(model.id, -1));
    actions.appendChild(prevBtn);

    const nextIdx = rec?.tour && rec.playback
      ? findRoomWaypoint(rec.tour, rec.playback.currentWaypointIndex, +1)
      : -1;
    const nextBtn = el("button", "xkt-ct-btn", {
      type: "button", textContent: "Next ▶", title: "Step forward one room",
    }) as HTMLButtonElement;
    nextBtn.disabled = nextIdx < 0 || status === "generating";
    nextBtn.addEventListener("click", () => this._step(model.id, +1));
    actions.appendChild(nextBtn);

    const stopBtn = el("button", "xkt-ct-btn", {
      type: "button", textContent: "Stop",
    }) as HTMLButtonElement;
    stopBtn.disabled = !rec?.playback || status === "ready" || status === "generating";
    stopBtn.addEventListener("click", () => this._stop(model.id));
    actions.appendChild(stopBtn);

    const deleteBtn = el("button", "xkt-ct-btn xkt-ct-btn-danger", {
      type: "button", textContent: "Delete",
    }) as HTMLButtonElement;
    deleteBtn.disabled = !rec?.tour || status === "generating";
    deleteBtn.addEventListener("click", () => this._delete(model.id));
    actions.appendChild(deleteBtn);

    row.appendChild(actions);

    // ── Seek slider ───────────────────────────────────────────────
    // Range = full waypoint list (including portal transits) so the
    // slider can scrub through every interpolated state, not just
    // the planned in-space stops. Dragging pauses + seeks live —
    // the camera follows the slider for fine inspection.
    if (rec?.tour && rec.playback) {
      const wpCount = rec.tour.waypoints.length;
      const curIdx = rec.playback.currentWaypointIndex;

      const scrubber = el("div", "xkt-ct-scrubber");
      const slider = el("input", "xkt-ct-slider") as HTMLInputElement;
      slider.type  = "range";
      slider.min   = "0";
      slider.max   = String(Math.max(0, wpCount - 1));
      slider.step  = "1";
      slider.value = String(curIdx);
      slider.disabled = status === "generating";
      slider.title = "Drag to scrub through tour waypoints";

      const count = el("span", "xkt-ct-scrubber-count", {
        textContent: `${curIdx + 1} / ${wpCount}`,
      });

      // `pointerdown` / `pointerup` set the row's drag flag — the
      // body re-render short-circuits while it's set so a waypoint
      // arrival mid-drag doesn't recreate the slider and break the
      // pointer-capture-and-drag.
      slider.addEventListener("pointerdown", () => { rec.isDragging = true; });
      const endDrag = () => {
        if (!rec.isDragging) return;
        rec.isDragging = false;
        // Final re-render once the user releases — pulls the row
        // back in sync with whatever the seek + onWaypointEnter
        // chain left behind (button states, label, status badge).
        this._renderBody();
      };
      slider.addEventListener("pointerup",     endDrag);
      slider.addEventListener("pointercancel", endDrag);

      // Live scrub — every drag tick pauses + seeks. Pausing first
      // stops the rAF loop from racing the user's input. seek()
      // fires onWaypointEnter synchronously; that re-renders the
      // row's meta line but the `isDragging` guard above keeps the
      // slider element itself intact.
      slider.addEventListener("input", () => {
        const i = parseInt(slider.value, 10);
        if (!Number.isFinite(i) || !rec.playback) return;
        rec.playback.pause();
        rec.status = "paused";
        rec.playback.seek(i);
        count.textContent = `${i + 1} / ${wpCount}`;
      });

      scrubber.append(slider, count);
      row.appendChild(scrubber);
    }

    return row;
  }


  // ── Tour lifecycle ────────────────────────────────────────────

  /**
   * Run the planCameraTour pipeline for `model`.
   *
   * Extractor selection:
   *  - **With a paired DataModel** — use the default IFC
   *    extractor. If it returns an empty graph (DataModel exists
   *    but carries no `IfcSpace` entries, or all spaces fall
   *    through synthesis), retries once with the geometry
   *    fallback.
   *  - **Without a paired DataModel** — skip the IFC extractor
   *    entirely and go straight to {@link extractSpacesFromGeometry}.
   *    The IFC extractor would reject upfront with
   *    `InvalidInput("DataModel is required")`, so trying it adds
   *    a round-trip and a misleading "no spaces" surface in the
   *    Issues panel.
   */
  private async _generate(model: SceneModel): Promise<void> {
    // Tear down any existing playback for this model before
    // regenerating — leaving an old playback alive while a new
    // tour comes in would have it drive the camera against
    // stale waypoints.
    const prior = this._rows.get(model.id);
    prior?.playback?.destroy();

    const rec: TourRecord = {status: "generating"};
    this._rows.set(model.id, rec);
    this._renderBody();

    const dataModel = this._findDataModel(model.id);

    // Track which stage produced the final tour, so the row can
    // surface a user-facing note when a fallback was needed.
    // Optimistically set to the first-attempt origin; overwritten
    // below if a fallback ends up producing the tour.
    let generatedVia: NonNullable<TourRecord["generatedVia"]> = "ifc";

    // First attempt — IFC extractor when a DataModel is paired
    // (default), nothing-specified otherwise. The DataModel branch
    // gets proper room labels from IfcSpace.LongName when the
    // model carries them.
    let res = await planCameraTour({
      sceneModel: model,
      ...(dataModel ? {dataModel} : {}),
    });

    // Second-attempt fallback — fire when the first attempt's
    // extractor returned no spaces. Covers the canonical failures
    // surfaced by `planCameraTour`:
    //
    //   - IFC extractor with a DataModel that has no IfcSpace
    //     entries, or whose synthesis chain came up empty:
    //       "[planCameraTour] Extractor returned no spaces. ..."
    //
    //   - Default (IFC) extractor invoked without a DataModel:
    //       "[extractSpacesFromIfc] DataModel is required ..."
    //
    // Either way the second attempt uses the geometry extractor
    // explicitly, which doesn't depend on a DataModel at all.
    // The retry is skipped when the first attempt was already
    // the geometry extractor (no different extractor to fall back
    // to).
    const usedGeometryFirst = false;   // first attempt never sets `extractor` above
    const isEmptyExtractor = res.ok === false && (
        /Extractor returned no spaces/.test(res.error) ||
        /DataModel is required/.test(res.error)
    );
    if (!usedGeometryFirst && isEmptyExtractor) {
      res = await planCameraTour({
        sceneModel: model,
        extractor:  extractSpacesFromGeometry,
      });
      if (res.ok === true) generatedVia = "geometry";
    }

    // Third-attempt fallback — when both extractors gave up
    // (e.g. open-plan models without wall-bordered rooms, scenes
    // where the geometry-flood-fill never finds an interior void),
    // synthesise a single-waypoint tour from the SceneModel's
    // AABB so the row still has something playable. Better UX
    // than parking the row in a "Failed" state with a stack-
    // trace-flavoured error string; the user gets a one-stop
    // "look at the whole thing" tour they can play, pause, and
    // scrub through.
    if (res.ok === false && /Extractor returned no spaces/.test(res.error)) {
      const synth = this._synthesiseAabbTour(model);
      if (synth) {
        res = {ok: true, value: synth};
        generatedVia = "orbit";
      }
    }

    if (res.ok === false) {
      rec.status = "failed";
      rec.error  = res.error;
      // Surface in the IssuesPanel too — all attempts (IFC + the
      // geometry fallback + the AABB synthesis) have now failed,
      // which is unusual and worth flagging beyond the per-row
      // "Failed" badge.
      this.studio.reportError(res);
      this._renderBody();
      return;
    }
    rec.tour         = res.value;
    rec.status       = "ready";
    rec.error        = undefined;
    rec.generatedVia = generatedVia;
    rec.currentRoomLabel = undefined;
    rec.currentRoomIndex = undefined;

    // Construct playback but leave it paused (autoStart: false)
    // so the row's Play button drives the first frame deliberately.
    const view = this._firstView();
    if (!view) {
      rec.status = "failed";
      rec.error  = "[CameraTourPanel] No View available to play the tour against.";
      this._renderBody();
      return;
    }
    const playRes = playCameraTour(view, res.value, {
      autoStart: false,
      onWaypointEnter: (wp: CameraTourWaypoint, idx: number) => this._onWaypointEnter(model.id, wp, idx),
      onFinish: () => this._onFinish(model.id),
    });
    if (playRes.ok === false) {
      rec.status = "failed";
      rec.error  = playRes.error;
      this._renderBody();
      return;
    }
    rec.playback = playRes.value;
    this._renderBody();
  }

  /**
   * Build a multi-waypoint {@link CameraTour} from `model`'s
   * world AABB — last-resort fallback when both extractors return
   * no spaces (open-plan models, single-room buildings, point
   * clouds, scenes with no flood-fillable interior). The camera
   * orbits horizontally around the centroid at `0.9 × AABB-diagonal`
   * radius, lifted to mid-height on the up axis, taking
   * {@link _SYNTH_RING_COUNT} stops around the ring. Each stop
   * looks at the centroid so the model stays framed throughout.
   *
   * Returns `null` when the model has no resolvable AABB (empty
   * SceneModel, all objects destroyed) — caller then falls
   * through to the row's "failed" state and reports.
   */
  private _synthesiseAabbTour(model: SceneModel): CameraTour | null {
    const collisionIndex = getSceneCollisionIndex(model.scene);
    const objectIds = Object.keys(model.objects);
    const aabb = collisionIndex.getCombinedObjectAABB(objectIds);
    if (!aabb) return null;

    const cx = (aabb[0] + aabb[3]) * 0.5;
    const cy = (aabb[1] + aabb[4]) * 0.5;
    const cz = (aabb[2] + aabb[5]) * 0.5;
    const dx = aabb[3] - aabb[0];
    const dy = aabb[4] - aabb[1];
    const dz = aabb[5] - aabb[2];
    const diag = Math.hypot(dx, dy, dz) || 1;
    const radius = diag * 0.9;
    const up = model.scene.coordinateSystem.worldUp;

    // Resolve which axis is "up" so the orbit lies in the
    // horizontal plane. Y-up (default) → orbit in X-Z; Z-up →
    // orbit in X-Y.
    const upZ = Math.abs(up[2]) > Math.abs(up[1]);
    const upAxis: 0 | 1 | 2 = upZ ? 2 : 1;
    const aAxis = 0;                              // first horizontal axis
    const bAxis: 0 | 1 | 2 = upZ ? 1 : 2;         // second horizontal axis

    // Camera height — slightly above centroid so the orbit reads
    // as "looking down a touch" rather than dead-level.
    const eyeUp = ((upAxis === 1 ? cy : cz)) + diag * 0.15;

    const waypoints: CameraTourWaypoint[] = [];
    const N = CameraTourPanel._SYNTH_RING_COUNT;
    for (let i = 0; i < N; i++) {
      const theta = (i / N) * Math.PI * 2;
      const eye: [number, number, number] = [0, 0, 0];
      eye[aAxis]  = cx + radius * Math.cos(theta);
      eye[bAxis]  = (bAxis === 1 ? cy : cz) + radius * Math.sin(theta);
      eye[upAxis] = eyeUp;
      waypoints.push({
        position: eye,
        look:     [cx, cy, cz],
        up:       [up[0], up[1], up[2]],
        dwellMs:  1800,
        label:    `${model.id} · view ${i + 1}`,
        spaceId:  `${model.id}__synth_${i}`,
      });
    }

    // SpaceGraph satisfying the interface. Each ring waypoint
    // gets a one-to-one node so the panel meta line reads the
    // expected "N rooms" count. No edges — the orbit doesn't
    // model adjacency.
    const nodes = waypoints.map(wp => ({
      id:             wp.spaceId!,
      aabb:           aabb as any,
      centroid:       [cx, cy, cz] as [number, number, number],
      floorElevation: aabb[upAxis],
      sceneObjectId:  undefined,
      dataObjectId:   undefined,
      label:          wp.label,
      edges:          [] as any[],
    }));
    const nodesById = new Map<string, any>();
    for (const n of nodes) nodesById.set(n.id, n);

    return {
      waypoints,
      spaceGraph: {nodes, edges: [], nodesById} as any,
      // dwell × N + an inter-leg flight estimate per leg.
      estimatedDurationMs: N * 1800 + (N - 1) * 1500,
    };
  }

  /**
   * Number of viewpoints in the horizontal-orbit fallback tour.
   * 6 stops gives a 60° step between each ring station — enough
   * to inspect every face of a typical AABB without dragging on.
   */
  private static readonly _SYNTH_RING_COUNT = 6;

  private _togglePlayPause(modelId: string): void {
    const rec = this._rows.get(modelId);
    if (!rec?.playback) return;
    if (rec.status === "playing") {
      rec.playback.pause();
      rec.status = "paused";
    } else {
      rec.playback.play();
      rec.status = "playing";
    }
    this._renderBody();
  }

  private _stop(modelId: string): void {
    const rec = this._rows.get(modelId);
    if (!rec?.playback) return;
    rec.playback.stop();
    rec.status = "ready";
    rec.currentRoomLabel = undefined;
    rec.currentRoomIndex = undefined;
    this._renderBody();
  }

  /**
   * Step the row's playback forward (+1) or back (−1) one in-space
   * waypoint, skipping the smoother's portal-transit waypoints
   * (no `spaceId`, no room label). Pauses first so the seek isn't
   * immediately overrun by the rAF loop's transit advance.
   * No-op when no neighbouring in-space waypoint exists in the
   * chosen direction.
   */
  private _step(modelId: string, direction: 1 | -1): void {
    const rec = this._rows.get(modelId);
    if (!rec?.tour || !rec.playback) return;
    const target = findRoomWaypoint(rec.tour, rec.playback.currentWaypointIndex, direction);
    if (target < 0) return;
    rec.playback.pause();
    rec.status = "paused";
    rec.playback.seek(target);
    // `seek` fires onWaypointEnter synchronously which updates
    // label + counter; no manual render needed here.
  }

  private _delete(modelId: string): void {
    const rec = this._rows.get(modelId);
    if (!rec) return;
    rec.playback?.destroy();
    this._rows.delete(modelId);
    this._renderBody();
  }


  // ── Tour-driven row updates ───────────────────────────────────

  /**
   * Called from playCameraTour's onWaypointEnter — flip the
   * current room label + counter for the row.
   *
   * Portal-transit waypoints carry `spaceId === undefined` and
   * are skipped so the row continues to show the most recent
   * in-space label as the camera flies through doors.
   *
   * The counter is computed from the waypoint index (count of
   * in-space waypoints at indices 0..idx inclusive) rather than
   * incremented per call, so Prev/Next seeks land on the correct
   * room number regardless of direction.
   */
  private _onWaypointEnter(modelId: string, waypoint: CameraTourWaypoint, idx: number): void {
    if (!waypoint.spaceId) return;
    const rec = this._rows.get(modelId);
    if (!rec) return;
    rec.currentRoomLabel = waypoint.label ?? waypoint.spaceId;
    rec.currentRoomIndex = countRoomsUpToIndex(rec.tour, idx);
    // First in-space stop after stop()/seek(0) is the tour's
    // initial waypoint, which also fires synchronously when
    // playback is constructed — flip status to "playing" only
    // if we're actually running, otherwise the "Play" button
    // hint stays right.
    if (rec.status === "ready") {
      // Still in the constructor's synchronous enter — leave
      // status alone, just record the label.
    } else if (rec.status === "paused") {
      // No-op; user paused mid-flight, label updates anyway.
    } else {
      rec.status = "playing";
    }
    this._renderBody();
  }

  private _onFinish(modelId: string): void {
    const rec = this._rows.get(modelId);
    if (!rec) return;
    rec.status = "ready";
    this._renderBody();
  }


  // ── Lookups ───────────────────────────────────────────────────

  private _findDataModel(modelId: string): DataModel | undefined {
    const dataModels = (this.studio.data as any)?.models as Record<string, DataModel> | undefined;
    return dataModels?.[modelId];
  }

  /**
   * First View registered with the helper — playCameraTour needs
   * one to drive the camera. Returns `undefined` if no View has
   * been created yet (Generate then short-circuits with an error).
   */
  private _firstView() {
    const views = this.studio.viewManager?.views ?? {};
    const first = Object.values(views)[0] as {view?: unknown} | undefined;
    return (first?.view as any) ?? undefined;
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

/**
 * SceneModel-id pattern reserved by the DrawingsPanel for its
 * projection outputs. Matched here so the Camera Tour panel
 * doesn't offer to tour a drawing of a tour-able model.
 */
function isDrawingId(modelId: string): boolean {
  return /__bp_[a-z0-9_]+$/.test(modelId);
}

/**
 * User-facing explanation when the tour was produced by a
 * fallback path rather than the default IFC extractor. Returns
 * `null` for the IFC path (no note needed) or when the value is
 * absent.
 */
function fallbackNote(via: "ifc" | "geometry" | "orbit" | undefined): string | null {
  if (via === "geometry") {
    return "No IfcSpace data — rooms detected from the model geometry.";
  }
  if (via === "orbit") {
    return "No distinct rooms detected — showing a 360° overview instead.";
  }
  return null;
}

/**
 * Index of the in-space waypoint one step `direction` from
 * `fromIndex` in the tour's waypoint list, skipping portal-
 * transit waypoints (no `spaceId`). Returns `-1` when no further
 * in-space waypoint exists in that direction — the row's Prev /
 * Next button uses that to disable itself at the tour ends.
 */
function findRoomWaypoint(
    tour: CameraTour,
    fromIndex: number,
    direction: 1 | -1,
): number {
  const wps = tour.waypoints;
  for (let i = fromIndex + direction; i >= 0 && i < wps.length; i += direction) {
    if (wps[i].spaceId !== undefined) return i;
  }
  return -1;
}

/**
 * Number of in-space waypoints at indices `0..idx` inclusive.
 * Used by the row's "Now: Room N / M" counter so the displayed
 * room number stays consistent regardless of seek direction.
 */
function countRoomsUpToIndex(tour: CameraTour | undefined, idx: number): number {
  if (!tour) return 0;
  let n = 0;
  const upto = Math.min(idx, tour.waypoints.length - 1);
  for (let i = 0; i <= upto; i++) {
    if (tour.waypoints[i].spaceId !== undefined) n++;
  }
  return n;
}
