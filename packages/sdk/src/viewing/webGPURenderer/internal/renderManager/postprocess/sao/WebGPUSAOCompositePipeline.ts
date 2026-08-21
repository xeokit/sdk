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

/**
 * Multiplies the SAO occlusion texture into the HDR scene color.
 *
 * WebGL applies SAO while drawing opaque geometry into the HDR target, before
 * bloom, atmosphere, DOF, and tonemap. This pass gives WebGPU the same ordering
 * while keeping its SAO occlusion generation as a screen-space post step.
 *
 * @internal
 */
export class WebGPUSAOCompositePipeline {

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
    this._target = new WebGPUColorRenderTarget(renderContext, "xeokit-webgpu-sao-composite-color", "rgba16float");
  }

  init(): SDKResult<void> {
    if (this._initialized) {
      return {ok: true, value: undefined};
    }
    try {
      const device = this._renderContext.device;
      this._shaderModule = device.createShaderModule({
        label: "xeokit-webgpu-sao-composite-shader",
        code: SHADER
      });
      this._bindGroupLayout = device.createBindGroupLayout({
        label: "xeokit-webgpu-sao-composite-bind-group-layout",
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
            sampleType: "float"
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
        label: "xeokit-webgpu-sao-composite-pipeline-layout",
        bindGroupLayouts: [this._bindGroupLayout]
      });
      this._pipeline = device.createRenderPipeline({
        label: "xeokit-webgpu-sao-composite-pipeline",
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
          label: "xeokit-webgpu-sao-composite-sampler",
          magFilter: "linear",
          minFilter: "linear",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge"
        })
        : {};
      this._paramsBuffer = this._renderContext.createEmptyGPUBuffer(
        "xeokit-webgpu-sao-composite-params",
        64,
        64
      );
      this._initialized = true;
    } catch (e) {
      this.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUSAOCompositePipeline.init] Failed to create SAO composite pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: undefined};
  }

  render(params: {
    commandEncoder: WebGPUCommandEncoderLike;
    colorView: unknown;
    occlusionView: unknown;
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
        error: "[WebGPUSAOCompositePipeline.render] Pipeline was not initialized."
      };
    }

    this._target.ensureSize(params.width, params.height);
    this._renderContext.writeGPUBuffer(this._paramsBuffer as any, 0, this._createUniformData(params.view));
    const bindGroup: WebGPUBindGroupLike = this._renderContext.device.createBindGroup({
      label: "xeokit-webgpu-sao-composite-bind-group",
      layout: this._bindGroupLayout,
      entries: [{
        binding: 0,
        resource: this._sampler
      }, {
        binding: 1,
        resource: params.colorView
      }, {
        binding: 2,
        resource: params.occlusionView
      }, {
        binding: 3,
        resource: {
          buffer: this._paramsBuffer
        }
      }]
    });
    const passEncoder = params.commandEncoder.beginRenderPass({
      label: "xeokit-webgpu-sao-composite-pass",
      colorAttachments: [{
        view: this._target.view,
        loadOp: "clear",
        clearValue: {r: 0, g: 0, b: 0, a: 0},
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
    this._target.destroy();
    this._initialized = false;
  }

  private _createUniformData(view: View): Float32Array {
    const sao = (view as {effects?: any}).effects?.sao;
    return new Float32Array([
      sao?.blendFactor ?? 1.0,
      sao?.blendCutoff ?? 0.3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
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

const SHADER = `
struct Params {
  saoBlendFactor: f32,
  saoBlendCutoff: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
  pad3: f32,
  pad4: f32,
  pad5: f32,
  pad6: f32,
  pad7: f32,
  pad8: f32,
  pad9: f32,
  pad10: f32,
  pad11: f32,
  pad12: f32,
  pad13: f32,
};

@group(0) @binding(0) var sceneSampler: sampler;
@group(0) @binding(1) var sceneColor: texture_2d<f32>;
@group(0) @binding(2) var saoOcclusionTexture: texture_2d<f32>;
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

fn loadSAOFactor(uv: vec2<f32>) -> f32 {
  let dimsU = textureDimensions(saoOcclusionTexture);
  let dims = vec2<i32>(i32(dimsU.x), i32(dimsU.y));
  let clampedUV = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));
  let px = clamp(vec2<i32>(clampedUV * vec2<f32>(f32(dims.x), f32(dims.y))), vec2<i32>(0), dims - vec2<i32>(1));
  let occlusion = textureLoad(saoOcclusionTexture, px, 0).r;
  return clamp((smoothstep(params.saoBlendCutoff, 1.0, occlusion) - 1.0) * params.saoBlendFactor + 1.0, 0.0, 1.0);
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let scene = textureSample(sceneColor, sceneSampler, input.uv);
  let saoFactor = loadSAOFactor(input.uv);
  return vec4<f32>(scene.rgb * saoFactor, scene.a);
}
`;
