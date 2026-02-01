// MemoryDebugger.ts (extended with GPU memory usage panel)
import { DataTexture } from "./gpuMemoryManager/dataTextures/DataTexture";
import type { DataTextures } from "./gpuMemoryManager/DataTextures";
import type { MemoryUsage } from "../MemoryUsage";
import { WebGLRenderer } from "../WebGLRenderer";
import type { PrimRange } from "./gpuMemoryManager/dataTextures/PrimRange";
import { RENDER_PASSES } from "./RENDER_PASSES";


/**
 * Config: show first N items from each DataTexture (0-based indices).
 */
const DEBUG_VIEW_ITEMS = 128; // N

/**
 * Displays:
 *  1) GPU memory usage (allocated/used)
 *  2) Batch-level renderPassPrimitiveRanges for each DataTextures batch
 *  3) First N items for each DataTexture using getItem(index)
 *  4) DataTexture.description shown above each texture output box
 */
export class MemoryDebugger {
  private root!: HTMLDivElement;
  private header!: HTMLDivElement;
  private grid!: HTMLDivElement;

  // NEW: memory panel elements
  private memPanel!: HTMLDivElement;
  private memAllocatedEl!: HTMLDivElement;
  private memUsedEl!: HTMLDivElement;
  private memBarUsed!: HTMLDivElement;
  private memNoteEl!: HTMLDivElement;

  private unsubs: Array<() => void> = [];
  private cards = new Map<DataTexture, JsonCard>();
  private allTextures: Array<{ tex: DataTexture; path: string }> = [];

  private batchInfos: Array<BatchInfo> = [];

  // UI state
  private maxItemsPerTexture = DEBUG_VIEW_ITEMS;

  constructor(private renderer: WebGLRenderer, private host: HTMLElement) {
    renderer.events.onRendererStarted.subscribe(() => this._init());
    renderer.events.onRendererStopped.subscribe(() => {
      // this.dispose();
    });
    if (renderer.rendering) this._init();
  }

  private _init() {
    this.root = document.createElement("div");
    this.root.className = "dtx-json-root";
    this.host.appendChild(this.root);

    this.header = document.createElement("div");
    this.header.className = "dtx-json-header";
    this.root.appendChild(this.header);

    // NEW: memory panel lives under the header
    this.memPanel = document.createElement("div");
    this.memPanel.className = "dtx-mem-panel";
    this.root.appendChild(this.memPanel);

    this.grid = document.createElement("div");
    this.grid.className = "dtx-json-grid";
    this.root.appendChild(this.grid);

    this.injectStylesOnce();
    this.buildHeader();
    this.buildMemoryPanel(); // NEW
    this.collectTexturesAndBatches();
    this.buildGrid();
    this.bindAndInitialRender();

    // Initial memory render
    this.refreshMemoryUsage();
  }

  public dispose(): void {
    for (const u of this.unsubs.splice(0)) {
      try {
        u();
      } catch {
        /* ignore */
      }
    }
    this.cards.clear();
    this.allTextures.length = 0;
    this.batchInfos.length = 0;
    this.root.remove();
  }

  public refresh(): void {
    // NEW: memory refresh
    this.refreshMemoryUsage();

    for (const { tex } of this.allTextures) {
      const card = this.cards.get(tex);
      if (card) this.renderTexture(card);
    }
    for (const b of this.batchInfos) {
      if (b.preEl) this.renderBatchRanges(b);
    }
  }

  // ---------------------------------------------------------------------------

