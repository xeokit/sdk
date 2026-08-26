import type {SDKResult} from "../../../../../../../base/core";
import type {View} from "../../../../../../viewer";
import type {WebGPUCommandEncoderLike} from "../../../../core";
import type {RenderContext} from "../../../RenderContext";
import {WebGPUColorRenderTarget} from "../WebGPUColorRenderTarget";
import {WebGPUSAODepthLimitedBlurRenderer} from "./WebGPUSAODepthLimitedBlurRenderer";
import {WebGPUSAOOcclusionRenderer} from "./WebGPUSAOOcclusionRenderer";

/**
 * Runs the WebGPU SAO occlusion pass and optional two-pass depth-limited blur.
 *
 * This mirrors WebGLRenderer's SAOPipeline stage layout, but consumes the
 * already-rendered scene depth texture instead of redrawing SAO-capable bins
 * into a separate depth buffer.
 *
 * @internal
 */
export class WebGPUSAOPipeline {

  private readonly _occlusionTarget: WebGPUColorRenderTarget;
  private readonly _blurTarget: WebGPUColorRenderTarget;
  private readonly _occlusionRenderer: WebGPUSAOOcclusionRenderer;
  private readonly _blurRenderer: WebGPUSAODepthLimitedBlurRenderer;

  constructor(renderContext: RenderContext) {
    this._occlusionTarget = new WebGPUColorRenderTarget(renderContext, "xeokit-webgpu-sao-occlusion", "r8unorm");
    this._blurTarget = new WebGPUColorRenderTarget(renderContext, "xeokit-webgpu-sao-blur", "r8unorm");
    this._occlusionRenderer = new WebGPUSAOOcclusionRenderer(renderContext);
    this._blurRenderer = new WebGPUSAODepthLimitedBlurRenderer(renderContext);
  }

  render(params: {
    commandEncoder: WebGPUCommandEncoderLike;
    depthView: unknown;
    width: number;
    height: number;
    view: View;
  }): SDKResult<{occlusionView: unknown}> {
    this._occlusionTarget.ensureSize(params.width, params.height);
    const occlusionResult = this._occlusionRenderer.render({
      commandEncoder: params.commandEncoder,
      depthView: params.depthView,
      targetView: this._occlusionTarget.view,
      width: params.width,
      height: params.height,
      view: params.view
    });
    if (occlusionResult.ok === false) {
      return occlusionResult;
    }

    if (params.view.effects.sao.blur) {
      this._blurTarget.ensureSize(params.width, params.height);
      const horizontalResult = this._blurRenderer.render({
        commandEncoder: params.commandEncoder,
        depthView: params.depthView,
        occlusionView: this._occlusionTarget.view,
        targetView: this._blurTarget.view,
        width: params.width,
        height: params.height,
        view: params.view,
        direction: 0
      });
      if (horizontalResult.ok === false) {
        return horizontalResult;
      }
      const verticalResult = this._blurRenderer.render({
        commandEncoder: params.commandEncoder,
        depthView: params.depthView,
        occlusionView: this._blurTarget.view,
        targetView: this._occlusionTarget.view,
        width: params.width,
        height: params.height,
        view: params.view,
        direction: 1
      });
      if (verticalResult.ok === false) {
        return verticalResult;
      }
    }

    return {
      ok: true,
      value: {
        occlusionView: this._occlusionTarget.view
      }
    };
  }

  destroy(): void {
    this._occlusionRenderer.destroy();
    this._blurRenderer.destroy();
    this._occlusionTarget.destroy();
    this._blurTarget.destroy();
  }
}
