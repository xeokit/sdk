import type { MeshBatch } from "../meshManager";
import type { RenderPassValue } from "../RENDER_PASSES";
import type { PrimRange } from "../gpuMemoryManager/dataTextures/PrimRange";
import type { View } from "../../../viewer";

/**
 * Log entry for a single render frame, made up of multiple render passes.
 */
export interface FrameLog {

  /**
   * The View being rendered.
   */
  view: View;

  /**
   * Size of the canvas in pixels [width, height].
   */
  canvasSize: [number, number];

  /**
   * Render passes made during this frame.
   */
  renderPasses: RenderPassLog[];

  /**
   * Start time for this frame.
   */
  startTimeMs: number;

  /**
   * End time for this frame.
   */
  endTimeMs: number;

  /**
   * Duration of this frame in milliseconds.
   */
  durationMs: number;

  /**
   * Total number of draw calls made during this frame.
   */
  numDrawCalls: number;
}

/**
 * Log entry for a single render pass, made up of multiple draw calls.
 */
export interface RenderPassLog {

  /**
   * Name of the render pass.
   */
  name: string;

  /**
   * Draw calls made during this render pass.
   */
  drawCalls: DrawCallLog[];

  /**
   * Start time for this render pass.
   */
  startTimeMs: number;

  /**
   * End time for this render pass.
   */
  endTimeMs: number;

  /**
   * Duration of this render pass in milliseconds.
   */
  durationMs: number;
}

/**
 * Log entry for a single draw call.
 */
export interface DrawCallLog {

  /**
   * The MeshBatch being drawn.
   */
  meshBatch: MeshBatch;

  /**
   * The render pass for this draw call.
   */
  renderPass: RenderPassValue;

  /**
   * The range of primitives being drawn.
   */
  primRange: PrimRange;

  /**
   * Start time for this draw call.
   */
  startTimeMs: number;

  /**
   * End time for this draw call.
   */
  endTimeMs: number;

  /**
   * Duration of this draw call in milliseconds.
   */
  durationMs: number;
}

const nowMs = (): number => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (globalThis as any)?.performance;
  return p?.now ? p.now() : Date.now();
};


/**
 * Logs draw calls and their timings for performance analysis.
 */
export class DrawLogger {
  public enabled = false;

  private _currentFrame: FrameLog | null = null;
  private _currentPass: RenderPassLog | null = null;
  private _currentDraw: DrawCallLog | null = null;

  private _onFrameLogged?: (frameLog: FrameLog) => void;

  /**
   * Creates a DrawLogger.
   * @param opts
   */
  constructor(opts?: {
    enabled?: boolean;
    onFrameLogged?: (frameLog: FrameLog) => void;
  }) {
    this.enabled = opts?.enabled ?? false;
    this._onFrameLogged = opts?.onFrameLogged;
  }

  /**
   * Clears all current log data.
   */
  public clear(): void {
    this._currentFrame = null;
    this._currentPass = null;
    this._currentDraw = null;
  }

  /**
   * Gets the current frame log being recorded.
   */
  public get currentFrame(): FrameLog | null {
    return this._currentFrame;
  }

  private endDraw(): void {
    if (!this._currentDraw) return;
    const t = nowMs();
    this._currentDraw.endTimeMs = t;
    this._currentDraw.durationMs = t - this._currentDraw.startTimeMs;
    this._currentDraw = null;
  }

  private endPass(): void {
    if (!this._currentPass) return;

    this.endDraw();

    const t = nowMs();
    this._currentPass.endTimeMs = t;
    this._currentPass.durationMs = t - this._currentPass.startTimeMs;

    // Drop empty passes
    const frame = this._currentFrame;
    if (frame && this._currentPass.drawCalls.length === 0) {
      const i = frame.renderPasses.lastIndexOf(this._currentPass);
      if (i !== -1) frame.renderPasses.splice(i, 1);
    }

    this._currentPass = null;
  }

  /**
   * Marks the start of a new frame.
   * @param view The View being rendered.
   */
  public frameStarted(view: View): void {
    if (!this.enabled) return;

    this.endPass();

    const t = nowMs();
    this._currentFrame = {
      view,
      canvasSize: [0, 0], // TODO
      renderPasses: [],
      startTimeMs: t,
      endTimeMs: t,
      durationMs: 0,
      numDrawCalls: 0,
    };
  }

  /**
   *
   * @param renderPassName
   */
  public startRenderPass(renderPassName: string): void {
    if (!this.enabled || !this._currentFrame) return;

    this.endPass();

    const t = nowMs();
    const pass: RenderPassLog = {
      name: renderPassName,
      drawCalls: [],
      startTimeMs: t,
      endTimeMs: t,
      durationMs: 0,
    };

    this._currentPass = pass;
    this._currentFrame.renderPasses.push(pass);
  }

  /**
   * Logs a draw call. Duration is measured until the next draw
   * (or end of pass / frame).
   */
  public drawMeshBatch(
    meshBatch: MeshBatch,
    renderPass: RenderPassValue,
    primRange: PrimRange,
  ): void {
    if (!this.enabled || !this._currentFrame) return;

    if (!this._currentPass) this.startRenderPass("UnnamedPass");
    if (!this._currentPass) return;

    this.endDraw();

    const t = nowMs();
    const draw: DrawCallLog = {
      meshBatch,
      renderPass,
      primRange,
      startTimeMs: t,
      endTimeMs: t,
      durationMs: 0,
    };

    this._currentPass.drawCalls.push(draw);
    this._currentDraw = draw;
    this._currentFrame.numDrawCalls++;
  }

  /**
   * Marks the end of the current frame.
   */
  public frameEnded(): void {
    if (!this.enabled || !this._currentFrame) return;

    this.endPass();

    const t = nowMs();
    this._currentFrame.endTimeMs = t;
    this._currentFrame.durationMs = t - this._currentFrame.startTimeMs;

    const finished = this._currentFrame;
    this._onFrameLogged?.(finished);

    this._currentFrame = null;
    this._currentPass = null;
    this._currentDraw = null;
  }
}
