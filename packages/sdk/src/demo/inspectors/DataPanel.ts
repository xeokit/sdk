import { Data, DataEvents, DataModel, type DataModelStats } from "../../data";
import {FloatingPanelFlowHost} from "./FloatingPanelFlowHost";

function erDiagramIconDataUri(): string {
  // Redesigned ER diagram: three entities, two relationships (one crow's foot)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <rect x="7" y="10" width="18" height="13" rx="3" fill="#fff" stroke="#888" stroke-width="2"/>
  <rect x="35" y="10" width="18" height="13" rx="3" fill="#fff" stroke="#888" stroke-width="2"/>
  <rect x="21" y="37" width="18" height="13" rx="3" fill="#fff" stroke="#888" stroke-width="2"/>
  <!-- One-to-many relationship (crow's foot) -->
  <line x1="16" y1="23" x2="30" y2="37" stroke="#4a90e2" stroke-width="2"/>
  <polyline points="30,37 27,40 30,43" fill="none" stroke="#4a90e2" stroke-width="2"/>
  <polyline points="30,37 33,40 30,43" fill="none" stroke="#4a90e2" stroke-width="2"/>
  <!-- One-to-one relationship -->
  <line x1="44" y1="23" x2="30" y2="37" stroke="#4a90e2" stroke-width="2"/>
  <!-- Entity labels -->
  <text x="16" y="19" font-size="7" text-anchor="middle" fill="#444" font-family="sans-serif">A</text>
  <text x="44" y="19" font-size="7" text-anchor="middle" fill="#444" font-family="sans-serif">B</text>
  <text x="30" y="47" font-size="7" text-anchor="middle" fill="#444" font-family="sans-serif">C</text>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Floating, dependency-free HTML view that shows a list of DataModelStats panels,
 * one per DataModel, and keeps them in sync with DataEvents.
 *
 * - Immediately populates itself from existing Data#models on show().
 * - Creates/destroys per-model panels when DataModels are created/destroyed.
 * - Collapsible master panel + each model row collapsible.
 * - Absolutely-positioned floating host.
 *
 * Usage:
 *   const view = DataPanel.show(data, { corner: "top-right" });
 *   // later:
 *   view.destroy();
 */
export class DataPanel {
  static #HOST_ID = "__dms_multi_floating_host__";
  static #STYLE_ID = "__dms_multi_style__";
  static #MASTER_STATE_KEY = "__dms_multi_collapsed__";

  #data: Data;
  #events: DataEvents;
  #opts: any;

  #modelPanels = new Map<string, { root: HTMLElement; body: HTMLElement; collapsed: boolean }>();
  #unsubs: Array<() => void> = [];

  // cached DOM refs (avoid brittle querySelector for data-* attrs)
  #listEl: HTMLElement | null = null;
  #countEl: HTMLElement | null = null;
  #tileEl: HTMLElement | null = null;


  private constructor(flowHost: HTMLDivElement, data: Data, opts: any = {}) {
    this.#data = data;
    this.#events = data.events;
    this.#opts = opts;

    DataPanel.#ensureGlobalStyle();

    const root = this.render();
    const tile = FloatingPanelFlowHost.mountTile(root, {
      tileMinWidth: opts.tileMinWidth ?? opts.maxWidth ?? 420,
      tileMaxWidth: opts.tileMaxWidth ?? opts.maxWidth ?? 440,
    });

    flowHost.appendChild(tile);
    this.#tileEl = tile;


    // Populate immediately from existing Data#models
    this.#populateFromDataModels();

    // Listen for create/destroy going forward
    this.#wireEvents();
  }

  static show(
    flowHost: HTMLDivElement,
    data: Data,
    opts: {
      corner?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
      maxWidth?: number;
      zIndex?: number;
      startCollapsed?: boolean;
      startModelsCollapsed?: boolean;
      title?: string;
      subtitle?: string;
      maxHeightVh?: number; // default 90
    } = {}
  ) {
    return new DataPanel(flowHost, data, opts);
  }

  destroy() {
    for (const u of this.#unsubs) {
      try {
        u();
      } catch {
        // ignore
      }
    }
    this.#unsubs.length = 0;
    this.#modelPanels.clear();

    const host = document.getElementById(DataPanel.#HOST_ID);
    if (host) host.remove();
  }

  // ---------------------------------------------------------------------------
  // Initial population
  // ---------------------------------------------------------------------------

  #populateFromDataModels() {
    // Assuming Data#models is a plain object map (mirroring your Scene example)
    const models = Object.values(this.#data.models);
    for (const m of models) {
      this.#addModel(m);
    }
  }



  static #ensureGlobalStyle() {
    if (document.getElementById(this.#STYLE_ID)) return;

    const s = document.createElement("style");
    s.id = this.#STYLE_ID;
    s.textContent = DEFAULT_CSS;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  render() {
    const root = el("div", { className: "dmsm-root" });

    const collapsed = readBool(
      DataPanel.#MASTER_STATE_KEY,
      !!this.#opts.startCollapsed
    );

    const header = this.renderHeader({ collapsed });
    const body = this.renderBody();

    root.appendChild(header);
    root.appendChild(body);

    this.#setMasterCollapsed(root, collapsed);

    const toggleBtn = header.querySelector<HTMLButtonElement>("[data-dmsm-toggle]");
    toggleBtn?.addEventListener("click", () => {
      const nowCollapsed = !root.classList.contains("dmsm-collapsed");
      this.#setMasterCollapsed(root, nowCollapsed);
      writeBool(DataPanel.#MASTER_STATE_KEY, nowCollapsed);
    });

    return root;
  }

  renderHeader({ collapsed }: { collapsed: boolean }) {
    const title = this.#opts.title ?? "Data";
    const subtitle =
      this.#opts.subtitle ??
      "Data model statistics";

    const header = el("div", { className: "dmsm-header" });

    // Icon (ER diagram)
    const icon = el("img", {
      className: "dmsm-title-icon",
      width: 40,
      height: 40,
      alt: "ER diagram",
      src: erDiagramIconDataUri(),
      draggable: false,
    });

    // Title and subtitle stacked vertically, left-justified
    const textCol = el("div", { className: "dmsm-title-col" }, [
      el("div", { className: "dmsm-h1", textContent: title }),
      el("div", { className: "dmsm-subtitle", textContent: subtitle }),
    ]);

    // Flex row: icon | textCol
    header.appendChild(icon);
    header.appendChild(textCol);

    return header;
  }


  renderBody() {
    const body = el("div", { className: "dmsm-body" });

    body.appendChild(
      el("div", { className: "dmsm-toolbar" }, [
        el("div", { className: "dmsm-toolbar-left" }, [
          el("span", { className: "dmsm-k", textContent: "DataModels:" }),
          el("span", { className: "dmsm-v", textContent: String(this.#modelPanels.size) }),
        ]),
        // el("div", { className: "dmsm-toolbar-right" }, [
        //   el("button", {
        //     className: "dmsm-btn dmsm-btn--sub",
        //     textContent: "Refresh all",
        //     title: "Re-read model.stats for all panels",
        //     ["data-dmsm-refresh-all" as any]: "",
        //   }),
        //   el("button", {
        //     className: "dmsm-btn dmsm-btn--sub",
        //     textContent: "Collapse all",
        //     ["data-dmsm-collapse-all" as any]: "",
        //   }),
        //   el("button", {
        //     className: "dmsm-btn dmsm-btn--sub",
        //     textContent: "Expand all",
        //     ["data-dmsm-expand-all" as any]: "",
        //   }),
        // ]),
      ])
    );

    this.#countEl = body.querySelector<HTMLElement>(".dmsm-v");

    const list = el("div", { className: "dmsm-list" });
    body.appendChild(list);
    this.#listEl = list;

    body
      .querySelector<HTMLButtonElement>("[data-dmsm-collapse-all]")
      ?.addEventListener("click", () => this.#setAllModelsCollapsed(true));
    body
      .querySelector<HTMLButtonElement>("[data-dmsm-expand-all]")
      ?.addEventListener("click", () => this.#setAllModelsCollapsed(false));
    body
      .querySelector<HTMLButtonElement>("[data-dmsm-refresh-all]")
      ?.addEventListener("click", () => this.refreshAll());

    return body;
  }

  refreshAll() {
    const models = Object.values(this.#data.models);
    for (const m of models) this.#refreshModel(m);
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------

  #wireEvents() {
    const sub = <A, B>(emitter: any, handler: (a: A, b: B) => void): (() => void) => {
      if (emitter?.subscribe) {
        const token = emitter.subscribe(handler);
        if (typeof token === "function") return token;
        if (token?.unsubscribe) return () => token.unsubscribe();
        if (token?.dispose) return () => token.dispose();
      }
      if (emitter?.on) {
        emitter.on(handler);
        return () => emitter.off?.(handler);
      }
      if (emitter?.addListener) {
        emitter.addListener(handler);
        return () => emitter.removeListener?.(handler);
      }
      emitter?.add?.(handler);
      return () => emitter?.remove?.(handler);
    };

    this.#unsubs.push(
      sub<Data, DataModel>(this.#events.onDataModelCreated, (_data, model) => {
        this.#addModel(model);
      })
    );

    this.#unsubs.push(
      sub<Data, DataModel>(this.#events.onDataModelDestroyed, (_data, model) => {
        this.#removeModel(model);
      })
    );

    this.#unsubs.push(
      sub<Data, void>(this.#events.onDataDestroyed, () => {
        this.destroy();
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Model panel management
  // ---------------------------------------------------------------------------

// In #addModel, always start collapsed:
  #addModel(model: DataModel) {
    const id = this.#getModelId(model);
    if (this.#modelPanels.has(id)) return;

    const list = this.#listEl;
    if (!list) return;

    // Always start collapsed
    const startCollapsed = true;

    const panel = this.#renderModelPanel(model, startCollapsed);
    list.appendChild(panel.root);

    this.#modelPanels.set(id, panel);
    this.#updateModelCount();
  }

  #removeModel(model: DataModel) {
    const id = this.#getModelId(model);
    const panel = this.#modelPanels.get(id);
    if (!panel) return;

    panel.root.remove();
    this.#modelPanels.delete(id);
    this.#updateModelCount();
  }

  #refreshModel(model: DataModel) {
    const id = this.#getModelId(model);
    const panel = this.#modelPanels.get(id);
    if (!panel) return;

    const stats = (model as any)?.stats as DataModelStats | null | undefined;
    const newBody = this.#renderStatsBody(stats);

    panel.body.replaceChildren(...Array.from(newBody.childNodes));
  }

  #renderModelPanel(model: DataModel, startCollapsed: boolean) {
    const root = el("div", { className: "dmsm-model" });

    const header = el("div", { className: "dmsm-model-head" });
    const title = el("div", { className: "dmsm-model-title" });

    const caret = el("span", {
      className: "dmsm-model-caret",
      textContent: startCollapsed ? "▸" : "▾",
    });

    const name = el("span", {
      className: "dmsm-model-name",
      textContent: this.#getModelLabel(model),
      title: "DataModel",
    });

    title.appendChild(caret);
    title.appendChild(name);

    header.appendChild(title);

    const viewJsonBtn = el("button", {
      className: "datapanel-viewjson-btn",
      type: "button",
      textContent: "JSON",
      onclick: (e: MouseEvent) => {
        e.stopPropagation();
          const result = model.toParams();
          if (result.ok!== false) {
            try {
              openJsonInNewTab(result.value, model.id ? `DataModel: ${model.id}` : "DataModel JSON");
            } catch (err) {
              alert("Failed to export DataModel as JSON: " + (err && (err as any).message || err));
            }
          }
      }
    });

    header.appendChild(viewJsonBtn);

    const body = el("div", { className: "dmsm-model-body" });
    body.appendChild(this.#renderStatsBody((model as any)?.stats));

    root.appendChild(header);
    root.appendChild(body);

    setCollapsed(root, body, caret, startCollapsed);

    header.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("button")) return;
      const nowCollapsed = !root.classList.contains("dmsm-model-collapsed");
      setCollapsed(root, body, caret, nowCollapsed);
    });


    return { root, body, collapsed: startCollapsed };

    function setCollapsed(rootEl: HTMLElement, bodyEl: HTMLElement, caretEl: HTMLElement, collapsed: boolean) {
      rootEl.classList.toggle("dmsm-model-collapsed", collapsed);
      bodyEl.style.display = collapsed ? "none" : "block";
      caretEl.textContent = collapsed ? "▸" : "▾";
    }
  }

  #renderStatsBody(stats: DataModelStats | null | undefined) {
    const wrap = el("div", { className: "dmsm-stats" });

    if (!stats) {
      wrap.appendChild(
        el("div", {
          className: "dmsm-empty",
          textContent: "No stats available (model.stats is null/undefined).",
        })
      );
      return wrap;
    }

    // wrap.appendChild(
    //   el("div", { className: "dmsm-chips" }, [
    //     chip("Objects", formatNumber(stats.numObjects)),
    //     chip("Relationships", formatNumber(stats.numRelationships)),
    //     chip("PropertySets", formatNumber(stats.numPropertySets)),
    //   ])
    // );

    const rows: Array<[string, string]> = [
      ["DataObjects", formatNumber(stats.numObjects)],
      ["Relationships", formatNumber(stats.numRelationships)],
      ["PropertySets", formatNumber(stats.numPropertySets)],
    ];

    const table = el("table", { className: "dmsm-table" });
    for (const [k, v] of rows) {
      const tr = el("tr");
      tr.appendChild(el("th", { textContent: k }));
      tr.appendChild(el("td", { textContent: v }));
      table.appendChild(tr);
    }
    wrap.appendChild(table);

    return wrap;

    function chip(label: string, value: string) {
      const c = el("div", { className: "dmsm-chip" });
      c.appendChild(el("div", { className: "dmsm-chip-label", textContent: label }));
      c.appendChild(el("div", { className: "dmsm-chip-value", textContent: value }));
      return c;
    }
  }

  #setMasterCollapsed(root: HTMLElement, collapsed: boolean) {
    root.classList.toggle("dmsm-collapsed", collapsed);

    const body = root.querySelector<HTMLElement>(".dmsm-body");
    if (body) body.style.display = collapsed ? "none" : "block";

    const caret = root.querySelector<HTMLElement>("[data-dmsm-caret]");
    if (caret) caret.textContent = collapsed ? "▸" : "▾";

    const state = root.querySelector<HTMLElement>("[data-dmsm-state]");
    if (state) state.textContent = collapsed ? "Collapsed" : "Expanded";
  }

  #setAllModelsCollapsed(collapsed: boolean) {
    for (const entry of this.#modelPanels.values()) {
      const caret = entry.root.querySelector<HTMLElement>(".dmsm-model-caret");
      entry.root.classList.toggle("dmsm-model-collapsed", collapsed);
      entry.body.style.display = collapsed ? "none" : "block";
      if (caret) caret.textContent = collapsed ? "▸" : "▾";
      entry.collapsed = collapsed;
    }
  }

  #updateModelCount() {
    if (this.#countEl) this.#countEl.textContent = String(this.#modelPanels.size);
  }

  #getModelId(model: any) {
    return String(model?.id ?? model?.uuid ?? model?._id ?? model?.name ?? "DataModel");
  }

  #getModelLabel(model: any) {
    const id = this.#getModelId(model);
    const name = model?.name;
    return name && String(name) !== id ? `${name} (${id})` : id;
  }
}

