/**
 * Browser for every loaded model in the demo's Scene. Renders one
 * collapsible {@link HTMLDetailsElement} per {@link model!scene.SceneModel | SceneModel},
 * each carrying identity, provenance, coordinate system, stats,
 * quick actions and jump-to links to deeper panels (Scene Health,
 * Data Health, Boundaries, Explorer).
 *
 * Uses the same section idiom as `ViewerConfigPanel` (per-View),
 * `SceneStatsPanel` and `DataStatsPanel`: one `<details>` per
 * entity, hover-revealed destroy button on the summary row, body
 * laid out as labelled key/value tables. Section open/closed state
 * is memoised across re-renders so a Scene mutation doesn't snap
 * everything shut.
 *
 * @module demo/panels/modelsPanel/ModelsPanel
 */

import type {Studio} from "../../Studio";
import type {SceneModel} from "../../../model/scene";
import {isDefaultLayerModel} from "../../../model/scene";
import {el} from "../../utils/el";
import {FloatingPanelBase} from "../floatingPanelBase";
import type {ModelsPanelParams} from "./ModelsPanelParams";
import {getSceneCollisionIndex} from "../../../spatial/collision";


// ─────────────────────────────────────────────────────────────────
// CSS — same chrome family as ViewerConfigPanel / SceneStatsPanel.
// ─────────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "xkt-mp-styles";
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
.xkt-mp-panel {
  position: fixed;
  top: 115px;
  right: 17px;
  width: 640px;
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
.xkt-mp-panel *, .xkt-mp-panel *::before, .xkt-mp-panel *::after {
  box-sizing: border-box;
}
.xkt-mp-panel[hidden] { display: none; }

.xkt-mp-panel .xkt-mp-header {
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
.xkt-mp-panel .xkt-mp-header.xkt-mp-dragging { cursor: grabbing; }
.xkt-mp-panel .xkt-mp-title {
  flex: 1;
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  color: #111;
  display: flex;
  align-items: center;
  gap: 8px;
}
.xkt-mp-panel .xkt-mp-title-icon {
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
.xkt-mp-panel .xkt-mp-title-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xkt-mp-panel .xkt-mp-title-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}
.xkt-mp-panel .xkt-mp-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #475569;
  line-height: 1.25;
}
.xkt-mp-panel .xkt-mp-close {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  font: inherit;
  font-size: 18px;
  line-height: 1;
  color: #777;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}
.xkt-mp-panel .xkt-mp-close:hover {
  background: #ececec;
  color: #222;
}

.xkt-mp-panel .xkt-mp-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 14px;
}
.xkt-mp-panel .xkt-mp-empty {
  padding: 24px 12px;
  text-align: center;
  color: #777;
  font-size: 12px;
}

/* Top summary — count of loaded models. */
.xkt-mp-panel .xkt-mp-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  font-size: 11px;
}
.xkt-mp-panel .xkt-mp-summary-k {
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-size: 9.5px;
  font-weight: 600;
}
.xkt-mp-panel .xkt-mp-summary-v {
  font-weight: 600;
  color: #111;
  font-variant-numeric: tabular-nums;
}

/* Section <details> — one per loaded model, mirroring the
 * Views / Scene-Stats / Data-Stats idiom. */
