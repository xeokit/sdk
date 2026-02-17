import type { MeshBatch } from "../meshManager";
import type { RenderPassValue } from "../RENDER_PASSES";
import { RENDER_PASSES } from "../RENDER_PASSES";
import type { PrimRange } from "../gpuMemoryManager/dataTextures/PrimRange";
import type { View } from "../../../viewer";
import { LinesPrimitive, PointsPrimitive, TrianglesPrimitive } from "../../../constants";
import { type ViewRenderStats } from "./ViewRenderStats";
import { type RenderBinStats } from "./RenderBinStats";
import { type DrawCallStats } from "./DrawCallStats";
import {RENDER_BINS} from "../RENDER_BINS";
import {type RenderStats} from "./RenderStats";
import type {GPUTile} from "../gpuMemoryManager";

const nowMs = (): number => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (globalThis as any)?.performance;
  return p?.now ? p.now() : Date.now();
};

type ActiveState = {
  currentFrame: ViewRenderStats | null;
  currentPass: RenderBinStats | null;
  currentDraw: DrawCallStats | null;
  lastFrameEndMs: number | null;
};

/**
 * Logs draw calls and their timings for performance analysis.
 *
 * Public:
 * - frameLogs[i] = last completed ViewRenderStats for viewIndex i
 * - frameRates[i] = last computed fps for viewIndex i
 */
export class RenderInspector {

  /**
   * Whether the inspector is enabled.
   */
  public enabled = false;

  /**
   * Aggregate render stats.
   */
  public renderStats: RenderStats;

  /**
   * Last computed fps per viewIndex (null until at least 2 frames end).
   */
  public frameRates: Array<number | null> = [];

  /**
   * IDs of the render bins used internally by the `WebGLRenderer`.
   */
  public static renderBins = RENDER_BINS;

  private _states: ActiveState[] = [];
  private _activeViewIndex: number | null = null;
  private _includedRenderBins: Set<string>;
  private _excludedRenderBins: Set<string>;

  /**
   * Creates a RenderInspector.
   * @param opts
   */
  constructor(opts?: {
    enabled?: boolean;
    includeRenderBins?: string[];
    excludeRenderBins?: string[];
  }) {
    this.enabled = opts?.enabled ?? false;
    this._includedRenderBins = new Set<string>(opts?.includeRenderBins ?? []);
    this._excludedRenderBins = new Set<string>(opts?.excludeRenderBins ?? []);
    this.renderStats = {
      tiles: {},
      views: []
    };
  }

  /**
   * Determines if logging is enabled for the given render bin.
   * @private
   */
  public getRenderBinEnabled(renderBinName: string): boolean {
    if (this._includedRenderBins.size > 0 && !this._includedRenderBins.has(renderBinName)) return false;
    if (this._excludedRenderBins.size > 0 && this._excludedRenderBins.has(renderBinName)) return false;
    return true;
  }

  /**
   * Gets the list of all render bin IDs.
   */
  public get renderBinIds(): string[] {
    return Object.values(RenderInspector.renderBins);
  }

  /**
   * Sets the list of render bins to include in rendering.
   * When this list is non-empty, only render bins in this list will be rendered.
   * @param renderBinIds
   */
  public setIncludedRenderBins(renderBinIds: string[]): void {
    this._includedRenderBins = new Set<string>(renderBinIds);
  }

  /**
   * Sets the list of render bins to exclude from rendering.
   * When a render bin is in this list, it will not be rendered.
   * @param renderBinIds
   */
  public setExcludedRenderBins(renderBinIds: string[]): void {
    this._excludedRenderBins = new Set<string>(renderBinIds);
  }

  /**
   * Logs the creation of a new tile.
   * @param tile
   * @private
   */
  public tileAcquired(tile: GPUTile): void {
    if (tile.useCount === 1) {
      this.renderStats.tiles[tile.id] = {
        id: tile.id,
        rtcCenter: <[number, number, number]>Array.from(tile.center),
        tileIndex: tile.tileIndex,
        numMeshes: tile.useCount
      };
    } else {
      const existing = this.renderStats.tiles[tile.id];
      if (existing) {
        existing.numMeshes = tile.useCount;
      }
    }
  }

  /**
   * Logs the disposal of a tile.
   * @param tile
   * @private
   */
  public tileReleased(tile: GPUTile): void {
    if (tile.useCount === 0) {
      delete this.renderStats.tiles[tile.id];
    } else {
      const existing = this.renderStats.tiles[tile.id];
      if (existing) {
        existing.numMeshes = tile.useCount;
      }
    }
  }

  /**
   * Marks the start of a new frame for the given View.
   * Also activates the internal state for view.viewIndex, used by subsequent calls.
   * @private
   */
  public frameStarted(view: View & { viewIndex: number }): void {
    if (!this.enabled) {
      return;
    }

    const viewIndex = view.viewIndex;
    this._activeViewIndex = viewIndex;

    const s = this.ensureState(viewIndex);
    this.endPassFor(s);

    const t = nowMs();
    s.currentFrame = {
      viewId: (view as any).id ?? String(viewIndex),
      canvasSize: [0, 0], // TODO
      renderBins: [],
      timeMs: { start: t, end: t, duration: 0 },
      numDrawCalls: 0,
      numPrims: 0
    };
  }

