import {PerspectiveProjectionType} from "../../../../../../../base/constants";
import type {SDKResult} from "../../../../../../../base/core";
import {SDKErrorType} from "../../../../../../../base/core";
import type {View} from "../../../../../../viewer";
import type {WebGPUBindGroupLayoutLike, WebGPUBindGroupLike, WebGPUCommandEncoderLike, WebGPURenderPipelineLike, WebGPUShaderModuleLike} from "../../../../core";
import {GPU_SHADER_STAGE} from "../../../constants";
import type {RenderContext} from "../../../RenderContext";

/**
 * Computes a WebGPU SAO occlusion texture from the scene depth buffer.
 *
 * Mirrors WebGLRenderer's SAOOcclusionRenderer at the architectural level: this
 * pass owns the AO shader and leaves final color darkening to the composite pass.
 *
 * @internal
 */
export class WebGPUSAOOcclusionRenderer {

  private readonly _renderContext: RenderContext;
  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _bindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _pipelineLayout: unknown | null = null;
  private _pipeline: WebGPURenderPipelineLike | null = null;
  private _paramsBuffer: unknown | null = null;
  private _numSamples = 0;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  render(params: {
    commandEncoder: WebGPUCommandEncoderLike;
    depthView: unknown;
    targetView: unknown;
    width: number;
    height: number;
    view: View;
  }): SDKResult<void> {
    const sao = params.view.effects.sao;
    const sampleCount = Math.max(1, Math.min(32, Math.floor(sao.numSamples ?? 10)));
    const initResult = this._ensurePipeline(sampleCount);
    if (initResult.ok === false) {
      return initResult;
    }
    if (!this._pipeline || !this._bindGroupLayout || !this._paramsBuffer) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[WebGPUSAOOcclusionRenderer.render] Pipeline was not initialized."
      };
    }

    this._renderContext.writeGPUBuffer(
      this._paramsBuffer as any,
      0,
      this._createUniformData(params.view, params.width, params.height, sampleCount)
    );

    const bindGroup: WebGPUBindGroupLike = this._renderContext.device.createBindGroup({
      label: "xeokit-webgpu-sao-occlusion-bind-group",
      layout: this._bindGroupLayout,
      entries: [{
        binding: 0,
        resource: {
          buffer: this._paramsBuffer
        }
      }, {
        binding: 1,
        resource: params.depthView
      }]
    });

    const passEncoder = params.commandEncoder.beginRenderPass({
      label: "xeokit-webgpu-sao-occlusion-pass",
      colorAttachments: [{
        view: params.targetView,
        loadOp: "clear",
        clearValue: {r: 1, g: 1, b: 1, a: 1},
        storeOp: "store"
      }]
    });
    passEncoder.setPipeline?.(this._pipeline);
    passEncoder.setBindGroup?.(0, bindGroup);
    passEncoder.draw?.(3, 1, 0, 0);
    passEncoder.end?.();
    passEncoder.endPass?.();
    return {ok: true, value: undefined};
  }

  destroy(): void {
    (this._paramsBuffer as {destroy?: () => void} | null)?.destroy?.();
    this._paramsBuffer = null;
    this._shaderModule = null;
    this._bindGroupLayout = null;
    this._pipelineLayout = null;
    this._pipeline = null;
    this._numSamples = 0;
  }

  private _ensurePipeline(numSamples: number): SDKResult<void> {
    if (this._pipeline && this._numSamples === numSamples) {
      return {ok: true, value: undefined};
    }
    this.destroy();
    this._numSamples = numSamples;
    try {
      const device = this._renderContext.device;
      this._shaderModule = device.createShaderModule({
        label: "xeokit-webgpu-sao-occlusion-shader",
        code: createShader(numSamples)
      });
      this._bindGroupLayout = device.createBindGroupLayout({
        label: "xeokit-webgpu-sao-occlusion-bind-group-layout",
        entries: [{
          binding: 0,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          buffer: {
            type: "uniform"
          }
        }, {
          binding: 1,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "depth"
          }
        }]
      });
      this._pipelineLayout = device.createPipelineLayout({
        label: "xeokit-webgpu-sao-occlusion-pipeline-layout",
        bindGroupLayouts: [this._bindGroupLayout]
      });
      this._pipeline = device.createRenderPipeline({
        label: "xeokit-webgpu-sao-occlusion-pipeline",
        layout: this._pipelineLayout,
        vertex: {
          module: this._shaderModule,
          entryPoint: "vsMain"
        },
        fragment: {
          module: this._shaderModule,
          entryPoint: "fsMain",
          targets: [{
            format: "r8unorm"
          }]
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "none"
        }
      });
      this._paramsBuffer = this._renderContext.createEmptyGPUBuffer(
        "xeokit-webgpu-sao-occlusion-params",
        128,
        64
      );
    } catch (e) {
      this.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUSAOOcclusionRenderer.init] Failed to create SAO occlusion pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: undefined};
  }

  private _createUniformData(view: View, width: number, height: number, sampleCount: number): Float32Array {
    const sao = view.effects.sao;
    const projection = view.camera.projectionType === PerspectiveProjectionType
      ? view.camera.perspectiveProjection
      : view.camera.orthoProjection;
    const projMatrix = projection.projMatrix;
    return new Float32Array([
      width > 0 ? 1.0 / width : 0,
      height > 0 ? 1.0 / height : 0,
      Math.max(1, width),
      Math.max(1, height),
      projection.near,
      projection.far,
      (sao.scale ?? 1) * (projection.far / 5),
      sao.intensity ?? 0.15,
      sao.bias ?? 0.5,
      sao.kernelRadius ?? 100,
      sao.minResolution ?? 0,
      Math.random(),
      view.camera.projectionType === PerspectiveProjectionType ? 1 : 0,
      sampleCount,
      Number(projMatrix[0]),
      Number(projMatrix[5]),
      this._renderContext.renderConfigs.logDepth ? 1 : 0,
      0, 0, 0, 0, 0, 0, 0
    ]);
  }
}

