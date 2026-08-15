import {PerspectiveProjectionType} from "../../../../../base/constants";
import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import {createMat4Float64, lookAtMat4v, mulMat4, orthoMat4c, type Mat4} from "../../../../../base/math/matrix";
import type {View} from "../../../../viewer";
import type {
  WebGPUBindGroupLike,
  WebGPUBufferLike,
  WebGPURenderPassEncoderLike,
  WebGPUSamplerLike,
  WebGPUTextureLike
} from "../../../core";
import {DrawOp, CommandStateTracker, type InstancedDrawBatch} from "../../drawOps";
import {BindGroupLayoutManager} from "../../gpuMemoryManager";
import type {RenderInspector} from "../../inspectors";
import {RenderContext} from "../../RenderContext";
import {
  GPU_BUFFER_USAGE,
  GPU_TEXTURE_USAGE,
  MAX_SHADOW_CASCADES,
  SHADOW_DEPTH_FORMAT,
  SHADOW_UNIFORM_BYTES,
  SHADOW_UNIFORM_FLOATS,
  WEBGPU_CLIP_SPACE_MATRIX
} from "../../constants";
import {FrameUniformManager} from "../FrameUniformManager";

const tempLightView = createMat4Float64();
const tempLightProjection = createMat4Float64();
const tempLightViewProjection = createMat4Float64();
const tempShadowDepthViewProjection = createMat4Float64();
const tempLightViewProjections: Mat4[] = Array.from({length: MAX_SHADOW_CASCADES}, () => createMat4Float64());
const tempShadowDepthViewProjections: Mat4[] = Array.from({length: MAX_SHADOW_CASCADES}, () => createMat4Float64());

/**
 * Cascaded directional shadow-map pipeline for WebGPURenderer.
 *
 * @internal
 */
export class WebGPUShadowPipeline {

  private readonly _renderContext: RenderContext;
  private readonly _bindGroupLayoutManager: BindGroupLayoutManager;
  private readonly _frameUniformManager: FrameUniformManager;
  private readonly _renderInspector: RenderInspector;
  private readonly _uniformData = new Float32Array(SHADOW_UNIFORM_FLOATS);
  private _uniformBuffer: WebGPUBufferLike | null = null;
  private _sampler: WebGPUSamplerLike | null = null;
  private _texture: WebGPUTextureLike | null = null;
  private _textureView: unknown | null = null;
  private _layerViews: unknown[] = [];
  private _bindGroup: WebGPUBindGroupLike | null = null;
  private _resolution = 0;
  private _cascadeCount = 0;
  private readonly _sliceDistances = new Float32Array(MAX_SHADOW_CASCADES + 1);

  constructor(params: {
    renderContext: RenderContext;
    bindGroupLayoutManager: BindGroupLayoutManager;
    frameUniformManager: FrameUniformManager;
    renderInspector: RenderInspector;
  }) {
    this._renderContext = params.renderContext;
    this._bindGroupLayoutManager = params.bindGroupLayoutManager;
    this._frameUniformManager = params.frameUniformManager;
    this._renderInspector = params.renderInspector;
  }

  public init(): SDKResult<void> {
    return {
      ok: true,
      value: undefined
    };
  }

  public shouldRender(view: View, batches: InstancedDrawBatch[]): boolean {
    const shadows = view.effects?.shadows;
    return !!shadows && shadows.applied && shadows.possible && shadows.intensity > 0 && batches.length > 0;
  }

