/**
 * Floating "tell me about this example" panel.
 *
 * Standardises the per-example UI cards that every demo grew its
 * own ad-hoc HTML for — title, description, and a stack of small
 * widgets (toggles, sliders, buttons, read-only stats). Examples
 * open it via {@link Studio.openInfoPanel} and add widgets
 * imperatively:
 *
 * ```ts
 * const info = studio.openInfoPanel({
 *   id:          "sectionCaps-duplex",
 *   title:       "Section Caps — Duplex",
 *   description: "Drag the slider to move the cut plane…",
 * });
 * info.addToggle({ label: "Section plane", value: true,
 *                  onChange: v => sp.active = v });
 * info.addSlider({ label: "Cut Z (m)", min: 0, max: 5,
 *                  value: 2.6, onChange: rebuildCaps });
 * info.addStat  ({ id: "caps", label: "Cap meshes" });
 * info.setStat("caps", "42");
 * ```
 *
 * For one-off widgets that don't fit the builders, {@link body}
 * is the fallback.
 *
 */

import {FloatingPanelBase} from "../floatingPanelBase";
import {el} from "../../utils/el";


const STYLE_TAG_ID = "xkt-info-styles";
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
// CSS
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-info-panel {
  position: fixed;
  /* These CSS defaults match what _restoreLayout writes inline on
     every open, so the baseline and the runtime state stay
     consistent. The panel starts at top-right with 17px insets
     and re-anchors there every time it's constructed — no
     localStorage persistence (see InfoPanel._restoreLayout). */
  top: 17px;
  right: 17px;
  width: 360px;
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
  min-width: 260px;
}
.xkt-info-panel *, .xkt-info-panel *::before, .xkt-info-panel *::after {
  box-sizing: border-box;
}
.xkt-info-panel[hidden] { display: none; }

.xkt-info-panel .xkt-info-header {
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
.xkt-info-panel .xkt-info-header.xkt-info-dragging { cursor: grabbing; }
.xkt-info-panel .xkt-info-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  line-height: 1.35;
  font-weight: 650;
  color: #2d5e8c;
  letter-spacing: 0.2px;
  overflow-wrap: anywhere;
  white-space: normal;
}
.xkt-info-panel .xkt-info-close {
  flex-shrink: 0;
  align-self: flex-start;
  width: 24px;
  height: 24px;
  padding: 0;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  color: #777;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  cursor: pointer;
}
.xkt-info-panel .xkt-info-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-info-pill {
  position: fixed;
  bottom: 17px;
  /* Bottom-centre. The panel itself lives top-right; placing the
     pill at the opposite corner makes it ambiguous, so we centre
     it horizontally instead — always visible, always findable. */
  left: 50%;
  transform: translateX(-50%);
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
.xkt-info-pill:hover { background: #1f4669; }
.xkt-info-pill[hidden] { display: none; }

.xkt-info-panel .xkt-info-body {
  flex: 0 1 auto;
  overflow-y: auto;
  padding: 10px 14px 14px;
}

.xkt-info-panel .xkt-info-description {
  font-size: 12px;
  color: #333;
  margin: 0 0 12px 0;
}
.xkt-info-panel .xkt-info-description p { margin: 0 0 8px; }
.xkt-info-panel .xkt-info-description p:last-child { margin-bottom: 0; }
.xkt-info-panel .xkt-info-description code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  background: #f1f3f5;
  padding: 1px 5px;
  border-radius: 3px;
  color: #1f4669;
}

.xkt-info-panel .xkt-info-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* A single labelled widget row. */
.xkt-info-panel .xkt-info-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #333;
}
.xkt-info-panel .xkt-info-row-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xkt-info-panel .xkt-info-row-control {
  flex: 0 0 auto;
}

/* Toggle button — pill-style on/off. */
.xkt-info-panel .xkt-info-toggle {
  padding: 4px 12px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  text-transform: uppercase;
  color: #fff;
  background: #2d5e8c;
  border: 1px solid #1f4669;
  border-radius: 999px;
  cursor: pointer;
  min-width: 56px;
}
.xkt-info-panel .xkt-info-toggle[aria-pressed="false"] {
  color: #555;
  background: #f1f3f5;
  border-color: #c8d4e2;
}
.xkt-info-panel .xkt-info-toggle:hover { filter: brightness(1.05); }

/* Generic action button — square-edged, neutral chrome. */
.xkt-info-panel .xkt-info-button {
  padding: 5px 12px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: #2d5e8c;
  background: #eef2f7;
  border: 1px solid #c8d4e2;
  border-radius: 5px;
  cursor: pointer;
}
.xkt-info-panel .xkt-info-button:hover {
  background: #2d5e8c;
  color: #fff;
  border-color: #2d5e8c;
}