  private buildHeader() {
    const title = document.createElement("div");
    title.className = "dtx-json-title";
    title.textContent = `[@xeokit/sdk/webglrenderer/GPUMemoryDebugger] - Showing first ${this.maxItemsPerTexture} items per data texture`;
    this.header.appendChild(title);

    const controls = document.createElement("div");
    controls.className = "dtx-json-controls";
    this.header.appendChild(controls);

    const nLabel = document.createElement("label");
    nLabel.className = "dtx-json-control";
    nLabel.textContent = "Items ";
    const nInput = document.createElement("input");
    nInput.type = "number";
    nInput.min = "1";
    nInput.max = "100000";
    nInput.step = "1";
    nInput.value = String(this.maxItemsPerTexture);
    nInput.addEventListener("change", () => {
      const v = Number(nInput.value);
      this.maxItemsPerTexture = Number.isFinite(v) ? Math.max(1, v | 0) : DEBUG_VIEW_ITEMS;
      nInput.value = String(this.maxItemsPerTexture);
      this.refresh();
    });
    nLabel.appendChild(nInput);
    controls.appendChild(nLabel);

    const refreshBtn = document.createElement("button");
    refreshBtn.className = "dtx-json-button";
    refreshBtn.textContent = "Refresh";
    refreshBtn.addEventListener("click", () => this.refresh());
    controls.appendChild(refreshBtn);
  }

  // ---------------------------------------------------------------------------
  // NEW: GPU memory usage UI + refresh logic
  // ---------------------------------------------------------------------------

  private buildMemoryPanel() {
    // Layout:
    //  [GPU memory]  Allocated: X MB   Used: Y MB   [██████----]  (percent)
    const left = document.createElement("div");
    left.className = "dtx-mem-left";
    left.textContent = "GPU memory";
    this.memPanel.appendChild(left);

    const stats = document.createElement("div");
    stats.className = "dtx-mem-stats";
    this.memPanel.appendChild(stats);

    this.memAllocatedEl = document.createElement("div");
    this.memAllocatedEl.className = "dtx-mem-stat";
    stats.appendChild(this.memAllocatedEl);

    this.memUsedEl = document.createElement("div");
    this.memUsedEl.className = "dtx-mem-stat";
    stats.appendChild(this.memUsedEl);

    const barWrap = document.createElement("div");
    barWrap.className = "dtx-mem-bar-wrap";
    this.memPanel.appendChild(barWrap);

    const barBg = document.createElement("div");
    barBg.className = "dtx-mem-bar-bg";
    barWrap.appendChild(barBg);

    this.memBarUsed = document.createElement("div");
    this.memBarUsed.className = "dtx-mem-bar-used";
    barBg.appendChild(this.memBarUsed);

    this.memNoteEl = document.createElement("div");
    this.memNoteEl.className = "dtx-mem-note";
    this.memPanel.appendChild(this.memNoteEl);

    // Manual refresh button (handy if memory updates without texture events)
    const btn = document.createElement("button");
    btn.className = "dtx-json-button";
    btn.textContent = "Refresh memory";
    btn.addEventListener("click", () => this.refreshMemoryUsage());
    this.memPanel.appendChild(btn);
  }

  /**
   * Pulls memory usage from the renderer if available.
   *
   * Expected renderer API (choose what matches your implementation):
   *  - renderer.getMemoryUsage(): MemoryUsage
   *  - renderer.getGPUMemoryManager().getUsage(): MemoryUsage
   *  - renderer.gpuMemoryUsage (property)
   *
   * If none exist, the panel will show "(unavailable)".
   */
  private refreshMemoryUsage() {
    const usage = this.tryGetUsage();
    if (!usage) {
      this.memAllocatedEl.textContent = `Allocated: (unavailable)`;
      this.memUsedEl.textContent = `Used: (unavailable)`;
      this.memBarUsed.style.width = `0%`;
      this.memNoteEl.textContent =
        `Tip: expose a GPUMemoryUsage getter on WebGLRenderer (allocatedMB/usedMB) to enable this panel.`;
      return;
    }

    const allocated = Number(usage.allocatedMB) || 0;
    const used = Number(usage.usedMB) || 0;
    const pct = allocated > 0 ? used / allocated : 0;
    const pctStr = allocated > 0 ? (pct * 100).toFixed(2) : "0.00";

    this.memAllocatedEl.textContent = `Allocated: ${this.fmtMB(allocated)} (${this.fmtKB(allocated)})`;
    this.memUsedEl.textContent = `Used: ${this.fmtMB(used)} (${this.fmtKB(used)}) (${pctStr}%)`;
    this.memBarUsed.style.width = `${pct * 100}%`;

    if (allocated > 0 && used > allocated) {
      this.memNoteEl.textContent = `Warning: used memory exceeds allocated memory!`;
    } else if (allocated <= 0 && used <= 0) {
      this.memNoteEl.textContent = `Note: memory usage is zero or negative (raw: allocated=${allocated}, used=${used})`;
    } else if (allocated < 0 || used < 0) {
      this.memNoteEl.textContent = `Note: negative memory usage (raw: allocated=${allocated}, used=${used})`;
    } else if (allocated < 0.01 && used < 0.01) {
      this.memNoteEl.textContent = `Note: memory usage is very low (<0.01 MB)`;
    } else {
      this.memNoteEl.textContent = "";
    }
  }