  public disable(): SDKResult<void> {
    const resourcesResult = this._ensureResources(1, 1);
    if (resourcesResult.ok === false) {
      return resourcesResult;
    }
    for (let c = 0; c < MAX_SHADOW_CASCADES; c++) {
      const offset = c * 16;
      for (let i = 0; i < 16; i++) {
        this._uniformData[offset + i] = i % 5 === 0 ? 1 : 0;
      }
    }
    this._uniformData[96] = 0;
    this._uniformData[97] = 0;
    this._uniformData[98] = 0;
    this._uniformData[99] = 0;
    this._uniformData[100] = -0.5;
    this._uniformData[101] = -1.0;
    this._uniformData[102] = -0.3;
    this._uniformData[103] = 0;
    this._uniformData[104] = 0;
    this._uniformData[105] = 0;
    this._uniformData[106] = 1;
    this._uniformData[107] = 0;
    for (let i = 0; i < 16; i++) {
      this._uniformData[108 + i] = i % 5 === 0 ? 1 : 0;
    }
    for (let i = 124; i < 132; i++) {
      this._uniformData[i] = Number.MAX_VALUE;
    }
    this._renderContext.device.queue.writeBuffer(this._uniformBuffer!, 0, this._uniformData);
    this._renderContext.shadowBindGroup = this._bindGroup;
    return {
      ok: true,
      value: undefined
    };
  }

