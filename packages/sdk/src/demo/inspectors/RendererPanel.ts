import { FloatingPanelFlowHost } from "./FloatingPanelFlowHost";
import {
  type DrawCallStats,
  type RenderBinStats,
  RenderInspector,
  type RenderStats,
  type ViewRenderStats,
} from "../../webGLRenderer/internal/inspectors";
import { WebGLRenderer } from "../../webGLRenderer";

function rendererLogIconDataUri(): string {
  // 60x60 SVG: scope/trace icon (timeline + waveform + markers + GPU chip badge)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <defs>
    <linearGradient id="traceGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7db3e6"/>
      <stop offset="100%" stop-color="#2d5e8c"/>
    </linearGradient>
  </defs>

  <!-- Soft shadow -->
  <ellipse cx="30" cy="52" rx="18" ry="6" fill="#000" opacity="0.10"/>

  <!-- Outer rounded frame -->
  <rect x="4" y="4" width="52" height="52" rx="12"
        fill="#ffffff"
        stroke="#e6e6e6"
        stroke-width="1.5"/>

  <!-- Scope screen -->
  <rect x="10" y="10" width="40" height="40" rx="10"
        fill="#fbfdff"
        stroke="#dbe7f3"
        stroke-width="1.5"/>

  <!-- Grid -->
  <g opacity="0.55" stroke="#e8eef6" stroke-width="1">
    <line x1="14" y1="18" x2="46" y2="18"/>
    <line x1="14" y1="26" x2="46" y2="26"/>
    <line x1="14" y1="34" x2="46" y2="34"/>
    <line x1="14" y1="42" x2="46" y2="42"/>
    <line x1="18" y1="14" x2="18" y2="46"/>
    <line x1="26" y1="14" x2="26" y2="46"/>
    <line x1="34" y1="14" x2="34" y2="46"/>
    <line x1="42" y1="14" x2="42" y2="46"/>
  </g>

  <!-- Trace waveform -->
  <path d="M14 34
           L18 34
           L20 28
           L23 40
           L26 22
           L29 34
           L32 30
           L35 38
           L38 26
           L41 34
           L46 34"
        fill="none"
        stroke="url(#traceGrad)"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"/>

  <!-- Span markers (like GPU debug markers) -->
  <g>
    <line x1="22" y1="16" x2="22" y2="46" stroke="#2d5e8c" stroke-width="1.5" opacity="0.25"/>
    <line x1="34" y1="16" x2="34" y2="46" stroke="#2d5e8c" stroke-width="1.5" opacity="0.25"/>
    <circle cx="22" cy="16" r="2" fill="#ffffff" stroke="#2d5e8c" stroke-width="1.3"/>
    <circle cx="34" cy="16" r="2" fill="#ffffff" stroke="#2d5e8c" stroke-width="1.3"/>
  </g>

  <!-- Little "cursor" dot on the trace -->
  <circle cx="29" cy="34" r="2.2" fill="#ffffff" stroke="#2d5e8c" stroke-width="1.2"/>

  <!-- GPU chip badge (bottom-right) -->
  <g transform="translate(36 36)">
    <rect x="0" y="0" width="14" height="14" rx="4" fill="#ffffff" stroke="#b7d7f2" stroke-width="1.6"/>
    <rect x="4.4" y="4.4" width="5.2" height="5.2" rx="1.4" fill="url(#traceGrad)" opacity="0.9"/>

    <!-- Pins -->
    <rect x="6" y="-2.2" width="2" height="3.2" rx="1" fill="#c7d6e6"/>
    <rect x="6" y="13" width="2" height="3.2" rx="1" fill="#c7d6e6"/>
    <rect x="-2.2" y="6" width="3.2" height="2" rx="1" fill="#c7d6e6"/>
    <rect x="13" y="6" width="3.2" height="2" rx="1" fill="#c7d6e6"/>
  </g>
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Floating, dependency-free HTML view for RenderInspector (per-view frame logs).
 * - Mounts into the shared FloatingPanelFlowHost (flow layout with other panels).
 * - Collapsible panel.
 * - Views are shown in a low-navigation tabular layout (click row for details).
 * - No external deps.
 */
export class RendererPanel {
  static #TILE_ID = "__renderinsp_tile__";
  static #STYLE_ID = "__renderinsp_style__";
  static #STATE_KEY = "__renderinsp_collapsed__";
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

    header.querySelector<HTMLButtonElement>("[data-rins-toggle]")?.addEventListener("click", () => {
      const nowCollapsed = !root.classList.contains("rins-collapsed");
      this.#setCollapsed(root, nowCollapsed);
      writeBool(this.#STATE_KEY, nowCollapsed);

      const btn = header.querySelector<HTMLButtonElement>("[data-rins-toggle]");
      if (btn) btn.textContent = nowCollapsed ? "Expand" : "Collapse";
    });

    header.querySelector<HTMLButtonElement>("[data-rins-refresh]")?.addEventListener("click", () => {
      const newRoot = this.render(inspector, opts);
      root.replaceWith(newRoot);
    });

    header.querySelector<HTMLButtonElement>("[data-rins-copyview]")?.addEventListener("click", async () => {
      const sel = readNumber(this.#VIEWSEL_KEY, 0);
      const renderStats = (inspector as any)?.renderStats as RenderStats | undefined;
      const frameRates = (inspector as any)?.frameRates as Array<number | null> | undefined;
      const frame = renderStats?.views?.[sel] ?? null;
      const fps = frameRates?.[sel] ?? null;

      const payload = safeJson({ selectedViewIndex: sel, fps, frame });
      await tryCopy(payload);

      const btn = header.querySelector<HTMLButtonElement>("[data-rins-copyview]");
      if (btn) {
        const old = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = old || "Copy view"), 700);
      }
    });

    // View selection by row click
    body.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const row = t.closest("[data-rins-viewrow]") as HTMLElement | null;
      if (!row) return;

      const idx = Number(row.getAttribute("data-rins-viewrow"));
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
    const subtitle = opts.subtitle ?? "WebGLRenderer execution log for the last frame.";

    const renderStats = (inspector as any)?.renderStats as RenderStats | undefined;
    const views = (renderStats?.views ?? []) as Array<ViewRenderStats | null>;
    const completed = views.filter((v) => !!v).length;

    const sel = readNumber(this.#VIEWSEL_KEY, 0);
    const selectedIndex = clampInt(sel, 0, Math.max(0, views.length - 1));
    const selected = views?.[selectedIndex] ?? null;

    const header = el("div", { className: "rins-header" });

    const icon = el("img", {
      className: "rins-title-icon",
      width: 60,
      height: 60,
      alt: "Renderer log",
      src: rendererLogIconDataUri(),
      draggable: false,
    });

    const textCol = el("div", { className: "rins-title-col" }, [
      el("div", { className: "rins-h1", textContent: title }),
      el("div", { className: "rins-subtitle", textContent: subtitle }),
    ]);

    const stats = el("div", { className: "rins-headstats" }, [
      this.#pill(`${completed}/${views.length} frames`, "neutral"),
      this.#pill(`drawCalls: ${selected?.numDrawCalls ?? "—"}`, typeof selected?.numDrawCalls === "number" ? "info" : "muted"),
      this.#pill(`prims: ${selected?.numPrims ?? "—"}`, typeof selected?.numPrims === "number" ? "info" : "muted"),
      this.#pill(`time: ${formatTimeMs(selected?.timeMs)}`, selected?.timeMs ? "info" : "muted"),
    ]);

    const actions = el("div", { className: "rins-actions" }, [
      el("button", {
        className: "rins-btn rins-btn--sub",
        ["data-rins-toggle" as any]: "",
        textContent: collapsed ? "Expand" : "Collapse",
        title: "Toggle collapse",
      }),
      el("button", {
        className: "rins-btn rins-btn--sub",
        ["data-rins-refresh" as any]: "",
        textContent: "Refresh",
        title: "Re-render from inspector",
      }),
      el("button", {
        className: "rins-btn rins-btn--sub",
        ["data-rins-copyview" as any]: "",
        textContent: "Copy view",
        title: "Copy selected view JSON to clipboard",
      }),
    ]);

    const mid = el("div", { className: "rins-headmid" }, [textCol, stats]);

    header.appendChild(icon);
    header.appendChild(mid);
    header.appendChild(actions);

    return header;
  }

  static renderBody(inspector: RenderInspector | null, _opts: any = {}) {
    const body = el("div", { className: "rins-body" });

    const renderStats = (inspector as any)?.renderStats as RenderStats | undefined;
    const frameRates = (inspector as any)?.frameRates as Array<number | null> | undefined;

    if (!renderStats) {
      body.appendChild(el("div", { className: "rins-empty", textContent: "No renderStats available on inspector." }));
      return body;
    }

    const tree = el("div", { className: "rins-tree" });

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
    const wrap = el("section", { className: "rins-views" });

    const views = (renderStats.views ?? []) as Array<ViewRenderStats | null>;
    const completed = views.filter((v) => !!v).length;

    wrap.appendChild(
      el("div", { className: "rins-section-head" }, [
        el("div", { className: "rins-section-title", textContent: "Views" }),
        el("div", { className: "rins-section-meta", textContent: `${completed}/${views.length} frames · click row for details` }),
      ])
    );

    if (!views.length) {
      wrap.appendChild(el("div", { className: "rins-empty", textContent: "No view slots yet." }));
      return wrap;
    }

    const sel = readNumber(this.#VIEWSEL_KEY, 0);
    const selectedIndex = clampInt(sel, 0, views.length - 1);

    const table = el("table", { className: "rins-viewtable" });

    // Fixed column geometry to keep header/body perfectly aligned
    const colgroup = el("colgroup");
    colgroup.appendChild(el("col", { className: "rins-col-idx" }));
    colgroup.appendChild(el("col", { className: "rins-col-id" }));
    colgroup.appendChild(el("col", { className: "rins-col-canvas" }));
    colgroup.appendChild(el("col", { className: "rins-col-fps" }));
    colgroup.appendChild(el("col", { className: "rins-col-dc" }));
    colgroup.appendChild(el("col", { className: "rins-col-pr" }));
    colgroup.appendChild(el("col", { className: "rins-col-time" }));
    table.appendChild(colgroup);

    table.appendChild(
      el("thead", {}, [
        el("tr", {}, [
          el("th", { className: "rins-th rins-th--num", textContent: "#" }),
          el("th", { className: "rins-th", textContent: "viewId" }),
          el("th", { className: "rins-th", textContent: "canvas" }),
          el("th", { className: "rins-th rins-th--num", textContent: "fps" }),
          el("th", { className: "rins-th rins-th--num", textContent: "drawCalls" }),
          el("th", { className: "rins-th rins-th--num", textContent: "prims" }),
          el("th", { className: "rins-th", textContent: "time" }),
        ]),
      ])
    );

    const tbody = el("tbody");
    table.appendChild(tbody);

    for (let viewIndex = 0; viewIndex < views.length; viewIndex++) {
      const frame = views[viewIndex];
      const fps = frameRates?.[viewIndex] ?? null;

      const tr = el("tr", {
        className: `rins-viewrow ${viewIndex === selectedIndex ? "is-selected" : ""} ${frame ? "is-ready" : "is-empty"}`,
        ["data-rins-viewrow" as any]: String(viewIndex),
        ["data-rins-plain" as any]: `views:${viewIndex}`,
        title: frame ? "Select this view" : "No completed frame for this viewIndex yet",
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

      tr.appendChild(el("td", { className: "rins-td rins-td--num", textContent: String(viewIndex) }));
      tr.appendChild(el("td", { className: "rins-td rins-td--mono", textContent: frame?.viewId ?? "—" }));
      tr.appendChild(
        el("td", {
          className: "rins-td rins-td--mono",
          textContent: frame ? `${frame.canvasSize?.[0] ?? "—"} × ${frame.canvasSize?.[1] ?? "—"}` : "—",
        })
      );
      tr.appendChild(el("td", { className: "rins-td rins-td--num", textContent: fps == null ? "—" : fps.toFixed(2) }));
      tr.appendChild(el("td", { className: "rins-td rins-td--num", textContent: frame ? String(frame.numDrawCalls ?? "—") : "—" }));
      tr.appendChild(el("td", { className: "rins-td rins-td--num", textContent: frame ? String(frame.numPrims ?? "—") : "—" }));
      tr.appendChild(el("td", { className: "rins-td rins-td--mono", textContent: frame ? formatTimeMs(frame.timeMs) : "—" }));

      tbody.appendChild(tr);
    }

    wrap.appendChild(table);

    // Details
    wrap.appendChild(this.#renderViewDetails(selectedIndex, views[selectedIndex], frameRates?.[selectedIndex] ?? null));

    return wrap;
  }

  static #renderViewDetails(viewIndex: number, frame: ViewRenderStats | null, fps: number | null) {
    const box = el("div", { className: "rins-viewdetail" });

    box.appendChild(
      el("div", { className: "rins-viewdetail-title" }, [
        el("div", { className: "rins-viewdetail-h", textContent: `View ${viewIndex}` }),
        el("div", { className: "rins-viewdetail-sub", textContent: frame?.viewId ?? "—" }),
      ])
    );

    if (!frame) {
      box.appendChild(el("div", { className: "rins-empty", textContent: "No completed frame for this viewIndex." }));
      return box;
    }

    // Compact metrics strip (no "selected" tag)
    box.appendChild(
      el("div", { className: "rins-metrics" }, [
        RendererPanel.#metric("Canvas", `${frame.canvasSize?.[0] ?? "—"} × ${frame.canvasSize?.[1] ?? "—"}`),
        RendererPanel.#metric("FPS", fps == null ? "—" : fps.toFixed(2)),
        RendererPanel.#metric("Draw calls", String(frame.numDrawCalls ?? "—")),
        RendererPanel.#metric("Prims", String(frame.numPrims ?? "—")),
        RendererPanel.#metric("Time", formatTimeMs(frame.timeMs)),
      ])
    );

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

    // Sort bins by time desc
    const binsSorted = bins.slice().sort((a, b) => Number(b?.timeMs?.duration ?? 0) - Number(a?.timeMs?.duration ?? 0));

    const table = el("table", { className: "rins-bintable" });

    // Fixed columns (aligned)
    const colgroup = el("colgroup");
    colgroup.appendChild(el("col", { className: "rins-col-bin-name" }));
    colgroup.appendChild(el("col", { className: "rins-col-bin-dc" }));
    colgroup.appendChild(el("col", { className: "rins-col-bin-time" }));
    table.appendChild(colgroup);

    table.appendChild(
      el("thead", {}, [
        el("tr", {}, [
          el("th", { className: "rins-th", textContent: "name" }),
          el("th", { className: "rins-th rins-th--num", textContent: "drawCalls" }),
          el("th", { className: "rins-th", textContent: "time" }),
        ]),
      ])
    );

    const tbody = el("tbody");
    table.appendChild(tbody);

    for (let i = 0; i < binsSorted.length; i++) {
      const b = binsSorted[i];
      const calls = (b.drawCalls ?? []) as DrawCallStats[];

      const tr = el("tr", { ["data-rins-plain" as any]: `view:${viewIndex}:bin:${i}` }) as HTMLTableRowElement;
      (tr as any).dataset.rinsPlain = safeJson({
        name: b.name,
        timeMs: b.timeMs,
        drawCalls: calls.length,
      });

      tr.appendChild(el("td", { className: "rins-td rins-td--mono", textContent: b.name }));
      tr.appendChild(el("td", { className: "rins-td rins-td--num", textContent: String(calls.length) }));
      tr.appendChild(el("td", { className: "rins-td rins-td--mono", textContent: formatTimeMs(b.timeMs) }));

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
      for (const dc of (b.drawCalls ?? []) as DrawCallStats[]) all.push({ binName: b.name, dc });
    }

    if (!all.length) {
      details.appendChild(el("div", { className: "rins-empty", textContent: "No draw calls." }));
      return details;
    }

    // Sort draw calls by time desc
    all.sort((a, b) => Number(b.dc?.timeMs?.duration ?? 0) - Number(a.dc?.timeMs?.duration ?? 0));

    const table = el("table", {
      className: "rins-dctable",
      ["data-rins-plain" as any]: `view:${viewIndex}:drawcalls`,
    }) as HTMLTableElement;

    (table as any).dataset.rinsPlain = safeJson(all.map((x) => ({ bin: x.binName, ...x.dc })));

    // Fixed columns for alignment
    const colgroup = el("colgroup");
    colgroup.appendChild(el("col", { className: "rins-col-dc-bin" }));
    colgroup.appendChild(el("col", { className: "rins-col-dc-pass" }));
    colgroup.appendChild(el("col", { className: "rins-col-dc-prim" }));
    colgroup.appendChild(el("col", { className: "rins-col-dc-batch" }));
    colgroup.appendChild(el("col", { className: "rins-col-dc-range" }));
    colgroup.appendChild(el("col", { className: "rins-col-dc-time" }));
    table.appendChild(colgroup);

    table.appendChild(
      el("thead", {}, [
        el("tr", {}, [
          el("th", { className: "rins-th", textContent: "bin" }),
          el("th", { className: "rins-th", textContent: "renderPass" }),
          el("th", { className: "rins-th", textContent: "primitive" }),
          el("th", { className: "rins-th rins-th--num", textContent: "batch" }),
          el("th", { className: "rins-th", textContent: "primRange" }),
          el("th", { className: "rins-th", textContent: "time" }),
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
      tr.appendChild(el("td", { className: "rins-td rins-td--mono", textContent: binName }));
      tr.appendChild(el("td", { className: "rins-td rins-td--mono", textContent: dc.renderPass }));
      tr.appendChild(el("td", { className: "rins-td rins-td--mono", textContent: dc.primitive }));
      tr.appendChild(el("td", { className: "rins-td rins-td--num", textContent: String(dc.batchIndex) }));
      tr.appendChild(el("td", { className: "rins-td rins-td--mono", textContent: `${pr0} / ${prn}` }));
      tr.appendChild(el("td", { className: "rins-td rins-td--mono", textContent: formatTimeMs(dc.timeMs) }));
      tbody.appendChild(tr);
    }

    if (all.length > MAX) {
      details.appendChild(
        el("div", {
          className: "rins-empty",
          textContent: `Showing first ${MAX.toLocaleString()} draw calls (of ${all.length.toLocaleString()}).`,
        })
      );
    }

    details.appendChild(table);
    return details;
  }

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  static #pill(text: string, tone: "neutral" | "info" | "muted") {
    return el("span", { className: `rins-pill rins-pill--${tone}`, textContent: text });
  }

  static #metric(label: string, value: string) {
    return el("div", { className: "rins-metric" }, [
      el("div", { className: "rins-metric-k", textContent: label }),
      el("div", { className: "rins-metric-v", textContent: value }),
    ]);
  }

  static #kvTable(rows: Array<[string, string]>, pathForCopy: string) {
    const wrap = el("div", { className: "rins-kvwrap" });

    const head = el("div", { className: "rins-kvhead" }, [
      el("div", { className: "rins-kvtitle", textContent: "Details" }),
      el("div", { className: "rins-kvmeta", textContent: pathForCopy }),
    ]);

    const table = el("table", { className: "rins-table", ["data-rins-plain" as any]: pathForCopy }) as HTMLTableElement;
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

function safeJson(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatTimeMs(timeMs: any) {
  if (!timeMs) return "—";
  const d = Number(timeMs.duration);
  const dur = Number.isFinite(d) ? `${d.toFixed(2)} ms` : "—";
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

/* Header */
.rins-header {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 14px;
  padding: 14px;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
  align-items: start;
}

.rins-title-icon {
  width: 60px;
  height: 60px;
  border-radius: 14px;
  border: 1.5px solid #e6e6e6;
  background: #fafafa;
  padding: 6px;
}

.rins-headmid { display: grid; gap: 10px; min-width: 0; }
.rins-title-col { display: grid; gap: 4px; }
.rins-h1 { padding-top: 6px; font-size: 24px; color: #666666; font-weight: 650; }
.rins-subtitle { font-size: 12px; color: #444; line-height: 1.35; }

.rins-headstats { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.rins-pill {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 750;
  border: 1px solid #e6e6e6;
  background: #fff;
  color: #2d5e8c;
  letter-spacing: 0.02em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.rins-pill--neutral { background: #f7fafc; color: #2d5e8c; }
.rins-pill--info { background: #f4f9ff; border-color: rgba(45,94,140,0.20); color: #2d5e8c; }
.rins-pill--muted { background: #fafafa; color: #7a7f87; }

.rins-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

.rins-btn {
  font-size: 12px;
  border-radius: 10px;
  padding: 6px 10px;
  border: 1px solid #e6e6e6;
  background: #fff;
  cursor: pointer;
}
.rins-btn:hover { background: #fafafa; }
.rins-btn--sub { padding: 5px 8px; border-radius: 10px; font-size: 11px; }

.rins-body { margin-top: 12px; }
.rins-tree { display: grid; gap: 12px; }

.rins-empty { font-size: 12px; color: #777; padding: 6px 0; }

/* Section header */
.rins-section-head { display: flex; justify-content: space-between; align-items: baseline; margin: 2px 0 10px; }
.rins-section-title { font-size: 13px; font-weight: 650; }
.rins-section-meta { font-size: 12px; color: #666; }

/* Tables */
.rins-viewtable, .rins-bintable, .rins-dctable {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed; /* key for alignment */
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
  background: #f7fafc;
}

.rins-viewtable td, .rins-bintable td, .rins-dctable td {
  padding: 8px 10px;
  border-top: 1px solid #f7f7f7;
  vertical-align: top;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap; /* keeps column widths stable */
  word-break: normal;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.rins-th--num, .rins-td--num { text-align: left; font-variant-numeric: tabular-nums; }
.rins-td--mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

/* Fixed column widths via colgroup classes */
.rins-col-idx { width: 44px; }
.rins-col-fps { width: 76px; }
.rins-col-dc  { width: 96px; }
.rins-col-pr  { width: 84px; }
.rins-col-time { width: 120px; }

/* Bin columns */
.rins-col-bin-dc { width: 110px; }
.rins-col-bin-time { width: 140px; }

/* Draw call columns */
.rins-col-dc-bin { width: 180px; }
.rins-col-dc-batch { width: 90px; }
.rins-col-dc-time { width: 130px; }
.rins-col-dc-range { width: 130px; }

.rins-viewrow { cursor: pointer; }
.rins-viewrow:hover { background: #fafafa; }
.rins-viewrow.is-selected { background: #f4f9ff; }
.rins-viewrow.is-empty { color: #8a8f98; }

/* Details blocks */
.rins-viewdetail { margin-top: 12px; display: grid; gap: 10px; }
.rins-viewdetail-title { display: grid; gap: 2px; }
.rins-viewdetail-h { font-size: 13px; font-weight: 650; }
.rins-viewdetail-sub { font-size: 12px; color: #666; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

.rins-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(140px, 1fr));
  gap: 10px;
}
.rins-metric {
  border: 1px solid #e6e6e6;
  background: #fff;
  border-radius: 12px;
  padding: 10px 12px;
}
.rins-metric-k { font-size: 11px; color: #666; font-weight: 650; margin-bottom: 2px; }
.rins-metric-v { font-size: 12px; font-weight: 750; color: #2d5e8c; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

@media (max-width: 980px) {
  .rins-metrics { grid-template-columns: repeat(2, minmax(140px, 1fr)); }
}

/* KV */
.rins-kvwrap { border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; overflow: hidden; }
.rins-kvhead { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: baseline; gap: 10px; background: #fbfdff; }
.rins-kvtitle { font-size: 12px; font-weight: 750; color: #2d5e8c; }
.rins-kvmeta { font-size: 11px; color: #777; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

.rins-table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
.rins-table th {
  text-align: left;
  color: #666;
  font-weight: 650;
  width: 180px;
  padding: 7px 10px;
  vertical-align: top;
  background: #fbfdff;
  border-right: 1px solid #eef2f5;
}
.rins-table td {
  padding: 7px 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.rins-table tr + tr td, .rins-table tr + tr th { border-top: 1px solid #f0f0f0; }

/* Draw calls details */
.rins-dcdetails { border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; padding: 10px 12px; }
.rins-dcsum { cursor: pointer; font-size: 12px; font-weight: 750; color: #2d5e8c; list-style: none; }
.rins-dcsum::-webkit-details-marker { display: none; }
`;