function createShader(numSamples: number): string {
  return `
struct Params {
  inverseViewport: vec2<f32>,
  viewport: vec2<f32>,
  near: f32,
  far: f32,
  scale: f32,
  intensity: f32,
  bias: f32,
  kernelRadius: f32,
  minResolution: f32,
  randomSeed: f32,
  perspective: f32,
  numSamples: f32,
  proj00: f32,
  proj11: f32,
  pad0: vec2<f32>,
  pad1: vec4<f32>,
  pad2: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var sceneDepth: texture_depth_2d;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  let pos = positions[vertexIndex];
  var output: VertexOutput;
  output.position = vec4<f32>(pos, 0.0, 1.0);
  output.uv = vec2<f32>(pos.x * 0.5 + 0.5, 0.5 - pos.y * 0.5);
  return output;
}

fn rand(uv: vec2<f32>) -> f32 {
  let dt = dot(uv, vec2<f32>(12.9898, 78.233));
  return fract(sin(dt % 3.14159265359) * 43758.5453);
}

fn loadDepth(uv: vec2<f32>) -> f32 {
  let dimsU = textureDimensions(sceneDepth);
  let dims = vec2<i32>(i32(dimsU.x), i32(dimsU.y));
  let clampedUV = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));
  let px = clamp(vec2<i32>(clampedUV * vec2<f32>(f32(dims.x), f32(dims.y))), vec2<i32>(0), dims - vec2<i32>(1));
  return textureLoad(sceneDepth, px, 0);
}

fn getViewZ(depth: f32) -> f32 {
  let perspectiveStandardZ = (params.near * params.far) / ((params.far - params.near) * depth - params.far);
  let perspectiveLogZ = 1.0 - pow(1.0 + params.far, depth);
  let perspectiveZ = select(perspectiveStandardZ, perspectiveLogZ, params.pad0.x > 0.5);
  let orthoZ = depth * (params.near - params.far) - params.near;
  return select(orthoZ, perspectiveZ, params.perspective > 0.5);
}

fn getViewPos(screenPos: vec2<f32>, depth: f32, viewZ: f32) -> vec3<f32> {
  let ndcXY = vec2<f32>(screenPos.x * 2.0 - 1.0, 1.0 - screenPos.y * 2.0);
  let perspectivePos = vec3<f32>(
    ndcXY.x * (-viewZ) / params.proj00,
    ndcXY.y * (-viewZ) / params.proj11,
    viewZ
  );
  let orthoPos = vec3<f32>(ndcXY, depth);
  return select(orthoPos, perspectivePos, params.perspective > 0.5);
}

fn getOcclusion(centerViewPosition: vec3<f32>, centerViewNormal: vec3<f32>, sampleViewPosition: vec3<f32>) -> f32 {
  let viewDelta = sampleViewPosition - centerViewPosition;
  let viewDistance = length(viewDelta);
  let scaledScreenDistance = max((params.scale / params.far) * viewDistance, 0.000001);
  let minResolution = params.minResolution * params.far;
  let normalTerm = (dot(centerViewNormal, viewDelta) - minResolution) / scaledScreenDistance - params.bias;
  return max(0.0, normalTerm) / (1.0 + scaledScreenDistance * scaledScreenDistance);
}

fn getAmbientOcclusion(centerViewPosition: vec3<f32>, uv: vec2<f32>) -> f32 {
  let centerViewNormal = normalize(cross(dpdy(centerViewPosition), dpdx(centerViewPosition)));
  var angle = rand(uv + vec2<f32>(params.randomSeed)) * 6.28318530718;
  var radius = vec2<f32>(params.kernelRadius / f32(${numSamples})) * params.inverseViewport;
  let radiusStep = radius;
  var occlusionSum = 0.0;
  var weightSum = 0.0;
  for (var i = 0; i < ${numSamples}; i = i + 1) {
    let sampleUV = uv + vec2<f32>(cos(angle), sin(angle)) * radius;
    radius = radius + radiusStep;
    angle = angle + (6.28318530718 * 4.0 / f32(${numSamples}));
    let sampleDepth = loadDepth(sampleUV);
    if (sampleDepth < 0.999999) {
      let sampleViewZ = getViewZ(sampleDepth);
      let sampleViewPosition = getViewPos(sampleUV, sampleDepth, sampleViewZ);
      occlusionSum = occlusionSum + getOcclusion(centerViewPosition, centerViewNormal, sampleViewPosition);
      weightSum = weightSum + 1.0;
    }
  }
  return select(0.0, occlusionSum * (params.intensity / weightSum), weightSum > 0.0);
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let centerDepth = loadDepth(input.uv);
  let centerViewZ = getViewZ(centerDepth);
  let centerViewPosition = getViewPos(input.uv, centerDepth, centerViewZ);
  let ambientOcclusion = getAmbientOcclusion(centerViewPosition, input.uv);
  let depthValid = select(1.0, 0.0, centerDepth >= 0.999999);
  let occlusion = mix(1.0, clamp(1.0 - ambientOcclusion, 0.0, 1.0), depthValid);
  return vec4<f32>(occlusion, 0.0, 0.0, 1.0);
}
`;
}