.xkt-mp-panel .xkt-mp-section {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #ececec;
  border-left: 3px solid #2d5e8c;
  border-radius: 6px;
  overflow: hidden;
}
.xkt-mp-panel .xkt-mp-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  user-select: none;
}
.xkt-mp-panel .xkt-mp-section > summary::-webkit-details-marker { display: none; }
.xkt-mp-panel .xkt-mp-section > summary::marker                  { display: none; }
.xkt-mp-panel .xkt-mp-section > summary::before {
  content: "›";
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 120ms ease-out;
  color: #888;
  font-size: 12px;
}
.xkt-mp-panel .xkt-mp-section[open] > summary::before { transform: rotate(90deg); }
.xkt-mp-panel .xkt-mp-section > summary:hover { background: #fafafa; }
.xkt-mp-panel .xkt-mp-section-label {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 650;
  color: #2d5e8c;
  letter-spacing: -0.1px;
}
.xkt-mp-panel .xkt-mp-section-id {
  flex: 1 1 auto;
  min-width: 0;
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: #666;
  background: #f0f0f0;
  border-radius: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-mp-panel .xkt-mp-section-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  font-variant-numeric: tabular-nums;
}
/* Hover-revealed destroy button — same idiom as the Views panel's
 * per-View destroy. */
.xkt-mp-panel .xkt-mp-section-destroy {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  color: #888;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 100ms ease-out, background 100ms ease-out, color 100ms ease-out, border-color 100ms ease-out;
}
.xkt-mp-panel .xkt-mp-section > summary:hover .xkt-mp-section-destroy { opacity: 1; }
.xkt-mp-panel .xkt-mp-section-destroy:hover {
  color: #b73d3d;
  background: #fff3f3;
  border-color: #f0c8c8;
}
.xkt-mp-panel .xkt-mp-section-destroy:focus-visible {
  opacity: 1;
  border-color: #b73d3d;
  box-shadow: 0 0 0 2px rgba(183, 61, 61, 0.18);
}

/* Fast-verb summary buttons — Frame / Show / Hide. Hidden until
 * the summary row is hovered (same idiom as the destroy ×) so
 * the chrome stays calm by default, but the verbs are one click
 * away once the user mouses over a row. Keyboard focus reveals
 * them too; touch surfaces them via the media-query rule below. */
.xkt-mp-panel .xkt-mp-section-action {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #6a7a8a;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 100ms ease-out, background 100ms ease-out, color 100ms ease-out, border-color 100ms ease-out;
}
.xkt-mp-panel .xkt-mp-section > summary:hover .xkt-mp-section-action { opacity: 1; }
.xkt-mp-panel .xkt-mp-section-action:hover {
  color: #2d5e8c;
  background: #eef3f9;
  border-color: #c8d6e6;
}
.xkt-mp-panel .xkt-mp-section-action:focus-visible {
  opacity: 1;
  border-color: #2d5e8c;
  box-shadow: 0 0 0 2px rgba(45, 94, 140, 0.18);
}
.xkt-mp-panel .xkt-mp-section-action svg {
  width: 14px;
  height: 14px;
  display: block;
}
/* Touch / no-hover devices — keep the verbs visible so they're
 * actually reachable. */
@media (hover: none) {
  .xkt-mp-panel .xkt-mp-section-action,
  .xkt-mp-panel .xkt-mp-section-destroy { opacity: 1; }
}

.xkt-mp-panel .xkt-mp-section > .xkt-mp-section-body {
  padding: 6px 10px 10px;
  border-top: 1px solid #f4f4f4;
  background: #fcfcfc;
}

/* Sub-groups inside each model's body — Identity / Source files /
 * Coordinate System / Stats / Actions / Open in. */
.xkt-mp-panel .xkt-mp-group {
  margin: 6px 0;
}
.xkt-mp-panel .xkt-mp-group-label {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #2c7e6f;
  margin: 4px 0 6px;
}

.xkt-mp-panel .xkt-mp-kv {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.xkt-mp-panel .xkt-mp-kv th {
  width: 16ch;
  vertical-align: top;
  padding: 3px 8px 3px 4px;
  text-align: left;
  font-weight: 600;
  color: #2d5e8c;
  font-size: 11px;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xkt-mp-panel .xkt-mp-kv td {
  vertical-align: top;
  padding: 3px 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #111;
  word-break: break-word;
  white-space: pre-line;
}
.xkt-mp-panel .xkt-mp-empty-val { color: #aaa; }

.xkt-mp-panel .xkt-mp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.xkt-mp-panel .xkt-mp-btn {
  padding: 4px 10px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #2d5e8c;
  background: #fff;
  border: 1px solid #c8d6e6;
  border-radius: 5px;
  cursor: pointer;
}
.xkt-mp-panel .xkt-mp-btn:hover { background: #eef3f9; }

.xkt-mp-pill {
  padding: 9px 16px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: #2d5e8c;
  border: 1px solid #1f4669;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.xkt-mp-pill:hover { background: #1f4669; }
.xkt-mp-pill[hidden] { display: none; }
`;


export class ModelsPanel extends FloatingPanelBase {

  private static readonly _instances = new WeakMap<Studio, ModelsPanel>();

  static iconSvg(): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<rect x="3.5" y="4.5" width="17" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>` +
      `<rect x="3.5" y="10"  width="17" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>` +
      `<rect x="3.5" y="15.5" width="17" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>` +
    `</svg>`;
  }

  static getFor(studio: Studio): ModelsPanel | undefined {
    const inst = ModelsPanel._instances.get(studio);
    return inst && !inst._destroyed ? inst : undefined;
  }

  static openFor(params: ModelsPanelParams): ModelsPanel {
    let inst = ModelsPanel._instances.get(params.studio);
    if (inst && !inst._destroyed) {
      inst.show();
      return inst;
    }
    inst = new ModelsPanel(params);
    return inst;
  }

  readonly studio: Studio;

  private _bodyEl!: HTMLElement;
  private _summaryEl!: HTMLElement;
  /**
   * Per-section open/closed memory. Stable keys (`model:<id>`) so
   * re-rendering after a Scene mutation doesn't snap sections shut.
   * Defaults to `true` (a model section opens on first render so
   * the user sees its detail immediately).
   */
  private readonly _openSections = new Map<string, boolean>();
  private readonly _unsubs: Array<() => void> = [];

  constructor(params: ModelsPanelParams) {
    if (!params?.studio) {
      throw new Error("ModelsPanel: studio is required");
    }
    super({
      container:   params.container,
      storageKey:  "xkt-mp-panel",
      classPrefix: "xkt-mp",
    });
    this.studio = params.studio;

    const prior = ModelsPanel._instances.get(this.studio);
    if (prior && !prior._destroyed) prior.destroy();
    ModelsPanel._instances.set(this.studio, this);

    injectStylesOnce();
    this._buildDom();
    this._bindChrome();
    this._attachSceneSubscriptions();
    this._renderBody();

    if (params.visible === false) this.hide(); else this.show();
  }

  destroy(): void {
    if (this._destroyed) return;
    for (const u of this._unsubs) {
      try { u(); } catch { /* ignore */ }
    }
    this._unsubs.length = 0;
    if (ModelsPanel._instances.get(this.studio) === this) {
      ModelsPanel._instances.delete(this.studio);
    }
    super.destroy();
  }


  // ── DOM ───────────────────────────────────────────────────────

  protected _buildDom(): void {
    this._pill = el("button", "xkt-mp-pill", {
      type: "button",
      title: "Reopen Models",
      hidden: true,
      textContent: "Models",
    }) as HTMLButtonElement;

    this._panel = el("div", "xkt-mp-panel");

    this._header = el("div", "xkt-mp-header");
    const title = el("h2", "xkt-mp-title");
    title.innerHTML =
      `<span class="xkt-mp-title-icon">${ModelsPanel.iconSvg()}</span>` +
      `<span class="xkt-mp-title-stack">` +
        `<span class="xkt-mp-title-text">Models</span>` +
        `<span class="xkt-mp-subtitle">Loaded models, with unload actions.</span>` +
      `</span>`;
    this._closeBtn = el("button", "xkt-mp-close", {
      type: "button",
      "aria-label": "Close Models panel",
      title: "Close",
      innerHTML: "×",
    }) as HTMLButtonElement;
    this._header.append(title, this._closeBtn);
    this._panel.appendChild(this._header);

    this._bodyEl = el("div", "xkt-mp-body");
    this._panel.appendChild(this._bodyEl);

    this._container.appendChild(this._pill);
    this._container.appendChild(this._panel);
  }


  // ── Scene subscriptions — keep the section list live ──────────

  private _attachSceneSubscriptions(): void {
    const ev = (this.studio.scene as any).events;
    if (!ev) return;
    const refresh = () => this._renderBody();
    const sub = (unsub: () => void) => this._unsubs.push(unsub);
    if (ev.onSceneModelCreated?.subscribe)   sub(ev.onSceneModelCreated.subscribe(refresh));
    if (ev.onSceneModelDestroyed?.subscribe) sub(ev.onSceneModelDestroyed.subscribe(refresh));
    if (ev.onSceneObjectCreated?.subscribe)  sub(ev.onSceneObjectCreated.subscribe(refresh));
    if (ev.onSceneObjectDestroyed?.subscribe) sub(ev.onSceneObjectDestroyed.subscribe(refresh));
  }


  // ── Rendering ─────────────────────────────────────────────────

  private _renderBody(): void {
    this._bodyEl.replaceChildren();

    const models = this._loadedSceneModels();

    // Top summary — model count.
    this._summaryEl = el("div", "xkt-mp-summary");
    this._summaryEl.append(
      el("span", "xkt-mp-summary-k", {textContent: "Models"}),
      el("span", "xkt-mp-summary-v", {textContent: String(models.length)}),
    );
    this._bodyEl.appendChild(this._summaryEl);

    if (models.length === 0) {
      this._bodyEl.appendChild(el("div", "xkt-mp-empty", {
        textContent: "No models loaded.",
      }));
      return;
    }

    for (const sceneModel of models) {
      this._bodyEl.appendChild(this._renderModelSection(sceneModel));
    }
  }

  private _renderModelSection(sceneModel: SceneModel): HTMLElement {
    const id = String((sceneModel as any).id);
    const sectionKey = `model:${id}`;
    const dataModel  = (this.studio.data as any).models?.[id];
    const origin     = this.studio.getModelOrigin(id);
    const objectCount = countKeys((sceneModel as any).objects);

    const section = el("details", "xkt-mp-section") as HTMLDetailsElement;
    section.setAttribute("data-kind", "model");

    const memo = this._openSections.get(sectionKey);
    section.open = memo === undefined ? true : memo;
    section.addEventListener("toggle", () => {
      this._openSections.set(sectionKey, section.open);
    });

    // Summary row — id badge, object count, then the fast-verb
    // mini-buttons (Frame / Show / Hide) and the destroy ×. The
    // mini-buttons are hover-revealed so the row stays quiet by
    // default; touch / keyboard get them via the CSS rules above.
    const summary = el("summary");
    summary.append(
      el("span", "xkt-mp-section-label", {textContent: "Model"}),
      el("span", "xkt-mp-section-id", {textContent: id, title: "Model id"}),
      el("span", "xkt-mp-section-count", {
        textContent: `${objectCount} object${objectCount === 1 ? "" : "s"}`,
      }),
      this._mkSummaryAction(`Frame ${id}`, ICON_FRAME, () => this._frame(sceneModel)),
      this._mkSummaryAction(`Show ${id}`,  ICON_EYE,   () => this._setVisible(sceneModel, true)),
      this._mkSummaryAction(`Hide ${id}`,  ICON_EYE_OFF, () => this._setVisible(sceneModel, false)),
    );
    const destroyBtn = el("button", "xkt-mp-section-destroy", {
      type: "button",
      title: `Unload ${id}`,
      "aria-label": `Unload ${id}`,
      innerHTML: "×",
    }) as HTMLButtonElement;
    destroyBtn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    destroyBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this._unload(id);
    });
    summary.appendChild(destroyBtn);
    section.appendChild(summary);

    // Body — labelled key/value groups.
    const body = el("div", "xkt-mp-section-body");
    body.append(
      this._group("Identity", this._kv([
        ["Model id",  id],
        ["DataModel", dataModel ? String(dataModel.id) : null],
        ["Loaded as", origin ? origin.dataSetLabel : null],
      ])),
      this._group("Source files", this._kv(
        origin && origin.fileNames && origin.fileNames.length
          ? origin.fileNames.map((n: string, i: number): [string, string | null] => [`File ${i + 1}`, n])
          : [["Files", null]],
      )),
      this._group("Coordinate system", this._kv(
        (sceneModel as any).coordinateSystem
          ? [
              ["Basis",  fmtVec((sceneModel as any).coordinateSystem.basis)],
              ["Origin", fmtVec((sceneModel as any).coordinateSystem.origin)],
              ["Units",  (sceneModel as any).coordinateSystem.units ?? null],
            ]
          : [["Basis", null]],
      )),
      this._group("Stats", this._kv([
        ["Objects",      String(objectCount)],
        ["Meshes",       String(countKeys((sceneModel as any).meshes))],
        ["Geometries",   String(countKeys((sceneModel as any).geometries))],
        ["Materials",    String(countKeys((sceneModel as any).materials))],
        ["Data objects", dataModel ? String(countKeys((dataModel as any).objects)) : null],
        ["AABB",         fmtAabb(this._modelAabb(sceneModel))],
      ])),
      this._group("Open in", this._buttonRow([
        ["Scene Health", () => this.studio.panels.open("sceneHealth", {focusSceneModel: sceneModel})],
        ["Data Health",  () => this.studio.panels.open("dataHealth",  {focusDataModel: dataModel ?? undefined})],
        ["Explorer",     () => this.studio.panels.open("explorerPanel")],
        ["Boundaries",   () => this.studio.panels.open("boundariesPanel")],
      ])),
    );
    section.appendChild(body);

    return section;
  }

  private _group(label: string, content: HTMLElement): HTMLElement {
    const group = el("div", "xkt-mp-group");
    group.append(
      el("div", "xkt-mp-group-label", {textContent: label}),
      content,
    );
    return group;
  }

  private _kv(rows: Array<[string, string | null]>): HTMLElement {
    const table = el("table", "xkt-mp-kv");
    for (const [k, v] of rows) {
      const tr = el("tr");
      tr.appendChild(el("th", undefined, {textContent: k, title: k}));
      const td = el("td");
      if (v === null || v === "") {
        td.classList.add("xkt-mp-empty-val");
        td.textContent = "—";
      } else {
        td.textContent = v;
      }
      tr.appendChild(td);
      table.appendChild(tr);
    }
    return table;
  }

  /**
   * Build one of the small summary-row action buttons (Frame /
   * Show / Hide). `pointerdown` is stopped on the button so a
   * click doesn't also toggle the parent `<details>` open/closed.
   */
  private _mkSummaryAction(
    title: string,
    svg: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = el("button", "xkt-mp-section-action", {
      type: "button",
      title,
      "aria-label": title,
      innerHTML: svg,
    }) as HTMLButtonElement;
    btn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onClick();
    });
    return btn;
  }

  private _buttonRow(entries: Array<[string, () => void]>): HTMLElement {
    const row = el("div", "xkt-mp-actions");
    for (const [label, onClick] of entries) {
      const btn = el("button", "xkt-mp-btn", {
        type: "button",
        textContent: label,
      }) as HTMLButtonElement;
      btn.addEventListener("click", () => onClick());
      row.appendChild(btn);
    }
    return row;
  }


  // ── Action helpers ────────────────────────────────────────────

  private _frame(sceneModel: SceneModel): void {
    const aabb = this._modelAabb(sceneModel);
    if (!aabb) return;
    const flight = this._cameraFlight();
    if (!flight) return;
    flight.jumpTo({aabb});
  }

  private _setVisible(sceneModel: SceneModel, visible: boolean): void {
    const view = this.studio.viewer?.viewList?.[0];
    if (!view) return;
    const ids = Object.keys((sceneModel as any).objects ?? {});
    if (ids.length > 0) view.setObjectsVisible(ids, visible);
  }

  private _unload(modelId: string): void {
    this.studio.destroyModel(modelId);
  }

  private _cameraFlight(): any {
    const view = this.studio.viewer?.viewList?.[0];
    if (!view) return null;
    return this.studio.viewManager.views?.[view.id]?.cameraFlight ?? null;
  }

  private _modelAabb(sceneModel: SceneModel): number[] | null {
    const idx: any = this.studio.picking?.collisionIndex
      ?? getSceneCollisionIndex(this.studio.scene as any);
    if (!idx?.getCombinedObjectAABB) return null;
    const ids = Object.keys((sceneModel as any).objects ?? {});
    if (ids.length === 0) return null;
    const aabb = idx.getCombinedObjectAABB(ids);
    return aabb ? Array.from(aabb) : null;
  }


  // ── Data helpers ──────────────────────────────────────────────

  private _loadedSceneModels(): SceneModel[] {
    const models = (this.studio.scene as any)?.models as Record<string, SceneModel> | undefined;
    if (!models) return [];
    return Object.values(models).filter(m =>
      !(m as any).destroyed && isDefaultLayerModel(m as SceneModel),
    );
  }
}


