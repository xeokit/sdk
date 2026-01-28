/**
 * Generates a lightweight, dependency-free HTML view for a ModelConverterStatsReport,
 * and mounts it into its own floating, absolutely-positioned host DIV that sits
 * above everything else on the page.
 *
 * Usage:
 *   ModelConverterStatsReportHtmlView.show(report);   // create/update floating panel
 *   ModelConverterStatsReportHtmlView.hide();         // remove panel
 *   ModelConverterStatsReportHtmlView.toggle(report); // convenience
 *
 * Notes:
 * - The floating panel is created internally (no need for a host element in HTML).
 * - The panel is layered above everything via a very high z-index.
 */
export class ModelConverterStatsReportHTMLView {
  // IDs used to ensure singleton host + singleton style injection.
  static #HOST_ID = "__mcsr_floating_host__";
  static #STYLE_ID = "__mcsr_style__";

  /**
   * Creates (or updates) the floating panel and renders the report into it.
   * @param {ModelConverterStatsReport} report
   * @param {Object} [opts]
   * @param {"top-right"|"top-left"|"bottom-right"|"bottom-left"} [opts.corner="top-right"]
   * @param {number} [opts.maxWidth=520]
   * @param {number} [opts.zIndex=2147483647]
   * @returns {HTMLElement} The host element
   */
  static show(report, opts = {}) {
    const host = this.#getOrCreateHost(opts);
    this.#ensureGlobalStyle();

    // Render report content (no host styling here; host controls positioning/layering)
    const root = this.render(report);

    // Replace content (keeps host stable for scroll position / CSS)
    host.replaceChildren(root);

    // Ensure visible
    host.style.display = "block";

    return host;
  }

