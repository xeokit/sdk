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

const NUM_MIPS = 5;
const BLOOM_FORMAT = "rgba16float";
const BLOOM_PARITY_GAIN = 1.4;

/**
 * HDR bloom post-process for WebGPU.
 *
 * Mirrors WebGLRenderer's BloomPipeline stage layout:
 * prefilter -> downsample pyramid -> additive upsample -> HDR composite.
 * WebGPU writes the final scene+bloom result to a separate HDR target to avoid
 * sampling and rendering to the same scene texture in one pass.
 *
 * @internal
 */
export class WebGPUBloomPipeline {

  private readonly _renderContext: RenderContext;
  private readonly _mipTargets: WebGPUColorRenderTarget[] = [];
  private readonly _mipSizes: Array<[number, number]> = [];
  private readonly _compositeTarget: WebGPUColorRenderTarget;
  private _prefilter: BloomPass | null = null;
  private _downsample: BloomPass | null = null;
  private _upsample: BloomPass | null = null;
  private _composite: BloomPass | null = null;
  private _sampler: WebGPUSamplerLike | null = null;
  private _paramsBuffer: unknown | null = null;
  private _initialized = false;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
    this._compositeTarget = new WebGPUColorRenderTarget(renderContext, "xeokit-webgpu-bloom-composite", BLOOM_FORMAT);
    for (let i = 0; i < NUM_MIPS; i++) {
      this._mipTargets.push(new WebGPUColorRenderTarget(renderContext, `xeokit-webgpu-bloom-mip-${i}`, BLOOM_FORMAT));
    }
  }

  init(): SDKResult<void> {
    if (this._initialized) {
      return {ok: true, value: undefined};
    }
    try {
      const device = this._renderContext.device;
      this._sampler = device.createSampler
        ? device.createSampler({
          label: "xeokit-webgpu-bloom-sampler",
          magFilter: "linear",
          minFilter: "linear",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge"
        })
        : {};
      this._paramsBuffer = this._renderContext.createEmptyGPUBuffer(
        "xeokit-webgpu-bloom-params",
        80,
        64
      );
      this._prefilter = new BloomPass(this._renderContext, {
        label: "prefilter",
        shader: SHADER_PREFILTER,
        bindGroupLayout: this._createBindGroupLayout("prefilter", 3),
        targetFormat: BLOOM_FORMAT,
        blend: false
      });
      this._downsample = new BloomPass(this._renderContext, {
        label: "downsample",
        shader: SHADER_DOWN,
        bindGroupLayout: this._createBindGroupLayout("downsample", 3),
        targetFormat: BLOOM_FORMAT,
        blend: false
      });
      this._upsample = new BloomPass(this._renderContext, {
        label: "upsample",
        shader: SHADER_UP,
        bindGroupLayout: this._createBindGroupLayout("upsample", 3),
        targetFormat: BLOOM_FORMAT,
        blend: true
      });
      this._composite = new BloomPass(this._renderContext, {
        label: "composite",
        shader: SHADER_COMPOSITE,
        bindGroupLayout: this._createBindGroupLayout("composite", 4),
        targetFormat: BLOOM_FORMAT,
        blend: false
      });
      this._initialized = true;
    } catch (e) {
      this.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUBloomPipeline.init] Failed to create bloom pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    return {ok: true, value: undefined};
  }

  render(params: {
    commandEncoder: WebGPUCommandEncoderLike;
    sourceView: unknown;
    width: number;
    height: number;
    view: View;
  }): SDKResult<{colorView: unknown}> {
    const initResult = this.init();
    if (initResult.ok === false) {
      return initResult;
    }
    if (!this._prefilter || !this._downsample || !this._upsample || !this._composite || !this._sampler || !this._paramsBuffer) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[WebGPUBloomPipeline.render] Pipeline was not initialized."
      };
    }

    this._ensureMipChain(params.width, params.height);
    if (this._mipSizes.length === 0) {
      return {
        ok: true,
        value: {
          colorView: params.sourceView
        }
      };
    }

    const bloom = params.view.effects.bloom;
    const sourceView = params.sourceView;
    const firstMip = this._mipTargets[0];
    const [m0W, m0H] = this._mipSizes[0];
    this._writeParams({
      inverseWidth: m0W > 0 ? 1.0 / m0W : 0,
      inverseHeight: m0H > 0 ? 1.0 / m0H : 0,
      threshold: bloom.threshold,
      knee: bloom.knee,
      intensity: bloom.intensity
    });
    let result = this._prefilter.render({
      commandEncoder: params.commandEncoder,
      label: "xeokit-webgpu-bloom-prefilter-pass",
      sampler: this._sampler,
      paramsBuffer: this._paramsBuffer,
      sourceView,
      targetView: firstMip.view,
      extraView: null,
      clear: true,
      load: false
    });
    if (result.ok === false) return result;

    for (let i = 0; i < this._mipSizes.length - 1; i++) {
      const [srcW, srcH] = this._mipSizes[i];
      this._writeParams({
        inverseWidth: srcW > 0 ? 1.0 / srcW : 0,
        inverseHeight: srcH > 0 ? 1.0 / srcH : 0,
        threshold: bloom.threshold,
        knee: bloom.knee,
        intensity: 1.0
      });
      result = this._downsample.render({
        commandEncoder: params.commandEncoder,
        label: `xeokit-webgpu-bloom-downsample-${i}-pass`,
        sampler: this._sampler,
        paramsBuffer: this._paramsBuffer,
        sourceView: this._mipTargets[i].view,
        targetView: this._mipTargets[i + 1].view,
        extraView: null,
        clear: true,
        load: false
      });
      if (result.ok === false) return result;
    }

    for (let i = this._mipSizes.length - 1; i > 0; i--) {
      const [srcW, srcH] = this._mipSizes[i];
      this._writeParams({
        inverseWidth: srcW > 0 ? 1.0 / srcW : 0,
        inverseHeight: srcH > 0 ? 1.0 / srcH : 0,
        threshold: bloom.threshold,
        knee: bloom.knee,
        intensity: 1.0
      });
      result = this._upsample.render({
        commandEncoder: params.commandEncoder,
        label: `xeokit-webgpu-bloom-upsample-${i}-pass`,
        sampler: this._sampler,
        paramsBuffer: this._paramsBuffer,
        sourceView: this._mipTargets[i].view,
        targetView: this._mipTargets[i - 1].view,
        extraView: null,
        clear: false,
        load: true
      });
      if (result.ok === false) return result;
    }

    this._compositeTarget.ensureSize(params.width, params.height);
    const [srcW, srcH] = this._mipSizes[0];
    this._writeParams({
      inverseWidth: srcW > 0 ? 1.0 / srcW : 0,
      inverseHeight: srcH > 0 ? 1.0 / srcH : 0,
      threshold: bloom.threshold,
      knee: bloom.knee,
      intensity: bloom.intensity * BLOOM_PARITY_GAIN
    });
    result = this._composite.render({
      commandEncoder: params.commandEncoder,
      label: "xeokit-webgpu-bloom-composite-pass",
      sampler: this._sampler,
      paramsBuffer: this._paramsBuffer,
      sourceView,
      targetView: this._compositeTarget.view,
      extraView: this._mipTargets[0].view,
      clear: true,
      load: false
    });
    if (result.ok === false) return result;

    return {
      ok: true,
      value: {
        colorView: this._compositeTarget.view
      }
    };
  }

  destroy(): void {
    (this._paramsBuffer as {destroy?: () => void} | null)?.destroy?.();
    this._paramsBuffer = null;
    this._prefilter?.destroy();
    this._downsample?.destroy();
    this._upsample?.destroy();
    this._composite?.destroy();
    this._prefilter = null;
    this._downsample = null;
    this._upsample = null;
    this._composite = null;
    this._sampler = null;
    this._initialized = false;
    for (const target of this._mipTargets) {
      target.destroy();
    }
    this._compositeTarget.destroy();
    this._mipSizes.length = 0;
  }

  private _createBindGroupLayout(label: string, textureCount: 3 | 4): WebGPUBindGroupLayoutLike {
    const entries: any[] = [{
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
    }];
    if (textureCount === 4) {
      entries.push({
        binding: 3,
        visibility: GPU_SHADER_STAGE.FRAGMENT,
        texture: {
          sampleType: "float"
        }
      });
    }
    return this._renderContext.device.createBindGroupLayout({
      label: `xeokit-webgpu-bloom-${label}-bind-group-layout`,
      entries
    });
  }

  private _writeParams(params: {
    inverseWidth: number;
    inverseHeight: number;
    threshold: number;
    knee: number;
    intensity: number;
  }): void {
    this._renderContext.writeGPUBuffer(
      this._paramsBuffer as any,
      0,
      new Float32Array([
        params.inverseWidth,
        params.inverseHeight,
        params.threshold,
        params.knee,
        params.intensity,
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
      ])
    );
  }

  private _ensureMipChain(sceneW: number, sceneH: number): void {
    let width = Math.max(2, Math.floor(sceneW / 2));
    let height = Math.max(2, Math.floor(sceneH / 2));
    this._mipSizes.length = 0;
    for (let i = 0; i < NUM_MIPS; i++) {
      if (width < 2 || height < 2) break;
      this._mipSizes.push([width, height]);
      this._mipTargets[i].ensureSize(width, height);
      width = Math.max(2, Math.floor(width / 2));
      height = Math.max(2, Math.floor(height / 2));
    }
    for (let i = this._mipSizes.length; i < this._mipTargets.length; i++) {
      this._mipTargets[i].destroy();
    }
  }
}