// ─────────────────────────────────────────────────────────────────
// Inline summary-row icons — monochrome 24x24, currentColor strokes,
// matching the toolbar's 1.6-stroke / rounded-cap idiom.
// ─────────────────────────────────────────────────────────────────

const ICON_FRAME =
  `<svg viewBox="0 0 24 24" aria-hidden="true">` +
    // Corner brackets (fit-to-frame).
    `<path d="M3 8 L3 4 L7 4 M17 4 L21 4 L21 8 M21 16 L21 20 L17 20 M7 20 L3 20 L3 16" ` +
          `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
  `</svg>`;

const ICON_EYE =
  `<svg viewBox="0 0 24 24" aria-hidden="true">` +
    `<ellipse cx="12" cy="12" rx="9" ry="6" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
    `<circle cx="12" cy="12" r="2.5" fill="currentColor"/>` +
  `</svg>`;

const ICON_EYE_OFF =
  `<svg viewBox="0 0 24 24" aria-hidden="true">` +
    `<ellipse cx="12" cy="12" rx="9" ry="6" ` +
            `fill="none" stroke="currentColor" stroke-width="1.6"/>` +
    `<circle cx="12" cy="12" r="2.5" fill="currentColor"/>` +
    // Slash from upper-left to lower-right marks the eye as off.
    `<path d="M4 4 L20 20" ` +
          `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
  `</svg>`;


function countKeys(obj: unknown): number {
  return obj && typeof obj === "object" ? Object.keys(obj as Record<string, unknown>).length : 0;
}

function fmtVec(v: ArrayLike<number> | undefined | null): string | null {
  if (!v || (v as any).length === 0) return null;
  const arr = Array.from(v as ArrayLike<number>);
  return `[${arr.map(n => formatNumber(n)).join(", ")}]`;
}

function fmtAabb(a: number[] | null): string | null {
  if (!a || a.length !== 6) return null;
  return `min ${fmtVec(a.slice(0, 3))}\nmax ${fmtVec(a.slice(3, 6))}`;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1000 || abs < 0.001) return n.toExponential(2);
  return Number(n.toFixed(3)).toString();
}