  private fmtMB(mb: number): string {
    if (Math.abs(mb) < 0.01) {
      return `${mb.toFixed(4)} MB`;
    }
    if (Math.abs(mb) < 1) {
      return `${mb.toFixed(3)} MB`;
    }
    return `${mb.toFixed(2)} MB`;
  }

  private fmtKB(mb: number): string {
    const kb = mb * 1024;
    if (Math.abs(kb) < 1) {
      return `${kb.toFixed(2)} KB`;
    }
    return `${kb.toFixed(0)} KB`;
  }

  private tryGetUsage(): MemoryUsage | null {
    const r: any = this.renderer as any;

    // Option A: direct method
    if (typeof r.getMemoryUsage === "function") {
      try {
        const u = r.getMemoryUsage();
        if (u && typeof u.allocatedMB === "number" && typeof u.usedMB === "number") return u;
      } catch {
        /* ignore */
      }
    }

    // Option B: manager getter
    if (typeof r.getGPUMemoryManager === "function") {
      try {
        const mgr = r.getGPUMemoryManager();
        const u = mgr?.getUsage?.();
        if (u && typeof u.allocatedMB === "number" && typeof u.usedMB === "number") return u;
      } catch {
        /* ignore */
      }
    }

    // Option C: property
    const u = r.gpuMemoryUsage;
    if (u && typeof u.allocatedMB === "number" && typeof u.usedMB === "number") return u;

    return null;
  }

  // ---------------------------------------------------------------------------

  private collectTexturesAndBatches() {
    const out: Array<{ tex: DataTexture; path: string }> = [];
    const push = (tex: DataTexture | undefined | null, path: string) => {
      if (!tex) return;
      out.push({ tex, path });
    };

    const memoryViewRes = this.renderer.getMemoryView();
    if (memoryViewRes.ok === false) {
      throw new Error(`MemoryDebugger: renderer.getMemoryView() error: ${memoryViewRes.error}`);
    }
    const dataTextures = memoryViewRes.value.dataTextures as DataTextures;
    if (!dataTextures) throw new Error("MemoryDebugger: renderer is rendering and should have dataTextures");

    dataTextures.viewTileCameraMatrixTexture?.forEach((t, i) => push(t, `viewTileCameraMatrixTexture[${i}]`));
    dataTextures.viewTilePickMatrixTexture?.forEach((t, i) => push(t, `viewTilePickMatrixTexture[${i}]`));

    this.batchInfos.length = 0;

    dataTextures.batches?.forEach((batch: any, bi: number) => {
      push(batch.indices, `batches[${bi}].indices`);
      push(batch.edgeIndices, `batches[${bi}].edgeIndices`);
      push(batch.meshAttributeTexture, `batches[${bi}].meshAttribTable`);
      push(batch.meshMatrixTexture, `batches[${bi}].meshMatrixTexture`);
      push(batch.geometryAttributeTexture, `batches[${bi}].geometryAttributeTexture`);
      push(batch.geometryQuantRangeTexture, `batches[${bi}].geometryQuantRangeTexture`);
      push(batch.vertexPositionTexture, `batches[${bi}].vertexPositionTexture`);
      push(batch.vertexColorTexture, `batches[${bi}].vertexColorTexture`);

      batch.views?.forEach((v: any, vi: number) => {

        const renderPassPrimitiveRanges = batch.views[vi].renderPassPrimitiveRanges;
        this.batchInfos.push({
          batchIndex: bi,
          path: `batches[${bi}].views[${vi}].renderPassPrimitiveRanges`,
          getRanges: () => (renderPassPrimitiveRanges as PrimRange[] | undefined),
        });

        push(v.primitiveMeshIndexTexture, `batches[${bi}].views[${vi}].primitiveMeshIndexTexture`);
        push(v.meshAttributeTexture, `batches[${bi}].views[${vi}].meshAttributeTexture`);
      });

      // this.batchInfos.push({
      //   batchIndex: bi,
      //   path: `batches[${bi}].renderPassPrimitiveRanges`,
      //   getRanges: () => (renderPassPrimitiveRanges as PrimRange[] | undefined),
      // });
    });

    this.allTextures.length = 0;
    const seen = new Set<DataTexture>();
    for (const item of out) {
      if (seen.has(item.tex)) continue;
      seen.add(item.tex);
      this.allTextures.push(item);
    }
  }

