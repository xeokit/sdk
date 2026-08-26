/**
 * Floating, draggable Section Planes panel. Mirrors the other
 * Studio panels' chrome (FloatingPanelBase + scoped CSS) and
 * sits next to the {@link SectionPlanesController} the toolbar's
 * Section Planes tool spins up.
 *
 * Each row of the body represents one {@link SectionPlane} in
 * the bound View. The header carries the global edit-mode toggle
 * (Translate / Rotate) plus a Clear-all button; per-row controls
 * are an active checkbox and a destroy button. Clicking a row
 * promotes the plane to the gizmo's attached target.
 *
 */
import {EventDispatcher} from "strongly-typed-events";
import {EventEmitter} from "@xeokit/sdk/base/core";
import type {SectionPlane, View} from "@xeokit/sdk/viewing/viewer";
import {SectionPlanesController, type SectionPlanesEditMode} from "../../systems/sectionPlanesTool";
import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface SectionPlanesPanelParams {
  /**
   * View whose section planes are listed. Doubles as the WeakMap
   * key for {@link SectionPlanesPanel.openFor} idempotence — one
   * Section Planes panel per View.
   */
  view: View;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-sp-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// CSS — scoped under .xkt-sp-panel
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-sp-styles";
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

const PANEL_CSS = `
.xkt-sp-panel {
  position: fixed;
  top: 88px;
  right: 17px;
  width: 320px;
  max-width: calc(100vw - 34px);
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
  color: #111;
  z-index: 200000000;
  overflow: hidden;
  box-sizing: border-box;
}
.xkt-sp-panel *, .xkt-sp-panel *::before, .xkt-sp-panel *::after {
  box-sizing: border-box;
}
.xkt-sp-panel[hidden] { display: none; }

.xkt-sp-panel .xkt-sp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #ececec;
  cursor: grab;
  user-select: none;
}
.xkt-sp-panel .xkt-sp-header.xkt-sp-dragging { cursor: grabbing; }
.xkt-sp-panel .xkt-sp-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  font-weight: 650;
  color: #111;
}

/* Segmented Translate / Rotate toggle. */
.xkt-sp-panel .xkt-sp-mode {
  display: inline-flex;
  background: #f1f5f9;
  border: 1px solid #d6dde6;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-sp-panel .xkt-sp-mode-btn {
  padding: 4px 8px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  background: transparent;
  border: none;
  cursor: pointer;
}
.xkt-sp-panel .xkt-sp-mode-btn[aria-pressed="true"] {
  color: #fff;
  background: #2d5e8c;
}
.xkt-sp-panel .xkt-sp-mode-btn:hover:not([aria-pressed="true"]) {
  background: #e2e8f0;
}

.xkt-sp-panel .xkt-sp-clear,
.xkt-sp-panel .xkt-sp-close {
  height: 26px;
  padding: 0;
  font: inherit;
  line-height: 1;
  color: #777;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-sp-panel .xkt-sp-clear { padding: 0 8px; font-size: 11px; font-weight: 600; }
.xkt-sp-panel .xkt-sp-close { width: 26px; font-size: 20px; }
.xkt-sp-panel .xkt-sp-clear:hover,
.xkt-sp-panel .xkt-sp-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}
.xkt-sp-panel .xkt-sp-clear:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.xkt-sp-panel .xkt-sp-clear:disabled:hover {
  background: transparent;
  color: #777;
  border-color: transparent;
}

.xkt-sp-panel .xkt-sp-hint {
  padding: 6px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #ececec;
  font-size: 10.5px;
  color: #64748b;
  line-height: 1.35;
}

.xkt-sp-panel .xkt-sp-body {
  flex: 1 1 auto;
  overflow: auto;
}
.xkt-sp-panel .xkt-sp-empty {
  padding: 18px 14px;
  text-align: center;
  color: #94a3b8;
  font-style: italic;
}
.xkt-sp-panel .xkt-sp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-top: 1px solid #f1f5f9;
  cursor: pointer;
}
.xkt-sp-panel .xkt-sp-row:first-child { border-top: none; }
.xkt-sp-panel .xkt-sp-row:hover { background: #f8fafc; }
.xkt-sp-panel .xkt-sp-row.xkt-sp-selected {
  background: rgba(45, 94, 140, 0.10);
}
.xkt-sp-panel .xkt-sp-row-active {
  flex-shrink: 0;
  width: 14px; height: 14px;
  margin: 0;
  cursor: pointer;
}
.xkt-sp-panel .xkt-sp-row-id {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-sp-panel .xkt-sp-row-destroy {
  flex-shrink: 0;
  width: 22px; height: 22px;
  padding: 0;
  font: inherit;
  font-size: 14px;
  line-height: 1;
  color: #777;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}
.xkt-sp-panel .xkt-sp-row-destroy:hover {
  background: #fee2e2;
  color: #b91c1c;
  border-color: rgba(185, 28, 28, 0.32);
}

.xkt-sp-pill {
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
  background: #2d5e8c;
  border: 1px solid #1f4669;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-sp-pill:hover { background: #1f4669; }
.xkt-sp-pill[hidden] { display: none; }
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

export class SectionPlanesPanel extends FloatingPanelBase {

  private static readonly _instances = new WeakMap<View, SectionPlanesPanel>();

  /** SVG markup for the title-bar / toolbar-button glyph — a
   *  half-cube with a cutting plane through it. */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      // Cube outline.
      `<path d="M5 8 L12 4 L19 8 L12 12 Z M5 8 L5 16 L12 20 L12 12 M19 8 L19 16 L12 20" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      // Slicing plane (diagonal).
      `<path d="M3 14 L21 10" ` +
            `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
    `</svg>`;
  }

  static getFor(view: View): SectionPlanesPanel | undefined {
    const inst = SectionPlanesPanel._instances.get(view);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: SectionPlanesPanelParams): SectionPlanesPanel {
    const existing = SectionPlanesPanel._instances.get(params.view);
    if (existing && !existing._destroyed) {
      existing.show();
      return existing;
    }
    return new SectionPlanesPanel(params);
  }

  readonly view: View;
  readonly controller: SectionPlanesController;

  /** Fires after each render so hosts can sync any external UI. */
  readonly onRendered = new EventEmitter<SectionPlanesPanel, void>(
    new EventDispatcher<SectionPlanesPanel, void>(),
  );

  private _bodyEl!: HTMLElement;
  private _modeTranslateBtn!: HTMLButtonElement;
  private _modeRotateBtn!: HTMLButtonElement;
  private _clearBtn!: HTMLButtonElement;
  private readonly _unsubs: Array<() => void> = [];

  constructor(params: SectionPlanesPanelParams) {
    if (!params || !params.view) throw new Error("SectionPlanesPanel: view is required");
    super({
      container: params.container,
      storageKey: params.storageKey || "xkt-sp-panel",
      classPrefix: "xkt-sp",
    });
    this.view = params.view;
    this.controller = SectionPlanesController.openFor(params.view);

    const prior = SectionPlanesPanel._instances.get(params.view);
    if (prior && !prior._destroyed) prior.destroy();
    SectionPlanesPanel._instances.set(params.view, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireEvents();
    this._renderList();

    if (params.visible === false) this.hide();
    else this.show();
  }


  // ── Public lifecycle ──────────────────────────────────────────

  get visible(): boolean { return this._panel.style.display !== "none"; }
  show(): void { if (!this._destroyed) super.show(); }
  hide(): void { if (!this._destroyed) super.hide(); }
  toggle(): void { if (this.visible) this.hide(); else this.show(); }

  destroy(): void {
    if (this._destroyed) return;
    for (const u of this._unsubs) { try { u(); } catch { /* ignore */ } }
    this._unsubs.length = 0;
    if (SectionPlanesPanel._instances.get(this.view) === this) {
      SectionPlanesPanel._instances.delete(this.view);
    }
    super.destroy();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-sp-pill", {
      type: "button",
      title: "Reopen the Section Planes panel",
      hidden: true,
      textContent: "Section Planes",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-sp-panel");

    this._header = el("div", "xkt-sp-header");
    const title = el("h2", "xkt-sp-title", {textContent: "Section Planes"});

    // Segmented Translate / Rotate toggle.
    const modeWrap = el("div", "xkt-sp-mode", {
      role: "group",
      "aria-label": "Edit mode",
    });
    this._modeTranslateBtn = el("button", "xkt-sp-mode-btn", {
      type: "button",
      textContent: "Translate",
      title: "Drag the plane along its axes",
      "aria-pressed": "true",
    }) as HTMLButtonElement;
    this._modeRotateBtn = el("button", "xkt-sp-mode-btn", {
      type: "button",
      textContent: "Rotate",
      title: "Re-orient the plane",
      "aria-pressed": "false",
    }) as HTMLButtonElement;
    modeWrap.append(this._modeTranslateBtn, this._modeRotateBtn);

    this._clearBtn = el("button", "xkt-sp-clear", {
      type: "button",
      textContent: "Clear",
      title: "Destroy every section plane in this View",
    }) as HTMLButtonElement;

    this._closeBtn = el("button", "xkt-sp-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, modeWrap, this._clearBtn, this._closeBtn);
    this._panel.appendChild(this._header);

    const hint = el("div", "xkt-sp-hint", {
      textContent: "Click a surface in the viewer to drop a section plane.",
    });
    this._panel.appendChild(hint);

    this._bodyEl = el("div", "xkt-sp-body");
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireEvents(): void {
    // Translate / Rotate buttons toggle the controller's gizmo mode.
    this._modeTranslateBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.controller.setMode("translate");
    });
    this._modeRotateBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.controller.setMode("rotate");
    });
    this._clearBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      // Snapshot first — `remove` mutates the list while we iterate.
      for (const p of this.controller.list().slice()) {
        this.controller.remove(p);
      }
    });

    // Controller-driven re-renders.
    this._unsubs.push(
      this.controller.onChanged.subscribe(() => this._renderList()),
      this.controller.onSelectionChanged.subscribe((_c, payload) => {
        this._reflectMode(payload.mode);
        this._renderList();
      }),
    );
  }

  private _reflectMode(mode: SectionPlanesEditMode): void {
    this._modeTranslateBtn.setAttribute("aria-pressed", String(mode === "translate"));
    this._modeRotateBtn.setAttribute("aria-pressed",    String(mode === "rotate"));
  }

  private _renderList(): void {
    if (this._destroyed) return;
    this._bodyEl.replaceChildren();

    const planes = this.controller.list();
    this._clearBtn.disabled = planes.length === 0;

    if (planes.length === 0) {
      const empty = el("div", "xkt-sp-empty", {
        textContent: "No section planes. Click a surface to drop one.",
      });
      this._bodyEl.appendChild(empty);
      this.onRendered.dispatch(this, undefined);
      return;
    }

    const selected = this.controller.selected;
    for (const plane of planes) {
      const row = el("div", "xkt-sp-row");
      if (plane === selected) row.classList.add("xkt-sp-selected");

      const activeCb = el("input", "xkt-sp-row-active") as HTMLInputElement;
      activeCb.type = "checkbox";
      activeCb.checked = plane.active;
      activeCb.title = "Active";
      activeCb.addEventListener("click", (ev) => ev.stopPropagation());
      activeCb.addEventListener("change", () => {
        plane.active = activeCb.checked;
      });

      const idEl = el("span", "xkt-sp-row-id", {
        textContent: plane.id,
        title: plane.id,
      });

      const destroyBtn = el("button", "xkt-sp-row-destroy", {
        type: "button",
        title: `Destroy ${plane.id}`,
        textContent: "×",
      }) as HTMLButtonElement;
      destroyBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.controller.remove(plane);
      });

      row.append(activeCb, idEl, destroyBtn);
      // Clicking the row promotes the plane to the gizmo target.
      row.addEventListener("click", () => {
        this.controller.select(plane);
      });
      this._bodyEl.appendChild(row);
    }
    this.onRendered.dispatch(this, undefined);
  }
}
