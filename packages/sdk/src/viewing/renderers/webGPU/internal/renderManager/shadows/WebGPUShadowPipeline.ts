import {PerspectiveProjectionType} from "../../../../../../base/constants";
import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import {createMat4Float64, inverseMat4, lookAtMat4v, mulMat4, orthoMat4c, type Mat4} from "../../../../../../base/math/matrix";
import {
  computeShadowCascadeSplits,
  fitShadowCascadeToCamera,
  isFiniteShadowAABB,
  type ShadowCascadeCameraProjection
} from "../../../../../../base/math/shadows";
import {getSceneCollisionIndex} from "../../../../../../spatial/collision";
import {getShadowDebugModeId, getShadowPcfRadius} from "../../../../../viewer/ShadowSampling";
import type {View} from "../../../../../viewer";
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
const tempInverseCameraView = createMat4Float64();
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
  private readonly _cascadeDepthRanges = new Float32Array(MAX_SHADOW_CASCADES);
  private readonly _cascadeTexelSizes = new Float32Array(MAX_SHADOW_CASCADES);

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
    this._uniformData.fill(0);
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
    for (let i = 136; i < 144; i++) {
      this._uniformData[i] = 1;
    }
    for (let i = 144; i < 152; i++) {
      this._uniformData[i] = 1;
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
    const debugMode = getShadowDebugModeId(shadows.debug);
    this._uniformData[99] = Math.max(0, shadows.normalOffsetBias);
    const direction = shadows.direction;
    this._uniformData[100] = direction[0];
    this._uniformData[101] = direction[1];
    this._uniformData[102] = direction[2];
    const slopeBias = Number.isFinite(Number(shadows.slopeBias)) ? Number(shadows.slopeBias) : 0.00125;
    this._uniformData[103] = Math.max(0, slopeBias);
    this._uniformData[104] = debugMode;
    this._uniformData[105] = cascadeCount;
    this._uniformData[106] = 1.0 / Math.max(1, resolution);
    this._uniformData[107] = getShadowPcfRadius(shadows.pcfKernelSize);
    const cameraViewMatrix = params.view.camera.viewMatrix as ArrayLike<number>;
    for (let i = 0; i < 16; i++) {
      this._uniformData[108 + i] = cameraViewMatrix[i];
    }
    for (let i = 0; i < 8; i++) {
      this._uniformData[124 + i] = i < cascadeCount - 1 ? this._sliceDistances[i + 1] : Number.MAX_VALUE;
    }
    const lightRadius = Number.isFinite(Number(shadows.lightRadius)) ? Number(shadows.lightRadius) : 0.08;
    this._uniformData[132] = shadows.contactHardening ? 1 : 0;
    this._uniformData[133] = Math.max(0, lightRadius);
    this._uniformData[134] = 1;
    this._uniformData[135] = 0;
    for (let i = 0; i < MAX_SHADOW_CASCADES; i++) {
      this._uniformData[136 + i] = this._cascadeDepthRanges[i] || 1;
      this._uniformData[144 + i] = this._cascadeTexelSizes[i] || 1;
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
        compare: "less-equal",
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
    const dirWorld = normalize3(dir[0], dir[1], dir[2]);
    const worldUp: [number, number, number] = Math.abs(dir[2]) < 0.95 ? [0, 0, 1] : [0, 1, 0];
    const maxDistance = Math.max(1, Math.min(shadows.maxDistance, camera.projectionType === PerspectiveProjectionType
      ? camera.perspectiveProjection.far
      : camera.orthoProjection.far));
    const nearDistance = 0.1;
    computeShadowCascadeSplits({
      nearDistance,
      farDistance: maxDistance,
      cascadeCount,
      lambda: shadows.cascadeSplitLambda ?? 0.5,
      target: this._sliceDistances
    });
    const lightDistance = shadows.autoFit ? 1000 : shadows.lightDistance;
    const lightEyeView: [number, number, number] = [
      -dirWorld[0] * lightDistance,
      -dirWorld[1] * lightDistance,
      -dirWorld[2] * lightDistance
    ];
    lookAtMat4v(lightEyeView, [0, 0, 0] as any, worldUp as any, tempLightView);
    const inverseCameraViewMatrix = (camera as {inverseViewMatrix?: ArrayLike<number>}).inverseViewMatrix
      ?? inverseMat4(camera.viewMatrix as Mat4, tempInverseCameraView);
    const projection = getShadowCameraProjection(view);
    const sceneAABB = getSceneAABB(view.viewer.scene);

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
        const fit = fitShadowCascadeToCamera({
          projection,
          canvasWidth,
          canvasHeight,
          nearDistance: sliceNear,
          farDistance: sliceFar,
          lightViewMatrix: tempLightView,
          cameraInverseViewMatrix: inverseCameraViewMatrix,
          resolution,
          padding: shadows.padding,
          sceneAABB
        });
        left = fit.left;
        rightExtent = fit.right;
        bottom = fit.bottom;
        top = fit.top;
        near = fit.near;
        far = fit.far;
        this._cascadeDepthRanges[c] = fit.depthRange;
        this._cascadeTexelSizes[c] = fit.texelWorldSize;
      } else {
        const size = shadows.projectionSize;
        left = -size;
        rightExtent = size;
        bottom = -size;
        top = size;
        near = 0.1;
        far = Math.max(1, shadows.lightDistance * 3);
        this._cascadeDepthRanges[c] = Math.max(0.001, far - near);
        this._cascadeTexelSizes[c] = Math.max(
          0.000001,
          Math.max(rightExtent - left, top - bottom) / Math.max(1, resolution)
        );
      }
      orthoMat4c(left, rightExtent, bottom, top, near, far, tempLightProjection);
      mulMat4(tempLightProjection as Mat4, tempLightView as Mat4, tempLightViewProjection);
      mulMat4(WEBGPU_CLIP_SPACE_MATRIX as Mat4, tempLightViewProjection as Mat4, tempLightViewProjections[c]);
      mulMat4(WEBGPU_CLIP_SPACE_MATRIX as Mat4, tempLightViewProjection as Mat4, tempShadowDepthViewProjections[c]);
    }
    for (let c = cascadeCount; c < MAX_SHADOW_CASCADES; c++) {
      this._cascadeDepthRanges[c] = this._cascadeDepthRanges[0] || 1;
      this._cascadeTexelSizes[c] = this._cascadeTexelSizes[0] || 1;
    }
  }

}