  /**
   * Removes the floating panel from the page (if present).
   */
  static hide() {
    const host = document.getElementById(this.#HOST_ID);
    if (host) host.remove();
  }

  /**
   * Toggles the floating panel.
   * If hidden -> show(report)
   * If visible -> hide()
   * @param {ModelConverterStatsReport} report
   * @param {Object} [opts] forwarded to show()
   */
  static toggle(report, opts) {
    const host = document.getElementById(this.#HOST_ID);
    if (host) {
      this.hide();
    } else {
      this.show(report, opts);
    }
  }

  /**
   * Renders report content as a DOM subtree.
   * (This does NOT position anything; use show() for floating UI.)
   * @param {ModelConverterStatsReport} report
   * @returns {HTMLElement}
   */
  static render(report) {
    const root = el("div", { className: "mcsr-root" });

    // IMPORTANT: styles are injected globally once (not per render)
    // so multiple calls to show() don't keep re-adding <style>.
    root.appendChild(this.renderHeader(report));
    root.appendChild(this.renderSummary(report));
    root.appendChild(this.renderErrors(report.errors));

    root.appendChild(
      this.renderSection("Inputs", Object.entries(report.inputs || {}), ([id, input]) =>
        this.renderInputCard(id, input)
      )
    );

    root.appendChild(
      this.renderSection(
        "Scene models",
        Object.entries(report.sceneModels || {}),
        ([id, stats]) => this.renderGenericCard(id, stats)
      )
    );

    root.appendChild(
      this.renderSection(
        "Data models",
        Object.entries(report.dataModels || {}),
        ([id, stats]) => this.renderGenericCard(id, stats)
      )
    );

    root.appendChild(
      this.renderSection("Outputs", Object.entries(report.outputs || {}), ([id, output]) =>
        this.renderOutputCard(id, output)
      )
    );

    return root;
  }

  /**
   * Renders to an HTML string (SSR / innerHTML).
   * Note: does not create the floating host. Use show() for floating UI.
   * @param {ModelConverterStatsReport} report
   * @returns {string}
   */
  static toHtmlString(report) {
    return this.render(report).outerHTML;
  }

  // ---------------------------------------------------------------------------
  // Host + global style management
  // ---------------------------------------------------------------------------

  static #getOrCreateHost(opts) {
    const {
      corner = "top-right",
      maxWidth = 520,
      zIndex = 2147483647,
    } = opts;

    let host = document.getElementById(this.#HOST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = this.#HOST_ID;

      // Floating host visuals + layout
      host.style.position = "absolute";         // requested: absolutely placed
      host.style.maxHeight = "90vh";
      host.style.overflow = "auto";
      host.style.background = "rgba(255,255,255,0.96)";
      host.style.border = "1px solid #e6e6e6";
      host.style.borderRadius = "12px";
      host.style.boxShadow = "0 6px 24px rgba(0,0,0,0.14)";
      host.style.backdropFilter = "blur(2px)";
      host.style.padding = "0";                // content has its own padding
      host.style.display = "block";

      // Layer above everything else
      host.style.zIndex = String(zIndex);

      // Avoid stealing pointer events from the canvas outside the panel
      // (panel itself should still be interactive)
      host.style.pointerEvents = "auto";

      document.body.appendChild(host);
    }

    // Width
    host.style.width = `min(${maxWidth}px, calc(100vw - 24px))`;

    // Corner placement
    // Use 12px margin from the viewport edges.
    host.style.top = "";
    host.style.right = "";
    host.style.bottom = "";
    host.style.left = "";

    switch (corner) {
      case "top-left":
        host.style.top = "12px";
        host.style.left = "12px";
        break;
      case "bottom-right":
        host.style.bottom = "12px";
        host.style.right = "12px";
        break;
      case "bottom-left":
        host.style.bottom = "12px";
        host.style.left = "12px";
        break;
      case "top-right":
      default:
        host.style.top = "12px";
        host.style.right = "12px";
        break;
    }

    return host;
  }

  static #ensureGlobalStyle() {
    if (document.getElementById(this.#STYLE_ID)) return;

    const s = document.createElement("style");
    s.id = this.#STYLE_ID;
    s.textContent = DEFAULT_CSS;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------------------
  // Header / summary
  // ---------------------------------------------------------------------------

  static renderHeader(report) {
    const header = el("div", { className: "mcsr-header" });

    header.appendChild(
      el("div", { className: "mcsr-title" }, [
        el("div", { className: "mcsr-h1", textContent: "Model Converter Stats Report" }),
        el("div", { className: "mcsr-subtitle", textContent: report.description || "" }),
      ])
    );

    const meta = el("div", { className: "mcsr-meta" }, [
      metaRow("Pipeline", report.pipeline),
      metaRow("Time", report.time),
      metaRow("Command", report.command),
    ]);

    header.appendChild(meta);
    return header;

    function metaRow(label, value) {
      const row = el("div", { className: "mcsr-meta-row" });
      row.appendChild(el("div", { className: "mcsr-meta-label", textContent: label }));
      row.appendChild(el("div", { className: "mcsr-meta-value", textContent: value || "—" }));
      return row;
    }
  }

  static renderSummary(report) {
    const inputsCount = Object.keys(report.inputs || {}).length;
    const outputsCount = Object.keys(report.outputs || {}).length;
    const sceneModelsCount = Object.keys(report.sceneModels || {}).length;
    const dataModelsCount = Object.keys(report.dataModels || {}).length;

    const inputsBytes = sumBytes(Object.values(report.inputs || {}), (x) => x.fileDataSizeBytes);
    const outputsBytes = sumBytes(Object.values(report.outputs || {}), (x) => x.fileDataSizeBytes);

    const summary = el("div", { className: "mcsr-summary" }, [
      summaryChip("Inputs", String(inputsCount)),
      summaryChip("Outputs", String(outputsCount)),
      summaryChip("Scene models", String(sceneModelsCount)),
      summaryChip("Data models", String(dataModelsCount)),
      summaryChip("Input bytes", formatBytes(inputsBytes)),
      summaryChip("Output bytes", formatBytes(outputsBytes)),
    ]);

    return summary;

    function summaryChip(label, value) {
      const chip = el("div", { className: "mcsr-chip" });
      chip.appendChild(el("div", { className: "mcsr-chip-label", textContent: label }));
      chip.appendChild(el("div", { className: "mcsr-chip-value", textContent: value }));
      return chip;
    }

    function sumBytes(items, getBytes) {
      return items.reduce((acc, it) => acc + (Number(getBytes(it)) || 0), 0);
    }
  }

  static renderErrors(errors = []) {
    const section = el("div", { className: "mcsr-errors" });

    if (!errors.length) {
      section.appendChild(el("div", { className: "mcsr-ok", textContent: "No conversion errors." }));
      return section;
    }

    section.appendChild(
      el("div", { className: "mcsr-error-title", textContent: `Errors (${errors.length})` })
    );

    const list = el("ul", { className: "mcsr-list mcsr-list--errors" });
    for (const err of errors) {
      list.appendChild(el("li", { textContent: err }));
    }
    section.appendChild(list);
    return section;
  }

  // ---------------------------------------------------------------------------
  // Sections / cards
  // ---------------------------------------------------------------------------

  static renderSection(title, entries, renderItem) {
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
    for (const entry of entries) {
      grid.appendChild(renderItem(entry));
    }
    section.appendChild(grid);

    return section;
  }

  static renderInputCard(id, input) {
    const card = el("div", { className: "mcsr-card" });

    card.appendChild(
      el("div", { className: "mcsr-card-head" }, [
        el("div", { className: "mcsr-card-title", textContent: id }),
        this.renderBadges(input.messages, input.warnings, input.errors),
      ])
    );

    card.appendChild(
      this.renderKeyValueTable([
        ["Path", input.filePath],
        ["Format", `${input.fileFormat} ${input.fileFormatVersion || ""}`.trim()],
        ["Data type", input.fileDataType],
        ["Size", formatBytes(input.fileDataSizeBytes)],
        ["Scene model", input.sceneModel || "—"],
        ["Data model", input.dataModel || "—"],
      ])
    );

    card.appendChild(this.renderDiagnostics(input.messages, input.warnings, input.errors));
    card.appendChild(this.renderOptions(input.options));

    return card;
  }

  static renderOutputCard(id, output) {
    const card = el("div", { className: "mcsr-card" });

    card.appendChild(
      el("div", { className: "mcsr-card-head" }, [
        el("div", { className: "mcsr-card-title", textContent: id }),
        this.renderBadges(output.messages, output.warnings, output.errors),
      ])
    );

    card.appendChild(
      this.renderKeyValueTable([
        ["Path", output.filePath],
        ["Format", `${output.fileFormat} ${output.fileFormatVersion || ""}`.trim()],
        ["Data type", output.fileDataType],
        ["Size", formatBytes(output.fileDataSizeBytes)],
        ["Scene model", output.sceneModel || "—"],
        ["Data model", output.dataModel || "—"],
      ])
    );

    card.appendChild(this.renderDiagnostics(output.messages, output.warnings, output.errors));
    card.appendChild(this.renderOptions(output.options));

    return card;
  }

  static renderGenericCard(id, stats) {
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

  static renderBadges(messages = [], warnings = [], errors = []) {
    const wrap = el("div", { className: "mcsr-badges" });

    if (errors.length) wrap.appendChild(badge("Errors", errors.length, "mcsr-badge--error"));
    if (warnings.length) wrap.appendChild(badge("Warnings", warnings.length, "mcsr-badge--warn"));
    if (messages.length) wrap.appendChild(badge("Messages", messages.length, "mcsr-badge--info"));

    return wrap;

    function badge(label, count, cls) {
      return el("span", { className: `mcsr-badge ${cls}`, textContent: `${label}: ${count}` });
    }
  }

  static renderDiagnostics(messages = [], warnings = [], errors = []) {
    const container = el("div", { className: "mcsr-diagnostics" });

    container.appendChild(this.renderListBlock("Messages", messages));
    container.appendChild(this.renderListBlock("Warnings", warnings));
    container.appendChild(this.renderListBlock("Errors", errors));

    return container;
  }

  static renderListBlock(title, items) {
    const details = el("details", { className: "mcsr-details", open: false });

    const count = (items && items.length) || 0;
    details.appendChild(
      el("summary", { className: "mcsr-summary-row", textContent: `${title} (${count})` })
    );

    if (!count) {
      details.appendChild(el("div", { className: "mcsr-empty", textContent: "None" }));
      return details;
    }

    const list = el("ul", { className: "mcsr-list" });
    for (const item of items) {
      list.appendChild(el("li", { textContent: item }));
    }
    details.appendChild(list);
    return details;
  }

  static renderOptions(options) {
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

  static renderKeyValueTable(rows) {
    const table = el("table", { className: "mcsr-table" });

    for (const [k, v] of rows) {
      const tr = el("tr");
      tr.appendChild(el("th", { textContent: k }));
      tr.appendChild(el("td", { textContent: v ?? "—" }));
      table.appendChild(tr);
    }

    return table;
  }
}

// -----------------------------------------------------------------------------
// Small DOM utilities (no framework)
// -----------------------------------------------------------------------------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    node[key] = value;
  }

  for (const child of children) node.appendChild(child);
  return node;
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatBytes(bytes) {
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

// -----------------------------------------------------------------------------
// Default CSS (small + readable)
// -----------------------------------------------------------------------------

const DEFAULT_CSS = `
.mcsr-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px; }
.mcsr-header { display: grid; gap: 12px; padding: 14px; border: 1px solid #e6e6e6; border-radius: 12px; }
.mcsr-h1 { font-size: 18px; font-weight: 650; }
.mcsr-subtitle { font-size: 13px; color: #444; }
.mcsr-meta { display: grid; gap: 6px; }
.mcsr-meta-row { display: grid; grid-template-columns: 90px 1fr; gap: 10px; }
.mcsr-meta-label { font-size: 12px; color: #666; }
.mcsr-meta-value { font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; word-break: break-word; }

.mcsr-summary { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0 4px; }
.mcsr-chip { border: 1px solid #e6e6e6; border-radius: 999px; padding: 8px 10px; display: flex; gap: 8px; align-items: baseline; }
.mcsr-chip-label { font-size: 12px; color: #666; }
.mcsr-chip-value { font-size: 12px; font-weight: 600; }

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
