import {SDKErrorType, type SDKResult} from "../../../base/core";
import {createMat4Float64, mulMat4, type Mat4} from "../../../base/math/matrix";
import type {View} from "../../viewer";
import type {WebGPUBindGroupLike, WebGPUBufferLike} from "../core";
import {
  FRAME_UNIFORM_BYTES,
  FRAME_UNIFORM_FLOATS,
  GPU_BUFFER_USAGE,
  IDENTITY_MATRIX,
  WEBGPU_CLIP_SPACE_MATRIX
} from "./constants";
import {WebGPULightingManager} from "./WebGPULightingManager";
import {WebGPUPipelineManager} from "./WebGPUPipelineManager";
import {WebGPURenderContext} from "./WebGPURenderContext";

/**
 * Owns per-view frame uniforms shared by all instanced mesh draws.
 *
 * @internal
 */
export class WebGPUFrameUniformManager {

  private readonly _renderContext: WebGPURenderContext;
  private readonly _pipelineManager: WebGPUPipelineManager;
  private readonly _lightingManager: WebGPULightingManager;
  private readonly _viewProjectionMatrix: Mat4 = createMat4Float64();
  private readonly _webGPUViewProjectionMatrix: Mat4 = createMat4Float64();
  private readonly _frameUniformData = new Float32Array(FRAME_UNIFORM_FLOATS);
  private _uniformBuffer: WebGPUBufferLike | null = null;
  private _bindGroup: WebGPUBindGroupLike | null = null;

  constructor(params: {
    renderContext: WebGPURenderContext;
    pipelineManager: WebGPUPipelineManager;
    lightingManager: WebGPULightingManager;
  }) {
    this._renderContext = params.renderContext;
    this._pipelineManager = params.pipelineManager;
    this._lightingManager = params.lightingManager;
  }

  public writeFrameUniforms(view: View): SDKResult<WebGPUBindGroupLike> {
    const bindGroupResult = this._getOrCreateBindGroup();
    if (bindGroupResult.ok === false) {
      return bindGroupResult;
    }

    const camera = view.camera;
    const viewMatrix = (camera?.viewMatrix ?? IDENTITY_MATRIX) as Mat4;
    const projMatrix = (camera?.projMatrix ?? IDENTITY_MATRIX) as Mat4;

    mulMat4(projMatrix, viewMatrix, this._viewProjectionMatrix);
    mulMat4(WEBGPU_CLIP_SPACE_MATRIX as Mat4, this._viewProjectionMatrix, this._webGPUViewProjectionMatrix);

    for (let i = 0; i < 16; i++) {
      this._frameUniformData[i] = this._webGPUViewProjectionMatrix[i];
    }
    this._lightingManager.writeLightingUniforms(this._frameUniformData, 16);
    this._renderContext.device.queue.writeBuffer(this._uniformBuffer!, 0, this._frameUniformData);

    return bindGroupResult;
  }

  public destroy(): void {
    try {
      this._uniformBuffer?.destroy?.();
    } catch {
      // Ignore buffer destruction failures during teardown.
    }
    this._uniformBuffer = null;
    this._bindGroup = null;
  }

  private _getOrCreateBindGroup(): SDKResult<WebGPUBindGroupLike> {
    if (this._bindGroup) {
      return {
        ok: true,
        value: this._bindGroup
      };
    }

    const bindGroupLayoutResult = this._pipelineManager.getFrameBindGroupLayout();
    if (bindGroupLayoutResult.ok === false) {
      return bindGroupLayoutResult;
    }

    try {
      this._uniformBuffer = this._renderContext.device.createBuffer({
        label: "xeokit-webgpu-frame-uniforms",
        size: FRAME_UNIFORM_BYTES,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      });
      this._bindGroup = this._renderContext.device.createBindGroup({
        label: "xeokit-webgpu-frame-bind-group",
        layout: bindGroupLayoutResult.value,
        entries: [{
          binding: 0,
          resource: {
            buffer: this._uniformBuffer
          }
        }]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUFrameUniformManager._getOrCreateBindGroup] Failed to create WebGPU frame uniforms: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._bindGroup
    };
  }
}