  private buildGrid() {
    this.grid.innerHTML = "";

    // 1) Batch renderPassPrimitiveRanges section
    if (this.batchInfos.length) {
      const section = document.createElement("div");
      section.className = "dtx-json-section";
      section.textContent = "Batch renderPassPrimitiveRanges";
      this.grid.appendChild(section);

      for (const b of this.batchInfos) {
        const card = document.createElement("div");
        card.className = "dtx-json-card";

        const top = document.createElement("div");
        top.className = "dtx-json-card-top";
        card.appendChild(top);

        const name = document.createElement("div");
        name.className = "dtx-json-card-title";
        name.textContent = b.path;
        top.appendChild(name);

        const meta = document.createElement("div");
        meta.className = "dtx-json-card-meta";
        meta.textContent = `batch ${b.batchIndex}`;
        top.appendChild(meta);

        const pre = document.createElement("pre");
        pre.className = "dtx-json-pre";
        pre.textContent = "(rendering...)";
        card.appendChild(pre);

        const footer = document.createElement("div");
        footer.className = "dtx-json-card-footer";
        footer.textContent = `Lists pass bins: { firstPrim, numPrims }`;
        card.appendChild(footer);

        this.grid.appendChild(card);

        b.preEl = pre;
        b.metaEl = meta;

        this.renderBatchRanges(b);
      }
    }

    // 2) Texture items section
    const section2 = document.createElement("div");
    section2.className = "dtx-json-section";
    section2.textContent = "Texture items (getItem)";
    this.grid.appendChild(section2);

    for (const { tex, path } of this.allTextures) {
      const card = document.createElement("div");
      card.className = "dtx-json-card";

      const top = document.createElement("div");
      top.className = "dtx-json-card-top";
      card.appendChild(top);

      // description banner
      const desc = document.createElement("div");
      desc.className = "dtx-json-card-desc";
      const description = (tex as any).description as string | undefined;
      desc.textContent = description?.trim() ? description : "(no description)";
      card.appendChild(desc);

      const name = document.createElement("div");
      name.className = "dtx-json-card-title";
      name.textContent = path;
      top.appendChild(name);

      const meta = document.createElement("div");
      meta.className = "dtx-json-card-meta";
      meta.textContent = `${tex.width ?? 0} × ${tex.height ?? 0}`;
      top.appendChild(meta);

      const pre = document.createElement("pre");
      pre.className = "dtx-json-pre";
      pre.textContent = "(rendering...)";
      card.appendChild(pre);

      const footer = document.createElement("div");
      footer.className = "dtx-json-card-footer";
      footer.textContent = `Items are queried by index: getItem(0..N-1).`;
      card.appendChild(footer);

      this.grid.appendChild(card);

      this.cards.set(tex, { tex, path, card, metaEl: meta, preEl: pre, descEl: desc });
    }
  }

