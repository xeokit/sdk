import {SDKErrorType, type SDKResult} from "../../../../base/core";
import {OrthoProjectionType} from "../../../../base/constants";
import {createMat4Float64, mulMat4, type Mat4} from "../../../../base/math/matrix";
import type {View} from "../../../viewer";
import type {WebGPUBindGroupLike, WebGPUBufferLike} from "../../core";
import {
  FRAME_UNIFORM_BYTES,
  FRAME_UNIFORM_FLOATS,
  GPU_BUFFER_USAGE,
  IDENTITY_MATRIX,
  AMBIENT_LIGHT_UNIFORM_OFFSET,
  MAX_SECTION_PLANES,
  SECTION_PLANE_STATE_UNIFORM_OFFSET,
  SECTION_PLANE_CAP_COLOR_UNIFORM_OFFSET,
  DEPTH_PARAMS_UNIFORM_OFFSET,
  POINT_PARAMS_UNIFORM_OFFSET,
  LINE_PARAMS_UNIFORM_OFFSET,
  VIEW_MATRIX_UNIFORM_OFFSET,
  SPLAT_PARAMS_UNIFORM_OFFSET,
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
  private _bindGroupVersion = -1;

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
    this._lightingManager.writeLightingUniforms(view, this._frameUniformData, AMBIENT_LIGHT_UNIFORM_OFFSET);
    this._writeSectionPlaneUniforms(view, this._frameUniformData, SECTION_PLANE_STATE_UNIFORM_OFFSET);
    this._writeDepthUniforms(view, this._frameUniformData, DEPTH_PARAMS_UNIFORM_OFFSET);
    this._writePointUniforms(view, this._frameUniformData, POINT_PARAMS_UNIFORM_OFFSET);
    this._writeLineUniforms(view, this._frameUniformData, LINE_PARAMS_UNIFORM_OFFSET);
    this._writeViewMatrixUniforms(view, this._frameUniformData, VIEW_MATRIX_UNIFORM_OFFSET);
    this._writeSplatUniforms(view, this._frameUniformData, SPLAT_PARAMS_UNIFORM_OFFSET);
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
    if (this._bindGroup && this._bindGroupVersion === this._renderContext.iblBindGroupVersion) {
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
        }, {
          binding: 2,
          resource: {
            buffer: this._renderContext.iblUniformBuffer
          }
        }, {
          binding: 3,
          resource: this._renderContext.iblSampler
        }, {
          binding: 4,
          resource: this._renderContext.iblIrradianceView
        }, {
          binding: 5,
          resource: this._renderContext.iblPrefilteredView
        }, {
          binding: 6,
          resource: this._renderContext.iblBRDFLUTView
        }]
      });
      this._bindGroupVersion = this._renderContext.iblBindGroupVersion;
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

  private _writeDepthUniforms(view: View, target: Float32Array, offset: number): void {
    const far = Number(view.camera?.perspectiveProjection?.far ?? 1000000);
    const safeFar = Number.isFinite(far) && far > 0 ? far : 1000000;
    target[offset] = 2.0 / Math.log2(safeFar + 1.0);
    target[offset + 1] = this._renderContext.renderConfigs.logDepth ? 1.0 : 0.0;
    target[offset + 2] = 0.0;
    target[offset + 3] = 0.0;
  }

  private _writePointUniforms(view: View, target: Float32Array, offset: number): void {
    const pointMaterial = view.pointsMaterial;
    const pointSize = Math.max(1, Number(pointMaterial?.pointSize ?? 1));
    const minPerspectivePointSize = Math.max(1, Number(pointMaterial?.minPerspectivePointSize ?? pointSize));
    const maxPerspectivePointSize = Math.max(minPerspectivePointSize, Number(pointMaterial?.maxPerspectivePointSize ?? pointSize));
    const perspectivePoints = pointMaterial?.perspectivePoints === true ? 1 : 0;
    const roundPoints = pointMaterial?.roundPoints === true ? 1 : 0;
    const camera = view.camera;
    const fov = Number(camera?.perspectiveProjection?.fov ?? 60);
    const viewportHeight = Number(view.boundary?.[3] || view.htmlElement?.clientHeight || 1);
    const nearPlaneHeight = camera?.projectionType === OrthoProjectionType
      ? 1
      : viewportHeight / (2 * Math.tan(0.5 * fov * Math.PI / 180.0));

    target[offset + 0] = pointSize;
    target[offset + 1] = perspectivePoints;
    target[offset + 2] = roundPoints;
    target[offset + 3] = nearPlaneHeight;
    target[offset + 4] = minPerspectivePointSize;
    target[offset + 5] = maxPerspectivePointSize;
    target[offset + 6] = Math.max(1, Number(view.boundary?.[2] || view.htmlElement?.clientWidth || 1));
    target[offset + 7] = Math.max(1, viewportHeight);
  }

  private _writeLineUniforms(view: View, target: Float32Array, offset: number): void {
    const lineMaterial = view.linesMaterial;
    target[offset + 0] = Math.max(1, Number(lineMaterial?.lineWidth ?? 1));
    target[offset + 1] = Math.max(1, Number(view.boundary?.[2] || view.htmlElement?.clientWidth || 1));
    target[offset + 2] = Math.max(1, Number(view.boundary?.[3] || view.htmlElement?.clientHeight || 1));
    target[offset + 3] = 0;
  }

  private _writeViewMatrixUniforms(view: View, target: Float32Array, offset: number): void {
    const viewMatrix = (view.camera?.viewMatrix ?? IDENTITY_MATRIX) as Mat4;
    for (let i = 0; i < 16; i++) {
      target[offset + i] = viewMatrix[i];
    }
  }

  private _writeSplatUniforms(view: View, target: Float32Array, offset: number): void {
    const camera = view.camera;
    const fov = Number(camera?.perspectiveProjection?.fov ?? 60);
    const viewportWidth = Math.max(1, Number(view.boundary?.[2] || view.htmlElement?.clientWidth || 1));
    const viewportHeight = Math.max(1, Number(view.boundary?.[3] || view.htmlElement?.clientHeight || 1));
    const focalY = camera?.projectionType === OrthoProjectionType
      ? viewportHeight
      : viewportHeight / (2 * Math.tan(0.5 * fov * Math.PI / 180.0));
    const focalX = focalY * (viewportWidth / viewportHeight);
    target[offset + 0] = viewportWidth;
    target[offset + 1] = viewportHeight;
    target[offset + 2] = focalX;
    target[offset + 3] = focalY;
  }
}
