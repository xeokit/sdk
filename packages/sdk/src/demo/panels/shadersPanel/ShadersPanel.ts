/**
 * Floating, draggable, closeable panel that surfaces every
 * GLSL shader pair compiled into a {@link WebGLRenderer}'s
 * draw pipeline — vertex + fragment, grouped by primitive
 * (Triangles / Lines / Points) and by technique (opaque,
 * transparent, selected, highlighted, xrayed, pick, edge
 * variants), with an in-page filter and a one-click "open
 * GLSL in new tab" affordance for each source.
 *
 * The panel reads from a snapshot {@link ShaderInspector}
 * passed at construction. Inspector data is immutable for the
 * life of the renderer's draw-op set, so the panel paints
 * once on `show()` and again only when the user expands a
 * collapsed branch — no per-frame polling, no listeners.
 *
 * Same chrome and lifecycle as the sister diagnostic panels
 * ({@link demo/eventsPanel!EventsPanel},
 * {@link demo/tasksPanel!TasksPanel}) — per-inspector WeakMap
 * registry, idempotent `getFor` / `openFor`, drag-header,
 * close button + reopen pill, layout persistence,
 * bring-to-front on pointer-down, scoped `xkt-shins-` CSS
 * prefix.
 *
 * @module demo/shadersPanel
 */
import {
  ShaderInspector,
  type DrawTechniqueRecord,
  type ShaderVariantName,
  type ShaderVariantRecord,
} from "../../../webGLRenderer/internal/inspectors";

import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";


// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface ShadersPanelParams {

  /**
   * Snapshot of compiled shader sources to display. Doubles as
   * the WeakMap key for {@link ShadersPanel.openFor} idempotence —
   * one panel per inspector instance.
   */
  inspector: ShaderInspector;

  /** DOM container; defaults to `document.body`. */
  container?: HTMLElement;

  /**
   * `localStorage` key for persisting drag position + closed
   * state. Defaults to `"xkt-shins-panel"`.
   */
  storageKey?: string;

  /** Show on construction (default `true`). */
  visible?: boolean;
}


// ─────────────────────────────────────────────────────────────────
// Module state — single CSS-injection guard.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-shins-styles";
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
// CSS — scoped under `.xkt-shins-panel`, classes prefixed
// `xkt-shins-`. Visual palette tracks the other floating panels.
// ─────────────────────────────────────────────────────────────────

