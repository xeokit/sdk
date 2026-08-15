import {PerspectiveProjectionType} from "../../../../../../base/constants";
import type {SDKResult} from "../../../../../../base/core";
import {SDKErrorType} from "../../../../../../base/core";
import type {View} from "../../../../../viewer";
import type {WebGPUBindGroupLayoutLike, WebGPUBindGroupLike, WebGPUCommandEncoderLike, WebGPURenderPipelineLike, WebGPUShaderModuleLike} from "../../../../core";
import {GPU_SHADER_STAGE} from "../../../constants";
import type {RenderContext} from "../../../RenderContext";

const BLUR_STD_DEV = 4;
const BLUR_DEPTH_CUTOFF = 0.01;
const KERNEL_RADIUS = 16;
const SAMPLE_WEIGHTS = createSampleWeights(KERNEL_RADIUS + 1, BLUR_STD_DEV);

/**
 * Optional depth-limited SAO blur pass, equivalent in shape to WebGLRenderer's
 * SAODepthLimitedBlurRenderer.
 *
 * @internal
 */
export class WebGPUSAODepthLimitedBlurRenderer {

  private readonly _renderContext: RenderContext;
  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _bindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _pipelineLayout: unknown | null = null;
  private _pipeline: WebGPURenderPipelineLike | null = null;
  private _paramsBuffer: unknown | null = null;
  private _initialized = false;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  init(): SDKResult<void> {
    if (this._initialized) {
      return {ok: true, value: undefined};
    }
    try {
      const device = this._renderContext.device;
      this._shaderModule = device.createShaderModule({
        label: "xeokit-webgpu-sao-blur-shader",
        code: SHADER
      });
      this._bindGroupLayout = device.createBindGroupLayout({
        label: "xeokit-webgpu-sao-blur-bind-group-layout",
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
        }, {
          binding: 2,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "float"
          }
        }]
      });
      this._pipelineLayout = device.createPipelineLayout({
        label: "xeokit-webgpu-sao-blur-pipeline-layout",
        bindGroupLayouts: [this._bindGroupLayout]
      });
      this._pipeline = device.createRenderPipeline({
        label: "xeokit-webgpu-sao-blur-pipeline",
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
        "xeokit-webgpu-sao-blur-params",
        160,
        64
      );
      this._initialized = true;
    } catch (e) {
      this.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUSAODepthLimitedBlurRenderer.init] Failed to create SAO blur pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: undefined};
  }

  render(params: {
    commandEncoder: WebGPUCommandEncoderLike;
    depthView: unknown;
    occlusionView: unknown;
    targetView: unknown;
    width: number;
    height: number;
    view: View;
    direction: 0 | 1;
  }): SDKResult<void> {
    const initResult = this.init();
    if (initResult.ok === false) {
      return initResult;
    }
    if (!this._pipeline || !this._bindGroupLayout || !this._paramsBuffer) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[WebGPUSAODepthLimitedBlurRenderer.render] Pipeline was not initialized."
      };
    }
    this._renderContext.writeGPUBuffer(
      this._paramsBuffer as any,
      0,
      this._createUniformData(params.view, params.width, params.height, params.direction)
    );

    const bindGroup: WebGPUBindGroupLike = this._renderContext.device.createBindGroup({
      label: "xeokit-webgpu-sao-blur-bind-group",
      layout: this._bindGroupLayout,
      entries: [{
        binding: 0,
        resource: {
          buffer: this._paramsBuffer
        }
      }, {
        binding: 1,
        resource: params.depthView
      }, {
        binding: 2,
        resource: params.occlusionView
      }]
    });

    const passEncoder = params.commandEncoder.beginRenderPass({
      label: params.direction === 0 ? "xeokit-webgpu-sao-blur-horizontal-pass" : "xeokit-webgpu-sao-blur-vertical-pass",
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
    this._initialized = false;
  }

  private _createUniformData(view: View, width: number, height: number, direction: 0 | 1): Float32Array {
    const projection = view.camera.projectionType === PerspectiveProjectionType
      ? view.camera.perspectiveProjection
      : view.camera.orthoProjection;
    const data = new Float32Array(32);
    data[0] = Math.max(1, width);
    data[1] = Math.max(1, height);
    data[2] = projection.near;
    data[3] = projection.far;
    data[4] = view.camera.projectionType === PerspectiveProjectionType ? 1 : 0;
    data[5] = this._renderContext.renderConfigs.logDepth ? 1 : 0;
    data[6] = direction === 0 ? 1 : 0;
    data[7] = direction === 0 ? 0 : 1;
    data[8] = BLUR_DEPTH_CUTOFF;
    for (let i = 0; i <= KERNEL_RADIUS; i++) {
      data[12 + i] = SAMPLE_WEIGHTS[i];
    }
    return data;
  }
}