  private bindAndInitialRender() {
    for (const { tex } of this.allTextures) {
      tex.debugging = true;

      const unsub = tex.onUpdated.subscribe(() => {
        // NEW: update memory usage when textures update
        this.refreshMemoryUsage();

        const card = this.cards.get(tex);
        if (card) this.renderTexture(card);
      });
      this.unsubs.push(unsub);

      const card = this.cards.get(tex);
      if (card) this.renderTexture(card);
    }

    // Optional: re-render batch ranges when any texture updates
    for (const { tex } of this.allTextures) {
      const unsub = tex.onUpdated.subscribe(() => {
        // NEW: update memory usage when textures update
        this.refreshMemoryUsage();

        for (const b of this.batchInfos) {
          if (b.preEl) this.renderBatchRanges(b);
        }
      });
      this.unsubs.push(unsub);
    }

    // NEW: subscribe to primitiveMeshIndexTexture updates for each batch view
    const memoryViewRes = this.renderer.getMemoryView();
    if (memoryViewRes.ok === false) return;
    const dataTextures = memoryViewRes.value.dataTextures as DataTextures;
    if (!dataTextures) return;

    dataTextures.batches?.forEach((batch: any, bi: number) => {
      batch.views?.forEach((view: any, vi: number) => {
        const primitiveMeshIndexTexture = view.primitiveMeshIndexTexture;
        if (primitiveMeshIndexTexture && typeof primitiveMeshIndexTexture.onUpdated?.subscribe === "function") {
          // Find the corresponding BatchInfo for this batch
          const batchInfo = this.batchInfos.find(b => b.batchIndex === bi);
          if (batchInfo) {
            const unsub = primitiveMeshIndexTexture.onUpdated.subscribe(() => {
              if (batchInfo.preEl) this.renderBatchRanges(batchInfo);
            });
            this.unsubs.push(() => unsub());
          }
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Rendering: batch ranges
  // ---------------------------------------------------------------------------

  private renderBatchRanges(b: BatchInfo) {

    function getRenderPassKey(): Array<{ id: number; name: string }> {
      // RENDER_PASSES is an object { NAME: number }
      return Object.entries(RENDER_PASSES)
        .filter(([k, v]) => typeof v === "number")
        .map(([name, id]) => ({ id: id as number, name }));
    }

    const rangesMap = b.getRanges?.();
    const out: string[] = [];

    if (!rangesMap || !(rangesMap instanceof Map) || rangesMap.size === 0) {
      out.push("(no ranges)");
      b.preEl!.textContent = out.join("\n");
      b.metaEl!.textContent = `batch ${b.batchIndex} — 0 passes`;
      return;
    }

    // --- Render pass key ---
    const passKey = getRenderPassKey();
    out.push("Pass ID key:");
    for (const { id, name } of passKey) {
      out.push(`  ${id}: ${name}`);
    }
    out.push("");

    let total = 0;
    out.push(b.path);
    out.push(`passes: ${rangesMap.size}`);
    out.push("");

    let idx = 0;
    for (const [passId, r] of rangesMap.entries()) {
      const first = r?.firstPrim ?? 0;
      const count = r?.numPrims ?? 0;
      total += count;
      out.push(`[${idx}] passId=${passId} firstPrim=${first}, numPrims=${count}, lastPrim=${count > 0 ? first + count - 1 : first}`);
      idx++;
    }

    out.push("");
    out.push(`totalPrims (sum numPrims) = ${total}`);

    b.preEl!.textContent = out.join("\n");
    b.metaEl!.textContent = `batch ${b.batchIndex} — ${rangesMap.size} passes`;
  }

  // ---------------------------------------------------------------------------
  // Rendering: texture items list
  // ---------------------------------------------------------------------------

  private renderTexture(card: JsonCard) {
    const tex = card.tex;

    const description = (tex as any).description as string | undefined;
    card.descEl.textContent = description?.trim() ? description : "(no description)";

    const fullW = Math.max(0, tex.width | 0);
    const fullH = Math.max(0, tex.height | 0);

    const N = Math.max(1, this.maxItemsPerTexture | 0);
    card.metaEl.textContent = `${fullW} × ${fullH} — showing first ${N} items`;

    const out: string[] = [];
    out.push(`${card.path}`);
    out.push(`texture: ${fullW}×${fullH}`);
    out.push(`items: 0..${N - 1}`);
    out.push("");

    for (let i = 0; i < N; i++) {
      out.push(`[${i}]`);
      try {
        const v = tex.getItem(i);
        out.push(this.prettyAny(v));
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        out.push(`(!) getItem(${i}) threw: ${msg}`);
        break; // common out-of-range behavior
      }
      out.push("");
    }

    card.preEl.textContent = out.join("\n");
  }

  private prettyAny(v: any): string {
    if (v == null) return String(v);
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      try {
        return String(v);
      } catch {
        return "[unprintable]";
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Styling
  // ---------------------------------------------------------------------------

  private injectStylesOnce() {
    const id = "dtx-json-styles";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .dtx-json-root {
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        color: #111;
      }
      .dtx-json-header {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        background: #fff;
        position: sticky;
        top: 0;
        z-index: 5;
      }
      .dtx-json-title { font-weight: 700; letter-spacing: 0.2px; }
      .dtx-json-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .dtx-json-control { display: inline-flex; gap: 8px; align-items: center; font-size: 12px; color: #374151; }
      .dtx-json-control input { width: 110px; padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 8px; }
      .dtx-json-button {
        font-size: 12px;
        padding: 6px 10px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: #fff;
        cursor: pointer;
      }
      .dtx-json-button:hover { background: #f9fafb; }

      /* NEW: memory panel */
      .dtx-mem-panel{
        margin-top: 10px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        background: #fff;
      }
      .dtx-mem-left{
        font-size: 12px;
        font-weight: 700;
        color: #374151;
        min-width: 90px;
      }
      .dtx-mem-stats{
        display: flex;
        gap: 12px;
        align-items: baseline;
        flex-wrap: wrap;
      }
      .dtx-mem-stat{
        font-size: 12px;
        color: #111827;
      }
      .dtx-mem-bar-wrap{
        flex: 1 1 auto;
        min-width: 140px;
      }
      .dtx-mem-bar-bg{
        height: 10px;
        border-radius: 999px;
        background: #eef2f7;
        overflow: hidden;
        border: 1px solid #e5e7eb;
      }
      .dtx-mem-bar-used{
        height: 100%;
        width: 0%;
        background: #111827;
      }
      .dtx-mem-note{
        font-size: 12px;
        color: #6b7280;
        min-height: 1em;
        white-space: nowrap;
      }

      .dtx-json-grid {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: flex-start;
      }

      .dtx-json-section{
        flex: 1 1 100%;
        font-size: 12px;
        font-weight: 700;
        color: #374151;
        padding: 8px 2px 2px 2px;
      }

      .dtx-json-card {
        flex: 1 1 520px;
        max-width: 400px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: #fff;
        overflow: hidden;
      }

      .dtx-json-card-desc {
        padding: 10px 12px;
        font-size: 12px;
        font-weight: 600;
        color: #111827;
        background: #f9fafb;
        border-bottom: 1px solid #eef2f7;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .dtx-json-card-top {
        padding: 10px 12px 6px 12px;
        border-bottom: 1px solid #f3f4f6;
      }
      .dtx-json-card-title {
        font-size: 13px;
        font-weight: 600;
        color: #111827;
        word-break: break-word;
      }
      .dtx-json-card-meta {
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
      }
      .dtx-json-pre {
        margin: 0;
        padding: 10px 12px;
        max-height: 800px;
        overflow: auto;
        background: #0b1020;
        color: #e5e7eb;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
        line-height: 1.25;
        white-space: pre;
      }
      .dtx-json-card-footer {
        padding: 8px 12px;
        font-size: 12px;
        color: #6b7280;
        border-top: 1px solid #f3f4f6;
        background: #fff;
      }
    `;
    document.head.appendChild(style);
  }
}

type JsonCard = {
  tex: DataTexture;
  path: string;
  card: HTMLDivElement;
  metaEl: HTMLDivElement;
  preEl: HTMLPreElement;
  descEl: HTMLDivElement;
};

type BatchInfo = {
  batchIndex: number;
  path: string;
  getRanges: () => PrimRange[] | undefined;
  preEl?: HTMLPreElement;
  metaEl?: HTMLDivElement;
};
