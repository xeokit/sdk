import type {SDKResult} from "../../../../../base/core";
import type {View} from "../../../../viewer";
import type {WebGPUCommandEncoderLike} from "../../../core";
import type {RenderContext} from "../../RenderContext";
import {WebGPUColorRenderTarget} from "./WebGPUColorRenderTarget";
import {WebGPUPostProcessPipeline} from "./WebGPUPostProcessPipeline";
import {WebGPUSAOPipeline} from "./sao";

/**
 * WebGPU post-process orchestration, gated by View-owned effect components.
 *
 * @internal
 */
export class WebGPUPostProcessChain {

  private readonly _sceneTarget: WebGPUColorRenderTarget;
  private readonly _pipeline: WebGPUPostProcessPipeline;
  private readonly _saoPipeline: WebGPUSAOPipeline;
  private _initialized = false;

  constructor(renderContext: RenderContext) {
    this._sceneTarget = new WebGPUColorRenderTarget(renderContext, "xeokit-webgpu-postprocess-scene-color", "rgba16float");
    this._pipeline = new WebGPUPostProcessPipeline(renderContext);
    this._saoPipeline = new WebGPUSAOPipeline(renderContext);
  }

  init(): SDKResult<void> {
    return {ok: true, value: undefined};
  }

  needsPostProcess(view: View): boolean {
    const effects = (view as {effects?: any}).effects;
    const tonemap = effects?.tonemap;
    const antiAliasing = effects?.antiAliasing;
    return !!(
      (tonemap?.applied && tonemap?.possible) ||
      (antiAliasing?.applied && antiAliasing?.possible && antiAliasing?.mode !== "none") ||
      this.needsSAO(view)
    );
  }

  needsSAO(view: View): boolean {
    const sao = (view as {effects?: any}).effects?.sao;
    return !!(sao?.applied && sao?.possible && (sao.intensity ?? 0) > 0);
  }

  ensureSceneTarget(width: number, height: number): {view: unknown; textureView: unknown; format: string} {
    this._sceneTarget.ensureSize(width, height);
    return {
      view: this._sceneTarget.view,
      textureView: this._sceneTarget.view,
      format: this._sceneTarget.format
    };
  }

  composite(params: {
    commandEncoder: WebGPUCommandEncoderLike;
    sourceView: unknown;
    canvasView: unknown;
    depthView: unknown;
    width: number;
    height: number;
    view: View;
  }): SDKResult<void> {
    if (!this._initialized) {
      const initResult = this._pipeline.init();
      if (initResult.ok === false) {
        return initResult;
      }
      this._initialized = true;
    }
    let saoOcclusionView: unknown | null = null;
    if (this.needsSAO(params.view)) {
      const saoResult = this._saoPipeline.render({
        commandEncoder: params.commandEncoder,
        depthView: params.depthView,
        width: params.width,
        height: params.height,
        view: params.view
      });
      if (saoResult.ok === false) {
        return saoResult;
      }
      saoOcclusionView = saoResult.value.occlusionView;
    }
    return this._pipeline.render({
      ...params,
      saoOcclusionView
    });
  }

  destroy(): void {
    this._pipeline.destroy();
    this._saoPipeline.destroy();
    this._sceneTarget.destroy();
  }
}