  /**
   * Marks the start of a new render bin for the currently active view.
   * @param renderBinName
   * @private
   */
  public renderBinStarted(renderBinName: string): void {
    const s = this.getActiveState();
    if (!this.enabled || !s || !s.currentFrame) {
      return;
    }

    // Respect include/exclude functionality
    if (!this.getRenderBinEnabled(renderBinName)) {
      // End any current pass so timing doesn't bleed across filtered bins
      this.endPassFor(s);
      return;
    }

    this.endPassFor(s);

    const t = nowMs();
    const pass: RenderBinStats = {
      name: renderBinName,
      drawCalls: [],
      timeMs: { start: t, end: t, duration: 0 },
    };

    s.currentPass = pass;
    s.currentFrame.renderBins.push(pass);
  }

  /**
   * Logs a draw call for the currently active view.
   * Duration measured until the next draw (or end of pass / frame).
   * @private
   */
  public drawMeshBatch(meshBatch: MeshBatch, renderPass: RenderPassValue, primRange: PrimRange, edges? : boolean): void {
    const s = this.getActiveState();
    if (!this.enabled || !s || !s.currentFrame) {
      return;
    }

    if (!s.currentPass) {
      // Keep previous behavior ("UnnamedPass"), but still respect filters
      if (!this.getRenderBinEnabled("UnnamedPass")) return;
      this.renderBinStarted("UnnamedPass");
    }
    if (!s.currentPass) return;

    this.endDrawFor(s);

    let renderBinName: string;
    switch (renderPass) {
      case RENDER_PASSES.OPAQUE:
        renderBinName = "OPAQUE";
        break;
      case RENDER_PASSES.TRANSPARENT:
        renderBinName = "TRANSPARENT";
        break;
      case RENDER_PASSES.HIGHLIGHTED:
        renderBinName = "HIGHLIGHTED";
        break;
      case RENDER_PASSES.SELECTED:
        renderBinName = "SELECTED";
        break;
      case RENDER_PASSES.XRAYED:
        renderBinName = "XRAYED";
        break;
      case RENDER_PASSES.PICK:
        renderBinName = "PICK";
        break;
      default:
        renderBinName = "Unknown";
    }

    if (edges) {
      renderBinName = "EDGES_" + renderBinName;
    }

    let primitiveName: string;
    switch (meshBatch.primitive) {
      case TrianglesPrimitive:
        primitiveName = "TRIANGLES";
        break;
      case LinesPrimitive:
        primitiveName = "LINES";
        break;
      case PointsPrimitive:
        primitiveName = "POINTS";
        break;
      default:
        primitiveName = "Unknown";
    }

    const t = nowMs();
    const draw: DrawCallStats = {
      batchIndex: meshBatch.gpuMemoryBatchIndex,
      renderPass: renderBinName,
      primitive: primitiveName,
      primRange,
      timeMs: { start: t, end: t, duration: 0 },
    };
    s.currentPass.drawCalls.push(draw);
    s.currentDraw = draw;
    s.currentFrame.numDrawCalls++;
    s.currentFrame.numPrims += primRange.numPrims;
  }

  /**
   * Marks the end of the current frame for the currently active view.
   * Replaces `frameLogs[viewIndex]` each time.
   */
  public frameEnded(): void {
    const viewIndex = this._activeViewIndex;
    if (!this.enabled || viewIndex == null) return;

    const s = this.ensureState(viewIndex);
    if (!s.currentFrame) return;

    this.endPassFor(s);

    const t = nowMs();
    s.currentFrame.timeMs.end = t;
    s.currentFrame.timeMs.duration = t - s.currentFrame.timeMs.start;

    // Replace per-view frame log reference
    this.renderStats.views[viewIndex] = s.currentFrame;

    // Update fps (end-to-end delta between frame ends)
    if (s.lastFrameEndMs != null) {
      const dt = t - s.lastFrameEndMs;
      this.frameRates[viewIndex] = dt > 0 ? 1000 / dt : null;
    } else {
      this.frameRates[viewIndex] = null;
    }
    s.lastFrameEndMs = t;

    s.currentFrame = null;
    s.currentPass = null;
    s.currentDraw = null;
  }

  // ----------------- internals -----------------

  private getActiveState(): ActiveState | null {
    if (this._activeViewIndex == null) return null;
    return this.ensureState(this._activeViewIndex);
  }

  private ensureState(viewIndex: number): ActiveState {
    while (this._states.length <= viewIndex) {
      this._states.push({
        currentFrame: null,
        currentPass: null,
        currentDraw: null,
        lastFrameEndMs: null,
      });
    }
    while (this.renderStats.views.length <= viewIndex) this.renderStats.views.push(null);
    while (this.frameRates.length <= viewIndex) this.frameRates.push(null);
    return this._states[viewIndex];
  }

  private endDrawFor(s: ActiveState): void {
    if (!s.currentDraw) return;
    const t = nowMs();
    if (!s.currentDraw.timeMs) {
      s.currentDraw.timeMs = { start: 0, end: 0, duration: 0 };
    }
    s.currentDraw.timeMs.end = t;
    s.currentDraw.timeMs.duration = t - s.currentDraw.timeMs.start;
    s.currentDraw = null;
  }

  private endPassFor(s: ActiveState): void {
    if (!s.currentPass) return;

    this.endDrawFor(s);

    const t = nowMs();
    s.currentPass.timeMs.end = t;
    s.currentPass.timeMs.duration = t - s.currentPass.timeMs.start;

    // Drop empty passes
    const frame = s.currentFrame;
    if (frame && s.currentPass.drawCalls.length === 0) {
      const i = frame.renderBins.lastIndexOf(s.currentPass);
      if (i !== -1) frame.renderBins.splice(i, 1);
    }

    s.currentPass = null;
  }
}
