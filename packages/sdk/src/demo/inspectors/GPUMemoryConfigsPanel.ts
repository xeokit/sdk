import { type MemoryConfigs } from "../../webglrenderer";
import { FloatingPanelFlowHost } from "./FloatingPanelFlowHost";

/**
 * Generates a lightweight, dependency-free HTML view for a MemoryConfigs object,
 * and mounts it into the shared FloatingPanelFlowHost so it flow-wraps with other panels.
 *
 * Usage:
 *   GPUMemoryConfigsPanel.show(configs);   // create/update panel tile
 *   GPUMemoryConfigsPanel.hide();         // remove tile
 *   GPUMemoryConfigsPanel.toggle(configs);// convenience
 */
export class GPUMemoryConfigsPanel {
  static #TILE_ID = "__memcfg_tile__";
  static #STYLE_ID = "__memcfg_style__";
  static #STATE_KEY = "__memcfg_collapsed__";

  /**
   * Creates (or updates) the panel and renders the configs into it.
   * Mounts into the shared flow host.
   */
  static show(flowHost: HTMLDivElement, configs: MemoryConfigs, opts: any = {}) {

    this.#ensureGlobalStyle();

    let tile = document.getElementById(this.#TILE_ID) as HTMLDivElement | null;

    if (!tile) {
      const root = this.render(configs, opts);
      tile = FloatingPanelFlowHost.mountTile(root, {
        tileMinWidth: opts.tileMinWidth ?? opts.maxWidth ?? 420,
        tileMaxWidth: opts.tileMaxWidth ?? opts.maxWidth ?? 440,
      }) as HTMLDivElement;

      tile.id = this.#TILE_ID;
      flowHost.appendChild(tile);
    } else {
      const root = this.render(configs, opts);
      tile.replaceChildren(root);
    }

    return tile;
  }
  //
  // static hide() {
  //   const tile = document.getElementById(this.#TILE_ID);
  //   if (tile) tile.remove();
  // }
  //
  // static toggle(configs: MemoryConfigs, opts?: any) {
  //   const tile = document.getElementById(this.#TILE_ID);
  //   if (tile) this.hide();
  //   else this.show(configs, opts);
  // }

  /**
   * Renders configs content as a DOM subtree.
   */
  static render(configs: MemoryConfigs, opts: any = {}) {
    const root = el("div", { className: "memcfg-root" });

    const collapsed = readBool(this.#STATE_KEY, !!opts.startCollapsed);

    const header = this.renderHeader({ collapsed });
    const body = this.renderBody(configs);

    root.appendChild(header);
    root.appendChild(body);

    this.#setCollapsed(root, collapsed);

    const toggleBtn = header.querySelector<HTMLButtonElement>("[data-memcfg-toggle]");
    toggleBtn?.addEventListener("click", () => {
      const nowCollapsed = !root.classList.contains("memcfg-collapsed");
      this.#setCollapsed(root, nowCollapsed);
      writeBool(this.#STATE_KEY, nowCollapsed);
    });

    return root;
  }

  static toHtmlString(configs: MemoryConfigs, opts: any = {}) {
    return this.render(configs, opts).outerHTML;
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
    root.classList.toggle("memcfg-collapsed", collapsed);

    const body = root.querySelector<HTMLElement>(".memcfg-body");
    if (body) body.style.display = collapsed ? "none" : "block";

    const caret = root.querySelector<HTMLElement>("[data-memcfg-caret]");
    if (caret) caret.textContent = collapsed ? "▸" : "▾";

    const state = root.querySelector<HTMLElement>("[data-memcfg-state]");
    if (state) state.textContent = collapsed ? "Collapsed" : "Expanded";
  }

  // ---------------------------------------------------------------------------
  // Header / body
  // ---------------------------------------------------------------------------

  static renderHeader({ collapsed }: { collapsed: boolean }) {
    const header = el("div", { className: "memcfg-header" });

    const left = el("div", { className: "memcfg-title" }, [
      el("div", { className: "memcfg-h1", textContent: "GPU Memory Configs" }),
      el("div", {
        className: "memcfg-subtitle",
        textContent:
          "Limits for tiles, batches, vertices, indices, geometries, meshes, and primitives.",
      }),
    ]);

    const right = el("div", { className: "memcfg-actions" }, [
      el("span", {
        className: "memcfg-caret",
        textContent: collapsed ? "▸" : "▾",
        ["data-memcfg-caret" as any]: "",
      }),
      el("button", {
        className: "memcfg-btn",
        textContent: "Toggle",
        title: "Collapse/expand",
        ["data-memcfg-toggle" as any]: "",
      }),
    ]);

    header.appendChild(left);
   // header.appendChild(right);

    // header.appendChild(
    //   el("div", { className: "memcfg-status" }, [
    //     el("span", { className: "memcfg-status-label", textContent: "Panel:" }),
    //     el("span", {
    //       className: "memcfg-status-value",
    //       textContent: collapsed ? "Collapsed" : "Expanded",
    //       ["data-memcfg-state" as any]: "",
    //     }),
    //   ])
    // );

    return header;
  }

  static renderBody(configs: MemoryConfigs) {
    const body = el("div", { className: "memcfg-body" });

    body.appendChild(
      this.renderSection("RTC tiling", [
        row("tileSize", configs?.tileSize, "Size of each RTC tile (world units)"),
        row("maxTiles", configs?.maxTiles, "Max RTC tiles in GPU memory"),
      ])
    );

    body.appendChild(
      this.renderSection("Batching", [
        row("maxBatches", configs?.maxBatches, "Max render batches in GPU memory"),
        row("maxBatchVertices", configs?.maxBatchVertices, "Max vertices per batch"),
        row("maxBatchIndices", configs?.maxBatchIndices, "Max indices per batch"),
        row("maxBatchGeometries", configs?.maxBatchGeometries, "Max geometries per batch"),
        row("maxBatchMeshes", configs?.maxBatchMeshes, "Max meshes per batch"),
        row("maxBatchPrims", configs?.maxBatchPrims, "Max primitives per batch"),
      ])
    );

    body.appendChild(this.renderHints(configs));

    return body;

    function row(key: keyof MemoryConfigs, value: any, help?: string): [string, string, string] {
      return [String(key), formatNumber(value), help || ""];
    }
  }

  static renderSection(title: string, rows: Array<[string, string, string]>) {
    const section = el("section", { className: "memcfg-section" });

    section.appendChild(
      el("div", { className: "memcfg-section-header" }, [
        el("h2", { className: "memcfg-h2", textContent: title }),
        el("div", { className: "memcfg-count", textContent: String(rows.length) }),
      ])
    );

    const table = el("table", { className: "memcfg-table" });
    for (const [k, v, help] of rows) {
      const tr = el("tr");
      tr.appendChild(el("th", { textContent: k }));
      const td = el("td", { className: "memcfg-td" });
      td.appendChild(el("div", { className: "memcfg-val", textContent: v }));
      if (help) td.appendChild(el("div", { className: "memcfg-help", textContent: help }));
      tr.appendChild(td);
      table.appendChild(tr);
    }

    section.appendChild(table);
    return section;
  }

  static renderHints(configs: MemoryConfigs) {
    const hints = el("div", { className: "memcfg-hints" });

    const problems: string[] = [];
    const c: any = configs || {};

    if (!(Number(c.tileSize) > 0)) problems.push("tileSize should be > 0.");
    if (!(Number(c.maxTiles) > 0)) problems.push("maxTiles should be > 0.");
    if (!(Number(c.maxBatches) > 0)) problems.push("maxBatches should be > 0.");
    if (!(Number(c.maxBatchVertices) > 0)) problems.push("maxBatchVertices should be > 0.");
    if (!(Number(c.maxBatchIndices) >= 0)) problems.push("maxBatchIndices should be ≥ 0.");
    if (!(Number(c.maxBatchGeometries) > 0)) problems.push("maxBatchGeometries should be > 0.");
    if (!(Number(c.maxBatchMeshes) > 0)) problems.push("maxBatchMeshes should be > 0.");
    if (!(Number(c.maxBatchPrims) > 0)) problems.push("maxBatchPrims should be > 0.");

    if (!problems.length) {
      hints.appendChild(el("div", { className: "memcfg-ok", textContent: "No obvious config issues detected." }));
      return hints;
    }

    hints.appendChild(el("div", { className: "memcfg-warn-title", textContent: `Notes (${problems.length})` }));
    const ul = el("ul", { className: "memcfg-list" });
    for (const p of problems) ul.appendChild(el("li", { textContent: p }));
    hints.appendChild(ul);

    return hints;
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
// Default CSS (includes panel visuals since there is no per-panel host anymore)
// -----------------------------------------------------------------------------

const DEFAULT_CSS = `
.memcfg-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px; background: rgba(255,255,255,0.96); border: 1px solid #e6e6e6; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14); backdrop-filter: blur(2px); }

.memcfg-header { display: grid; gap: 10px; padding: 14px; border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; }
.memcfg-title { display: grid; gap: 4px; }
.memcfg-h1 { padding-top:10px;  font-size: 24px; color: #666666; font-weight: 650; }
.memcfg-subtitle { font-size: 12px; color: #444; line-height: 1.35; }

.memcfg-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.memcfg-caret { font-size: 14px; color: #444; width: 18px; text-align: center; }
.memcfg-btn { font-size: 12px; border-radius: 10px; padding: 6px 10px; border: 1px solid #e6e6e6; background: #fff; cursor: pointer; }
.memcfg-btn:hover { background: #fafafa; }

.memcfg-status { display: flex; gap: 8px; align-items: baseline; }
.memcfg-status-label { font-size: 12px; color: #666; }
.memcfg-status-value { font-size: 12px; font-weight: 600; }

.memcfg-body { margin-top: 12px; }
.memcfg-section { margin-top: 14px; }
.memcfg-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.memcfg-h2 { font-size: 13px; margin: 0; font-weight: 650; }
.memcfg-count { font-size: 12px; color: #666; }

.memcfg-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.memcfg-table th { text-align: left; color: #666; font-weight: 600; width: 170px; padding: 6px 8px; vertical-align: top; }
.memcfg-td { padding: 6px 8px; }
.memcfg-val { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.memcfg-help { margin-top: 2px; font-size: 11px; color: #777; line-height: 1.35; }
.memcfg-table tr + tr td, .memcfg-table tr + tr th { border-top: 1px solid #f0f0f0; }

.memcfg-hints { margin-top: 14px; }
.memcfg-ok { font-size: 12px; color: #2e7d32; }
.memcfg-warn-title { font-size: 12px; font-weight: 650; color: #7a5a00; margin-bottom: 6px; }
.memcfg-list { margin: 8px 0 0; padding-left: 18px; color: #222; font-size: 12px; }
`;
