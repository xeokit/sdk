import type {RenderContext} from "../../RenderContext";
import type {ViewRenderState} from "../../ViewRenderState";
import type {DrawOps} from "../../drawOps/DrawOps";
import type {MeshBatch} from "../../meshManager/MeshBatch";

import {SDKErrorType, type SDKResult} from "../../../../../base/core";

import {SAOOcclusionRenderer} from "./SAOOcclusionRenderer";
import {SAODepthLimitedBlurRenderer} from "./SAODepthLimitedBlurRenderer";

/**
 * Runs the SAO depth pass, the AO-from-depth pass, and the optional depth-limited
 * Gaussian blur, then publishes the final occlusion texture on {@link RenderContext}
 * for the shadow-aware color techniques to sample.
 *
 * Owns the fullscreen-quad renderers that execute the AO and blur shaders so the
 * surrounding {@link RenderManager} doesn't have to know about them.
 *
 * @internal
 */
export class SAOPipeline {

  private readonly _renderContext: RenderContext;
  private _occlusionRenderer: SAOOcclusionRenderer | null = null;
  private _blurRenderer: SAODepthLimitedBlurRenderer | null = null;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  /**
   * Creates the internal fullscreen-quad renderers if they don't exist yet.
   *
   * Returns a failed {@link base!core.SDKResult | SDKResult} if constructing either renderer throws —
   * typical cause is missing WebGL2 features or a failed shader compile. On
   * failure the caller should leave the pipeline in an unusable state; we
   * tear down whatever did construct successfully so destroy() is safe.
   */
  init(): SDKResult<void> {
    try {
      if (!this._occlusionRenderer) {
        this._occlusionRenderer = new SAOOcclusionRenderer({renderContext: this._renderContext});
      }
      if (!this._blurRenderer) {
        this._blurRenderer = new SAODepthLimitedBlurRenderer({renderContext: this._renderContext});
      }
      return {ok: true, value: undefined};
    } catch (e) {
      this.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SAOPipeline.init] Failed to initialize SAO pipeline: ${errorMessage(e)}`
      };
    }
  }

  /**
   * Runs the full SAO prep pipeline:
   *   1. Render caster depth (both SAO-only and combined batches) into the SAO
   *      depth FBO using the standard opaque DrawOp.
   *   2. Run the AO fullscreen shader to compute occlusion from depth.
   *   3. If blur is enabled on the view, run the two-pass depth-limited
   *      Gaussian blur.
   *
   * Afterwards {@link RenderContext.saoOcclusionTexture} is set to the final
   * occlusion texture. Callers are responsible for restoring the main framebuffer
   * viewport/state before drawing shadowed color.
   */
  render(params: {
    rendererView: ViewRenderState;
    drawOps: DrawOps["prims"];
    saoBatches: MeshBatch[];
    comboBatches: MeshBatch[];
  }): void {
    const {rendererView, drawOps, saoBatches, comboBatches} = params;
    const view = rendererView.view;
    const rc = this._renderContext;
    const gl = rc.gl;

    // Match the scene's render resolution — supersampling (Tonemap.renderScale)
    // makes `sceneRenderWidth` larger than the canvas, and all SAO textures
    // need to match so the opaqueSAO fragment shader's UV math lines up.
    const sceneW = rc.sceneRenderWidth || gl.drawingBufferWidth;
    const sceneH = rc.sceneRenderHeight || gl.drawingBufferHeight;

    const depthBuffer = rendererView.renderBuffers.getRenderBuffer("saoDepth", {
      depthTexture: true,
      size: [sceneW, sceneH]
    });
    const occlusionBuffer = rendererView.renderBuffers.getRenderBuffer("saoOcclusion", {
      size: [sceneW, sceneH]
    });

    // Depth pass — both SAO-only and combined batches contribute, so the AO
    // sampling sees all occluding geometry regardless of which color DrawOp
    // eventually draws it.
    depthBuffer.bind();
    gl.viewport(0, 0, sceneW, sceneH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    rc.lastProgramId = -1;
    for (let i = 0; i < saoBatches.length; i++) {
      drawOps[saoBatches[i].primitive]?.opaque?.drawBatch(saoBatches[i]);
    }
    for (let i = 0; i < comboBatches.length; i++) {
      drawOps[comboBatches[i].primitive]?.opaque?.drawBatch(comboBatches[i]);
    }
    depthBuffer.unbind();

    // AO pass.
    occlusionBuffer.bind();
    this._occlusionRenderer!.render({depthRenderBuffer: depthBuffer, view});
    occlusionBuffer.unbind();

    // Optional two-pass depth-limited Gaussian blur.
    if (view.effects.sao.blur) {
      const blurBuffer = rendererView.renderBuffers.getRenderBuffer("saoBlur", {size: [sceneW, sceneH]});
      blurBuffer.bind();
      this._blurRenderer!.render({
        view,
        depthRenderBuffer: depthBuffer,
        occlusionRenderBuffer: occlusionBuffer,
        direction: 0
      });
      blurBuffer.unbind();
      occlusionBuffer.bind();
      this._blurRenderer!.render({
        view,
        depthRenderBuffer: depthBuffer,
        occlusionRenderBuffer: blurBuffer,
        direction: 1
      });
      occlusionBuffer.unbind();
    }

    rc.saoOcclusionTexture = occlusionBuffer.getTexture();
  }

  destroy(): void {
    this._occlusionRenderer?.destroy();
    this._blurRenderer?.destroy();
    this._occlusionRenderer = null;
    this._blurRenderer = null;
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
