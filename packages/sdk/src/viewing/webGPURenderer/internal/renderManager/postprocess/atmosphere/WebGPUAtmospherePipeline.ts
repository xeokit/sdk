import {OrthoProjectionType} from "../../../../../../base/constants";
import type {SDKResult} from "../../../../../../base/core";
import {SDKErrorType} from "../../../../../../base/core";
import type {View} from "../../../../../viewer";
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
 * Single-pass HDR atmospheric attenuation post-process for WebGPU.
 *
 * Mirrors WebGLRenderer's AtmospherePipeline: consumes the HDR scene color plus
 * matching scene depth, fades distant geometry toward View.effects.atmosphere
 * haze color, and writes an HDR target for later post-process stages.
 *
 * @internal
 */
export class WebGPUAtmospherePipeline {

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
    this._target = new WebGPUColorRenderTarget(renderContext, "xeokit-webgpu-atmosphere-color", "rgba16float");
  }

  init(): SDKResult<void> {
    if (this._initialized) {
      return {ok: true, value: undefined};
    }
    try {
      const device = this._renderContext.device;
      this._shaderModule = device.createShaderModule({
        label: "xeokit-webgpu-atmosphere-shader",
        code: SHADER
      });
      this._bindGroupLayout = device.createBindGroupLayout({
        label: "xeokit-webgpu-atmosphere-bind-group-layout",
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
        label: "xeokit-webgpu-atmosphere-pipeline-layout",
        bindGroupLayouts: [this._bindGroupLayout]
      });
      this._pipeline = device.createRenderPipeline({
        label: "xeokit-webgpu-atmosphere-pipeline",
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
          label: "xeokit-webgpu-atmosphere-sampler",
          magFilter: "linear",
          minFilter: "linear",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge"
        })
        : {};
      this._paramsBuffer = this._renderContext.createEmptyGPUBuffer(
        "xeokit-webgpu-atmosphere-params",
        64,
        64
      );
      this._initialized = true;
    } catch (e) {
      this.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUAtmospherePipeline.init] Failed to create atmosphere pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: undefined};
  }

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
        error: "[WebGPUAtmospherePipeline.render] Pipeline was not initialized."
      };
    }

    this._target.ensureSize(params.width, params.height);
    this._renderContext.writeGPUBuffer(
      this._paramsBuffer as any,
      0,
      this._createUniformData(params.view)
    );

    const bindGroup: WebGPUBindGroupLike = this._renderContext.device.createBindGroup({
      label: "xeokit-webgpu-atmosphere-bind-group",
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
      label: "xeokit-webgpu-atmosphere-pass",
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

  private _createUniformData(view: View): Float32Array {
    const camera = view.camera;
    const projectionInfo = getProjectionInfo(camera);
    const atmosphere = view.effects.atmosphere;
    const color = atmosphere.color;
    return new Float32Array([
      projectionInfo.near,
      projectionInfo.far,
      this._renderContext.renderConfigs.logDepth ? 1 : 0,
      projectionInfo.projectionType,
      color[0],
      color[1],
      color[2],
      atmosphere.startDistance,
      atmosphere.endDistance,
      atmosphere.intensity,
      atmosphere.maxOpacity,
      atmosphere.affectSky ? 1 : 0,
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
  near: f32,
  far: f32,
  logDepth: f32,
  projectionType: f32,
  fogColor: vec3<f32>,
  startDistance: f32,
  endDistance: f32,
  intensity: f32,
  maxOpacity: f32,
  affectSky: f32,
  pad0: vec4<f32>,
};

@group(0) @binding(0) var sceneSampler: sampler;
@group(0) @binding(1) var sceneColor: texture_2d<f32>;
@group(0) @binding(2) var sceneDepth: texture_depth_2d;
@group(0) @binding(3) var<uniform> params: Params;

const LUMA = vec3<f32>(0.2126, 0.7152, 0.0722);

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

fn sampleColor(uv: vec2<f32>) -> vec4<f32> {
  return textureSample(sceneColor, sceneSampler, clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0)));
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

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let color = sampleColor(input.uv);
  let rawDepth = loadDepth(input.uv);
  let viewDepth = linearizeDepth(rawDepth);
  let range = max(params.endDistance - params.startDistance, 0.0001);
  let distanceAmount = smoothstep(0.0, 1.0, clamp((viewDepth - params.startDistance) / range, 0.0, 1.0));
  let haze = min(params.maxOpacity, distanceAmount * params.intensity);
  let airlight = clamp(params.fogColor, vec3<f32>(0.0), vec3<f32>(1.0));
  var fogged = mix(color.rgb, airlight, haze);
  let sourceLuma = dot(color.rgb, LUMA);
  let foggedLuma = dot(fogged, LUMA);
  let minLuma = sourceLuma * (1.0 - haze * 0.08);
  fogged = select(fogged, fogged * (minLuma / max(foggedLuma, 0.00001)), foggedLuma < minLuma);
  let skyPixel = rawDepth >= 0.999999 && params.affectSky < 0.5;
  return select(vec4<f32>(fogged, color.a), color, skyPixel);
}
`;
