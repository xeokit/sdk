import type {SDKResult} from "../../../../../base/core";
import {SDKErrorType} from "../../../../../base/core";
import type {View} from "../../../../viewer";
import type {WebGPUCommandEncoderLike, WebGPUBindGroupLayoutLike, WebGPUBindGroupLike, WebGPURenderPipelineLike, WebGPUSamplerLike, WebGPUShaderModuleLike} from "../../../core";
import {GPU_SHADER_STAGE} from "../../constants";
import type {RenderContext} from "../../RenderContext";

const TONEMAP_MODE_NONE = 0;
const TONEMAP_MODE_REINHARD = 1;
const TONEMAP_MODE_ACES = 2;

/**
 * Fullscreen WebGPU composite pass. It samples the scene color texture, applies
 * View-managed tonemap settings, then optionally applies a compact FXAA pass.
 *
 * @internal
 */
export class WebGPUPostProcessPipeline {

  private readonly _renderContext: RenderContext;
  private _shaderModule: WebGPUShaderModuleLike | null = null;
  private _bindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _pipelineLayout: unknown | null = null;
  private _pipeline: WebGPURenderPipelineLike | null = null;
  private _sampler: WebGPUSamplerLike | null = null;
  private _paramsBuffer: unknown | null = null;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  init(): SDKResult<void> {
    try {
      const device = this._renderContext.device;
      this._shaderModule = device.createShaderModule({
        label: "xeokit-webgpu-postprocess-shader",
        code: SHADER
      });
      this._bindGroupLayout = device.createBindGroupLayout({
        label: "xeokit-webgpu-postprocess-bind-group-layout",
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
          buffer: {
            type: "uniform"
          }
        }, {
          binding: 3,
          visibility: GPU_SHADER_STAGE.FRAGMENT,
          texture: {
            sampleType: "float"
          }
        }]
      });
      this._pipelineLayout = device.createPipelineLayout({
        label: "xeokit-webgpu-postprocess-pipeline-layout",
        bindGroupLayouts: [this._bindGroupLayout]
      });
      this._pipeline = device.createRenderPipeline({
        label: "xeokit-webgpu-postprocess-pipeline",
        layout: this._pipelineLayout,
        vertex: {
          module: this._shaderModule,
          entryPoint: "vsMain"
        },
        fragment: {
          module: this._shaderModule,
          entryPoint: "fsMain",
          targets: [{
            format: this._renderContext.contextFormat,
            blend: {
              color: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
              }
            }
          }]
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "none"
        }
      });
      this._sampler = device.createSampler
        ? device.createSampler({
          label: "xeokit-webgpu-postprocess-sampler",
          magFilter: "linear",
          minFilter: "linear",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge"
        })
        : {};
      this._paramsBuffer = this._renderContext.createEmptyGPUBuffer(
        "xeokit-webgpu-postprocess-params",
        64,
        64
      );
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUPostProcessPipeline.init] Failed to create post-process pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: undefined};
  }

  render(params: {
    commandEncoder: WebGPUCommandEncoderLike;
    sourceView: unknown;
    canvasView: unknown;
    saoOcclusionView: unknown | null;
    width: number;
    height: number;
    view: View;
  }): SDKResult<void> {
    if (!this._pipeline || !this._bindGroupLayout || !this._sampler || !this._paramsBuffer) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[WebGPUPostProcessPipeline.render] Pipeline was not initialized."
      };
    }

    const uniformData = this._createUniformData(params.view, params.width, params.height, params.saoOcclusionView !== null);
    this._renderContext.writeGPUBuffer(this._paramsBuffer as any, 0, uniformData);
    const bindGroup: WebGPUBindGroupLike = this._renderContext.device.createBindGroup({
      label: "xeokit-webgpu-postprocess-bind-group",
      layout: this._bindGroupLayout,
      entries: [{
        binding: 0,
        resource: this._sampler
      }, {
        binding: 1,
        resource: params.sourceView
      }, {
        binding: 2,
        resource: {
          buffer: this._paramsBuffer
        }
      }, {
        binding: 3,
        resource: params.saoOcclusionView ?? params.sourceView
      }]
    });
    const passEncoder = params.commandEncoder.beginRenderPass({
      label: "xeokit-webgpu-postprocess-pass",
      colorAttachments: [{
        view: params.canvasView,
        loadOp: "clear",
        clearValue: {
          r: 0,
          g: 0,
          b: 0,
          a: params.view.transparent ? 0 : 1
        },
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
    this._sampler = null;
  }

  private _createUniformData(view: View, width: number, height: number, hasSAOOcclusionView: boolean): Float32Array {
    const effects = (view as {effects?: any}).effects;
    const tonemap = effects?.tonemap;
    const antiAliasing = effects?.antiAliasing;
    const sao = effects?.sao;
    const tonemapActive = !!(tonemap?.applied && tonemap?.possible);
    const aaActive = !!(antiAliasing?.applied && antiAliasing?.possible && antiAliasing?.mode !== "none");
    const saoActive = hasSAOOcclusionView && !!(sao?.applied && sao?.possible && (sao.intensity ?? 0) > 0);
    const exposure = tonemapActive ? (tonemap.exposure ?? 1.0) : 1.0;
    const tonemapMode = tonemapActive ? modeToInt(tonemap.mode) : TONEMAP_MODE_NONE;
    const sRGBEncode = tonemap ? (tonemap.sRGBEncode !== false) : false;
    return new Float32Array([
      width > 0 ? 1.0 / width : 0,
      height > 0 ? 1.0 / height : 0,
      exposure,
      tonemapMode,
      sRGBEncode ? 1 : 0,
      aaActive ? 1 : 0,
      saoActive ? 1 : 0,
      sao?.blendFactor ?? 1.0,
      sao?.blendCutoff ?? 0.3,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ]);
  }
}

function modeToInt(mode: string): number {
  if (mode === "reinhard") return TONEMAP_MODE_REINHARD;
  if (mode === "aces") return TONEMAP_MODE_ACES;
  return TONEMAP_MODE_NONE;
}

const SHADER = `
struct Params {
  inverseViewport: vec2<f32>,
  exposure: f32,
  tonemapMode: f32,
  sRGBEncode: f32,
  fxaaEnabled: f32,
  saoEnabled: f32,
  saoBlendFactor: f32,
  saoBlendCutoff: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
  pad3: f32,
  pad4: f32,
  pad5: f32,
  pad6: f32,
};

@group(0) @binding(0) var sceneSampler: sampler;
@group(0) @binding(1) var sceneColor: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var saoOcclusionTexture: texture_2d<f32>;

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

fn luma(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.299, 0.587, 0.114));
}

fn reinhard(color: vec3<f32>) -> vec3<f32> {
  return color / (color + vec3<f32>(1.0));
}

fn aces(color: vec3<f32>) -> vec3<f32> {
  return clamp((color * (2.51 * color + vec3<f32>(0.03))) / (color * (2.43 * color + vec3<f32>(0.59)) + vec3<f32>(0.14)), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyTonemap(colorIn: vec3<f32>) -> vec3<f32> {
  let exposed = colorIn * params.exposure;
  let reinhardColor = reinhard(exposed);
  let acesColor = aces(exposed);
  let reinhardOrNone = select(exposed, reinhardColor, params.tonemapMode > 0.5);
  let toneMapped = select(reinhardOrNone, acesColor, params.tonemapMode > 1.5);
  let encoded = pow(max(toneMapped, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
  return select(toneMapped, encoded, params.sRGBEncode > 0.5);
}

fn sampleScene(uv: vec2<f32>) -> vec3<f32> {
  return textureSample(sceneColor, sceneSampler, uv).rgb;
}

fn loadSAOFactor(uv: vec2<f32>) -> f32 {
  let dimsU = textureDimensions(saoOcclusionTexture);
  let dims = vec2<i32>(i32(dimsU.x), i32(dimsU.y));
  let clampedUV = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));
  let px = clamp(vec2<i32>(clampedUV * vec2<f32>(f32(dims.x), f32(dims.y))), vec2<i32>(0), dims - vec2<i32>(1));
  let occlusion = textureLoad(saoOcclusionTexture, px, 0).r;
  return clamp((smoothstep(params.saoBlendCutoff, 1.0, occlusion) - 1.0) * params.saoBlendFactor + 1.0, 0.0, 1.0);
}

fn applyFXAA(uv: vec2<f32>) -> vec3<f32> {
  let inv = params.inverseViewport;
  let rgbNW = sampleScene(uv + vec2<f32>(-1.0, -1.0) * inv);
  let rgbNE = sampleScene(uv + vec2<f32>( 1.0, -1.0) * inv);
  let rgbSW = sampleScene(uv + vec2<f32>(-1.0,  1.0) * inv);
  let rgbSE = sampleScene(uv + vec2<f32>( 1.0,  1.0) * inv);
  let rgbM = sampleScene(uv);
  let lumaNW = luma(rgbNW);
  let lumaNE = luma(rgbNE);
  let lumaSW = luma(rgbSW);
  let lumaSE = luma(rgbSE);
  let lumaM = luma(rgbM);
  let lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
  let lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
  let lumaRange = lumaMax - lumaMin;
  var dir = vec2<f32>(
    -((lumaNW + lumaNE) - (lumaSW + lumaSE)),
     ((lumaNW + lumaSW) - (lumaNE + lumaSE))
  );
  let dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 / 8.0), 1.0 / 128.0);
  let rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(dir * rcpDirMin, vec2<f32>(-8.0), vec2<f32>(8.0)) * inv;
  let rgbA = 0.5 * (
    sampleScene(uv + dir * (1.0 / 3.0 - 0.5)) +
    sampleScene(uv + dir * (2.0 / 3.0 - 0.5))
  );
  let rgbB = rgbA * 0.5 + 0.25 * (
    sampleScene(uv + dir * -0.5) +
    sampleScene(uv + dir * 0.5)
  );
  let lumaB = luma(rgbB);
  let constrained = select(rgbB, rgbA, lumaB < lumaMin || lumaB > lumaMax);
  let nonEdge = lumaRange < max(1.0 / 32.0, lumaMax * (1.0 / 8.0));
  return select(constrained, rgbM, nonEdge);
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let scene = sampleScene(input.uv);
  let fxaa = applyFXAA(input.uv);
  var color = select(scene, fxaa, params.fxaaEnabled > 0.5);
  let saoFactor = loadSAOFactor(input.uv);
  color = color * select(1.0, saoFactor, params.saoEnabled > 0.5);
  color = applyTonemap(color);
  return vec4<f32>(color, 1.0);
}
`;