class BloomPass {

  private readonly _renderContext: RenderContext;
  private readonly _label: string;
  private readonly _bindGroupLayout: WebGPUBindGroupLayoutLike;
  private readonly _shaderModule: WebGPUShaderModuleLike;
  private readonly _pipelineLayout: unknown;
  private readonly _pipeline: WebGPURenderPipelineLike;

  constructor(renderContext: RenderContext, params: {
    label: string;
    shader: string;
    bindGroupLayout: WebGPUBindGroupLayoutLike;
    targetFormat: string;
    blend: boolean;
  }) {
    this._renderContext = renderContext;
    this._label = params.label;
    this._bindGroupLayout = params.bindGroupLayout;
    this._shaderModule = renderContext.device.createShaderModule({
      label: `xeokit-webgpu-bloom-${params.label}-shader`,
      code: params.shader
    });
    this._pipelineLayout = renderContext.device.createPipelineLayout({
      label: `xeokit-webgpu-bloom-${params.label}-pipeline-layout`,
      bindGroupLayouts: [this._bindGroupLayout]
    });
    this._pipeline = renderContext.device.createRenderPipeline({
      label: `xeokit-webgpu-bloom-${params.label}-pipeline`,
      layout: this._pipelineLayout,
      vertex: {
        module: this._shaderModule,
        entryPoint: "vsMain"
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "fsMain",
        targets: [{
          format: params.targetFormat,
          blend: params.blend ? {
            color: {
              srcFactor: "one",
              dstFactor: "one",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one",
              operation: "add"
            }
          } : undefined
        }]
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none"
      }
    });
  }