/* Slider — full-row, value pill on the right. */
.xkt-info-panel .xkt-info-slider {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.xkt-info-panel .xkt-info-slider-top {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.xkt-info-panel .xkt-info-slider-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xkt-info-panel .xkt-info-slider-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #1f4669;
  background: #eef2f7;
  border: 1px solid #c8d4e2;
  border-radius: 3px;
  padding: 1px 6px;
  min-width: 44px;
  text-align: right;
}
.xkt-info-panel .xkt-info-slider input[type="range"] {
  width: 100%;
  margin: 0;
}

/* Native select restyled to read like the rest of the chrome. */
.xkt-info-panel .xkt-info-select {
  padding: 4px 8px;
  font: inherit;
  font-size: 11px;
  color: #1f4669;
  background: #fff;
  border: 1px solid #c8d4e2;
  border-radius: 5px;
  cursor: pointer;
  min-width: 120px;
}

/* Radio group row — chips side by side. */
.xkt-info-panel .xkt-info-radios {
  display: inline-flex;
  gap: 4px;
}
.xkt-info-panel .xkt-info-radio {
  padding: 3px 10px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: #555;
  background: #f1f3f5;
  border: 1px solid #c8d4e2;
  border-radius: 999px;
  cursor: pointer;
}
.xkt-info-panel .xkt-info-radio[aria-pressed="true"] {
  color: #fff;
  background: #2d5e8c;
  border-color: #1f4669;
}

/* Read-only stat row. */
.xkt-info-panel .xkt-info-stat-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  color: #1f4669;
}
`;


// ─────────────────────────────────────────────────────────────────
// Widget params
// ─────────────────────────────────────────────────────────────────

/** Common params for every builder. */
export interface InfoPanelWidgetParamsBase {
  /** Stable id for later updates / lookups. Auto-assigned if omitted. */
  id?: string;
  /** User-facing label rendered to the left of the control. */
  label: string;
  /** Tooltip on hover. */
  title?: string;
}

export interface InfoPanelToggleParams extends InfoPanelWidgetParamsBase {
  /** Initial state. Default `false`. */
  value?: boolean;
  /** Fires when the user toggles the control. */
  onChange?: (value: boolean) => void;
}

export interface InfoPanelSliderParams extends InfoPanelWidgetParamsBase {
  min: number;
  max: number;
  /** Initial value. Defaults to `min`. */
  value?: number;
  /** Increment. Default `(max - min) / 100`. */
  step?: number;
  /**
   * Decimal places shown in the value pill. Default 2.
   * The slider's emitted value is always a plain number.
   */
  digits?: number;
  /** Fires on every `input` event (i.e., during drag). */
  onChange?: (value: number) => void;
}

export interface InfoPanelButtonParams extends InfoPanelWidgetParamsBase {
  /**
   * Button face text. Defaults to {@link label} when omitted, in
   * which case the row label is suppressed (single-line button).
   */
  buttonText?: string;
  onClick?: () => void;
}

export interface InfoPanelSelectOption {
  value: string;
  label: string;
}

export interface InfoPanelSelectParams extends InfoPanelWidgetParamsBase {
  options: InfoPanelSelectOption[];
  /** Initially-selected `value`. Defaults to the first option. */
  value?: string;
  onChange?: (value: string) => void;
}

export interface InfoPanelRadioGroupParams extends InfoPanelWidgetParamsBase {
  options: InfoPanelSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
}

export interface InfoPanelStatParams extends InfoPanelWidgetParamsBase {
  /** Initial value text. Default `"—"`. */
  value?: string;
}


// ─────────────────────────────────────────────────────────────────
// Constructor params
// ─────────────────────────────────────────────────────────────────

export interface InfoPanelParams {
  /** DOM container for the panel + pill. Defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * Stable id, used to namespace the panel's `localStorage` key
   * for drag-position + closed-state persistence. Each example
   * should pass its own example id so two panels don't share a
   * slot. Default `"infoPanel"`.
   */
  id?: string;

  /** Header title. Default `"Info"`. */
  title?: string;

  /**
   * Body description, rendered as HTML at the top of the panel
   * body above the controls. Examples are trusted authors, so no
   * sanitisation pass is run — pass plain text or trusted markup.
   * Wrap paragraphs in `<p>` for proper spacing.
   */
  description?: string;
}


// ─────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────

/**
 * Floating info card — see the module overview for usage. The
 * caller owns the panel reference and uses the imperative
 * `addToggle` / `addSlider` / `addStat` / etc. builders to grow
 * the control list, and `setStat(id, value)` to update read-only
 * fields. `body` is the fallback for one-off DOM that doesn't
 * fit the builders.
 */
export class InfoPanel extends FloatingPanelBase {

  private _headerTitleEl!: HTMLSpanElement;
  private _body!: HTMLDivElement;
  private _descriptionEl!: HTMLDivElement;
  private _controlsEl!: HTMLDivElement;

  /** id → value-element map, used by {@link setStat}. */
  private readonly _statValueEls: { [id: string]: HTMLSpanElement } = {};

  /** Auto-id counter for widgets the caller didn't id themselves. */
  private _autoIdSeq = 0;

  constructor(params: InfoPanelParams = {}) {
    const id = params.id || "infoPanel";
    super({
      container:   params.container,
      storageKey:  `xkt-info-${id}`,
      classPrefix: "xkt-info",
      minHeight:   0,
    });
    injectStylesOnce();
    this._buildDom(params);
    this._bindChrome();

    // The InfoPanel pill stays visible at all times — it doubles
    // as a permanent landmark in the side-rail rather than just a
    // "panel was minimised" affordance. _buildDom creates the
    // pill with `hidden: true` and `show()` would normally
    // re-hide it; the `show()` override below mirrors this same
    // un-hide on every reopen.
    this._pill.hidden = false;
  }

  /**
   * @override Re-surface the pill after `super.show()` hides it.
   * The InfoPanel pill is a permanent landmark, not just a
   * minimised-state affordance.
   */
  override show(): void {
    if (this._destroyed) return;
    super.show();
    this._pill.hidden = false;
  }

  protected _buildDom(params: InfoPanelParams = {}): void {
    this._panel = el("div", "xkt-info-panel");

    this._header = el("div", "xkt-info-header");
    this._headerTitleEl = el("span", "xkt-info-title", {
      textContent: params.title || "Info",
    });
    this._header.appendChild(this._headerTitleEl);

    this._closeBtn = el("button", "xkt-info-close", {
      type:         "button",
      "aria-label": "Close",
      title:        "Close",
      innerHTML:    "×",
    }) as HTMLButtonElement;
    this._header.appendChild(this._closeBtn);

    this._panel.appendChild(this._header);

    this._body = el("div", "xkt-info-body") as HTMLDivElement;

    this._descriptionEl = el("div", "xkt-info-description") as HTMLDivElement;
    if (params.description) {
      this._descriptionEl.innerHTML = params.description;
    } else {
      this._descriptionEl.hidden = true;
    }
    this._body.appendChild(this._descriptionEl);

    this._controlsEl = el("div", "xkt-info-controls") as HTMLDivElement;
    this._body.appendChild(this._controlsEl);

    this._panel.appendChild(this._body);

    this._pill = el("button", "xkt-info-pill", {
      type:        "button",
      textContent: params.title || "Info",
      hidden:      true,
    });

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }


  // ── Layout persistence overrides ─────────────────────────────
  //
  // InfoPanel deliberately does NOT persist layout across page
  // reloads — every example session opens fresh at the top-right
  // 17px inset. Overriding both halves of FloatingPanelBase's
  // persistence pair achieves that without growing a new opt-out
  // flag on the base.

  /**
   * @override Force a fixed initial position instead of reading
   * a saved layout. Called by the base's `_bindChrome`.
   */
  protected override _restoreLayout(): void {
    this._panel.style.top       = "17px";
    this._panel.style.right     = "17px";
    this._panel.style.left      = "auto";
    this._panel.style.bottom    = "auto";
    this._panel.style.transform = "none";
  }

  /**
   * @override No-op. Drags, resizes, and minimize/restore all
   * call into this and would normally persist to
   * `localStorage`; for InfoPanel we want every session to
   * start at the same place regardless of what the user did
   * last time.
   */
  protected override _saveLayout(): void {
    /* intentionally empty */
  }


  // ── Public surface ────────────────────────────────────────────

  /**
   * The body's controls container. Use this when none of the
   * builders fit — append arbitrary DOM and wire its events
   * yourself. Widgets added via the builders are appended here
   * too, so your raw nodes interleave naturally with them in
   * insertion order.
   */
  get body(): HTMLElement {
    return this._controlsEl;
  }

  /** Update the panel's header (and reopen-pill) title. */
  setTitle(title: string): void {
    this._headerTitleEl.textContent = title;
    this._pill.textContent = title;
  }

  /**
   * Replace the description block with the given HTML. Pass an
   * empty string to hide the description entirely.
   */
  setDescription(html: string): void {
    if (html) {
      this._descriptionEl.innerHTML = html;
      this._descriptionEl.hidden = false;
    } else {
      this._descriptionEl.innerHTML = "";
      this._descriptionEl.hidden = true;
    }
  }

  // ── Widget builders ───────────────────────────────────────────

  addToggle(params: InfoPanelToggleParams): HTMLButtonElement {
    const row = this._makeRow(params.label, params.title);
    const initial = params.value === true;
    const btn = el("button", "xkt-info-toggle", {
      type:           "button",
      textContent:    initial ? "On" : "Off",
      "aria-pressed": String(initial),
      title:          params.title,
    }) as HTMLButtonElement;
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(next));
      btn.textContent = next ? "On" : "Off";
      params.onChange?.(next);
    });
    this._appendControl(row, btn);
    return btn;
  }

  addSlider(params: InfoPanelSliderParams): HTMLInputElement {
    const wrap = el("div", "xkt-info-slider");
    const top  = el("div", "xkt-info-slider-top");
    const label = el("span", "xkt-info-slider-label", {textContent: params.label});
    const valueEl = el("span", "xkt-info-slider-value");
    top.append(label, valueEl);
    wrap.appendChild(top);

    const initial = params.value ?? params.min;
    const step    = params.step ?? (params.max - params.min) / 100;
    const digits  = params.digits ?? 2;
    const input = el("input", undefined, {
      type:  "range",
      min:   String(params.min),
      max:   String(params.max),
      step:  String(step),
      value: String(initial),
      title: params.title,
    }) as HTMLInputElement;
    valueEl.textContent = (+initial).toFixed(digits);
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      valueEl.textContent = v.toFixed(digits);
      params.onChange?.(v);
    });
    wrap.appendChild(input);
    this._controlsEl.appendChild(wrap);
    return input;
  }

  addButton(params: InfoPanelButtonParams): HTMLButtonElement {
    const face = params.buttonText ?? params.label;
    const showLabel = params.buttonText !== undefined && params.buttonText !== params.label;
    const row = this._makeRow(showLabel ? params.label : "", params.title);
    if (!showLabel) {
      // Collapse the label slot so the button takes the full row.
      const labelEl = row.querySelector(".xkt-info-row-label");
      if (labelEl) labelEl.remove();
    }
    const btn = el("button", "xkt-info-button", {
      type:        "button",
      textContent: face,
      title:       params.title,
    }) as HTMLButtonElement;
    btn.addEventListener("click", () => params.onClick?.());
    this._appendControl(row, btn);
    return btn;
  }

  addSelect(params: InfoPanelSelectParams): HTMLSelectElement {
    const row = this._makeRow(params.label, params.title);
    const select = el("select", "xkt-info-select", {
      title: params.title,
    }) as HTMLSelectElement;
    for (const opt of params.options) {
      const o = el("option", undefined, {value: opt.value, textContent: opt.label});
      select.appendChild(o);
    }
    if (params.value !== undefined) select.value = params.value;
    select.addEventListener("change", () => params.onChange?.(select.value));
    this._appendControl(row, select);
    return select;
  }

  addRadioGroup(params: InfoPanelRadioGroupParams): HTMLDivElement {
    const row = this._makeRow(params.label, params.title);
    const group = el("div", "xkt-info-radios") as HTMLDivElement;
    const initial = params.value ?? params.options[0]?.value;
    for (const opt of params.options) {
      const chip = el("button", "xkt-info-radio", {
        type:           "button",
        textContent:    opt.label,
        "aria-pressed": String(opt.value === initial),
      }) as HTMLButtonElement;
      chip.dataset.value = opt.value;
      chip.addEventListener("click", () => {
        for (const sib of Array.from(group.children) as HTMLButtonElement[]) {
          sib.setAttribute("aria-pressed", String(sib === chip));
        }
        params.onChange?.(opt.value);
      });
      group.appendChild(chip);
    }
    this._appendControl(row, group);
    return group;
  }

  addStat(params: InfoPanelStatParams): HTMLSpanElement {
    const row = this._makeRow(params.label, params.title);
    const value = el("span", "xkt-info-stat-value", {
      textContent: params.value ?? "—",
    });
    const id = params.id || `stat-${++this._autoIdSeq}`;
    this._statValueEls[id] = value;
    this._appendControl(row, value);
    return value;
  }

  /**
   * Update the value text of a stat row added via {@link addStat}.
   * No-op if `id` was never registered.
   */
  setStat(id: string, value: string): void {
    const el = this._statValueEls[id];
    if (el) el.textContent = value;
  }


  // ── Internals ─────────────────────────────────────────────────

  private _makeRow(label: string, title?: string): HTMLDivElement {
    const row = el("div", "xkt-info-row") as HTMLDivElement;
    if (title) row.title = title;
    if (label !== "") {
      const labelEl = el("span", "xkt-info-row-label", {textContent: label});
      row.appendChild(labelEl);
    }
    this._controlsEl.appendChild(row);
    return row;
  }

  private _appendControl(row: HTMLElement, control: HTMLElement): void {
    const slot = el("span", "xkt-info-row-control");
    slot.appendChild(control);
    row.appendChild(slot);
  }
}