function normalize3(x: number, y: number, z: number): [number, number, number, number] {
  const len = Math.hypot(x, y, z);
  if (len <= 1e-12) {
    return [0, 0, 0, 0];
  }
  return [x / len, y / len, z / len, 1];
}

function getShadowCameraProjection(view: View): ShadowCascadeCameraProjection {
  return view.camera.projectionType === PerspectiveProjectionType
    ? {
      type: "perspective",
      fovDegrees: view.camera.perspectiveProjection.fov
    }
    : {
      type: "ortho",
      scale: view.camera.orthoProjection.scale
    };
}

function getSceneAABB(scene: unknown): ArrayLike<number> | null {
  if (!scene || !canUseSceneCollisionIndex(scene)) {
    return null;
  }
  const sceneAABB = getSceneCollisionIndex(scene as any).getSceneAABB();
  return sceneAABB && isFiniteShadowAABB(sceneAABB) ? sceneAABB : null;
}

function canUseSceneCollisionIndex(scene: unknown): boolean {
  const sceneLike = scene as {id?: unknown; events?: {onSceneDestroyed?: {subscribe?: unknown}}};
  return (
    typeof sceneLike.id === "string" &&
    typeof sceneLike.events?.onSceneDestroyed?.subscribe === "function"
  );
}