// -----------------------------------------------------------------------------
// Small DOM utilities (no framework)
// -----------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: any = {},
  children: Array<Node> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) (node as any)[key] = value;
  for (const child of children) node.appendChild(child);
  return node;
}

function formatNumber(v: any): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v ?? "—");
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean) {
  try {
    sessionStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore
  }
}

// -----------------------------------------------------------------------------
// Default CSS (namespaced to dmsm-*)
// -----------------------------------------------------------------------------

const DEFAULT_CSS = `
.dmsm-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px; background: rgba(255,255,255,0.96); border: 1px solid #e6e6e6; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14); backdrop-filter: blur(2px); }
.dmsm-header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
}
.dmsm-title-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 4px;
}
.dmsm-title-icon {
  width: 60px;
  height: 60px;
  flex: 0 0 60px;
  border-radius: 14px;
  border: 1.5px solid #e6e6e6;
  background: #fafafa;
  padding: 6px;
}
.dmsm-title { display: grid; gap: 4px; }
.dmsm-h1 {   padding-top:10px;  font-size: 24px; color: #666666; font-weight: 650; }
.dmsm-subtitle { font-size: 12px; color: #444; line-height: 1.35; }

.dmsm-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.dmsm-caret { font-size: 14px; color: #444; width: 18px; text-align: center; }
.dmsm-btn { font-size: 12px; border-radius: 10px; padding: 6px 10px; border: 1px solid #e6e6e6; background: #fff; cursor: pointer; }
.dmsm-btn:hover { background: #fafafa; }
.dmsm-btn--sub { padding: 5px 8px; border-radius: 10px; font-size: 11px; }

.dmsm-status { display: flex; gap: 8px; align-items: baseline; }
.dmsm-status-label { font-size: 12px; color: #666; }
.dmsm-status-value { font-size: 12px; font-weight: 600; }

.dmsm-body { margin-top: 12px; }
.dmsm-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
.dmsm-toolbar-left { display: flex; gap: 8px; align-items: baseline; }
.dmsm-k { font-size: 12px; color: #666; }
.dmsm-v { font-size: 12px; font-weight: 650; }

.dmsm-list { display: grid; gap: 10px; }

.dmsm-model { border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; }
.dmsm-model-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; }
.dmsm-model-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dmsm-model-caret { width: 18px; text-align: center; color: #444; }
.dmsm-model-name { font-size: 12px; font-weight: 650; word-break: break-word; }
.dmsm-model-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }

.dmsm-model-body { padding: 10px 12px 12px; border-top: 1px solid #f0f0f0; }
.dmsm-empty { font-size: 12px; color: #777; }

.dmsm-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.dmsm-chip { border: 1px solid #e6e6e6; border-radius: 999px; padding: 7px 9px; display: flex; gap: 8px; align-items: baseline; }
.dmsm-chip-label { font-size: 11px; color: #666; }
.dmsm-chip-value { font-size: 11px; font-weight: 650; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

.dmsm-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dmsm-table th { text-align: left; color: #666; font-weight: 600; width: 160px; padding: 6px 8px; vertical-align: top; }
.dmsm-table td { padding: 6px 8px; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.dmsm-table tr + tr td, .dmsm-table tr + tr th { border-top: 1px solid #f0f0f0; }

.datapanel-viewjson-btn {
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 7px;
  border: 1px solid #e6e6e6;
  background: #f7fafc;
  color: #2d5e8c;
  font-weight: 650;
  cursor: pointer;
  margin-left: 12px;
  transition: background 0.13s;
}
.datapanel-viewjson-btn:hover {
  background: #e6f0fa;
  border-color: #b3c6e0;
}
`;