  public render(params: {
    view: View;
    canvasWidth: number;
    canvasHeight: number;
    frameBindGroup: WebGPUBindGroupLike;
    instanceBindGroup: WebGPUBindGroupLike;
    batches: InstancedDrawBatch[];
    shadowDepthDrawOp: DrawOp | undefined;
  }): SDKResult<void> {
    if (!params.shadowDepthDrawOp) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[WebGPUShadowPipeline.render] Triangle shadow-depth draw operation was not initialized."
      };
    }
    const shadows = params.view.effects.shadows;
    const resolution = Math.max(1, Math.floor(shadows.resolution));
    const cascadeCount = Math.min(MAX_SHADOW_CASCADES, Math.max(1, Math.floor(shadows.cascadeCount ?? 1)));
    const resourcesResult = this._ensureResources(resolution, cascadeCount);
    if (resourcesResult.ok === false) {
      return resourcesResult;
    }

    this._buildLightViewProjections(params.view, params.canvasWidth, params.canvasHeight, resolution, cascadeCount);
    for (let c = 0; c < MAX_SHADOW_CASCADES; c++) {
      const matrix = c < cascadeCount ? tempLightViewProjections[c] : tempLightViewProjections[0];
      const offset = c * 16;
      for (let i = 0; i < 16; i++) {
        this._uniformData[offset + i] = matrix[i];
      }
    }
    this._uniformData[96] = 1;
    this._uniformData[97] = Math.max(0, Math.min(1, shadows.intensity));
    this._uniformData[98] = Math.max(0, shadows.bias);
    const debugMode = (shadows as {debug?: boolean | "factor" | "depth"}).debug;
    this._uniformData[99] = Math.max(0, shadows.normalOffsetBias);
    const direction = shadows.direction;
    this._uniformData[100] = direction[0];
    this._uniformData[101] = direction[1];
    this._uniformData[102] = direction[2];
    this._uniformData[103] = Math.max(0, shadows.slopeBias);
    this._uniformData[104] = debugMode === "depth" ? 2 : debugMode ? 1 : 0;
    this._uniformData[105] = cascadeCount;
    this._uniformData[106] = 1.0 / Math.max(1, resolution);
    this._uniformData[107] = 0;
    const cameraViewMatrix = params.view.camera.viewMatrix as ArrayLike<number>;
    for (let i = 0; i < 16; i++) {
      this._uniformData[108 + i] = cameraViewMatrix[i];
    }
    for (let i = 0; i < 8; i++) {
      this._uniformData[124 + i] = i < cascadeCount - 1 ? this._sliceDistances[i + 1] : Number.MAX_VALUE;
    }
    this._renderContext.device.queue.writeBuffer(this._uniformBuffer!, 0, this._uniformData);
    this._renderContext.shadowBindGroup = this._bindGroup;

    for (let c = 0; c < cascadeCount; c++) {
      const frameBindGroupResult = this._frameUniformManager.writeFrameUniformsForWebGPUViewProjection(params.view, tempShadowDepthViewProjections[c]);
      if (frameBindGroupResult.ok === false) {
        return frameBindGroupResult;
      }

      const commandEncoder = this._renderContext.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: this._layerViews[c],
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store"
        }
      }) as WebGPURenderPassEncoderLike;
      this._renderInspector.renderBinStarted("SHADOW_DEPTH");
      this._renderInspector.drawBatches({
        renderPass: "SHADOW_DEPTH",
        technique: "TrianglesShadowDepthTechnique",
        batches: params.batches
      });
      const commandStateTracker = new CommandStateTracker({
        passEncoder,
        commandStats: this._renderInspector
      });
      const drawResult = params.shadowDepthDrawOp.drawBatches({
        passEncoder,
        commandStateTracker,
        frameBindGroup: frameBindGroupResult.value,
        instanceBindGroup: params.instanceBindGroup,
        batches: params.batches,
        commandStats: this._renderInspector
      });
      if (drawResult.ok === false) {
        return drawResult;
      }
      passEncoder.end?.();
      this._renderContext.device.queue.submit([commandEncoder.finish()]);
    }

    return {
      ok: true,
      value: undefined
    };
  }

  public destroy(): void {
    try {
      this._texture?.destroy?.();
      this._uniformBuffer?.destroy?.();
    } catch {
      // Ignore resource destruction failures during teardown.
    }
    this._uniformBuffer = null;
    this._sampler = null;
    this._texture = null;
    this._textureView = null;
    this._layerViews = [];
    this._bindGroup = null;
    this._resolution = 0;
    this._cascadeCount = 0;
    this._renderContext.shadowBindGroup = null;
  }

  private _ensureResources(resolution: number, cascadeCount: number): SDKResult<void> {
    const bindGroupLayoutResult = this._bindGroupLayoutManager.getShadowBindGroupLayout();
    if (bindGroupLayoutResult.ok === false) {
      return bindGroupLayoutResult;
    }
    if (!this._uniformBuffer) {
      this._uniformBuffer = this._renderContext.device.createBuffer({
        label: "xeokit-webgpu-shadow-uniforms",
        size: SHADOW_UNIFORM_BYTES,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      });
    }
    if (!this._sampler) {
      if (!this._renderContext.device.createSampler) {
        return {
          ok: false,
          type: SDKErrorType.InitializationFailed,
          error: "[WebGPUShadowPipeline._ensureResources] WebGPU device does not expose createSampler."
        };
      }
      this._sampler = this._renderContext.device.createSampler({
        label: "xeokit-webgpu-shadow-comparison-sampler",
        compare: "less",
        minFilter: "linear",
        magFilter: "linear"
      });
    }
    if (!this._texture || this._resolution !== resolution || this._cascadeCount !== cascadeCount) {
      try {
        this._texture?.destroy?.();
      } catch {
        // Ignore texture destruction failures during resize.
      }
      this._texture = this._renderContext.device.createTexture({
        label: "xeokit-webgpu-shadow-depth-texture",
        size: {
          width: resolution,
          height: resolution,
          depthOrArrayLayers: cascadeCount
        },
        format: SHADOW_DEPTH_FORMAT,
        usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT | GPU_TEXTURE_USAGE.TEXTURE_BINDING
      });
      this._textureView = this._texture.createView({
        dimension: "2d-array",
        baseArrayLayer: 0,
        arrayLayerCount: cascadeCount
      });
      this._layerViews = [];
      for (let c = 0; c < cascadeCount; c++) {
        this._layerViews.push(this._texture.createView({
          dimension: "2d",
          baseArrayLayer: c,
          arrayLayerCount: 1
        }));
      }
      this._resolution = resolution;
      this._cascadeCount = cascadeCount;
      this._bindGroup = null;
    }
    if (!this._bindGroup) {
      this._bindGroup = this._renderContext.device.createBindGroup({
        label: "xeokit-webgpu-shadow-bind-group",
        layout: bindGroupLayoutResult.value,
        entries: [{
          binding: 0,
          resource: {
            buffer: this._uniformBuffer
          }
        }, {
          binding: 1,
          resource: this._sampler
        }, {
          binding: 2,
          resource: this._textureView
        }]
      });
    }
    this._renderContext.shadowBindGroup = this._bindGroup;
    return {
      ok: true,
      value: undefined
    };
  }

  private _buildLightViewProjections(view: View, canvasWidth: number, canvasHeight: number, resolution: number, cascadeCount: number): void {
    const shadows = view.effects.shadows;
    const dir = shadows.direction;
    const camera = view.camera;
    const cameraViewMatrix = camera.viewMatrix as ArrayLike<number>;
    const dxV = cameraViewMatrix[0] * dir[0] + cameraViewMatrix[4] * dir[1] + cameraViewMatrix[8] * dir[2];
    const dyV = cameraViewMatrix[1] * dir[0] + cameraViewMatrix[5] * dir[1] + cameraViewMatrix[9] * dir[2];
    const dzV = cameraViewMatrix[2] * dir[0] + cameraViewMatrix[6] * dir[1] + cameraViewMatrix[10] * dir[2];
    const dirView = normalize3(dxV, dyV, dzV);
    const worldUp: [number, number, number] = Math.abs(dir[2]) < 0.95 ? [0, 0, 1] : [0, 1, 0];
    const upView: [number, number, number] = [
      cameraViewMatrix[0] * worldUp[0] + cameraViewMatrix[4] * worldUp[1] + cameraViewMatrix[8] * worldUp[2],
      cameraViewMatrix[1] * worldUp[0] + cameraViewMatrix[5] * worldUp[1] + cameraViewMatrix[9] * worldUp[2],
      cameraViewMatrix[2] * worldUp[0] + cameraViewMatrix[6] * worldUp[1] + cameraViewMatrix[10] * worldUp[2]
    ];
    const maxDistance = Math.max(1, Math.min(shadows.maxDistance, camera.projectionType === PerspectiveProjectionType
      ? camera.perspectiveProjection.far
      : camera.orthoProjection.far));
    const nearDistance = 0.1;
    this._computeCascadeSplits(nearDistance, maxDistance, cascadeCount, shadows.cascadeSplitLambda ?? 0.5);
    const lightDistance = shadows.autoFit ? 1000 : shadows.lightDistance;
    const lightEyeView: [number, number, number] = [
      -dirView[0] * lightDistance,
      -dirView[1] * lightDistance,
      -dirView[2] * lightDistance
    ];
    lookAtMat4v(lightEyeView, [0, 0, 0] as any, upView as any, tempLightView);

    for (let c = 0; c < cascadeCount; c++) {
      const sliceNear = this._sliceDistances[c];
      const sliceFar = this._sliceDistances[c + 1];
      let left: number;
      let rightExtent: number;
      let bottom: number;
      let top: number;
      let near: number;
      let far: number;
      if (shadows.autoFit) {
        const fit = fitLightProjectionToCamera(view, {
          canvasWidth,
          canvasHeight,
          nearDistance: sliceNear,
          farDistance: sliceFar,
          lightView: tempLightView,
          resolution,
          padding: shadows.padding
        });
        left = fit.left;
        rightExtent = fit.right;
        bottom = fit.bottom;
        top = fit.top;
        near = fit.near;
        far = fit.far;
      } else {
        const size = shadows.projectionSize;
        left = -size;
        rightExtent = size;
        bottom = -size;
        top = size;
        near = 0.1;
        far = Math.max(1, shadows.lightDistance * 3);
      }
      orthoMat4c(left, rightExtent, bottom, top, near, far, tempLightProjection);
      mulMat4(tempLightProjection as Mat4, tempLightView as Mat4, tempLightViewProjection);
      mulMat4(WEBGPU_CLIP_SPACE_MATRIX as Mat4, tempLightViewProjection as Mat4, tempLightViewProjections[c]);
      mulMat4(tempLightViewProjection as Mat4, cameraViewMatrix as Mat4, tempShadowDepthViewProjection);
      mulMat4(WEBGPU_CLIP_SPACE_MATRIX as Mat4, tempShadowDepthViewProjection as Mat4, tempShadowDepthViewProjections[c]);
    }
  }

  private _computeCascadeSplits(near: number, far: number, count: number, lambda: number): void {
    this._sliceDistances[0] = near;
    const clampedLambda = Math.max(0, Math.min(1, lambda));
    for (let i = 1; i <= count; i++) {
      const p = i / count;
      const log = near * Math.pow(far / near, p);
      const uniform = near + (far - near) * p;
      this._sliceDistances[i] = clampedLambda * log + (1 - clampedLambda) * uniform;
    }
  }
}