function createSampleWeights(kernelRadius: number, stdDev: number): number[] {
  const weights: number[] = [];
  for (let i = 0; i <= kernelRadius; i++) {
    weights.push(Math.exp(-(i * i) / (2.0 * (stdDev * stdDev))) / (Math.sqrt(2.0 * Math.PI) * stdDev));
  }
  return weights;
}

const SHADER = `
const KERNEL_RADIUS: i32 = 16;

struct Params {
  viewport: vec2<f32>,
  near: f32,
  far: f32,
  perspective: f32,
  logDepth: f32,
  direction: vec2<f32>,
  depthCutoff: f32,
  pad0: vec3<f32>,
  sampleWeights0: vec4<f32>,
  sampleWeights1: vec4<f32>,
  sampleWeights2: vec4<f32>,
  sampleWeights3: vec4<f32>,
  sampleWeights4: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var sceneDepth: texture_depth_2d;
@group(0) @binding(2) var occlusionTexture: texture_2d<f32>;

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

fn weight(index: i32) -> f32 {
  if (index < 4) {
    return params.sampleWeights0[index];
  }
  if (index < 8) {
    return params.sampleWeights1[index - 4];
  }
  if (index < 12) {
    return params.sampleWeights2[index - 8];
  }
  if (index < 16) {
    return params.sampleWeights3[index - 12];
  }
  return params.sampleWeights4[index - 16];
}

fn pixelFromUV(uv: vec2<f32>) -> vec2<i32> {
  let dimsU = textureDimensions(sceneDepth);
  let dims = vec2<i32>(i32(dimsU.x), i32(dimsU.y));
  let clampedUV = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));
  return clamp(vec2<i32>(clampedUV * vec2<f32>(f32(dims.x), f32(dims.y))), vec2<i32>(0), dims - vec2<i32>(1));
}

fn loadDepthAtPixel(px: vec2<i32>) -> f32 {
  return textureLoad(sceneDepth, px, 0);
}

fn loadOcclusionAtPixel(px: vec2<i32>) -> f32 {
  return textureLoad(occlusionTexture, px, 0).r;
}

fn getViewZ(depth: f32) -> f32 {
  let perspectiveStandardZ = (params.near * params.far) / ((params.far - params.near) * depth - params.far);
  let perspectiveLogZ = 1.0 - pow(1.0 + params.far, depth);
  let perspectiveZ = select(perspectiveStandardZ, perspectiveLogZ, params.logDepth > 0.5);
  let orthoZ = depth * (params.near - params.far) - params.near;
  return select(orthoZ, perspectiveZ, params.perspective > 0.5);
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let centerPixel = pixelFromUV(input.uv);
  let centerDepth = loadDepthAtPixel(centerPixel);
  if (centerDepth >= 0.999999) {
    return vec4<f32>(1.0, 0.0, 0.0, 1.0);
  }

  let centerViewZ = -getViewZ(centerDepth);
  let dimsU = textureDimensions(sceneDepth);
  let dims = vec2<i32>(i32(dimsU.x), i32(dimsU.y));
  let direction = vec2<i32>(i32(params.direction.x), i32(params.direction.y));
  var rightBreak = false;
  var leftBreak = false;
  var weightSum = weight(0);
  var occlusionSum = loadOcclusionAtPixel(centerPixel) * weightSum;

  for (var i = 1; i <= KERNEL_RADIUS; i = i + 1) {
    let sampleWeight = weight(i);
    var samplePixel = clamp(centerPixel + direction * i, vec2<i32>(0), dims - vec2<i32>(1));
    var viewZ = -getViewZ(loadDepthAtPixel(samplePixel));
    if (abs(viewZ - centerViewZ) > params.depthCutoff) {
      rightBreak = true;
    }
    if (!rightBreak) {
      occlusionSum = occlusionSum + loadOcclusionAtPixel(samplePixel) * sampleWeight;
      weightSum = weightSum + sampleWeight;
    }

    samplePixel = clamp(centerPixel - direction * i, vec2<i32>(0), dims - vec2<i32>(1));
    viewZ = -getViewZ(loadDepthAtPixel(samplePixel));
    if (abs(viewZ - centerViewZ) > params.depthCutoff) {
      leftBreak = true;
    }
    if (!leftBreak) {
      occlusionSum = occlusionSum + loadOcclusionAtPixel(samplePixel) * sampleWeight;
      weightSum = weightSum + sampleWeight;
    }
  }
  let occlusion = occlusionSum / max(weightSum, 0.000001);
  return vec4<f32>(occlusion, 0.0, 0.0, 1.0);
}
`;