// Helper: syntax highlight JSON (basic)
function syntaxHighlightJson(json: string): string {
  // Escape HTML
  json = json.replace(/[&<>]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;'
  }[c] || c));
  // Highlight
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        if (/:$/.test(match)) cls = "json-key";
        else cls = "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

// Helper: open JSON in new tab with syntax highlighting
function openJsonInNewTab(obj: any, title = "DataModel JSON") {
  const json = JSON.stringify(obj, null, 2);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta charset="utf-8"/>
  <style>
    body { background: #0f1116; color: #e7e7e7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; padding: 0; }
    .json-pre {
      background: #0f1116;
      border-radius: 10px;
      margin: 24px 0 24px 24px;
      padding: 24px 32px;
      max-width: 900px;
      font-size: 15px;
      box-shadow: 0 4px 24px #0001;
      color: #e7e7e7;
      text-align: left;
    }
    .json-key { color: #7ec7e6; font-weight: 600; }
    .json-string { color: #ffe7b3; }
    .json-number { color: #b3e6c7; }
    .json-boolean { color: #ffd57a; }
    .json-null { color: #888; }
    h1 { color: #fff; font-size: 20px; font-weight: 650; margin: 0 0 12px 0; }
    .meta { color: #aaa; font-size: 13px; margin-bottom: 18px; }
  </style>
</head>
<body>
     <h1>${escapeHtml(title)}</h1>
           <div class="meta">Serialized to JSON</div>
  <pre class="json-pre">${syntaxHighlightJson(json)}</pre>
</body>
</html>
  `.trim();
  const win = window.open();
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}


function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
