import {OrthoProjectionType} from "../../../../../../../base/constants";
import type {SDKResult} from "../../../../../../../base/core";
import {SDKErrorType} from "../../../../../../../base/core";
import type {View} from "../../../../../../viewer";
import type {
  WebGPUBindGroupLayoutLike,
  WebGPUBindGroupLike,
  WebGPUCommandEncoderLike,
  WebGPURenderPipelineLike,
  WebGPUSamplerLike,
  WebGPUShaderModuleLike
} from "../../../../core";
import {GPU_SHADER_STAGE} from "../../../constants";
import type {RenderContext} from "../../../RenderContext";
import {WebGPUColorRenderTarget} from "../WebGPUColorRenderTarget";

const PROJECTION_PERSPECTIVE = 0;
const PROJECTION_ORTHO = 1;

/**
 * Single-pass HDR depth-of-field post-process for WebGPU.
 *
 * Mirrors WebGLRenderer's DepthOfFieldPipeline: consumes the HDR scene color
 * plus the matching scene depth texture, computes circle-of-confusion from
 * View.effects.depthOfField, and writes a blurred HDR color target for final
 * composition.
 *
 * @internal
 */
export class WebGPUDepthOfFieldPipeline {

  private readonly _renderContext: RenderContext;
  private readonly _target: WebGPUColorRenderTarget;
  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _bindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _pipelineLayout: unknown | null = null;
  private _pipeline: WebGPURenderPipelineLike | null = null;
  private _sampler: WebGPUSamplerLike | null = null;
  private _paramsBuffer: unknown | null = null;
  private _initialized = false;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
    this._target = new WebGPUColorRenderTarget(renderContext, "xeokit-webgpu-dof-color", "rgba16float");
  }

  init(): SDKResult<void> {
    if (this._initialized) {
      return {ok: true, value: undefined};
    }
    try {
      const device = this._renderContext.device;
      this._shaderModule = device.createShaderModule({
        label: "xeokit-webgpu-dof-shader",
        code: SHADER
      });
      this._bindGroupLayout = device.createBindGroupLayout({
        label: "xeokit-webgpu-dof-bind-group-layout",
        entries: [{
          binding: 0,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          sampler: {
            type: "filtering"
          }
        }, {
          binding: 1,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "float"
          }
        }, {
          binding: 2,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "depth"
          }
        }, {
          binding: 3,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          buffer: {
            type: "uniform"
          }
        }]
      });
      this._pipelineLayout = device.createPipelineLayout({
        label: "xeokit-webgpu-dof-pipeline-layout",
        bindGroupLayouts: [this._bindGroupLayout]
      });
      this._pipeline = device.createRenderPipeline({
        label: "xeokit-webgpu-dof-pipeline",
        layout: this._pipelineLayout,
        vertex: {
          module: this._shaderModule,
          entryPoint: "vsMain"
        },
        fragment: {
          module: this._shaderModule,
          entryPoint: "fsMain",
          targets: [{
            format: "rgba16float"
          }]
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "none"
        }
      });
      this._sampler = device.createSampler
        ? device.createSampler({
          label: "xeokit-webgpu-dof-sampler",
          magFilter: "linear",
          minFilter: "linear",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge"
        })
        : {};
      this._paramsBuffer = this._renderContext.createEmptyGPUBuffer(
        "xeokit-webgpu-dof-params",
        64,
        64
      );
      this._initialized = true;
    } catch (e) {
      this.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUDepthOfFieldPipeline.init] Failed to create DOF pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: undefined};
  }

  /**
   * Runs DOF into an internal HDR target and returns that target's color view.
   */
  render(params: {
    commandEncoder: WebGPUCommandEncoderLike;
    colorView: unknown;
    depthView: unknown;
    width: number;
    height: number;
    view: View;
  }): SDKResult<{colorView: unknown}> {
    const initResult = this.init();
    if (initResult.ok === false) {
      return initResult;
    }
    if (!this._pipeline || !this._bindGroupLayout || !this._sampler || !this._paramsBuffer) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[WebGPUDepthOfFieldPipeline.render] Pipeline was not initialized."
      };
    }

    this._target.ensureSize(params.width, params.height);
    this._renderContext.writeGPUBuffer(
      this._paramsBuffer as any,
      0,
      this._createUniformData(params.view, params.width, params.height)
    );

    const bindGroup: WebGPUBindGroupLike = this._renderContext.device.createBindGroup({
      label: "xeokit-webgpu-dof-bind-group",
      layout: this._bindGroupLayout,
      entries: [{
        binding: 0,
        resource: this._sampler
      }, {
        binding: 1,
        resource: params.colorView
      }, {
        binding: 2,
        resource: params.depthView
      }, {
        binding: 3,
        resource: {
          buffer: this._paramsBuffer
        }
      }]
    });

    const passEncoder = params.commandEncoder.beginRenderPass({
      label: "xeokit-webgpu-dof-pass",
      colorAttachments: [{
        view: this._target.view,
        loadOp: "clear",
        clearValue: {r: 0, g: 0, b: 0, a: 1},
        storeOp: "store"
      }]
    });
    passEncoder.setPipeline?.(this._pipeline);
    passEncoder.setBindGroup?.(0, bindGroup);
    passEncoder.draw?.(3, 1, 0, 0);
    passEncoder.end?.();
    passEncoder.endPass?.();
    return {
      ok: true,
      value: {
        colorView: this._target.view
      }
    };
  }

  destroy(): void {
    (this._paramsBuffer as {destroy?: () => void} | null)?.destroy?.();
    this._paramsBuffer = null;
    this._shaderModule = null;
    this._bindGroupLayout = null;
    this._pipelineLayout = null;
    this._pipeline = null;
    this._sampler = null;
    this._initialized = false;
    this._target.destroy();
  }

  private _createUniformData(view: View, width: number, height: number): Float32Array {
    const camera = view.camera;
    const projectionInfo = getProjectionInfo(camera);
    const dof = view.effects.depthOfField;
    return new Float32Array([
      width > 0 ? 1.0 / width : 0,
      height > 0 ? 1.0 / height : 0,
      projectionInfo.near,
      projectionInfo.far,
      this._renderContext.renderConfigs.logDepth ? 1 : 0,
      projectionInfo.projectionType,
      dof.focusDistance,
      dof.focalRange,
      dof.radius,
      dof.intensity,
      dof.nearBlur,
      dof.farBlur,
      0,
      0,
      0,
      0
    ]);
  }
}

