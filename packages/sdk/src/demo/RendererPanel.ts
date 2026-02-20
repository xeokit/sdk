import { FloatingPanelFlowHost } from "./FloatingPanelFlowHost";
import {
  DrawCallStats,
  RenderBinStats,
  RenderInspector,
  RenderStats,
  ViewRenderStats,
} from "../webglrenderer/internal/inspectors";
import { WebGLRenderer } from "../webglrenderer";


function rendererLogIconDataUri(): string {
  // Redesigned: clipboard/document, GPU chip, timeline, log lines
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <!-- Shadow -->
  <rect x="10" y="12" width="36" height="46" rx="7" fill="#e6e6e6" opacity="0.35"/>
  <!-- Clipboard/document -->
  <rect x="8" y="8" width="36" height="46" rx="7" fill="#fff" stroke="#b3c6e0" stroke-width="2"/>
  <!-- Clipboard clip -->
  <rect x="20" y="4" width="12" height="8" rx="3" fill="#4a90e2" stroke="#2d5e8c" stroke-width="1"/>
  <!-- Timeline bar -->
  <rect x="14" y="18" width="24" height="3.5" rx="1.5" fill="#cfe5ff"/>
  <!-- Log lines -->
  <rect x="14" y="25" width="20" height="3" rx="1.5" fill="#e0e7ef"/>
  <rect x="14" y="31" width="16" height="3" rx="1.5" fill="#b3e6c7"/>
  <rect x="14" y="37" width="22" height="3" rx="1.5" fill="#e0e7ef"/>
  <!-- Checkmark (success log) -->
  <polyline points="16,28 18,30 22,26" fill="none" stroke="#27ae60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- GPU chip (bottom right) -->
  <rect x="32" y="40" width="12" height="12" rx="3" fill="#f7fafc" stroke="#7ec7e6" stroke-width="2"/>
  <rect x="36" y="44" width="4" height="4" rx="1" fill="#4a90e2"/>
  <!-- GPU pins -->
  <rect x="37" y="40" width="2" height="3" rx="1" fill="#b3c6e0"/>
  <rect x="37" y="49" width="2" height="3" rx="1" fill="#b3c6e0"/>
  <rect x="32" y="45" width="3" height="2" rx="1" fill="#b3c6e0"/>
  <rect x="43" y="45" width="3" height="2" rx="1" fill="#b3c6e0"/>
  <!-- Frame border -->
  <rect x="4" y="4" width="52" height="52" rx="12" fill="none" stroke="#e6e6e6" stroke-width="1.5"/>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Floating, dependency-free HTML view for RenderInspector (tiles + per-view frame logs).
 * - Mounts into the shared FloatingPanelFlowHost (flow layout with other panels).
 * - Collapsible panel.
 * - Tiles remain a collapsible tree.
 * - Views are shown in a low-navigation tabular layout (click row for details).
 * - No external deps.
 *
 * Usage:
 *   RendererPanel.show(renderer);
 *   RendererPanel.hide();
 *
 * Optional:
 *   const stop = RendererPanel.autoRefresh(inspector, { intervalMs: 250 });
 *   stop();
 */
export class RendererPanel {
  static #TILE_ID = "__renderinsp_tile__";
  static #STYLE_ID = "__renderinsp_style__";
  static #STATE_KEY = "__renderinsp_collapsed__";
  static #TREE_KEY = "__renderinsp_tree__";
  static #VIEWSEL_KEY = "__renderinsp_viewsel__";

  static show(flowHost: HTMLDivElement, renderer: WebGLRenderer, opts: any = {}) {
    this.#ensureGlobalStyle();

    let tile = document.getElementById(this.#TILE_ID) as HTMLDivElement | null;

    const inspectorResult = renderer.getRenderInspector();
    const inspector = inspectorResult.ok ? inspectorResult.value : null;

    const root = this.render(inspector, opts);

    if (!tile) {
      tile = FloatingPanelFlowHost.mountTile(root, {
        tileMinWidth: opts.tileMinWidth ?? 720,
        tileMaxWidth: opts.tileMaxWidth ?? 1200,
      }) as HTMLDivElement;
      tile.id = this.#TILE_ID;
      flowHost.appendChild(tile);
    } else {
      tile.replaceChildren(root);
    }

    // Re-render when a view finishes rendering
    renderer.events.onViewRendered.subscribe(() => {
      const tile = document.getElementById(this.#TILE_ID);
      if (!tile) return;

      const inspectorResult = renderer.getRenderInspector();
      const inspector = inspectorResult.ok ? inspectorResult.value : null;

      tile.replaceChildren(this.render(inspector, {}));
    });

    return tile;
  }

  static hide() {
    const tile = document.getElementById(this.#TILE_ID);
    if (tile) tile.remove();
  }

  static autoRefresh(inspector: RenderInspector, opts: { intervalMs?: number } = {}) {
    const intervalMs = Math.max(50, Number(opts.intervalMs ?? 250));
    const t = window.setInterval(() => {
      const tile = document.getElementById(this.#TILE_ID);
      if (!tile) return;
      tile.replaceChildren(this.render(inspector, {}));
    }, intervalMs);
    return () => window.clearInterval(t);
  }

  static render(inspector: RenderInspector | null, opts: any = {}) {
    const root = el("div", { className: "rins-root" });

    const collapsed = readBool(this.#STATE_KEY, !!opts.startCollapsed);
    const header = this.renderHeader({ collapsed }, inspector, opts);
    const body = this.renderBody(inspector, opts);

    root.appendChild(header);
    root.appendChild(body);

    this.#setCollapsed(root, collapsed);

    // Wire header controls (IMPORTANT: query from header/root, not document)
    header.querySelector<HTMLButtonElement>("[data-rins-toggle]")?.addEventListener("click", () => {
      const nowCollapsed = !root.classList.contains("rins-collapsed");
      this.#setCollapsed(root, nowCollapsed);
      writeBool(this.#STATE_KEY, nowCollapsed);
    });

    header.querySelector<HTMLButtonElement>("[data-rins-refresh]")?.addEventListener("click", () => {
      const newRoot = this.render(inspector, opts);
      root.replaceWith(newRoot);
    });

    header.querySelector<HTMLButtonElement>("[data-rins-expandall]")?.addEventListener("click", () => {
      this.#setAllTreeOpen(root, true);
    });

    header.querySelector<HTMLButtonElement>("[data-rins-collapseall]")?.addEventListener("click", () => {
      this.#setAllTreeOpen(root, false);
    });

    header.querySelector<HTMLInputElement>("[data-rins-filter]")?.addEventListener("input", (e) => {
      const q = String((e.target as HTMLInputElement).value || "");
      this.#applyFilter(root, q);
    });

    // Persist open/close for tree nodes (Tiles)
    body.addEventListener("toggle", (e) => {
      const d = e.target as HTMLElement;
      if (!(d instanceof HTMLDetailsElement)) return;
      const key = d.getAttribute("data-rins-path");
      if (!key) return;
      const state = readJson(this.#TREE_KEY, {} as Record<string, boolean>);
      state[key] = d.open;
      writeJson(this.#TREE_KEY, state);
    });

    // Copy buttons (tiles/detail KV blocks)
    body.addEventListener("click", async (e) => {
      const t = e.target as HTMLElement;
      const btn = t.closest("[data-rins-copy]") as HTMLElement | null;
      if (!btn) return;

      const path = btn.getAttribute("data-rins-copy") || "";
      const node = body.querySelector<HTMLElement>(`[data-rins-plain="${cssEscape(path)}"]`);
      const text = (node as any)?.dataset?.rinsPlain ?? node?.textContent ?? "";
      await tryCopy(String(text));

      const old = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = old || "Copy"), 700);
    });

    // View selection buttons/rows (tabular Views)
    body.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const pick = t.closest("[data-rins-viewpick]") as HTMLElement | null;
      if (!pick) return;

      const idx = Number(pick.getAttribute("data-rins-viewpick"));
      if (!Number.isFinite(idx)) return;

      writeNumber(this.#VIEWSEL_KEY, idx);

      const tile = document.getElementById(this.#TILE_ID);
      if (!tile) return;
      tile.replaceChildren(this.render(inspector, {}));
    });

    return root;
  }

  // ---------------------------------------------------------------------------
  // Header / Body
  // ---------------------------------------------------------------------------

  static renderHeader(
    { collapsed }: { collapsed: boolean },
    inspector: RenderInspector | null,
    opts: any = {}
  ) {
    const title = opts.title ?? "Renderer";
    const subtitle = opts.subtitle ?? "WebGLRenderer executon log for the last frame.";

    const renderStats = (inspector as any)?.renderStats as RenderStats | undefined;
    const views = (renderStats?.views ?? []) as Array<ViewRenderStats | null>;
    const viewsCount = views.filter((v) => !!v).length;
    const tilesCount = renderStats?.tiles ? Object.keys(renderStats.tiles).length : 0;

    const header = el("div", { className: "rins-header" });

    // Icon (renderer log)
    const icon = el("img", {
      className: "rins-title-icon",
      width: 60,
      height: 60,
      alt: "Renderer log",
      src: rendererLogIconDataUri(),
      draggable: false,
    });

    // Title and subtitle stacked vertically, left-justified
    const textCol = el("div", { className: "rins-title-col" }, [
      el("div", { className: "rins-h1", textContent: title }),
      el("div", { className: "rins-subtitle", textContent: subtitle }),
    ]);

    // Flex row: icon | textCol
    header.appendChild(icon);
    header.appendChild(textCol);

    return header;
  }

  static renderBody(inspector: RenderInspector | null, _opts: any = {}) {
    const body = el("div", { className: "rins-body" });

    const renderStats = (inspector as any)?.renderStats as RenderStats | undefined;
    const frameRates = (inspector as any)?.frameRates as Array<number | null> | undefined;

    const state = readJson(this.#TREE_KEY, {} as Record<string, boolean>);

    if (!renderStats) {
      body.appendChild(
        el("div", { className: "rins-empty", textContent: "No renderStats available on inspector." })
      );
      return body;
    }

    const tree = el("div", { className: "rins-tree", ["data-rins-tree-root" as any]: "" });

    // Tiles (tree)
    // const tilesNode = this.#treeNode("Tiles", "renderStats.tiles", state, () => {
    //   const wrap = document.createElement("div");
    //   const tiles = (renderStats.tiles ?? {}) as any;
    //   const ids = Object.keys(tiles).sort();
    //   if (!ids.length) {
    //     wrap.appendChild(el("div", { className: "rins-empty", textContent: "No tiles." }));
    //     return wrap;
    //   }
    //
    //   for (const id of ids) {
    //     const tile = tiles[id];
    //     wrap.appendChild(
    //       this.#treeNode(`Tile ${id}`, `renderStats.tiles.${id}`, state, () => {
    //         return this.#kvTable(
    //           [
    //             ["id", String(tile?.id ?? id)],
    //             ["tileIndex", formatAny(tile?.tileIndex)],
    //             ["numMeshes", formatAny(tile?.numMeshes)],
    //             ["rtcCenter", formatAny(tile?.rtcCenter)],
    //           ],
    //           `tile:${id}`
    //         );
    //       })
    //     );
    //   }
    //   return wrap;
    // });
    // tree.appendChild(tilesNode);

    // Views (tabular, low navigation)
    tree.appendChild(this.#renderViewsTable(inspector, renderStats, frameRates));

    body.appendChild(tree);
    return body;
  }

  // ---------------------------------------------------------------------------
  // Views (TABULAR)
  // ---------------------------------------------------------------------------

  static #renderViewsTable(
    inspector: RenderInspector | null,
    renderStats: RenderStats,
    frameRates: Array<number | null> | undefined
  ) {
    const wrap = el("section", { className: "rins-views", ["data-rins-node" as any]: "" });

    const views = (renderStats.views ?? []) as Array<ViewRenderStats | null>;
    const completed = views.filter((v) => !!v).length;

    wrap.appendChild(
      el("div", { className: "rins-section-head" }, [
        el("div", { className: "rins-section-title", textContent: "Views" }),
        el("div", { className: "rins-section-meta", textContent: `${completed}/${views.length} frames` }),
      ])
    );

    if (!views.length) {
      wrap.appendChild(el("div", { className: "rins-empty", textContent: "No view slots yet." }));
      return wrap;
    }

    const sel = readNumber(this.#VIEWSEL_KEY, 0);
    const selectedIndex = clampInt(sel, 0, views.length - 1);

    const table = el("table", { className: "rins-viewtable" });

    table.appendChild(
      el("thead", {}, [
        el("tr", {}, [
          el("th", { textContent: "viewIndex" }),
          el("th", { textContent: "viewId" }),
          el("th", { textContent: "canvas" }),
          el("th", { textContent: "fps" }),
          el("th", { textContent: "drawCalls" }),
          el("th", { textContent: "prims" }),
          el("th", { textContent: "time" }),
          el("th", { textContent: "" }),
        ]),
      ])
    );

    const tbody = el("tbody");
    table.appendChild(tbody);

    for (let viewIndex = 0; viewIndex < views.length; viewIndex++) {
      const frame = views[viewIndex];
      const fps = frameRates?.[viewIndex] ?? null;

      const tr = el("tr", {
        className: `rins-viewrow ${viewIndex === selectedIndex ? "is-selected" : ""}`,
        ["data-rins-viewrow" as any]: "",
        ["data-rins-plain" as any]: `views:${viewIndex}`,
      }) as HTMLTableRowElement;

      (tr as any).dataset.rinsPlain = safeJson({
        viewIndex,
        viewId: frame?.viewId ?? null,
        canvasSize: frame?.canvasSize ?? null,
        numDrawCalls: frame?.numDrawCalls ?? null,
        numPrims: frame?.numPrims ?? null,
        fps,
        timeMs: frame?.timeMs ?? null,
      });

      tr.appendChild(el("td", { textContent: String(viewIndex) }));
      tr.appendChild(el("td", { textContent: frame?.viewId ?? "—" }));
      tr.appendChild(
        el("td", {
          textContent: frame ? `${frame.canvasSize?.[0] ?? "—"} × ${frame.canvasSize?.[1] ?? "—"}` : "—",
        })
      );
      tr.appendChild(el("td", { textContent: fps == null ? "—" : fps.toFixed(2) }));
      tr.appendChild(el("td", { textContent: frame ? String(frame.numDrawCalls ?? "—") : "—" }));
      tr.appendChild(el("td", { textContent: frame ? String(frame.numPrims ?? "—") : "—" }));
      tr.appendChild(el("td", { textContent: frame ? formatTimeMs(frame.timeMs) : "—" }));

      const btn = el("button", {
        className: "rins-btn rins-btn--sub rins-viewbtn",
        textContent: "Details",
        ["data-rins-viewpick" as any]: String(viewIndex),
        title: "Select this view",
      }) as HTMLButtonElement;

      tr.appendChild(el("td", { className: "rins-viewbtncell" }, [
      //  btn
      ]));

      // Row click selects too (but don’t steal button click)
      tr.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        if (t.closest("button")) return;
        writeNumber(this.#VIEWSEL_KEY, viewIndex);

        const tile = document.getElementById(this.#TILE_ID);
        if (!tile) return;
        tile.replaceChildren(this.render(inspector, {}));
      });

      tbody.appendChild(tr);
    }

    wrap.appendChild(table);

    // Detail area
    wrap.appendChild(
      this.#renderViewDetails(selectedIndex, views[selectedIndex], frameRates?.[selectedIndex] ?? null)
    );

    return wrap;
  }

  static #renderViewDetails(viewIndex: number, frame: ViewRenderStats | null, fps: number | null) {
    const box = el("div", { className: "rins-viewdetail" });

    box.appendChild(
      el("div", { className: "rins-viewdetail-title" }, [
        el("div", { className: "rins-viewdetail-h", textContent: `Selected view: ${viewIndex}` }),
        el("div", { className: "rins-viewdetail-sub", textContent: frame?.viewId ?? "—" }),
      ])
    );

    if (!frame) {
      box.appendChild(el("div", { className: "rins-empty", textContent: "No completed frame for this viewIndex." }));
      return box;
    }

    box.appendChild(
      this.#kvTable(
        [
          ["viewId", frame.viewId],
          ["canvasSize", `${frame.canvasSize?.[0] ?? "—"} × ${frame.canvasSize?.[1] ?? "—"}`],
          ["numDrawCalls", String(frame.numDrawCalls ?? "—")],
          ["numPrims", String(frame.numPrims ?? "—")],
          ["timeMs", formatTimeMs(frame.timeMs)],
          ["fps", fps == null ? "—" : fps.toFixed(2)],
        ],
        `view:${viewIndex}`
      )
    );

    const bins = (frame.renderBins ?? []) as RenderBinStats[];
    box.appendChild(this.#renderBinsTable(viewIndex, bins));
    box.appendChild(this.#renderDrawCallsDetails(viewIndex, bins));

    return box;
  }

  static #renderBinsTable(viewIndex: number, bins: RenderBinStats[]) {
    const wrap = el("div", { className: "rins-bins" });

    wrap.appendChild(
      el("div", { className: "rins-subhead" }, [
        el("div", { className: "rins-subtitle2", textContent: `Render bins executed (${bins.length})` }),
      ])
    );

    if (!bins.length) {
      wrap.appendChild(el("div", { className: "rins-empty", textContent: "No render bins executed." }));
      return wrap;
    }

    const table = el("table", { className: "rins-bintable" });
    table.appendChild(
      el("thead", {}, [
        el("tr", {}, [
          el("th", { textContent: "name" }),
          el("th", { textContent: "drawCalls" }),
          el("th", { textContent: "time" }),
        ]),
      ])
    );

    const tbody = el("tbody");
    table.appendChild(tbody);

    for (let i = 0; i < bins.length; i++) {
      const b = bins[i];
      const calls = (b.drawCalls ?? []) as DrawCallStats[];

      const tr = el("tr", { ["data-rins-plain" as any]: `view:${viewIndex}:bin:${i}` }) as HTMLTableRowElement;
      (tr as any).dataset.rinsPlain = safeJson({
        name: b.name,
        timeMs: b.timeMs,
        drawCalls: calls.length,
      });

      tr.appendChild(el("td", { textContent: b.name }));
      tr.appendChild(el("td", { textContent: String(calls.length) }));
      tr.appendChild(el("td", { textContent: formatTimeMs(b.timeMs) }));
      tbody.appendChild(tr);
    }

    wrap.appendChild(table);
    return wrap;
  }

  static #renderDrawCallsDetails(viewIndex: number, bins: RenderBinStats[]) {
    const details = el("details", { className: "rins-dcdetails", open: false }) as HTMLDetailsElement;
    details.appendChild(el("summary", { className: "rins-dcsum", textContent: "Draw calls executed" }));

    const all: Array<{ binName: string; dc: DrawCallStats }> = [];
    for (const b of bins) {
      for (const dc of (b.drawCalls ?? []) as DrawCallStats[]) {
        all.push({ binName: b.name, dc });
      }
    }

    if (!all.length) {
      details.appendChild(el("div", { className: "rins-empty", textContent: "No draw calls." }));
      return details;
    }

    const table = el("table", {
      className: "rins-dctable",
      ["data-rins-plain" as any]: `view:${viewIndex}:drawcalls`,
    }) as HTMLTableElement;

    (table as any).dataset.rinsPlain = safeJson(all.map((x) => ({ bin: x.binName, ...x.dc })));

    table.appendChild(
      el("thead", {}, [
        el("tr", {}, [
          el("th", { textContent: "bin" }),
          el("th", { textContent: "renderPass" }),
          el("th", { textContent: "primitive" }),
          el("th", { textContent: "batch" }),
          el("th", { textContent: "primRange" }),
          el("th", { textContent: "time" }),
        ]),
      ])
    );

    const tbody = el("tbody");
    table.appendChild(tbody);

    const MAX = 200;
    const slice = all.slice(0, MAX);

    for (const { binName, dc } of slice) {
      const pr0 = dc.primRange?.firstPrim ?? "—";
      const prn = dc.primRange?.numPrims ?? "—";

      const tr = el("tr");
      tr.appendChild(el("td", { textContent: binName }));
      tr.appendChild(el("td", { textContent: dc.renderPass }));
      tr.appendChild(el("td", { textContent: dc.primitive }));
      tr.appendChild(el("td", { textContent: String(dc.batchIndex) }));
      tr.appendChild(el("td", { textContent: `${pr0} / ${prn}` }));
      tr.appendChild(el("td", { textContent: formatTimeMs(dc.timeMs) }));
      tbody.appendChild(tr);
    }

    if (all.length > MAX) {
      details.appendChild(
        el("div", {
          className: "rins-empty",
          textContent: `Showing first ${MAX.toLocaleString()} draw calls (of ${all.length.toLocaleString()}). Use filter + Copy JSON if needed.`,
        })
      );
    }

    details.appendChild(table);
    return details;
  }

  // ---------------------------------------------------------------------------
  // Tree + helpers (Tiles)
  // ---------------------------------------------------------------------------

  static #treeNode(
    label: string,
    path: string,
    state: Record<string, boolean>,
    renderChildren: () => HTMLElement
  ) {
    const details = el("details", {
      className: "rins-details",
      open: state[path] ?? false,
      ["data-rins-path" as any]: path,
      ["data-rins-node" as any]: "",
    }) as HTMLDetailsElement;

    const summary = el("summary", { className: "rins-summary" }, [
      el("span", { className: "rins-node-label", textContent: label }),
      el("span", { className: "rins-node-path", textContent: path }),
    ]);

    const content = el("div", { className: "rins-node-content" });
    content.appendChild(renderChildren());

    details.appendChild(summary);
    details.appendChild(content);
    return details;
  }

  static #kvTable(rows: Array<[string, string]>, pathForCopy: string) {
    const wrap = el("div", { className: "rins-kvwrap" });

    const head = el("div", { className: "rins-kvhead" }, [
      // el("div", { className: "rins-kvtitle", textContent: "Details" }),
      // el("button", {
      //   className: "rins-btn rins-btn--sub",
      //   textContent: "Copy JSON",
      //   ["data-rins-copy" as any]: pathForCopy,
      // }),
    ]);

    const table = el("table", {
      className: "rins-table",
      ["data-rins-plain" as any]: pathForCopy,
    }) as HTMLTableElement;

    (table as any).dataset.rinsPlain = safeJson(Object.fromEntries(rows));

    for (const [k, v] of rows) {
      const tr = el("tr");
      tr.appendChild(el("th", { textContent: k }));
      tr.appendChild(el("td", { textContent: v }));
      table.appendChild(tr);
    }

    wrap.appendChild(head);
    wrap.appendChild(table);
    return wrap;
  }

  static #setCollapsed(root: HTMLElement, collapsed: boolean) {
    root.classList.toggle("rins-collapsed", collapsed);

    const body = root.querySelector<HTMLElement>(".rins-body");
    if (body) body.style.display = collapsed ? "none" : "block";

    const caret = root.querySelector<HTMLElement>("[data-rins-caret]");
    if (caret) caret.textContent = collapsed ? "▸" : "▾";

    const state = root.querySelector<HTMLElement>("[data-rins-state]");
    if (state) state.textContent = collapsed ? "Collapsed" : "Expanded";
  }

  static #setAllTreeOpen(root: HTMLElement, open: boolean) {
    const state = readJson(this.#TREE_KEY, {} as Record<string, boolean>);
    const nodes = root.querySelectorAll<HTMLDetailsElement>(".rins-details[data-rins-path]");
    nodes.forEach((d) => {
      const path = d.getAttribute("data-rins-path") || "";
      d.open = open;
      if (path) state[path] = open;
    });
    writeJson(this.#TREE_KEY, state);
  }

  static #applyFilter(root: HTMLElement, query: string) {
    const q = query.trim().toLowerCase();
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-rins-node], .rins-kvwrap, .rins-table"));

    if (!q) {
      nodes.forEach((n) => (n.style.display = ""));
      return;
    }

    nodes.forEach((n) => (n.style.display = "none"));

    const matches: HTMLElement[] = [];

    // match summaries (labels/paths)
    for (const d of Array.from(root.querySelectorAll<HTMLDetailsElement>("[data-rins-node]"))) {
      const txt = (d.querySelector(".rins-summary")?.textContent || "").toLowerCase();
      if (txt.includes(q)) matches.push(d);
    }

    // match table JSON/plain
    for (const t of Array.from(root.querySelectorAll<HTMLElement>("[data-rins-plain]"))) {
      const plain = String((t as any).dataset?.rinsPlain ?? t.textContent ?? "").toLowerCase();
      const path = String(t.getAttribute("data-rins-plain") || "").toLowerCase();
      if (plain.includes(q) || path.includes(q)) {
        const wrap = t.closest<HTMLElement>(".rins-kvwrap");
        if (wrap) matches.push(wrap);
        const node = t.closest<HTMLElement>("[data-rins-node]");
        if (node) matches.push(node);
      }
    }

    for (const m of matches) {
      let cur: HTMLElement | null = m;
      while (cur) {
        if (cur.matches("[data-rins-node], .rins-kvwrap, .rins-tree, .rins-views")) cur.style.display = "";
        cur = cur.parentElement;
      }
      m.style.display = "";
    }
  }

  static #ensureGlobalStyle() {
    if (document.getElementById(this.#STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = this.#STYLE_ID;
    s.textContent = DEFAULT_CSS;
    document.head.appendChild(s);
  }
}

// -----------------------------------------------------------------------------
// Utilities
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

function formatAny(v: any) {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString() : String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function formatTimeMs(timeMs: any) {
  if (!timeMs) return "—";
  const d = Number(timeMs.duration);
  const s = Number(timeMs.start);
  const e = Number(timeMs.end);
  const dur = Number.isFinite(d) ? `${d.toFixed(2)} ms` : "—";
  const start = Number.isFinite(s) ? s.toFixed(2) : "—";
  const end = Number.isFinite(e) ? e.toFixed(2) : "—";
  return `${dur}`;
}

async function tryCopy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {}
    ta.remove();
  }
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
  } catch {}
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: any) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function cssEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function readNumber(key: string, fallback: number): number {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function writeNumber(key: string, value: number) {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {}
}

function clampInt(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.trunc(v)));
}

// -----------------------------------------------------------------------------
// Default CSS
// -----------------------------------------------------------------------------

const DEFAULT_CSS = `
.rins-root {
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  color: #111;
  padding: 16px;
  background: rgba(255,255,255,0.96);
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.14);
  backdrop-filter: blur(2px);
}

.rins-header { display: grid; gap: 10px; padding: 14px; border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; }
.rins-title { display: grid; gap: 4px; }
.rins-h1 { padding-top:10px;  font-size: 24px; color: #666666; font-weight: 650; }
.rins-subtitle { font-size: 12px; color: #444; line-height: 1.35; }

.rins-filter { width: 100%; border-radius: 10px; border: 1px solid #e6e6e6; padding: 8px 10px; font-size: 12px; }
.rins-filter:focus { outline: none; border-color: #cfe5ff; box-shadow: 0 0 0 3px rgba(207,229,255,0.7); }

.rins-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.rins-caret { font-size: 14px; color: #444; width: 18px; text-align: center; }

.rins-btn { font-size: 12px; border-radius: 10px; padding: 6px 10px; border: 1px solid #e6e6e6; background: #fff; cursor: pointer; }
.rins-btn:hover { background: #fafafa; }
.rins-btn--sub { padding: 5px 8px; border-radius: 10px; font-size: 11px; }

.rins-status { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.rins-status-label { font-size: 12px; color: #666; }
.rins-status-value { font-size: 12px; font-weight: 600; }
.rins-dot { color: #aaa; }
.rins-on { color: #2e7d32; }
.rins-off { color: #b00020; }

.rins-body { margin-top: 12px; }
.rins-tree { display: grid; gap: 12px; }

.rins-details { border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; overflow: hidden; }
.rins-summary { cursor: pointer; display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 10px 12px; }
.rins-node-label { font-size: 12px; font-weight: 650; }
.rins-node-path {
  font-size: 11px; color: #777;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rins-node-content { padding: 10px 12px 12px; border-top: 1px solid #f0f0f0; display: grid; gap: 10px; }

.rins-kvwrap { border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; overflow: hidden; }
.rins-kvhead { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.rins-kvtitle { font-size: 12px; font-weight: 650; }

.rins-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.rins-table th { text-align: left; color: #666; font-weight: 600; width: 160px; padding: 6px 8px; vertical-align: top; }
.rins-table td { padding: 6px 8px; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.rins-table tr + tr td, .rins-table tr + tr th { border-top: 1px solid #f0f0f0; }

.rins-empty { font-size: 12px; color: #777; padding: 6px 0; }

.rins-collapsed .rins-body { display: none; }

/* -----------------------------
   Views (tabular, low navigation)
------------------------------ */

.rins-section-head { display: flex; justify-content: space-between; align-items: baseline; margin: 2px 0 10px; }
.rins-section-title { font-size: 13px; font-weight: 650; }
.rins-section-meta { font-size: 12px; color: #666; }

.rins-viewtable, .rins-bintable, .rins-dctable {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  background: #fff;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  overflow: hidden;
}
.rins-viewtable th, .rins-bintable th, .rins-dctable th {
  text-align: left;
  color: #666;
  font-weight: 650;
  padding: 8px 10px;
  border-bottom: 1px solid #f0f0f0;
}
.rins-viewtable td, .rins-bintable td, .rins-dctable td {
  padding: 8px 10px;
  border-top: 1px solid #f7f7f7;
  vertical-align: top;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.rins-viewrow { cursor: pointer; }
.rins-viewrow:hover { background: #fafafa; }
.rins-viewrow.is-selected { background: #f4f9ff; }

.rins-viewbtncell { width: 1%; white-space: nowrap; font-family: inherit; }
.rins-viewbtn { font-family: inherit; }

.rins-viewdetail { margin-top: 12px; display: grid; gap: 10px; }
.rins-viewdetail-title { display: grid; gap: 2px; }
.rins-viewdetail-h { font-size: 13px; font-weight: 650; }
.rins-viewdetail-sub { font-size: 12px; color: #666; }

.rins-subhead { display: flex; justify-content: space-between; align-items: baseline; margin-top: 6px; }
.rins-subtitle2 { font-size: 12px; font-weight: 550; color: #333;     padding-bottom: 10px; }

.rins-dcdetails { border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; padding: 10px 12px; }
.rins-dcsum { cursor: pointer; font-size: 12px; font-weight: 650; color: #333; }

.rins-header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
}
.rins-title-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 4px;
}
.rins-title-icon {
  width: 60px;
  height: 60px;
  flex: 0 0 60px;
  border-radius: 14px;
  border: 1.5px solid #e6e6e6;
  background: #fafafa;
  padding: 6px;
}
`;
