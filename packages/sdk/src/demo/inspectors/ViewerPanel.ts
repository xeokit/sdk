import type { ViewerParams } from "../../viewer/ViewerParams";
import type { ViewParams } from "../../viewer/ViewParams";
import type { ViewLayerParams } from "../../viewer/ViewLayerParams";
import { FloatingPanelFlowHost } from "./FloatingPanelFlowHost";

// DOM util
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: any = {},
  children: Array<Node> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("data-")) {
      node.setAttribute(key, String(value ?? ""));
      continue;
    }
    if (key === "style" && value && typeof value === "object") {
      Object.assign((node as any).style, value);
      continue;
    }
    (node as any)[key] = value;
  }
  for (const child of children) node.appendChild(child);
  return node;
}

// -----------------------------------------------------------------------------
// Formatting helpers
// -----------------------------------------------------------------------------

function isPlainObject(v: any) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  // Truncate (not round) to 2 decimals
  const t = Math.trunc(n * 100) / 100;
  if (Math.abs(t - Math.trunc(t)) < 1e-12) return String(Math.trunc(t));
  return t.toFixed(2);
}

function formatValueInline(val: any): string {
  if (val == null) return "—";
  if (typeof val === "number") return formatNumber(val);
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return `[${val.map((x) => formatValueInline(x)).join(", ")}]`;
  if (isPlainObject(val)) {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function renderValueNode(val: any): Node {
  if (val == null || typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    const cls =
      typeof val === "string"
        ? "vp-val vp-val--str"
        : typeof val === "number"
          ? "vp-val vp-val--num"
          : typeof val === "boolean"
            ? "vp-val vp-val--bool"
            : "vp-val vp-val--null";
    return el("span", { className: cls, textContent: formatValueInline(val) });
  }

  if (Array.isArray(val)) {
    return el("span", { className: "vp-val vp-val--arr", textContent: formatValueInline(val) });
  }

  if (isPlainObject(val)) {
    return renderObjectInlineTable(val);
  }

  return el("span", { className: "vp-val", textContent: String(val) });
}

/**
 * Make label column snug BUT aligned:
 * - We measure the longest key text (in characters) for the given KV table.
 * - Set CSS var `--vp-keyw` in `ch` units on that table.
 * - CSS uses a fixed width for the key column based on that var, so all rows align.
 */
function applyKeyColumnWidth(table: HTMLElement, keys: string[]) {
  const maxLen = keys.reduce((m, k) => Math.max(m, (k ?? "").length), 0);

  // Keep "snug": clamp to a sane range so values still have room.
  const minCh = 10;
  const maxCh = 28;
  const keyCh = Math.max(minCh, Math.min(maxCh, maxLen + 2)); // +2 for a little breathing room

  (table as HTMLElement).style.setProperty("--vp-keyw", `${keyCh}ch`);
}

function renderObjectInlineTable(obj: any): HTMLElement {
  const table = el("table", { className: "vp-table vp-table--kv vp-table--nested" });

  const entries = Object.entries(obj || {});
  entries.sort((a, b) => a[0].localeCompare(b[0]));

  applyKeyColumnWidth(table, entries.map((e) => e[0]));

  for (const [k, v] of entries) {
    const tr = el("tr", { className: "vp-row" });

    const th = el("th", {}, [
      el("div", { className: "vp-key" }, [el("span", { className: "vp-keytext", textContent: k })]),
    ]);

    const td = el("td", { className: "vp-cell" });
    td.appendChild(renderValueNode(v) as any);

    tr.appendChild(th);
    tr.appendChild(td);
    table.appendChild(tr);
  }

  return table;
}

// -----------------------------------------------------------------------------
// Icon + JSON tab inspectors (unchanged)
// -----------------------------------------------------------------------------

function viewerIconDataUri(): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
<ellipse cx="30" cy="30" rx="24" ry="14" fill="#e0e7ef" stroke="#b3c6e0" stroke-width="2"/>
<ellipse cx="30" cy="30" rx="10" ry="10" fill="#7ec7e6" stroke="#2d5e8c" stroke-width="2"/>
<ellipse cx="30" cy="30" rx="4" ry="4" fill="#fff" stroke="#2d5e8c" stroke-width="1"/>
<ellipse cx="30" cy="30" rx="2" ry="2" fill="#2d5e8c"/>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function openJsonInNewTab(obj: any, title = "ViewerParams JSON") {
  let json = JSON.stringify(obj, null, 2);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta charset="utf-8"/>
  <style>
    body { background: #0f1116; color: #e7e7e7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; padding: 0; }
    .json-pre { background: #0f1116; border-radius: 10px; margin: 24px 0 24px 24px; padding: 24px 32px; max-width: 900px; font-size: 15px; box-shadow: 0 4px 24px #0001; color: #e7e7e7; text-align: left; }
    h1 { color: #fff; font-size: 20px; font-weight: 650; margin: 0 0 12px 0; padding: 24px 0 0 24px; }
    .meta { color: #aaa; font-size: 13px; margin: 0 0 18px 24px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Serialized to JSON</div>
  <pre class="json-pre">${json.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c] as string))}</pre>
</body>
</html>
  `.trim();
  const win = window.open();
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export class ViewerPanel {
  static #STYLE_ID = "__viewerpanel_style__";

  #params: ViewerParams;
  #opts: any;
  #tileEl: HTMLElement | null = null;

  private constructor(flowHost: HTMLDivElement, params: ViewerParams, opts: any = {}) {
    this.#params = params;
    this.#opts = opts;

    ViewerPanel.#ensureGlobalStyle();

    const root = this.render();
    const tile = FloatingPanelFlowHost.mountTile(root, {
      tileMinWidth: opts.tileMinWidth ?? 880,
      tileMaxWidth: opts.tileMaxWidth ?? 880,
    });

    flowHost.appendChild(tile);
    this.#tileEl = tile;
  }

  static show(
    flowHost: HTMLDivElement,
    params: ViewerParams,
    opts: {
      corner?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
      maxWidth?: number;
      zIndex?: number;
      title?: string;
      subtitle?: string;
      maxHeightVh?: number;
    } = {}
  ) {
    return new ViewerPanel(flowHost, params, opts);
  }

  destroy() {
    if (this.#tileEl) this.#tileEl.remove();
  }

  render() {
    const root = el("div", { className: "vp-root" });
    root.appendChild(this.renderHeader());
    root.appendChild(this.renderBody());
    return root;
  }

  renderHeader() {
    const title = this.#opts.title ?? "Viewer";
    const subtitle = this.#opts.subtitle ?? "Viewer configuration";

    const header = el("div", { className: "vp-header" });

    const icon = el("img", {
      className: "vp-title-icon",
      width: 60,
      height: 60,
      alt: "Viewer",
      src: viewerIconDataUri(),
      draggable: false,
    });

    const textCol = el("div", { className: "vp-title-col" }, [
      el("div", { className: "vp-h1", textContent: title }),
      el("div", { className: "vp-subtitle", textContent: subtitle }),
    ]);

    const jsonBtn = el("button", {
      className: "vp-btn vp-btn--sub",
      textContent: "JSON",
      onclick: (e: MouseEvent) => {
        e.stopPropagation();
        openJsonInNewTab(this.#params, "ViewerParams JSON");
      },
    });

    const actions = el("div", { className: "vp-actions" }, [jsonBtn]);
    header.appendChild(icon);
    header.appendChild(textCol);
    header.appendChild(actions);

    return header;
  }

  renderBody() {
    const body = el("div", { className: "vp-body" });

    const summary = el("div", { className: "vp-summary" }, [
      el("div", { className: "vp-k", textContent: "ID:" }),
      el("div", { className: "vp-v", textContent: this.#params.id ?? "—" }),
      el("div", { className: "vp-k", textContent: "Views:" }),
      el("div", { className: "vp-v", textContent: String(this.#params.views?.length ?? 0) }),
    ]);
    body.appendChild(summary);

    if (this.#params.views && this.#params.views.length) {
      for (const view of this.#params.views) body.appendChild(this.renderViewSection(view));
    } else {
      body.appendChild(el("div", { className: "vp-empty", textContent: "No views defined." }));
    }

    return body;
  }

  renderViewSection(view: ViewParams) {
    const id = view.id ?? "View";
    const section = el("div", { className: "vp-section" });

    const summary = el("div", { className: "vp-section-summary" });
    const caret = el("span", { className: "vp-caret", textContent: "▸" });
    const label = el("span", { className: "vp-section-label", textContent: id });
    summary.appendChild(caret);
    summary.appendChild(label);

    const body = el("div", { className: "vp-section-body" });
    body.appendChild(this.renderViewTable(view));
    body.style.display = "none";

    summary.addEventListener("click", () => {
      const collapsed = body.style.display !== "block";
      body.style.display = collapsed ? "block" : "none";
      caret.textContent = collapsed ? "▾" : "▸";
    });

    section.appendChild(summary);
    section.appendChild(body);
    return section;
  }

  renderViewTable(view: ViewParams) {
    const table = el("table", { className: "vp-table vp-table--kv" });

    const entries = Object.entries(view);
    const score = (k: string, v: any) => {
      if (k === "layers") return 3;
      if (Array.isArray(v) || isPlainObject(v)) return 2;
      return 1;
    };
    entries.sort((a, b) => score(a[0], a[1]) - score(b[0], b[1]) || a[0].localeCompare(b[0]));

    applyKeyColumnWidth(table, entries.map((e) => e[0]));

    for (const [k, v] of entries) {
      const tr = el("tr", { className: "vp-row" });

      const th = el("th", {}, [
        el("div", { className: "vp-key" }, [el("span", { className: "vp-keytext", textContent: k })]),
      ]);

      const td = el("td", { className: "vp-cell" });

      if (k === "layers" && Array.isArray(v)) {
        const head = el("div", { className: "vp-subhead" }, [
          el("span", { className: "vp-subhead-title", textContent: "layers" }),
          el("span", { className: "vp-pill", textContent: `${v.length} layer${v.length === 1 ? "" : "s"}` }),
        ]);
        td.appendChild(head);
        td.appendChild(this.renderLayersTable(v as ViewLayerParams[]));
      } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        td.appendChild(this.renderObjectTable(v));
      } else {
        td.appendChild(renderValueNode(v) as any);
      }

      tr.appendChild(th);
      tr.appendChild(td);
      table.appendChild(tr);
    }

    return table;
  }

  renderLayersTable(layers: ViewLayerParams[]) {
    if (!layers.length) return el("div", { className: "vp-empty", textContent: "No layers" });

    const table = el("table", { className: "vp-table vp-table--layers" });

    const thead = el("thead");
    const head = el("tr");
    head.appendChild(el("th", { textContent: "id" }));
    head.appendChild(el("th", { textContent: "visible" }));
    head.appendChild(el("th", { textContent: "autoDestroy" }));
    thead.appendChild(head);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const l of layers) {
      const tr = el("tr");
      tr.appendChild(el("td", { textContent: l.id }));

      const vis = l.visible === undefined ? null : !!l.visible;
      const ad = l.autoDestroy === undefined ? null : !!l.autoDestroy;

      tr.appendChild(
        el("td", {}, [
          vis == null
            ? el("span", { className: "vp-val vp-val--null", textContent: "—" })
            : el("span", { className: `vp-flag ${vis ? "is-on" : "is-off"}`, textContent: vis ? "true" : "false" }),
        ])
      );

      tr.appendChild(
        el("td", {}, [
          ad == null
            ? el("span", { className: "vp-val vp-val--null", textContent: "—" })
            : el("span", { className: `vp-flag ${ad ? "is-on" : "is-off"}`, textContent: ad ? "true" : "false" }),
        ])
      );

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    return table;
  }

  renderObjectTable(obj: any) {
    return renderObjectInlineTable(obj);
  }

  static #ensureGlobalStyle() {
    if (document.getElementById(this.#STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = this.#STYLE_ID;
    style.textContent = `
.vp-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px; background: rgba(255,255,255,0.96); border: 1px solid #e6e6e6; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14); backdrop-filter: blur(2px); }
.vp-header { display: flex; flex-direction: row; align-items: flex-start; gap: 14px; padding: 14px; border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; margin-bottom: 12px; }
.vp-title-col { display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-start; gap: 4px; }
.vp-title-icon { width: 60px; height: 60px; flex: 0 0 60px; border-radius: 14px; border: 1.5px solid #e6e6e6; background: #fafafa; padding: 6px; }
.vp-h1 { padding-top:10px;  font-size: 24px; color: #666666; font-weight: 650; }
.vp-subtitle { font-size: 12px; color: #444; line-height: 1.35; }
.vp-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.vp-btn { font-size: 12px; border-radius: 10px; padding: 6px 10px; border: 1px solid #e6e6e6; background: #fff; cursor: pointer; }
.vp-btn:hover { background: #fafafa; }
.vp-btn--sub { padding: 5px 8px; border-radius: 10px; font-size: 11px; }
.vp-body { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.vp-summary { display: flex; gap: 8px; align-items: baseline; font-size: 13px; color: #2d5e8c; font-weight: 650; margin: 10px 0 8px 0; padding-left: 0; }
.vp-k { font-size: 12px; color: #666; font-weight:normal; }
.vp-v { font-size: 12px; font-weight: 600; color: #444; }
.vp-empty { color: #888; font-size: 13px; text-align: center; }
.vp-section { border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; margin-bottom: 0; overflow: hidden; }
.vp-section-summary { cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #2d5e8c; background: #f7fafc; border-radius: 12px 12px 0 0; padding: 12px 18px 10px 18px; user-select: none; letter-spacing: 0.01em; transition: background 0.13s; outline: none; }
.vp-section-summary:hover { background: #e6f0fa; }
.vp-caret { display: inline-block; width: 18px; text-align: center; font-size: 15px; color: #888; transition: transform 0.18s cubic-bezier(.4,0,.2,1), color 0.13s; user-select: none; margin-right: 4px; vertical-align: middle; }
.vp-section-label { font-size: 13px; color: #222; font-weight: 650; }
.vp-section-body { padding: 12px 18px 16px 18px; }

/* Base table */
.vp-table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border: 1px solid #e6e6e6; border-radius: 12px; overflow: hidden; margin-bottom: 8px; }

/* KV tables: snug label col but aligned via --vp-keyw (set per table in JS) */
.vp-table--kv { table-layout: fixed; }

/* Reduced padding just for the view KV table cells */
.vp-table--kv th {
  width: var(--vp-keyw, 16ch);
  white-space: nowrap;
  padding: 6px 10px;           /* reduced */
  vertical-align: top;
  background: #fbfdff;
  border-right: 1px solid #eef2f5;
  border-bottom: none;
  text-overflow: ellipsis;
  overflow: hidden;
}
.vp-table--kv td {
  width: auto;
  padding: 6px 10px;           /* reduced */
  vertical-align: top;
  border-top: 1px solid #f0f0f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  word-break: break-word;
}
.vp-row:first-child td { border-top: none; }

.vp-key { display: flex; align-items: center; justify-content: flex-start; gap: 10px; min-width: 0; }
.vp-keytext { font-size: 12px; font-weight: 750; color: #2d5e8c; letter-spacing: 0.01em; }
.vp-cell { color: #111; min-width: 0; }

/* Scalars */
.vp-val {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.35;
  color: #111;
  word-break: break-word;
}
.vp-val--str { color: #1f4d77; }
.vp-val--num { color: #2b6cb0; font-weight: 650; font-variant-numeric: tabular-nums; }
.vp-val--bool { color: #2e7d32; font-weight: 650; }
.vp-val--null { color: #8a8f98; }
.vp-val--arr { color: #111; }

/* Layers table */
.vp-table--layers { font-size: 12px; table-layout: auto; }
.vp-table--layers thead th {
  text-align: left;
  color: #666;
  font-weight: 650;
  padding: 8px 10px;
  border-bottom: 1px solid #f0f0f0;
  background: #f7fafc;
}
.vp-table--layers td {
  padding: 8px 10px;
  border-top: 1px solid #f7f7f7;
  vertical-align: top;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.vp-flag {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.04em;
  border: 1px solid #e6e6e6;
  background: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.vp-flag.is-on { border-color: rgba(46,125,50,0.25); background: rgba(46,125,50,0.08); color: #1f6b2b; }
.vp-flag.is-off { border-color: rgba(210,35,35,0.25); background: rgba(210,35,35,0.08); color: rgb(170, 20, 20); }

/* Section subhead (layers) */
.vp-subhead { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.vp-subhead-title { font-size: 12px; font-weight: 750; color: #2d5e8c; }
.vp-pill {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 750;
  border: 1px solid #e6e6e6;
  background: #f7fafc;
  color: #2d5e8c;
}

/* Nested object KV tables inherit the same alignment behavior (keep their own padding) */
.vp-table--nested { table-layout: fixed; width: 100%; }
.vp-table--nested th { padding: 8px 10px; }
.vp-table--nested td { padding: 8px 10px; }
    `;
    document.head.appendChild(style);
  }
}