const PANEL_CSS = `
.xkt-shins-panel {
  position: fixed;
  top: 88px;
  right: 17px;
  width: 640px;
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
.xkt-shins-panel *, .xkt-shins-panel *::before, .xkt-shins-panel *::after {
  box-sizing: border-box;
}
.xkt-shins-panel[hidden] { display: none; }

.xkt-shins-panel .xkt-shins-header {
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
.xkt-shins-panel .xkt-shins-header.xkt-shins-dragging { cursor: grabbing; }
.xkt-shins-panel .xkt-shins-title {
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
.xkt-shins-panel .xkt-shins-title-icon {
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
.xkt-shins-panel .xkt-shins-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-shins-panel .xkt-shins-title-text {
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-shins-panel .xkt-shins-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-shins-panel .xkt-shins-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-shins-panel .xkt-shins-counter {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: #2d5e8c;
  border-radius: 11px;
  letter-spacing: 0.2px;
}
.xkt-shins-panel .xkt-shins-counter[data-count="0"] {
  background: #94a3b8;
}
.xkt-shins-panel .xkt-shins-close {
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
.xkt-shins-panel .xkt-shins-close:hover {
  background: #f0f0f0;
  color: #222;
  border-color: #d0d0d0;
}

.xkt-shins-pill {
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
.xkt-shins-pill:hover { background: #1f4669; }
.xkt-shins-pill[hidden] { display: none; }

.xkt-shins-panel .xkt-shins-filter-row {
  flex: 0 0 auto;
  padding: 10px 14px;
  border-bottom: 1px solid #ececec;
  background: #fafcff;
}
.xkt-shins-panel .xkt-shins-filter {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #e6e6e6;
  padding: 7px 10px;
  font: inherit;
  font-size: 12px;
  background: #fff;
  color: #111;
}
.xkt-shins-panel .xkt-shins-filter:focus {
  outline: none;
  border-color: #2d5e8c;
  box-shadow: 0 0 0 2px rgba(45, 94, 140, 0.18);
}

.xkt-shins-panel .xkt-shins-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 0;
}

.xkt-shins-panel .xkt-shins-group {
  border-bottom: 1px solid #ececec;
}
.xkt-shins-panel .xkt-shins-group:last-child {
  border-bottom: none;
}
.xkt-shins-panel .xkt-shins-group > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  background: #f8fafc;
  user-select: none;
  -webkit-user-select: none;
  font-weight: 600;
  font-size: 13px;
  color: #2d5e8c;
}
.xkt-shins-panel .xkt-shins-group > summary::-webkit-details-marker { display: none; }
.xkt-shins-panel .xkt-shins-group > summary:hover { background: #f1f5f9; }
.xkt-shins-panel .xkt-shins-group[open] > summary {
  border-bottom: 1px solid #ececec;
}
.xkt-shins-panel .xkt-shins-twisty {
  flex-shrink: 0;
  width: 12px;
  text-align: center;
  font-size: 10px;
  color: #64748b;
  transition: transform 120ms ease;
  display: inline-block;
}
.xkt-shins-panel .xkt-shins-group[open] > summary .xkt-shins-twisty {
  transform: rotate(90deg);
}
.xkt-shins-panel .xkt-shins-group-count {
  margin-left: auto;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 6px;
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  background: #2d5e8c;
  border-radius: 9px;
  letter-spacing: 0.2px;
}
.xkt-shins-panel .xkt-shins-group-count[data-count="0"] {
  background: #cbd5e1;
  color: #475569;
}

.xkt-shins-panel .xkt-shins-tech {
  border-top: 1px solid #f1f5f9;
}
.xkt-shins-panel .xkt-shins-tech:first-child {
  border-top: none;
}
.xkt-shins-panel .xkt-shins-tech > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 8px 30px;
  background: #ffffff;
  user-select: none;
  -webkit-user-select: none;
  font-weight: 600;
  font-size: 12px;
  color: #1f2937;
}
.xkt-shins-panel .xkt-shins-tech > summary::-webkit-details-marker { display: none; }
.xkt-shins-panel .xkt-shins-tech > summary:hover { background: #f7fafc; }
.xkt-shins-panel .xkt-shins-tech[open] > summary {
  border-bottom: 1px solid #f1f5f9;
}

.xkt-shins-panel .xkt-shins-leafs {
  padding: 8px 14px 12px 46px;
  background: #f9fbff;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.xkt-shins-panel .xkt-shins-leaf {
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}
.xkt-shins-panel .xkt-shins-leaf-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
}
.xkt-shins-panel .xkt-shins-leaf-kind {
  flex: 1;
  font-weight: 600;
  font-size: 11.5px;
  color: #475569;
}
.xkt-shins-panel .xkt-shins-leaf-kind[data-kind="vertex"] { color: #1d4ed8; }
.xkt-shins-panel .xkt-shins-leaf-kind[data-kind="fragment"] { color: #c2410c; }
.xkt-shins-panel .xkt-shins-leaf-meta {
  font-size: 10.5px;
  color: #64748b;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.xkt-shins-panel .xkt-shins-btn {
  padding: 4px 9px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: #2d5e8c;
  background: #fff;
  border: 1px solid #c8d6e6;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-shins-panel .xkt-shins-btn:hover {
  background: #eef3f9;
  border-color: #2d5e8c;
}

.xkt-shins-panel .xkt-shins-tech-className {
  flex-shrink: 0;
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: #666;
  background: #f0f0f0;
  border-radius: 3px;
  white-space: nowrap;
}
.xkt-shins-panel .xkt-shins-tech-variants-count {
  flex-shrink: 0;
  font-size: 10.5px;
  font-weight: 600;
  color: #475569;
  font-variant-numeric: tabular-nums;
}

.xkt-shins-panel .xkt-shins-variant {
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}
.xkt-shins-panel .xkt-shins-variant-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: #f4f7fb;
  border-bottom: 1px solid #ececec;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.xkt-shins-panel .xkt-shins-variant-head:hover { background: #eef3f9; }
.xkt-shins-panel .xkt-shins-variant > summary { list-style: none; }
.xkt-shins-panel .xkt-shins-variant > summary::-webkit-details-marker { display: none; }
.xkt-shins-panel .xkt-shins-variant-name {
  flex: 1;
  font-weight: 600;
  font-size: 11.5px;
  color: #2d5e8c;
  letter-spacing: 0.2px;
}
.xkt-shins-panel .xkt-shins-variant-className {
  flex-shrink: 0;
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: #666;
  background: #fff;
  border: 1px solid #e6e6e6;
  border-radius: 3px;
  white-space: nowrap;
}

.xkt-shins-panel .xkt-shins-empty {
  padding: 18px 14px;
  color: #94a3b8;
  font-style: italic;
  font-size: 12px;
  text-align: center;
}
.xkt-shins-panel .xkt-shins-hidden {
  display: none !important;
}
`;