  render(params: {
    commandEncoder: WebGPUCommandEncoderLike;
    label: string;
    sampler: WebGPUSamplerLike;
    paramsBuffer: unknown;
    sourceView: unknown;
    targetView: unknown;
    extraView: unknown | null;
    clear: boolean;
    load: boolean;
  }): SDKResult<void> {
    const entries: any[] = [{
      binding: 0,
      resource: params.sampler
    }, {
      binding: 1,
      resource: params.sourceView
    }, {
      binding: 2,
      resource: {
        buffer: params.paramsBuffer
      }
    }];
    if (params.extraView) {
      entries.push({
        binding: 3,
        resource: params.extraView
      });
    }
    const bindGroup: WebGPUBindGroupLike = this._renderContext.device.createBindGroup({
      label: `xeokit-webgpu-bloom-${this._label}-bind-group`,
      layout: this._bindGroupLayout,
      entries
    });
    const passEncoder = params.commandEncoder.beginRenderPass({
      label: params.label,
      colorAttachments: [{
        view: params.targetView,
        loadOp: params.load ? "load" : "clear",
        clearValue: params.clear ? {r: 0, g: 0, b: 0, a: 1} : undefined,
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
    // WebGPU shader modules, layouts and pipelines are device-owned and do not
    // expose explicit destroy in the browser API.
  }
}

const VS_FULLSCREEN = `
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
`;

const PARAMS_AND_BINDINGS = `
struct Params {
  halfpixel: vec2<f32>,
  threshold: f32,
  knee: f32,
  intensity: f32,
  pad0: vec3<f32>,
  pad1: vec4<f32>,
  pad2: vec4<f32>,
};

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: Params;

fn sampleInput(uv: vec2<f32>) -> vec3<f32> {
  return textureSample(inputTexture, inputSampler, clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0))).rgb;
}
`;

const SHADER_PREFILTER = `
${VS_FULLSCREEN}
${PARAMS_AND_BINDINGS}

fn softKnee(brightness: f32, threshold: f32, knee: f32) -> f32 {
  let safeKnee = max(knee, 0.00001);
  var soft = clamp(brightness - threshold + safeKnee, 0.0, 2.0 * safeKnee);
  soft = (soft * soft) / (4.0 * safeKnee);
  let hard = max(brightness - threshold, 0.0);
  return max(soft, hard);
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let rgb = min(max(sampleInput(input.uv), vec3<f32>(0.0)), vec3<f32>(32.0));
  let brightness = max(rgb.r, max(rgb.g, rgb.b));
  let contribution = softKnee(brightness, params.threshold, params.knee) / max(brightness, 0.00001);
  return vec4<f32>(rgb * contribution, 1.0);
}
`;

const SHADER_DOWN = `
${VS_FULLSCREEN}
${PARAMS_AND_BINDINGS}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let halfpixel = params.halfpixel;
  var sum = sampleInput(input.uv) * 4.0;
  sum += sampleInput(input.uv - halfpixel.xy);
  sum += sampleInput(input.uv + halfpixel.xy);
  sum += sampleInput(input.uv + vec2<f32>( halfpixel.x, -halfpixel.y));
  sum += sampleInput(input.uv + vec2<f32>(-halfpixel.x,  halfpixel.y));
  return vec4<f32>(sum / 8.0, 1.0);
}
`;

const SHADER_UP = `
${VS_FULLSCREEN}
${PARAMS_AND_BINDINGS}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let halfpixel = params.halfpixel;
  var sum = sampleInput(input.uv + vec2<f32>(-halfpixel.x * 2.0, 0.0));
  sum += sampleInput(input.uv + vec2<f32>(-halfpixel.x,  halfpixel.y)) * 2.0;
  sum += sampleInput(input.uv + vec2<f32>(0.0,  halfpixel.y * 2.0));
  sum += sampleInput(input.uv + vec2<f32>( halfpixel.x,  halfpixel.y)) * 2.0;
  sum += sampleInput(input.uv + vec2<f32>( halfpixel.x * 2.0, 0.0));
  sum += sampleInput(input.uv + vec2<f32>( halfpixel.x, -halfpixel.y)) * 2.0;
  sum += sampleInput(input.uv + vec2<f32>(0.0, -halfpixel.y * 2.0));
  sum += sampleInput(input.uv + vec2<f32>(-halfpixel.x, -halfpixel.y)) * 2.0;
  return vec4<f32>(sum / 12.0 * params.intensity, 1.0);
}
`;

const SHADER_COMPOSITE = `
${VS_FULLSCREEN}
${PARAMS_AND_BINDINGS}
@group(0) @binding(3) var bloomTexture: texture_2d<f32>;

fn sampleBloom(uv: vec2<f32>) -> vec3<f32> {
  return textureSample(bloomTexture, inputSampler, clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0))).rgb;
}

fn sampleBloomTent(uv: vec2<f32>) -> vec3<f32> {
  let halfpixel = params.halfpixel;
  var sum = sampleBloom(uv + vec2<f32>(-halfpixel.x * 2.0, 0.0));
  sum += sampleBloom(uv + vec2<f32>(-halfpixel.x,  halfpixel.y)) * 2.0;
  sum += sampleBloom(uv + vec2<f32>(0.0,  halfpixel.y * 2.0));
  sum += sampleBloom(uv + vec2<f32>( halfpixel.x,  halfpixel.y)) * 2.0;
  sum += sampleBloom(uv + vec2<f32>( halfpixel.x * 2.0, 0.0));
  sum += sampleBloom(uv + vec2<f32>( halfpixel.x, -halfpixel.y)) * 2.0;
  sum += sampleBloom(uv + vec2<f32>(0.0, -halfpixel.y * 2.0));
  sum += sampleBloom(uv + vec2<f32>(-halfpixel.x, -halfpixel.y)) * 2.0;
  return sum / 12.0;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let scene = sampleInput(input.uv);
  let bloom = sampleBloomTent(input.uv) * params.intensity;
  return vec4<f32>(scene + bloom, 1.0);
}
`;