function getProjectionInfo(camera: any): {near: number; far: number; projectionType: number} {
  if (camera.projectionType === OrthoProjectionType) {
    return {
      near: camera.orthoProjection.near,
      far: camera.orthoProjection.far,
      projectionType: PROJECTION_ORTHO
    };
  }
  const projection = camera.perspectiveProjection;
  return {
    near: projection.near,
    far: projection.far,
    projectionType: PROJECTION_PERSPECTIVE
  };
}

const SHADER = `
struct Params {
  inverseViewport: vec2<f32>,
  near: f32,
  far: f32,
  logDepth: f32,
  projectionType: f32,
  focusDistance: f32,
  focalRange: f32,
  radius: f32,
  intensity: f32,
  nearBlur: f32,
  farBlur: f32,
  pad0: vec4<f32>,
};

@group(0) @binding(0) var sceneSampler: sampler;
@group(0) @binding(1) var sceneColor: texture_2d<f32>;
@group(0) @binding(2) var sceneDepth: texture_depth_2d;
@group(0) @binding(3) var<uniform> params: Params;

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

fn sampleColor(uv: vec2<f32>) -> vec3<f32> {
  return textureSample(sceneColor, sceneSampler, clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0))).rgb;
}

fn loadDepth(uv: vec2<f32>) -> f32 {
  let dimsU = textureDimensions(sceneDepth);
  let dims = vec2<i32>(i32(dimsU.x), i32(dimsU.y));
  let clampedUV = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));
  let px = clamp(vec2<i32>(clampedUV * vec2<f32>(f32(dims.x), f32(dims.y))), vec2<i32>(0), dims - vec2<i32>(1));
  return textureLoad(sceneDepth, px, 0);
}

fn linearizeDepth(depthIn: f32) -> f32 {
  let depth = clamp(depthIn, 0.0, 1.0);
  let logDepth = exp2(depth * log2(params.far + 1.0)) - 1.0;
  let orthoDepth = mix(params.near, params.far, depth);
  let z = depth * 2.0 - 1.0;
  let perspectiveDepth = (2.0 * params.near * params.far) / max(params.far + params.near - z * (params.far - params.near), 0.00001);
  let standardDepth = select(perspectiveDepth, orthoDepth, params.projectionType > 0.5);
  return select(standardDepth, logDepth, params.logDepth > 0.5);
}

fn circleOfConfusion(viewDepth: f32) -> f32 {
  let range = max(params.focalRange, 0.0001);
  let nearAmount = clamp((params.focusDistance - viewDepth) / range, 0.0, 1.0) * params.nearBlur;
  let farAmount = clamp((viewDepth - params.focusDistance) / range, 0.0, 1.0) * params.farBlur;
  return max(nearAmount, farAmount);
}

fn addTap(sumIn: vec3<f32>, weightIn: f32, uv: vec2<f32>, dir: vec2<f32>, radiusPixels: f32) -> vec4<f32> {
  let tapUV = clamp(uv + dir * params.inverseViewport * radiusPixels, vec2<f32>(0.0), vec2<f32>(1.0));
  let tapDepth = linearizeDepth(loadDepth(tapUV));
  let tapCoC = circleOfConfusion(tapDepth);
  let tapWeight = 0.35 + tapCoC;
  return vec4<f32>(sumIn + sampleColor(tapUV) * tapWeight, weightIn + tapWeight);
}

fn sampleBlurred(uv: vec2<f32>, radiusPixels: f32) -> vec3<f32> {
  var sum = sampleColor(uv);
  var weight = 1.0;
  var tap = addTap(sum, weight, uv, vec2<f32>( 0.000,  1.000), radiusPixels);
  sum = tap.rgb; weight = tap.a;
  tap = addTap(sum, weight, uv, vec2<f32>( 0.866,  0.500), radiusPixels);
  sum = tap.rgb; weight = tap.a;
  tap = addTap(sum, weight, uv, vec2<f32>( 0.866, -0.500), radiusPixels);
  sum = tap.rgb; weight = tap.a;
  tap = addTap(sum, weight, uv, vec2<f32>( 0.000, -1.000), radiusPixels);
  sum = tap.rgb; weight = tap.a;
  tap = addTap(sum, weight, uv, vec2<f32>(-0.866, -0.500), radiusPixels);
  sum = tap.rgb; weight = tap.a;
  tap = addTap(sum, weight, uv, vec2<f32>(-0.866,  0.500), radiusPixels);
  sum = tap.rgb; weight = tap.a;
  tap = addTap(sum, weight, uv, vec2<f32>( 0.500,  0.866), radiusPixels);
  sum = tap.rgb; weight = tap.a;
  tap = addTap(sum, weight, uv, vec2<f32>( 1.000,  0.000), radiusPixels);
  sum = tap.rgb; weight = tap.a;
  tap = addTap(sum, weight, uv, vec2<f32>( 0.500, -0.866), radiusPixels);
  sum = tap.rgb; weight = tap.a;
  tap = addTap(sum, weight, uv, vec2<f32>(-0.500, -0.866), radiusPixels);
  sum = tap.rgb; weight = tap.a;
  tap = addTap(sum, weight, uv, vec2<f32>(-1.000,  0.000), radiusPixels);
  sum = tap.rgb; weight = tap.a;
  tap = addTap(sum, weight, uv, vec2<f32>(-0.500,  0.866), radiusPixels);
  sum = tap.rgb; weight = tap.a;
  return sum / weight;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let sharp = sampleColor(input.uv);
  let depth = linearizeDepth(loadDepth(input.uv));
  let coc = circleOfConfusion(depth);
  let radiusPixels = coc * params.radius;
  let blurred = sampleBlurred(input.uv, radiusPixels);
  let mixAmount = clamp((radiusPixels / max(params.radius, 0.0001)) * params.intensity, 0.0, 1.0);
  let dofColor = mix(sharp, blurred, mixAmount);
  let dofActive = radiusPixels > 0.01 && params.intensity > 0.0;
  return vec4<f32>(select(sharp, dofColor, dofActive), 1.0);
}
`;
