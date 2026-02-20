
import { MemoryUsage } from "../webglrenderer";
import { FloatingPanelFlowHost } from "./FloatingPanelFlowHost";

// In file: packages/sdk/src/demo/GPUMemoryUsagePanel.ts

function gpuMemoryIconDataUri(): string {
  // 60x60 SVG: bold RAM stick, chips, gold contacts, shadow
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <!-- Shadow -->
  <rect x="8" y="18" width="44" height="24" rx="7" fill="#222" opacity="0.18"/>
  <!-- RAM body -->
  <rect x="6" y="14" width="48" height="28" rx="7" fill="#4a90e2" stroke="#1c4e6e" stroke-width="2.5"/>
  <!-- Memory chips -->
  <rect x="13" y="20" width="8" height="12" rx="2" fill="#222" stroke="#b3c6e0" stroke-width="1.5"/>
  <rect x="25" y="20" width="8" height="12" rx="2" fill="#222" stroke="#b3c6e0" stroke-width="1.5"/>
  <rect x="37" y="20" width="8" height="12" rx="2" fill="#222" stroke="#b3c6e0" stroke-width="1.5"/>
  <!-- Gold contacts -->
  <rect x="10" y="40" width="4" height="7" rx="1" fill="#ffd57a" stroke="#bfa14a" stroke-width="1"/>
  <rect x="18" y="40" width="4" height="7" rx="1" fill="#ffd57a" stroke="#bfa14a" stroke-width="1"/>
  <rect x="26" y="40" width="4" height="7" rx="1" fill="#ffd57a" stroke="#bfa14a" stroke-width="1"/>
  <rect x="34" y="40" width="4" height="7" rx="1" fill="#ffd57a" stroke="#bfa14a" stroke-width="1"/>
  <rect x="42" y="40" width="4" height="7" rx="1" fill="#ffd57a" stroke="#bfa14a" stroke-width="1"/>
  <!-- Frame border -->
  <rect x="4" y="4" width="52" height="52" rx="12" fill="none" stroke="#e6e6e6" stroke-width="1.5"/>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Generates a lightweight, dependency-free HTML view for a MemoryUsage object,
 * and mounts it into the shared FloatingPanelFlowHost so it flow-wraps with other panels.
 *
 * Usage:
 *   GPUMemoryUsagePanel.show(usage);            // create/update panel tile
 *   GPUMemoryUsagePanel.hide();                // remove tile
 *   GPUMemoryUsagePanel.toggle(usage);         // convenience
 */
export class GPUMemoryUsagePanel {
  static #TILE_ID = "__memusage_tile__";
  static #STYLE_ID = "__memusage_style__";
  static #STATE_KEY = "__memusage_collapsed__";

  /**
   * Creates (or updates) the panel and renders the usage into it.
   * Mounts into the shared flow host.
   */
  static show(flowHost: HTMLDivElement, usage: MemoryUsage, opts: any = {}) {
    this.#ensureGlobalStyle();

    // Create/locate tile
    let tile = document.getElementById(this.#TILE_ID) as HTMLDivElement | null;
    if (!tile) {
      const root = this.render(usage, opts);
      tile = FloatingPanelFlowHost.mountTile(root, {
        tileMinWidth: opts.tileMinWidth ?? opts.maxWidth ?? 420,
        tileMaxWidth: opts.tileMaxWidth ?? opts.maxWidth ?? 440,
      }) as HTMLDivElement;

      tile.id = this.#TILE_ID;
      flowHost.appendChild(tile);
    } else {
      // Update: replace panel root inside tile (keep tile stable)
      const root = this.render(usage, opts);
      tile.replaceChildren(root);
    }

    return tile;
  }

  // static hide() {
  //   const tile = document.getElementById(this.#TILE_ID);
  //   if (tile) tile.remove();
  // }
  //
  // static toggle(usage: MemoryUsage, opts?: any) {
  //   const tile = document.getElementById(this.#TILE_ID);
  //   if (tile) this.hide();
  //   else this.show(usage, opts);
  // }

  static render(usage: MemoryUsage, opts: any = {}) {
    const root = el("div", { className: "memusage-root" });

    const collapsed = readBool(this.#STATE_KEY, !!opts.startCollapsed);

    const header = this.renderHeader({ collapsed });
    const body = this.renderBody(usage);

    root.appendChild(header);
    root.appendChild(body);

    this.#setCollapsed(root, collapsed);

    const toggleBtn = header.querySelector<HTMLButtonElement>("[data-memusage-toggle]");
    toggleBtn?.addEventListener("click", () => {
      const nowCollapsed = !root.classList.contains("memusage-collapsed");
      this.#setCollapsed(root, nowCollapsed);
      writeBool(this.#STATE_KEY, nowCollapsed);
    });

    return root;
  }

  static toHtmlString(usage: MemoryUsage, opts: any = {}) {
    return this.render(usage, opts).outerHTML;
  }

  // ---------------------------------------------------------------------------
  // Styles + collapse
  // ---------------------------------------------------------------------------

  static #ensureGlobalStyle() {
    if (document.getElementById(this.#STYLE_ID)) return;

    const s = document.createElement("style");
    s.id = this.#STYLE_ID;
    s.textContent = DEFAULT_CSS;
    document.head.appendChild(s);
  }

  static #setCollapsed(root: HTMLElement, collapsed: boolean) {
    root.classList.toggle("memusage-collapsed", collapsed);

    const body = root.querySelector<HTMLElement>(".memusage-body");
    if (body) body.style.display = collapsed ? "none" : "block";

    const caret = root.querySelector<HTMLElement>("[data-memusage-caret]");
    if (caret) caret.textContent = collapsed ? "▸" : "▾";

    const state = root.querySelector<HTMLElement>("[data-memusage-state]");
    if (state) state.textContent = collapsed ? "Collapsed" : "Expanded";
  }

  // ---------------------------------------------------------------------------
  // Header / body
  // ---------------------------------------------------------------------------

  static renderHeader({ collapsed }: { collapsed: boolean }) {
  const header = el("div", { className: "memusage-header" });

  // Icon (GPU memory)
  const icon = el("img", {
    className: "memusage-title-icon",
    width: 60,
    height: 60,
    alt: "GPU memory",
    src: gpuMemoryIconDataUri(),
    draggable: false,
  });

  // Title and subtitle stacked vertically, left-justified
  const textCol = el("div", { className: "memusage-title-col" }, [
    el("div", { className: "memusage-h1", textContent: "GPU Memory Usage" }),
    el("div", {
      className: "memusage-subtitle",
      textContent: "Allocated vs actively used GPU memory (MB).",
    }),
  ]);

  header.appendChild(icon);
  header.appendChild(textCol);

  // ...actions, etc...
  return header;
}

  static renderBody(usage: MemoryUsage) {
    const body = el("div", { className: "memusage-body" });

    const allocated = Number(usage?.allocatedMB) || 0;
    const used = Number(usage?.usedMB) || 0;

    const pct = allocated > 0 ? clamp((used / allocated) * 100, 0, 100) : 0;

    body.appendChild(
      this.renderTable([
        ["allocatedMB", formatMB(allocated), "Total GPU memory allocated"],
        ["usedMB", formatMB(used), "GPU memory actively used"],
        ["usage", `${pct.toFixed(1)}%`, "usedMB / allocatedMB"],
      ])
    );

    body.appendChild(this.renderBar(pct));

    return body;
  }

  static renderTable(rows: Array<[string, string, string]>) {
    const table = el("table", { className: "memusage-table" });

    for (const [k, v, help] of rows) {
      const tr = el("tr");
      tr.appendChild(el("th", { textContent: k }));
      const td = el("td", { className: "memusage-td" });
      td.appendChild(el("div", { className: "memusage-val", textContent: v }));
      if (help) td.appendChild(el("div", { className: "memusage-help", textContent: help }));
      tr.appendChild(td);
      table.appendChild(tr);
    }

    return table;
  }

  static renderBar(pct: number) {
    const wrap = el("div", { className: "memusage-barwrap" });
    wrap.appendChild(el("div", { className: "memusage-barlabel", textContent: "Utilization" }));

    const track = el("div", { className: "memusage-track" });
    const fill = el("div", { className: "memusage-fill" });
    fill.style.width = `${pct}%`;

    track.appendChild(fill);
    wrap.appendChild(track);
    wrap.appendChild(el("div", { className: "memusage-barhint", textContent: `${pct.toFixed(1)}%` }));
    return wrap;
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

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function formatMB(v: number) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString()} MB` : "—";
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
// Default CSS
// -----------------------------------------------------------------------------

const DEFAULT_CSS = `
.memusage-root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 16px; background: rgba(255,255,255,0.96); border: 1px solid #e6e6e6; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14); backdrop-filter: blur(2px); }
.memusage-header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
}
.memusage-title-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 4px;
}
.memusage-title-icon {
  width: 60px;
  height: 60px;
  flex: 0 0 60px;
  border-radius: 14px;
  border: 1.5px solid #e6e6e6;
  background: #fafafa;
  padding: 6px;
}
.memusage-title { display: grid; gap: 4px; }
.memusage-h1 { padding-top:10px;  font-size: 24px; color: #666666; font-weight: 650; }
.memusage-subtitle { font-size: 12px; color: #444; line-height: 1.35; }

.memusage-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.memusage-caret { font-size: 14px; color: #444; width: 18px; text-align: center; }
.memusage-btn { font-size: 12px; border-radius: 10px; padding: 6px 10px; border: 1px solid #e6e6e6; background: #fff; cursor: pointer; }
.memusage-btn:hover { background: #fafafa; }

.memusage-status { display: flex; gap: 8px; align-items: baseline; }
.memusage-status-label { font-size: 12px; color: #666; }
.memusage-status-value { font-size: 12px; font-weight: 600; }

.memusage-body { margin-top: 12px; }
.memusage-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.memusage-table th { text-align: left; color: #666; font-weight: 600; width: 120px; padding: 6px 8px; vertical-align: top; }
.memusage-td { padding: 6px 8px; }
.memusage-val { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.memusage-help { margin-top: 2px; font-size: 11px; color: #777; line-height: 1.35; }
.memusage-table tr + tr td, .memusage-table tr + tr th { border-top: 1px solid #f0f0f0; }

.memusage-barwrap { margin-top: 12px; border-top: 1px solid #f0f0f0; padding-top: 10px; display: grid; gap: 6px; }
.memusage-barlabel { font-size: 12px; font-weight: 650; color: #333; }
.memusage-track { height: 10px; border-radius: 999px; background: #f0f0f0; overflow: hidden; border: 1px solid #e6e6e6; }
.memusage-fill { height: 100%; border-radius: 999px; background: #cfe5ff; }
.memusage-barhint { font-size: 11px; color: #666; }
`;
