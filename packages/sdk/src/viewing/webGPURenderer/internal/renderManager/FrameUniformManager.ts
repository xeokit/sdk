import {SDKErrorType, type SDKResult} from "../../../../base/core";
import {createMat4Float64, mulMat4, type Mat4} from "../../../../base/math/matrix";
import type {View} from "../../../viewer";
import type {WebGPUBindGroupLike, WebGPUBufferLike} from "../../core";
import {
  FRAME_UNIFORM_BYTES,
  FRAME_UNIFORM_FLOATS,
  GPU_BUFFER_USAGE,
  IDENTITY_MATRIX,
  MAX_SECTION_PLANES,
  SECTION_PLANE_CAP_COLOR_UNIFORM_OFFSET,
  WEBGPU_CLIP_SPACE_MATRIX
} from "../constants";
import {LightingManager} from "./LightingManager";
import {BindGroupLayoutManager} from "../gpuMemoryManager";
import {RenderContext} from "../RenderContext";
import {RTCTileManager} from "./RTCTileManager";

/**
 * Owns per-view frame uniforms shared by all instanced mesh draws.
 *
 * @internal
 */
export class FrameUniformManager {

  private readonly _renderContext: RenderContext;
  private readonly _bindGroupLayoutManager: BindGroupLayoutManager;
  private readonly _lightingManager: LightingManager;
  private readonly _rtcTileManager: RTCTileManager;
  private readonly _viewProjectionMatrix: Mat4 = createMat4Float64();
  private readonly _webGPUViewProjectionMatrix: Mat4 = createMat4Float64();
  private readonly _frameUniformData = new Float32Array(FRAME_UNIFORM_FLOATS);
  private _uniformBuffer: WebGPUBufferLike | null = null;
  private _bindGroup: WebGPUBindGroupLike | null = null;

  constructor(params: {
    renderContext: RenderContext;
    bindGroupLayoutManager: BindGroupLayoutManager;
    lightingManager: LightingManager;
    rtcTileManager: RTCTileManager;
  }) {
    this._renderContext = params.renderContext;
    this._bindGroupLayoutManager = params.bindGroupLayoutManager;
    this._lightingManager = params.lightingManager;
    this._rtcTileManager = params.rtcTileManager;
  }

  public writeFrameUniforms(view: View): SDKResult<WebGPUBindGroupLike> {
    const camera = view.camera;
    const viewMatrix = (camera?.viewMatrix ?? IDENTITY_MATRIX) as Mat4;
    const projMatrix = (camera?.projMatrix ?? IDENTITY_MATRIX) as Mat4;

    mulMat4(projMatrix, viewMatrix, this._viewProjectionMatrix);
    mulMat4(WEBGPU_CLIP_SPACE_MATRIX as Mat4, this._viewProjectionMatrix, this._webGPUViewProjectionMatrix);

    return this.writeFrameUniformsForWebGPUViewProjection(view, this._webGPUViewProjectionMatrix);
  }

  public writeFrameUniformsForWebGPUViewProjection(view: View, webGPUViewProjectionMatrix: Mat4): SDKResult<WebGPUBindGroupLike> {
    const tileUploadResult = this._rtcTileManager.writeTileMatricesForWebGPUViewProjection(webGPUViewProjectionMatrix);
    if (tileUploadResult.ok === false) {
      return tileUploadResult;
    }
    const bindGroupResult = this._getOrCreateBindGroup();
    if (bindGroupResult.ok === false) {
      return bindGroupResult;
    }

    for (let i = 0; i < 16; i++) {
      this._frameUniformData[i] = webGPUViewProjectionMatrix[i];
    }
    this._lightingManager.writeLightingUniforms(this._frameUniformData, 16);
    this._writeSectionPlaneUniforms(view, this._frameUniformData, 20);
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

    const bindGroupLayoutResult = this._bindGroupLayoutManager.getFrameBindGroupLayout();
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
        }, {
          binding: 1,
          resource: {
            buffer: this._rtcTileManager.buffer
          }
        }]
      });
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[FrameUniformManager._getOrCreateBindGroup] Failed to create WebGPU frame uniforms: ${e instanceof Error ? e.message : String(e)}`
      };
    }

    return {
      ok: true,
      value: this._bindGroup
    };
  }

  private _writeSectionPlaneUniforms(view: View, target: Float32Array, offset: number): void {
    const planes = (view as any).sectionPlanesList as Array<{
      active: boolean;
      dir: ArrayLike<number>;
      dist: number;
      capColor?: ArrayLike<number> | null;
    }> | undefined;
    let count = 0;
    if (planes) {
      for (let i = 0, len = planes.length; i < len && count < MAX_SECTION_PLANES; i++) {
        const plane = planes[i];
        if (!plane.active) {
          continue;
        }
        const planeOffset = offset + 4 + count * 4;
        target[planeOffset + 0] = plane.dir[0];
        target[planeOffset + 1] = plane.dir[1];
        target[planeOffset + 2] = plane.dir[2];
        target[planeOffset + 3] = plane.dist;
        const capColorOffset = SECTION_PLANE_CAP_COLOR_UNIFORM_OFFSET + count * 4;
        if (plane.capColor) {
          target[capColorOffset + 0] = plane.capColor[0];
          target[capColorOffset + 1] = plane.capColor[1];
          target[capColorOffset + 2] = plane.capColor[2];
          target[capColorOffset + 3] = 1;
        } else {
          target[capColorOffset + 0] = 0;
          target[capColorOffset + 1] = 0;
          target[capColorOffset + 2] = 0;
          target[capColorOffset + 3] = 0;
        }
        count++;
      }
    }
    target[offset] = count;
    target[offset + 1] = 0;
    target[offset + 2] = 0;
    target[offset + 3] = 0;
    for (let i = count; i < MAX_SECTION_PLANES; i++) {
      const planeOffset = offset + 4 + i * 4;
      target[planeOffset + 0] = 0;
      target[planeOffset + 1] = 0;
      target[planeOffset + 2] = 0;
      target[planeOffset + 3] = 0;
      const capColorOffset = SECTION_PLANE_CAP_COLOR_UNIFORM_OFFSET + i * 4;
      target[capColorOffset + 0] = 0;
      target[capColorOffset + 1] = 0;
      target[capColorOffset + 2] = 0;
      target[capColorOffset + 3] = 0;
    }
  }
}
