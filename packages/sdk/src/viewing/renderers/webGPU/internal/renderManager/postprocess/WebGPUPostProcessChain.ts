import type {SDKResult} from "../../../../../../base/core";
import type {View} from "../../../../../viewer";
import type {WebGPUCommandEncoderLike} from "../../../core";
import type {RenderContext} from "../../RenderContext";
import {WebGPUColorRenderTarget} from "./WebGPUColorRenderTarget";
import {WebGPUPostProcessPipeline} from "./WebGPUPostProcessPipeline";
import {WebGPUAtmospherePipeline} from "./atmosphere";
import {WebGPUBloomPipeline} from "./bloom";
import {WebGPUColorGradingPipeline} from "./colorGrading";
import {WebGPUDepthOfFieldPipeline} from "./dof";
import {WebGPUSAOCompositePipeline} from "./sao";
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
  private readonly _saoCompositePipeline: WebGPUSAOCompositePipeline;
  private readonly _bloomPipeline: WebGPUBloomPipeline;
  private readonly _atmospherePipeline: WebGPUAtmospherePipeline;
  private readonly _depthOfFieldPipeline: WebGPUDepthOfFieldPipeline;
  private readonly _colorGradingPipeline: WebGPUColorGradingPipeline;
  private _initialized = false;

  constructor(renderContext: RenderContext) {
    this._sceneTarget = new WebGPUColorRenderTarget(renderContext, "xeokit-webgpu-postprocess-scene-color", "rgba16float");
    this._pipeline = new WebGPUPostProcessPipeline(renderContext);
    this._saoPipeline = new WebGPUSAOPipeline(renderContext);
    this._saoCompositePipeline = new WebGPUSAOCompositePipeline(renderContext);
    this._bloomPipeline = new WebGPUBloomPipeline(renderContext);
    this._atmospherePipeline = new WebGPUAtmospherePipeline(renderContext);
    this._depthOfFieldPipeline = new WebGPUDepthOfFieldPipeline(renderContext);
    this._colorGradingPipeline = new WebGPUColorGradingPipeline(renderContext);
  }

  init(): SDKResult<void> {
    return {ok: true, value: undefined};
  }

  needsPostProcess(view: View): boolean {
    const effects = (view as {effects?: any}).effects;
    const tonemap = effects?.tonemap;
    const antiAliasing = effects?.antiAliasing;
    const bloom = effects?.bloom;
    return !!(
      (tonemap?.applied && tonemap?.possible) ||
      (tonemap?.sRGBEncode !== false && tonemap?.possible) ||
      this.needsColorGrading(view) ||
      (bloom?.applied && bloom?.possible && (bloom.intensity ?? 0) > 0) ||
      (antiAliasing?.applied && antiAliasing?.possible && antiAliasing?.mode !== "none") ||
      this.needsAtmosphere(view) ||
      this.needsDepthOfField(view) ||
      this.needsSAO(view)
    );
  }

  needsAtmosphere(view: View): boolean {
    const atmosphere = (view as {effects?: any}).effects?.atmosphere;
    return !!(
      atmosphere?.applied &&
      atmosphere?.possible &&
      (atmosphere.intensity ?? 0) > 0 &&
      (atmosphere.maxOpacity ?? 0) > 0 &&
      (atmosphere.endDistance ?? 0) > (atmosphere.startDistance ?? 0)
    );
  }

  needsBloom(view: View): boolean {
    const bloom = (view as {effects?: any}).effects?.bloom;
    return !!(bloom?.applied && bloom?.possible && (bloom.intensity ?? 0) > 0);
  }

  needsDepthOfField(view: View): boolean {
    const dof = (view as {effects?: any}).effects?.depthOfField;
    return !!(dof?.applied && dof?.possible && (dof.radius ?? 0) > 0 && (dof.intensity ?? 0) > 0);
  }

  needsColorGrading(view: View): boolean {
    const colorGrading = (view as {effects?: any}).effects?.colorGrading;
    return !!(
      colorGrading?.applied &&
      colorGrading?.possible &&
      (
        (colorGrading.brightness ?? 0) !== 0 ||
        (colorGrading.contrast ?? 1) !== 1 ||
        (colorGrading.saturation ?? 1) !== 1 ||
        (colorGrading.gamma ?? 1) !== 1 ||
        (colorGrading.temperature ?? 0) !== 0 ||
        (colorGrading.tint ?? 0) !== 0
      )
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
    skipSAO?: boolean;
  }): SDKResult<void> {
    if (!this._initialized) {
      const initResult = this._pipeline.init();
      if (initResult.ok === false) {
        return initResult;
      }
      this._initialized = true;
    }
    let saoOcclusionView: unknown | null = null;
    if (!params.skipSAO && this.needsSAO(params.view)) {
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
    let sourceView = params.sourceView;
    if (saoOcclusionView) {
      const saoCompositeResult = this._saoCompositePipeline.render({
        commandEncoder: params.commandEncoder,
        colorView: sourceView,
        occlusionView: saoOcclusionView,
        depthView: params.depthView,
        width: params.width,
        height: params.height,
        view: params.view
      });
      if (saoCompositeResult.ok === false) {
        return saoCompositeResult;
      }
      sourceView = saoCompositeResult.value.colorView;
      saoOcclusionView = null;
    }
    if (this.needsBloom(params.view)) {
      const bloomResult = this._bloomPipeline.render({
        commandEncoder: params.commandEncoder,
        sourceView,
        width: params.width,
        height: params.height,
        view: params.view
      });
      if (bloomResult.ok === false) {
        return bloomResult;
      }
      sourceView = bloomResult.value.colorView;
    }
    if (this.needsAtmosphere(params.view)) {
      const atmosphereResult = this._atmospherePipeline.render({
        commandEncoder: params.commandEncoder,
        colorView: sourceView,
        depthView: params.depthView,
        width: params.width,
        height: params.height,
        view: params.view
      });
      if (atmosphereResult.ok === false) {
        return atmosphereResult;
      }
      sourceView = atmosphereResult.value.colorView;
    }
    if (this.needsDepthOfField(params.view)) {
      const dofResult = this._depthOfFieldPipeline.render({
        commandEncoder: params.commandEncoder,
        colorView: sourceView,
        depthView: params.depthView,
        width: params.width,
        height: params.height,
        view: params.view
      });
      if (dofResult.ok === false) {
        return dofResult;
      }
      sourceView = dofResult.value.colorView;
    }
    if (this.needsColorGrading(params.view)) {
      const colorGradingResult = this._colorGradingPipeline.render({
        commandEncoder: params.commandEncoder,
        colorView: sourceView,
        width: params.width,
        height: params.height,
        view: params.view
      });
      if (colorGradingResult.ok === false) {
        return colorGradingResult;
      }
      sourceView = colorGradingResult.value.colorView;
    }
    return this._pipeline.render({
      ...params,
      sourceView,
      saoOcclusionView
    });
  }

  applySAO(params: {
    commandEncoder: WebGPUCommandEncoderLike;
    sourceView: unknown;
    depthView: unknown;
    width: number;
    height: number;
    view: View;
  }): SDKResult<{applied: boolean; colorView: unknown}> {
    if (!this.needsSAO(params.view)) {
      return {
        ok: true,
        value: {
          applied: false,
          colorView: params.sourceView
        }
      };
    }
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
    const saoCompositeResult = this._saoCompositePipeline.render({
      commandEncoder: params.commandEncoder,
      colorView: params.sourceView,
      occlusionView: saoResult.value.occlusionView,
      depthView: params.depthView,
      width: params.width,
      height: params.height,
      view: params.view
    });
    if (saoCompositeResult.ok === false) {
      return saoCompositeResult;
    }
    return {
      ok: true,
      value: {
        applied: true,
        colorView: saoCompositeResult.value.colorView
      }
    };
  }

  destroy(): void {
    this._pipeline.destroy();
    this._saoPipeline.destroy();
    this._saoCompositePipeline.destroy();
    this._bloomPipeline.destroy();
    this._atmospherePipeline.destroy();
    this._depthOfFieldPipeline.destroy();
    this._colorGradingPipeline.destroy();
    this._sceneTarget.destroy();
  }
}