function fitLightProjectionToCamera(
  view: View,
  params: {
    canvasWidth: number;
    canvasHeight: number;
    nearDistance: number;
    farDistance: number;
    lightView: Mat4;
    resolution: number;
    padding: number;
  }
): {left: number; right: number; bottom: number; top: number; near: number; far: number} {
  const aspect = Math.max(1e-6, params.canvasHeight > 0 ? params.canvasWidth / params.canvasHeight : 1);
  let halfNearH: number;
  let halfNearW: number;
  let halfFarH: number;
  let halfFarW: number;
  if (view.camera.projectionType === PerspectiveProjectionType) {
    const fovRad = view.camera.perspectiveProjection.fov * Math.PI / 180;
    const tanHalfFov = Math.tan(fovRad * 0.5);
    if (aspect >= 1) {
      halfNearH = tanHalfFov * params.nearDistance;
      halfNearW = halfNearH * aspect;
      halfFarH = tanHalfFov * params.farDistance;
      halfFarW = halfFarH * aspect;
    } else {
      halfNearW = tanHalfFov * params.nearDistance;
      halfNearH = halfNearW / aspect;
      halfFarW = tanHalfFov * params.farDistance;
      halfFarH = halfFarW / aspect;
    }
  } else {
    const halfH = view.camera.orthoProjection.scale * 0.5;
    halfNearH = halfFarH = halfH;
    halfNearW = halfFarW = halfH * aspect;
  }
  const corners = [
    [-halfNearW, -halfNearH, -params.nearDistance],
    [halfNearW, -halfNearH, -params.nearDistance],
    [-halfNearW, halfNearH, -params.nearDistance],
    [halfNearW, halfNearH, -params.nearDistance],
    [-halfFarW, -halfFarH, -params.farDistance],
    [halfFarW, -halfFarH, -params.farDistance],
    [-halfFarW, halfFarH, -params.farDistance],
    [halfFarW, halfFarH, -params.farDistance]
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const m = params.lightView;
  for (const c of corners) {
    const x = m[0] * c[0] + m[4] * c[1] + m[8] * c[2] + m[12];
    const y = m[1] * c[0] + m[5] * c[1] + m[9] * c[2] + m[13];
    const z = m[2] * c[0] + m[6] * c[1] + m[10] * c[2] + m[14];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const padMul = Math.max(1, params.padding);
  const padX = (maxX - minX) * (padMul - 1) * 0.5;
  const padY = (maxY - minY) * (padMul - 1) * 0.5;
  let left = minX - padX;
  let right = maxX + padX;
  let bottom = minY - padY;
  let top = maxY + padY;
  const texelX = (right - left) / params.resolution;
  const texelY = (top - bottom) / params.resolution;
  if (texelX > 0 && texelY > 0) {
    left = Math.floor(left / texelX) * texelX;
    right = left + texelX * params.resolution;
    bottom = Math.floor(bottom / texelY) * texelY;
    top = bottom + texelY * params.resolution;
  }
  return {
    left,
    right,
    bottom,
    top,
    near: Math.max(0.01, -maxZ),
    far: -minZ + params.farDistance
  };
}

function normalize3(x: number, y: number, z: number): [number, number, number, number] {
  const len = Math.hypot(x, y, z);
  if (len <= 1e-12) {
    return [0, 0, 0, 0];
  }
  return [x / len, y / len, z / len, 1];
}