// ─────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────

type GroupKey = "triangles" | "lines" | "points";

const GROUP_LABELS: Record<GroupKey, string> = {
  triangles: "Triangles",
  lines:     "Lines",
  points:    "Points",
};

interface GroupView {
  details: HTMLDetailsElement;
  countEl: HTMLElement;
  techDetails: HTMLDetailsElement[];
}


export class ShadersPanel extends FloatingPanelBase {

  /**
   * Per-inspector instance registry. WeakMap so an inspector
   * that gets dropped doesn't keep the panel alive for GC.
   */
  private static readonly _instances = new WeakMap<ShaderInspector, ShadersPanel>();

  /**
   * SVG markup for the panel's title-bar glyph — an isometric
   * cube with a small chevron-bracket overlay, evoking
   * "shader program". Strokes use `currentColor`.
   */
  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M12 3 L21 8 L21 17 L12 22 L3 17 L3 8 Z" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M3 8 L12 13 L21 8 M12 13 L12 22" ` +
            `fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.7"/>` +
      `<path d="M9.5 16.5 L8 18 L9.5 19.5 M14.5 16.5 L16 18 L14.5 19.5" ` +
            `fill="none" stroke="currentColor" stroke-width="1.5" ` +
            `stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
  }

  static getFor(inspector: ShaderInspector): ShadersPanel | undefined {
    const inst = ShadersPanel._instances.get(inspector);
    return inst && !inst._destroyed ? inst : undefined;
  }

  /**
   * Reveal (or lazily mount) a panel for `params.inspector`.
   * Idempotent — if a panel already exists for this inspector
   * and is still alive, it's brought back to the foreground;
   * otherwise a fresh one is constructed.
   */
  static openFor(params: ShadersPanelParams): ShadersPanel {
    let inst = ShadersPanel._instances.get(params.inspector);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new ShadersPanel(params);
    return inst;
  }

  readonly inspector: ShaderInspector;

  // Panel-content DOM refs (chrome refs live on FloatingPanelBase).
  private _counterEl!: HTMLElement;
  private _bodyEl!: HTMLElement;
  private _filterEl!: HTMLInputElement;
  private readonly _groups = new Map<GroupKey, GroupView>();

  constructor(params: ShadersPanelParams) {
    if (!params || !params.inspector) {
      throw new Error("ShadersPanel: inspector is required");
    }
    super({
      container:   params.container,
      storageKey:  params.storageKey || "xkt-shins-panel",
      classPrefix: "xkt-shins",
    });
    this.inspector = params.inspector;

    // Replace any prior panel bound to the same inspector — keeps
    // openFor idempotent and avoids stale DOM after a hot reload.
    const prior = ShadersPanel._instances.get(params.inspector);
    if (prior && !prior._destroyed) prior.destroy();
    ShadersPanel._instances.set(params.inspector, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._wireDomEvents();
    this._render();

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
    if (ShadersPanel._instances.get(this.inspector) === this) {
      ShadersPanel._instances.delete(this.inspector);
    }
    super.destroy();
  }


  // ── DOM construction ──────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-shins-pill", {
      type: "button",
      title: "Reopen the Shaders panel",
      hidden: true,
      textContent: "Shaders",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-shins-panel");

    this._header = el("div", "xkt-shins-header");
    const title = el("h2", "xkt-shins-title");
    title.innerHTML =
      `<span class="xkt-shins-title-icon">${ShadersPanel.iconSvg()}</span>` +
      `<span class="xkt-shins-title-stack">` +
        `<span class="xkt-shins-title-text">Shaders</span>` +
        `<span class="xkt-shins-subtitle">Compiled GLSL programs.</span>` +
      `</span>`;

    this._counterEl = el("span", "xkt-shins-counter");
    this._counterEl.textContent = "0";
    this._counterEl.dataset.count = "0";
    this._counterEl.title = "Total compiled shader techniques";

    this._closeBtn = el("button", "xkt-shins-close", {
      type: "button",
      "aria-label": "Close panel",
      title: "Close panel",
      innerHTML: "×",
    }) as HTMLButtonElement;

    this._header.append(title, this._counterEl, this._closeBtn);
    this._panel.appendChild(this._header);

    const filterRow = el("div", "xkt-shins-filter-row");
    this._filterEl = el("input", "xkt-shins-filter", {
      type: "search",
      placeholder: "Filter by technique name…",
      "aria-label": "Filter techniques",
    }) as HTMLInputElement;
    filterRow.appendChild(this._filterEl);
    this._panel.appendChild(filterRow);

    this._bodyEl = el("div", "xkt-shins-body");
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }

  private _wireDomEvents(): void {
    this._filterEl.addEventListener("input", () => {
      this._applyFilter(this._filterEl.value);
    });
  }


  // ── Rendering ─────────────────────────────────────────────────

  /**
   * Paints every group / technique / shader-leaf from the
   * inspector snapshot. The inspector is immutable once
   * constructed by the renderer, so this runs once on
   * construction and never re-runs over the panel's lifetime.
   *
   * The total counter sums *every* compiled program — base
   * pass + Lambert variants — so the header badge reflects the
   * full GPU program count rather than the slot count.
   */
  private _render(): void {
    this._bodyEl.replaceChildren();
    this._groups.clear();

    const techniques = this.inspector.techniques as Record<GroupKey, Record<string, DrawTechniqueRecord>>;
    let total = 0;

    for (const groupKey of ["triangles", "lines", "points"] as GroupKey[]) {
      const groupObj = techniques[groupKey] || {};
      const techNames = Object.keys(groupObj);
      let programCount = 0;
      for (const k of techNames) {
        const rec = groupObj[k];
        if (!rec) continue;
        programCount += 1 + (rec.variants ? Object.keys(rec.variants).length : 0);
      }
      total += programCount;
      const view = this._buildGroup(groupKey, groupObj, programCount);
      this._bodyEl.appendChild(view.details);
      this._groups.set(groupKey, view);
    }

    if (total === 0) {
      const empty = el("div", "xkt-shins-empty", {
        textContent: "No shader techniques available.",
      });
      this._bodyEl.appendChild(empty);
    }

    this._counterEl.textContent = String(total);
    this._counterEl.dataset.count = String(total);
  }

  private _buildGroup(
    key: GroupKey,
    techMap: Record<string, DrawTechniqueRecord>,
    programCount: number,
  ): GroupView {
    const details = document.createElement("details");
    details.className = "xkt-shins-group";
    details.dataset.group = key;
    details.open = true;

    const summary = document.createElement("summary");
    const twisty = el("span", "xkt-shins-twisty", {textContent: "▶"});
    const label  = el("span", "xkt-shins-group-label", {textContent: GROUP_LABELS[key]});

    const countEl = el("span", "xkt-shins-group-count");
    countEl.textContent = String(programCount);
    countEl.dataset.count = String(programCount);

    summary.append(twisty, label, countEl);
    details.appendChild(summary);

    const techDetails: HTMLDetailsElement[] = [];
    for (const techName of Object.keys(techMap)) {
      const tech = techMap[techName];
      if (!tech) continue;
      const techEl = this._buildTechnique(key, techName, tech);
      details.appendChild(techEl);
      techDetails.push(techEl);
    }

    return {details, countEl, techDetails};
  }

  private _buildTechnique(
    group: GroupKey,
    name: string,
    tech: DrawTechniqueRecord,
  ): HTMLDetailsElement {
    const details = document.createElement("details");
    details.className = "xkt-shins-tech";
    details.dataset.technique = `${group}.${name}`;

    const summary = document.createElement("summary");
    const twisty = el("span", "xkt-shins-twisty", {textContent: "▶"});
    const label  = el("span", "xkt-shins-tech-label", {textContent: name});
    const classNameEl = el("span", "xkt-shins-tech-className", {
      textContent: tech.className,
      title: `DrawTechnique class: ${tech.className}`,
    });
    summary.append(twisty, label, classNameEl);

    const variantCount = tech.variants ? Object.keys(tech.variants).length : 0;
    if (variantCount > 0) {
      const variantsCountEl = el("span", "xkt-shins-tech-variants-count", {
        textContent: `+${variantCount} variant${variantCount === 1 ? "" : "s"}`,
        title: "Lambert variants compiled into this slot",
      });
      summary.appendChild(variantsCountEl);
    }
    details.appendChild(summary);

    const leafs = el("div", "xkt-shins-leafs");

    // Base (flat-shaded, no-UVs) variant.
    if (tech.vertexShaderSrc) {
      leafs.appendChild(this._buildLeaf("vertex", name, tech.vertexShaderSrc, tech.vertexShaderCommentedSrc));
    }
    if (tech.fragmentShaderSrc) {
      leafs.appendChild(this._buildLeaf("fragment", name, tech.fragmentShaderSrc, tech.fragmentShaderCommentedSrc));
    }

    // Optional Lambert variants — collapsed by default; opening
    // one yields its own vertex + fragment leaves.
    if (tech.variants) {
      for (const variantName of Object.keys(tech.variants) as ShaderVariantName[]) {
        const variant = tech.variants[variantName];
        if (!variant) continue;
        leafs.appendChild(this._buildVariant(name, variantName, variant));
      }
    }

    details.appendChild(leafs);
    return details;
  }

  private _buildVariant(
    techName: string,
    variantName: ShaderVariantName,
    variant: ShaderVariantRecord,
  ): HTMLDetailsElement {
    const details = document.createElement("details");
    details.className = "xkt-shins-variant";
    details.dataset.variant = variantName;

    const summary = document.createElement("summary");
    summary.className = "xkt-shins-variant-head";
    const twisty = el("span", "xkt-shins-twisty", {textContent: "▶"});
    const nameEl = el("span", "xkt-shins-variant-name", {textContent: variantName});
    const classNameEl = el("span", "xkt-shins-variant-className", {
      textContent: variant.className,
      title: `DrawTechnique class: ${variant.className}`,
    });
    summary.append(twisty, nameEl, classNameEl);
    details.appendChild(summary);

    const inner = el("div", "xkt-shins-leafs");
    const variantLabel = `${techName} (${variantName})`;
    if (variant.vertexShaderSrc) {
      inner.appendChild(this._buildLeaf("vertex", variantLabel, variant.vertexShaderSrc, variant.vertexShaderCommentedSrc));
    }
    if (variant.fragmentShaderSrc) {
      inner.appendChild(this._buildLeaf("fragment", variantLabel, variant.fragmentShaderSrc, variant.fragmentShaderCommentedSrc));
    }
    details.appendChild(inner);

    return details;
  }

  private _buildLeaf(
    kind: "vertex" | "fragment",
    techName: string,
    src: string,
    commentedSrc: string,
  ): HTMLElement {
    const leaf = el("div", "xkt-shins-leaf");
    const head = el("div", "xkt-shins-leaf-head");

    const kindEl = el("span", "xkt-shins-leaf-kind", {
      textContent: kind === "vertex" ? "Vertex shader" : "Fragment shader",
    });
    kindEl.dataset.kind = kind;

    const metaEl = el("span", "xkt-shins-leaf-meta", {
      textContent: `${countLines(src).toLocaleString()} lines`,
    });

    const glslBtn = el("button", "xkt-shins-btn", {
      type: "button",
      textContent: "GLSL",
      title: "Open the compiled GLSL source in a new tab",
    }) as HTMLButtonElement;
    glslBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openShaderSourceInTab(kind, techName, src);
    });

    const commentedBtn = el("button", "xkt-shins-btn", {
      type: "button",
      textContent: "GLSL + Comments",
      title: "Open the commented source (not necessarily compilable) in a new tab",
    }) as HTMLButtonElement;
    commentedBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openShaderSourceInTab(kind, techName, commentedSrc || src);
    });

    head.append(kindEl, metaEl, glslBtn, commentedBtn);
    leaf.appendChild(head);
    return leaf;
  }


  // ── Filtering ─────────────────────────────────────────────────

  /**
   * Hide techniques whose name or {@link DrawTechniqueRecord.className}
   * doesn't include `query` (case-insensitive substring match).
   * Empty query restores everything. Filtering operates on the
   * technique row only; parent group rows always stay visible and
   * update their displayed count to reflect the visible programs
   * (base + variants) in the surviving subset.
   */
  private _applyFilter(query: string): void {
    const q = (query || "").trim().toLowerCase();
    const techniques = this.inspector.techniques as Record<GroupKey, Record<string, DrawTechniqueRecord>>;
    for (const [groupKey, view] of this._groups) {
      const techMap = techniques[groupKey] || {};
      let visiblePrograms = 0;
      for (const td of view.techDetails) {
        const techPath = (td.dataset.technique || "").toLowerCase();
        const techName = techPath.split(".").slice(1).join(".");
        const rec = techMap[techName];
        const className = (rec?.className || "").toLowerCase();
        const match = !q || techPath.includes(q) || className.includes(q);
        td.classList.toggle("xkt-shins-hidden", !match);
        if (match && rec) {
          visiblePrograms += 1 + (rec.variants ? Object.keys(rec.variants).length : 0);
        }
      }
      view.countEl.textContent = String(visiblePrograms);
      view.countEl.dataset.count = String(visiblePrograms);
    }
  }
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

function countLines(src: string): number {
  return Math.max(1, src.split(/\r\n|\r|\n/).length);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Open shader source in a new browser tab with lightweight GLSL
 * syntax highlighting. Dark scheme so a long inspection session
 * doesn't fatigue the eye; falls back to a styleless `<pre>`
 * page when the highlighter doesn't recognise tokens (e.g.
 * non-GLSL text passed in by mistake).
 */
function openShaderSourceInTab(
  kind: "vertex" | "fragment",
  name: string,
  src: string,
): void {
  const highlighted = highlightGLSL(src);
  const title = `${name} (${kind} shader)`;
  const css = `
    body { background: #0f1116; color: #e7e7e7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; padding: 0; }
    .glsl-kw { color: #c9a7ff; font-weight: 600; }
    .glsl-builtin { color: #7ee787; font-weight: 600; }
    .glsl-num { color: #ffab70; }
    .glsl-comment { color: #8b949e; font-style: italic; }
    .glsl-str { color: #a5d6ff; }
    .glsl-pp { color: #ffd57a; font-weight: 600; }
    pre { margin: 0; padding: 24px; font-size: 15px; line-height: 1.6; }
    h1 { color: #fff; font-size: 20px; font-weight: 650; margin: 0 24px 4px 24px; padding-top: 24px; }
    .meta { color: #aaa; font-size: 13px; margin: 0 24px 18px 24px; }
  `;
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <meta charset="utf-8">
  <style>${css}</style>
</head>
<body>
  <h1>${escapeHtml(name)}</h1>
  <div class="meta">${escapeHtml(kind)} shader</div>
  <pre><code>${highlighted}</code></pre>
</body>
</html>`;
  const win = window.open("", "_blank");
  if (!win) {
    console.warn("[ShadersPanel] window.open returned null — likely blocked by the pop-up policy.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/**
 * Tiny, dependency-free GLSL highlighter. Same logic as the
 * legacy panel — scans for comments / strings / raw segments
 * first, then runs keyword / builtin / number replacements on
 * each raw segment. Good enough for shop-floor inspection;
 * not a substitute for a real GLSL grammar.
 */
function highlightGLSL(src: string): string {
  type Tok = {t: "raw" | "comment" | "string"; v: string};
  const parts: Tok[] = [];
  const s = src;
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    const next = s[i + 1];

    if (ch === "/" && next === "/") {
      const start = i;
      i += 2;
      while (i < s.length && s[i] !== "\n") i++;
      parts.push({t: "comment", v: s.slice(start, i)});
      continue;
    }
    if (ch === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i = Math.min(s.length, i + 2);
      parts.push({t: "comment", v: s.slice(start, i)});
      continue;
    }
    if (ch === '"') {
      const start = i;
      i++;
      while (i < s.length) {
        if (s[i] === "\\" && i + 1 < s.length) { i += 2; continue; }
        if (s[i] === '"') { i++; break; }
        i++;
      }
      parts.push({t: "string", v: s.slice(start, i)});
      continue;
    }

    const start = i;
    i++;
    while (i < s.length) {
      const c = s[i];
      const n = s[i + 1];
      if ((c === "/" && (n === "/" || n === "*")) || c === '"') break;
      i++;
    }
    parts.push({t: "raw", v: s.slice(start, i)});
  }

  const kw = [
    "attribute", "uniform", "varying", "const", "in", "out", "inout", "precision",
    "highp", "mediump", "lowp", "layout", "centroid", "flat", "smooth", "noperspective",
    "if", "else", "for", "while", "do", "break", "continue", "return", "discard",
    "struct", "void",
    "bool", "int", "uint", "float", "double",
    "vec2", "vec3", "vec4", "bvec2", "bvec3", "bvec4", "ivec2", "ivec3", "ivec4", "uvec2", "uvec3", "uvec4",
    "mat2", "mat3", "mat4", "mat2x2", "mat2x3", "mat2x4", "mat3x2", "mat3x3", "mat3x4", "mat4x2", "mat4x3", "mat4x4",
    "sampler2D", "samplerCube", "sampler2DShadow", "samplerCubeShadow", "sampler3D", "sampler2DArray",
  ];
  const kwRe = new RegExp(`\\b(${kw.join("|")})\\b`, "g");
  const builtins = [
    "gl_Position", "gl_FragColor", "gl_FragCoord", "gl_PointSize", "gl_PointCoord",
    "gl_FrontFacing", "gl_FragDepth",
  ];
  const builtinRe = new RegExp(`\\b(${builtins.join("|")})\\b`, "g");
  const numRe = /\b(?:0x[0-9a-fA-F]+|\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][+-]?\d+)?\b/g;

  function highlightRaw(raw: string): string {
    const escaped = escapeHtml(raw);
    const withPP = escaped.replace(
      /(^|\n)(\s*#.*?)(?=\n|$)/g,
      (_m, p1, p2) => `${p1}<span class="glsl-pp">${p2}</span>`,
    );
    return withPP
      .replace(builtinRe, `<span class="glsl-builtin">$1</span>`)
      .replace(kwRe, `<span class="glsl-kw">$1</span>`)
      .replace(numRe, `<span class="glsl-num">$&</span>`);
  }

  let out = "";
  for (const p of parts) {
    if (p.t === "comment")      out += `<span class="glsl-comment">${escapeHtml(p.v)}</span>`;
    else if (p.t === "string")  out += `<span class="glsl-str">${escapeHtml(p.v)}</span>`;
    else                        out += highlightRaw(p.v);
  }
  return out;
}
