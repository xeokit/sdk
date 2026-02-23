import { FloatingPanelFlowHost } from "./FloatingPanelFlowHost";

/**
 * Lightweight, dependency-free HTML view for a ModelConverterStatsReport,
 * mounted into the shared FloatingPanelFlowHost so it flow-wraps with other panels.
 *
 * Usage:
 *   ModelConverterStatsReportPanel.show(report);
 *   ModelConverterStatsReportPanel.hide();
 *   ModelConverterStatsReportPanel.toggle(report);
 */
export class ModelConverterStatsReportPanel {
  static #TILE_ID = "__mcsr_tile__";
  static #STYLE_ID = "__mcsr_style__";
  static #STATE_KEY = "__mcsr_collapsed__";

  /**
   * Creates (or updates) the panel tile and renders the report into it.
   * Mounts into the shared flow host.
   */
  static show(flowHost: HTMLDivElement, report: any, opts: any = {}) {
    this.#ensureGlobalStyle();

    let tile = document.getElementById(this.#TILE_ID) as HTMLDivElement | null;

    if (!tile) {
      const root = this.render(report, opts);
      tile = FloatingPanelFlowHost.mountTile(root, {
        tileMinWidth: opts.tileMinWidth ?? opts.maxWidth ?? 520,
        tileMaxWidth: opts.tileMaxWidth ?? opts.maxWidth ?? 720,
      }) as HTMLDivElement;

      tile.id = this.#TILE_ID;
      flowHost.appendChild(tile);
    } else {
      const root = this.render(report, opts);
      tile.replaceChildren(root);
    }

    return tile;
  }

  // static hide() {
  //   const tile = document.getElementById(this.#TILE_ID);
  //   if (tile) tile.remove();
  // }
  //
  // static toggle(report: any, opts?: any) {
  //   const tile = document.getElementById(this.#TILE_ID);
  //   if (tile) this.hide();
  //   else this.show(report, opts);
  // }

  /**
   * Renders report content as a DOM subtree.
   * (Does not create host; show() mounts into flow host)
   */
  static render(report: any, opts: any = {}) {
    const root = el("div", { className: "mcsr-root" });

    const collapsed = readBool(this.#STATE_KEY, !!opts.startCollapsed);

    const header = this.renderHeader(report, { collapsed });
    const body = this.renderBody(report);

    root.appendChild(header);
    root.appendChild(body);

    this.#setCollapsed(root, collapsed);

    const toggleBtn = header.querySelector<HTMLButtonElement>("[data-mcsr-toggle]");
    toggleBtn?.addEventListener("click", () => {
      const nowCollapsed = !root.classList.contains("mcsr-collapsed");
      this.#setCollapsed(root, nowCollapsed);
      writeBool(this.#STATE_KEY, nowCollapsed);
    });

    return root;
  }

  static toHtmlString(report: any, opts: any = {}) {
    return this.render(report, opts).outerHTML;
  }

  // ---------------------------------------------------------------------------
  // Global style + collapse state
  // ---------------------------------------------------------------------------

  static #ensureGlobalStyle() {
    if (document.getElementById(this.#STYLE_ID)) return;

    const s = document.createElement("style");
    s.id = this.#STYLE_ID;
    s.textContent = DEFAULT_CSS;
    document.head.appendChild(s);
  }

  static #setCollapsed(root: HTMLElement, collapsed: boolean) {
    root.classList.toggle("mcsr-collapsed", collapsed);

    const body = root.querySelector<HTMLElement>(".mcsr-body");
    if (body) body.style.display = collapsed ? "none" : "block";

    const caret = root.querySelector<HTMLElement>("[data-mcsr-caret]");
    if (caret) caret.textContent = collapsed ? "▸" : "▾";

    const state = root.querySelector<HTMLElement>("[data-mcsr-state]");
    if (state) state.textContent = collapsed ? "Collapsed" : "Expanded";
  }

  // ---------------------------------------------------------------------------
  // Header / body
  // ---------------------------------------------------------------------------

  static renderHeader(report: any, { collapsed }: { collapsed: boolean }) {
    const header = el("div", { className: "mcsr-header" });

    header.appendChild(
      el("div", { className: "mcsr-title" }, [
        el("div", { className: "mcsr-h1", textContent: "Model Converter Stats Report" }),
        el("div", { className: "mcsr-subtitle", textContent: report?.description || "" }),
      ])
    );

    const meta = el("div", { className: "mcsr-meta" }, [
      metaRow("Pipeline", report?.pipeline),
      metaRow("Time", report?.time),
      metaRow("Command", report?.command),
    ]);

    const actions = el("div", { className: "mcsr-actions" }, [
      el("span", {
        className: "mcsr-caret",
        textContent: collapsed ? "▸" : "▾",
        ["data-mcsr-caret" as any]: "",
      }),
      el("button", {
        className: "mcsr-btn",
        textContent: "Toggle",
        title: "Collapse/expand",
        ["data-mcsr-toggle" as any]: "",
      }),
    ]);

    const status = el("div", { className: "mcsr-status" }, [
      el("span", { className: "mcsr-status-label", textContent: "Panel:" }),
      el("span", {
        className: "mcsr-status-value",
        textContent: collapsed ? "Collapsed" : "Expanded",
        ["data-mcsr-state" as any]: "",
      }),
    ]);

    header.appendChild(meta);
    header.appendChild(actions);
    header.appendChild(status);
    return header;

    function metaRow(label: string, value: any) {
      const row = el("div", { className: "mcsr-meta-row" });
      row.appendChild(el("div", { className: "mcsr-meta-label", textContent: label }));
      row.appendChild(el("div", { className: "mcsr-meta-value", textContent: value || "—" }));
      return row;
    }
  }

  static renderBody(report: any) {
    const body = el("div", { className: "mcsr-body" });

    body.appendChild(this.renderSummary(report));
    body.appendChild(this.renderErrors(report?.errors || []));

    body.appendChild(
      this.renderSection("Inputs", Object.entries(report?.inputs || {}), ([id, input]) =>
        this.renderInputCard(String(id), input as any)
      )
    );

    body.appendChild(
      this.renderSection("Scene models", Object.entries(report?.sceneModels || {}), ([id, stats]) =>
        this.renderGenericCard(String(id), stats)
      )
    );

    body.appendChild(
      this.renderSection("Data models", Object.entries(report?.dataModels || {}), ([id, stats]) =>
        this.renderGenericCard(String(id), stats)
      )
    );

    body.appendChild(
      this.renderSection("Outputs", Object.entries(report?.outputs || {}), ([id, output]) =>
        this.renderOutputCard(String(id), output as any)
      )
    );

    return body;
  }

  static renderSummary(report: any) {
    const inputsCount = Object.keys(report?.inputs || {}).length;
    const outputsCount = Object.keys(report?.outputs || {}).length;
    const sceneModelsCount = Object.keys(report?.sceneModels || {}).length;
    const dataModelsCount = Object.keys(report?.dataModels || {}).length;

    const inputsBytes = sumBytes(Object.values(report?.inputs || {}), (x: any) => x?.fileDataSizeBytes);
    const outputsBytes = sumBytes(Object.values(report?.outputs || {}), (x: any) => x?.fileDataSizeBytes);

    return el("div", { className: "mcsr-summary" }, [
      chip("Inputs", String(inputsCount)),
      chip("Outputs", String(outputsCount)),
      chip("Scene models", String(sceneModelsCount)),
      chip("Data models", String(dataModelsCount)),
      chip("Input bytes", formatBytes(inputsBytes)),
      chip("Output bytes", formatBytes(outputsBytes)),
    ]);

    function chip(label: string, value: string) {
      const c = el("div", { className: "mcsr-chip" });
      c.appendChild(el("div", { className: "mcsr-chip-label", textContent: label }));
      c.appendChild(el("div", { className: "mcsr-chip-value", textContent: value }));
      return c;
    }

    function sumBytes(items: any[], getBytes: (x: any) => any) {
      return items.reduce((acc, it) => acc + (Number(getBytes(it)) || 0), 0);
    }
  }

  static renderErrors(errors: any[] = []) {
    const section = el("div", { className: "mcsr-errors" });

    if (!errors.length) {
      section.appendChild(el("div", { className: "mcsr-ok", textContent: "No conversion errors." }));
      return section;
    }

    section.appendChild(
      el("div", { className: "mcsr-error-title", textContent: `Errors (${errors.length})` })
    );

    const list = el("ul", { className: "mcsr-list mcsr-list--errors" });
    for (const err of errors) list.appendChild(el("li", { textContent: String(err) }));
    section.appendChild(list);
    return section;
  }

  // ---------------------------------------------------------------------------
  // Sections / cards
  // ---------------------------------------------------------------------------

  static renderSection(
    title: string,
    entries: Array<any>,
    renderItem: (entry: any) => HTMLElement
  ) {
    const section = el("section", { className: "mcsr-section" });

    section.appendChild(
      el("div", { className: "mcsr-section-header" }, [
        el("h2", { className: "mcsr-h2", textContent: title }),
        el("div", { className: "mcsr-count", textContent: String(entries.length) }),
      ])
    );

    if (!entries.length) {
      section.appendChild(el("div", { className: "mcsr-empty", textContent: "None" }));
      return section;
    }

    const grid = el("div", { className: "mcsr-grid" });
    for (const entry of entries) grid.appendChild(renderItem(entry));
    section.appendChild(grid);

    return section;
  }

  static renderInputCard(id: string, input: any) {
    const card = el("div", { className: "mcsr-card" });

    card.appendChild(
      el("div", { className: "mcsr-card-head" }, [
        el("div", { className: "mcsr-card-title", textContent: id }),
        this.renderBadges(input?.messages, input?.warnings, input?.errors),
      ])
    );

    card.appendChild(
      this.renderKeyValueTable([
        ["Path", input?.filePath],
        ["Format", `${input?.fileFormat || ""} ${input?.fileFormatVersion || ""}`.trim()],
        ["Data type", input?.fileDataType],
        ["Size", formatBytes(input?.fileDataSizeBytes)],
        ["Scene model", input?.sceneModel || "—"],
        ["Data model", input?.dataModel || "—"],
      ])
    );

    card.appendChild(this.renderDiagnostics(input?.messages, input?.warnings, input?.errors));
    card.appendChild(this.renderOptions(input?.options));

    return card;
  }

  static renderOutputCard(id: string, output: any) {
    const card = el("div", { className: "mcsr-card" });

    card.appendChild(
      el("div", { className: "mcsr-card-head" }, [
        el("div", { className: "mcsr-card-title", textContent: id }),
        this.renderBadges(output?.messages, output?.warnings, output?.errors),
      ])
    );

    card.appendChild(
      this.renderKeyValueTable([
        ["Path", output?.filePath],
        ["Format", `${output?.fileFormat || ""} ${output?.fileFormatVersion || ""}`.trim()],
        ["Data type", output?.fileDataType],
        ["Size", formatBytes(output?.fileDataSizeBytes)],
        ["Scene model", output?.sceneModel || "—"],
        ["Data model", output?.dataModel || "—"],
      ])
    );

    card.appendChild(this.renderDiagnostics(output?.messages, output?.warnings, output?.errors));
    card.appendChild(this.renderOptions(output?.options));

    return card;
  }

  static renderGenericCard(id: string, stats: any) {
    const card = el("div", { className: "mcsr-card" });

    card.appendChild(
      el("div", { className: "mcsr-card-head" }, [
        el("div", { className: "mcsr-card-title", textContent: id }),
        el("div", { className: "mcsr-badges" }, []),
      ])
    );

    const details = el("details", { className: "mcsr-details", open: false });
    details.appendChild(el("summary", { className: "mcsr-summary-row", textContent: "Stats" }));
    details.appendChild(el("pre", { className: "mcsr-pre", textContent: safeJson(stats) }));
    card.appendChild(details);

    return card;
  }

  static renderBadges(messages: any[] = [], warnings: any[] = [], errors: any[] = []) {
    const wrap = el("div", { className: "mcsr-badges" });

    if (errors?.length) wrap.appendChild(badge("Errors", errors.length, "mcsr-badge--error"));
    if (warnings?.length) wrap.appendChild(badge("Warnings", warnings.length, "mcsr-badge--warn"));
    if (messages?.length) wrap.appendChild(badge("Messages", messages.length, "mcsr-badge--info"));

    return wrap;

    function badge(label: string, count: number, cls: string) {
      return el("span", { className: `mcsr-badge ${cls}`, textContent: `${label}: ${count}` });
    }
  }

  static renderDiagnostics(messages: any[] = [], warnings: any[] = [], errors: any[] = []) {
    const container = el("div", { className: "mcsr-diagnostics" });

    container.appendChild(this.renderListBlock("Messages", messages));
    container.appendChild(this.renderListBlock("Warnings", warnings));
    container.appendChild(this.renderListBlock("Errors", errors));

    return container;
  }

  static renderListBlock(title: string, items: any[] = []) {
    const details = el("details", { className: "mcsr-details", open: false });
    const count = items?.length || 0;

    details.appendChild(
      el("summary", { className: "mcsr-summary-row", textContent: `${title} (${count})` })
    );

    if (!count) {
      details.appendChild(el("div", { className: "mcsr-empty", textContent: "None" }));
      return details;
    }

    const list = el("ul", { className: "mcsr-list" });
    for (const item of items) list.appendChild(el("li", { textContent: String(item) }));
    details.appendChild(list);
    return details;
  }

  static renderOptions(options: any) {
    const details = el("details", { className: "mcsr-details", open: false });
    details.appendChild(el("summary", { className: "mcsr-summary-row", textContent: "Options" }));

    if (!options || Object.keys(options).length === 0) {
      details.appendChild(el("div", { className: "mcsr-empty", textContent: "None" }));
      return details;
    }

    const rows = Object.entries(options).map(([k, v]) => [
      k,
      typeof v === "string" ? v : safeJson(v),
    ]);

    details.appendChild(this.renderKeyValueTable(rows));
    return details;
  }

  static renderKeyValueTable(rows: any) {
    const table = el("table", { className: "mcsr-table" });

    for (const [k, v] of rows) {
      const tr = el("tr");
      tr.appendChild(el("th", { textContent: String(k) }));
      tr.appendChild(el("td", { textContent: v ?? "—" }));
      table.appendChild(tr);
    }

    return table;
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

function safeJson(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatBytes(bytes: any) {
  const n = Number(bytes) || 0;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const dp = i === 0 ? 0 : i === 1 ? 1 : 2;
  return `${v.toFixed(dp)} ${units[i]}`;
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
// Default CSS (panel visuals are on root since we don't have a per-panel host)
// -----------------------------------------------------------------------------

const DEFAULT_CSS = `
.mcsr-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px; background: rgba(255,255,255,0.96); border: 1px solid #e6e6e6; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14); backdrop-filter: blur(2px); }

.mcsr-header { display: grid; gap: 12px; padding: 14px; border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; }
.mcsr-title { display: grid; gap: 4px; }
.mcsr-h1 { font-size: 18px; font-weight: 650; }
.mcsr-subtitle { font-size: 13px; color: #444; }

.mcsr-meta { display: grid; gap: 6px; }
.mcsr-meta-row { display: grid; grid-template-columns: 90px 1fr; gap: 10px; }
.mcsr-meta-label { font-size: 12px; color: #666; }
.mcsr-meta-value { font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; word-break: break-word; }

.mcsr-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.mcsr-caret { font-size: 14px; color: #444; width: 18px; text-align: center; }
.mcsr-btn { font-size: 12px; border-radius: 10px; padding: 6px 10px; border: 1px solid #e6e6e6; background: #fff; cursor: pointer; }
.mcsr-btn:hover { background: #fafafa; }

.mcsr-status { display: flex; gap: 8px; align-items: baseline; }
.mcsr-status-label { font-size: 12px; color: #666; }
.mcsr-status-value { font-size: 12px; font-weight: 600; }

.mcsr-summary { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0 4px; }
.mcsr-chip { border: 1px solid #e6e6e6; border-radius: 999px; padding: 8px 10px; display: flex; gap: 8px; align-items: baseline; background: #fff; }
.mcsr-chip-label { font-size: 12px; color: #666; }
.mcsr-chip-value { font-size: 12px; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

.mcsr-errors { margin: 10px 0 6px; }
.mcsr-ok { font-size: 13px; color: #2e7d32; }
.mcsr-error-title { font-size: 13px; font-weight: 650; color: #b00020; margin-bottom: 6px; }
.mcsr-list { margin: 8px 0 0; padding-left: 18px; color: #222; font-size: 12px; }
.mcsr-list--errors { color: #b00020; }

.mcsr-section { margin-top: 18px; }
.mcsr-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.mcsr-h2 { font-size: 14px; margin: 0; font-weight: 650; }
.mcsr-count { font-size: 12px; color: #666; }
.mcsr-empty { font-size: 12px; color: #777; padding: 8px 0; }

.mcsr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
.mcsr-card { border: 1px solid #e6e6e6; border-radius: 12px; padding: 12px; background: #fff; }
.mcsr-card-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
.mcsr-card-title { font-size: 13px; font-weight: 650; word-break: break-word; }
.mcsr-badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.mcsr-badge { font-size: 11px; border-radius: 999px; padding: 3px 8px; border: 1px solid #e6e6e6; }
.mcsr-badge--error { border-color: #f3b7c0; color: #b00020; background: #fff5f7; }
.mcsr-badge--warn { border-color: #f6dda1; color: #7a5a00; background: #fffaf0; }
.mcsr-badge--info { border-color: #cfe5ff; color: #0b4aa2; background: #f4f9ff; }

.mcsr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.mcsr-table th { text-align: left; color: #666; font-weight: 600; width: 120px; padding: 6px 8px; vertical-align: top; }
.mcsr-table td { padding: 6px 8px; word-break: break-word; }
.mcsr-table tr + tr td, .mcsr-table tr + tr th { border-top: 1px solid #f0f0f0; }

.mcsr-details { margin-top: 10px; border-top: 1px solid #f0f0f0; padding-top: 8px; }
.mcsr-summary-row { cursor: pointer; font-size: 12px; color: #333; }
.mcsr-pre { margin: 8px 0 0; padding: 10px; border-radius: 10px; background: #fafafa; border: 1px solid #eee; overflow: auto; font-size: 11px; }
`;
