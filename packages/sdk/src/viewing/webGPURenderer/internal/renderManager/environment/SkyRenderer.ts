import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import {createMat4Float64, inverseMat4, mulMat4, type Mat4} from "../../../../../base/math/matrix";
import type {
  WebGPUBindGroupLayoutLike,
  WebGPUBindGroupLike,
  WebGPUBufferLike,
  WebGPUPipelineLayoutLike,
  WebGPURenderPassEncoderLike,
  WebGPURenderPipelineLike,
  WebGPUShaderModuleLike
} from "../../../core";
import {DEPTH_FORMAT, GPU_BUFFER_USAGE, GPU_SHADER_STAGE, WEBGPU_CLIP_SPACE_MATRIX} from "../../constants";
import type {RenderContext} from "../../RenderContext";
import type {ViewRenderState} from "../../ViewRenderState";

export interface SkyRendererOptions {
  skyColor?: [number, number, number];
  horizonColor?: [number, number, number];
  groundColor?: [number, number, number];
  horizonBlend?: number;
  sunEnabled?: boolean;
  sunDirection?: [number, number, number];
  sunColor?: [number, number, number];
  sunAngularSize?: number;
  sunGlowSize?: number;
  sunGlowIntensity?: number;
  worldUp?: [number, number, number];
}

/**
 * Procedural sky environment renderer for WebGPU.
 *
 * Mirrors the WebGLRenderer SkyRenderer: a fullscreen strip is drawn before
 * scene geometry, with the same gradient, sun disc/glow/haze, and RTE view
 * handling.
 *
 * @internal
 */
export class SkyRenderer {

  private static readonly _UNIFORM_FLOATS = 48;
  private static readonly _UNIFORM_BYTES = SkyRenderer._UNIFORM_FLOATS * 4;

  private readonly _renderContext: RenderContext;
  private readonly _viewProjMatrix: Mat4 = createMat4Float64();
  private readonly _webGPUViewProjMatrix: Mat4 = createMat4Float64();
  private readonly _invViewProjMatrix: Mat4 = createMat4Float64();
  private readonly _rteViewMatrix: Mat4 = createMat4Float64();
  private readonly _uniformData = new Float32Array(SkyRenderer._UNIFORM_FLOATS);
  private readonly _pipelines: {[colorTargetFormat: string]: WebGPURenderPipelineLike} = {};

  private _uniformBuffer: WebGPUBufferLike | null = null;
  private _bindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _pipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _bindGroup: WebGPUBindGroupLike | null = null;
  private _shaderModule: WebGPUShaderModuleLike | null = null;

  /**
   * When true, low-level callers can force sky rendering even when a View does
   * not expose `effects.sky`. Normal Viewer usage is driven by
   * `view.effects.sky.applied`, matching WebGLRenderer.
   */
  public enabled: boolean = false;

  public skyColor: [number, number, number];
  public horizonColor: [number, number, number];
  public groundColor: [number, number, number];
  public horizonBlend: number;
  public sunEnabled: boolean;
  public sunDirection: [number, number, number];
  public sunColor: [number, number, number];
  public sunAngularSize: number;
  public sunGlowSize: number;
  public sunGlowIntensity: number;
  public worldUp: [number, number, number];

  public initialized = false;
  public destroyed = false;

  constructor(renderContext: RenderContext, options: SkyRendererOptions = {}) {
    this._renderContext = renderContext;
    this.skyColor = options.skyColor ?? [0.28, 0.52, 0.93];
    this.horizonColor = options.horizonColor ?? [0.72, 0.86, 0.97];
    this.groundColor = options.groundColor ?? [0.22, 0.20, 0.18];
    this.horizonBlend = options.horizonBlend ?? 0.15;
    this.sunEnabled = options.sunEnabled ?? true;
    this.sunDirection = options.sunDirection ?? [0.577, 0.577, 0.577];
    this.sunColor = options.sunColor ?? [1.0, 0.97, 0.82];
    this.sunAngularSize = options.sunAngularSize ?? 3.0;
    this.sunGlowSize = options.sunGlowSize ?? 16.0;
    this.sunGlowIntensity = options.sunGlowIntensity ?? 0.25;
    this.worldUp = options.worldUp ?? [0, 0, 1];
  }

  public init(): SDKResult<void> {
    if (this.destroyed) {
      return {ok: false, type: SDKErrorType.InitializationFailed, error: "[SkyRenderer] Renderer has been destroyed"};
    }
    if (this.initialized) {
      return {ok: true, value: undefined};
    }

    this.initialized = true;
    return {ok: true, value: undefined};
  }

  public render(params: {
    passEncoder: WebGPURenderPassEncoderLike;
    viewRenderState: ViewRenderState;
  }): SDKResult<boolean> {
    if (!this.initialized) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[SkyRenderer.render] Renderer not initialized - call init() first."
      };
    }
    if (!params.passEncoder.setPipeline || !params.passEncoder.setBindGroup || !params.passEncoder.draw) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[SkyRenderer.render] WebGPU render pass encoder does not expose fullscreen drawing methods."
      };
    }

    const view = params.viewRenderState.view;
    const cfg = (view as any).effects?.sky as {
      applied: boolean;
      skyColor: [number, number, number];
      horizonColor: [number, number, number];
      groundColor: [number, number, number];
      horizonBlend: number;
      sunEnabled: boolean;
      sunDirection: [number, number, number];
      sunColor: [number, number, number];
      sunAngularSize: number;
      sunGlowSize: number;
      sunGlowIntensity: number;
      worldUp: [number, number, number];
    } | undefined;

    if (cfg) {
      if (cfg.applied === false) {
        return {ok: true, value: false};
      }
    } else if (!this.enabled) {
      return {ok: true, value: false};
    }

    const resourceResult = this._ensureResources();
    if (resourceResult.ok === false) {
      return resourceResult;
    }
    const resources = resourceResult.value;
    const pipelineResult = this._getPipeline();
    if (pipelineResult.ok === false) {
      return pipelineResult;
    }

    this._writeUniforms(params.viewRenderState, cfg);
    this._renderContext.device.queue.writeBuffer(resources.uniformBuffer, 0, this._uniformData);

    params.passEncoder.setPipeline(pipelineResult.value);
    params.passEncoder.setBindGroup(0, resources.bindGroup);
    params.passEncoder.draw(4, 1, 0, 0);

    return {ok: true, value: true};
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this._uniformBuffer?.destroy?.();
    this._uniformBuffer = null;
    this._bindGroupLayout = null;
    this._pipelineLayout = null;
    this._bindGroup = null;
    this._shaderModule = null;
    for (const key of Object.keys(this._pipelines)) {
      delete this._pipelines[key];
    }
    this.initialized = false;
    this.destroyed = true;
  }

  private _writeUniforms(viewRenderState: ViewRenderState, cfg: {
    skyColor: [number, number, number];
    horizonColor: [number, number, number];
    groundColor: [number, number, number];
    horizonBlend: number;
    sunEnabled: boolean;
    sunDirection: [number, number, number];
    sunColor: [number, number, number];
    sunAngularSize: number;
    sunGlowSize: number;
    sunGlowIntensity: number;
    worldUp: [number, number, number];
  } | undefined): void {
    const camera = viewRenderState.view.camera;
    const skyColor = cfg ? cfg.skyColor : this.skyColor;
    const horizonColor = cfg ? cfg.horizonColor : this.horizonColor;
    const groundColor = cfg ? cfg.groundColor : this.groundColor;
    const horizonBlend = cfg ? cfg.horizonBlend : this.horizonBlend;
    const sunEnabled = cfg ? cfg.sunEnabled : this.sunEnabled;
    const sunDir = cfg ? cfg.sunDirection : this.sunDirection;
    const sunColor = cfg ? cfg.sunColor : this.sunColor;
    const sunAngularSize = cfg ? cfg.sunAngularSize : this.sunAngularSize;
    const sunGlowSize = cfg ? cfg.sunGlowSize : this.sunGlowSize;
    const sunGlowIntensity = cfg ? cfg.sunGlowIntensity : this.sunGlowIntensity;
    const worldUp = cfg ? cfg.worldUp : this.worldUp;

    const vm = this._rteViewMatrix;
    const src = camera.viewMatrix;
    for (let i = 0; i < 16; i++) {
      vm[i] = src[i];
    }
    vm[12] = 0;
    vm[13] = 0;
    vm[14] = 0;
    mulMat4(camera.projMatrix, vm, this._viewProjMatrix);
    mulMat4(WEBGPU_CLIP_SPACE_MATRIX as Mat4, this._viewProjMatrix, this._webGPUViewProjMatrix);
    inverseMat4(this._webGPUViewProjMatrix, this._invViewProjMatrix);

    const uniforms = this._uniformData;
    uniforms.set(this._invViewProjMatrix as ArrayLike<number>, 0);
    writeVec4(uniforms, 16, worldUp[0], worldUp[1], worldUp[2], 0);
    writeVec4(uniforms, 20, skyColor[0], skyColor[1], skyColor[2], 1);
    writeVec4(uniforms, 24, horizonColor[0], horizonColor[1], horizonColor[2], 1);
    writeVec4(uniforms, 28, groundColor[0], groundColor[1], groundColor[2], 1);

    const sdLen = Math.sqrt(sunDir[0] * sunDir[0] + sunDir[1] * sunDir[1] + sunDir[2] * sunDir[2]) || 1;
    writeVec4(uniforms, 32, sunDir[0] / sdLen, sunDir[1] / sdLen, sunDir[2] / sdLen, 0);
    writeVec4(uniforms, 36, sunColor[0], sunColor[1], sunColor[2], 1);

    uniforms[40] = horizonBlend;
    uniforms[41] = Math.cos(sunAngularSize * (Math.PI / 180) * 0.5);
    uniforms[42] = sunGlowSize;
    uniforms[43] = sunGlowIntensity;
    uniforms[44] = sunEnabled ? 1 : 0;
    uniforms[45] = 0;
    uniforms[46] = 0;
    uniforms[47] = 0;
  }

  private _ensureResources(): SDKResult<{
    uniformBuffer: WebGPUBufferLike;
    bindGroup: WebGPUBindGroupLike;
  }> {
    if (this._uniformBuffer && this._bindGroup && this._bindGroupLayout && this._pipelineLayout) {
      return {
        ok: true,
        value: {
          uniformBuffer: this._uniformBuffer,
          bindGroup: this._bindGroup
        }
      };
    }

    try {
      const device = this._renderContext.device;
      this._uniformBuffer = device.createBuffer({
        label: "xeokit-webgpu-sky-uniforms",
        size: SkyRenderer._UNIFORM_BYTES,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      });
      this._bindGroupLayout = device.createBindGroupLayout({
        label: "xeokit-webgpu-sky-bind-group-layout",
        entries: [{
          binding: 0,
          visibility: GPU_SHADER_STAGE.VERTEX | GPU_SHADER_STAGE.FRAGMENT,
          buffer: {type: "uniform"}
        }]
      });
      this._pipelineLayout = device.createPipelineLayout({
        label: "xeokit-webgpu-sky-pipeline-layout",
        bindGroupLayouts: [this._bindGroupLayout]
      });
      this._bindGroup = device.createBindGroup({
        label: "xeokit-webgpu-sky-bind-group",
        layout: this._bindGroupLayout,
        entries: [{
          binding: 0,
          resource: {buffer: this._uniformBuffer}
        }]
      });
      return {
        ok: true,
        value: {
          uniformBuffer: this._uniformBuffer,
          bindGroup: this._bindGroup
        }
      };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SkyRenderer._ensureResources] Failed to allocate WebGPU sky resources: ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  private _getPipeline(): SDKResult<WebGPURenderPipelineLike> {
    const colorTargetFormat = this._renderContext.colorTargetFormat;
    const existing = this._pipelines[colorTargetFormat];
    if (existing) {
      return {ok: true, value: existing};
    }
    if (!this._pipelineLayout) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[SkyRenderer._getPipeline] Pipeline layout was not initialized."
      };
    }

    try {
      const shaderModule = this._getShaderModule();
      const pipeline = this._renderContext.device.createRenderPipeline({
        label: "xeokit-webgpu-sky-pipeline",
        layout: this._pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: "vs_main",
          buffers: []
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fs_main",
          targets: [{format: colorTargetFormat}]
        },
        depthStencil: {
          format: DEPTH_FORMAT,
          depthWriteEnabled: false,
          depthCompare: "always"
        },
        primitive: {
          topology: "triangle-strip",
          cullMode: "none"
        }
      });
      this._pipelines[colorTargetFormat] = pipeline;
      return {ok: true, value: pipeline};
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SkyRenderer._getPipeline] Failed to create WebGPU sky pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  private _getShaderModule(): WebGPUShaderModuleLike {
    if (!this._shaderModule) {
      this._shaderModule = this._renderContext.device.createShaderModule({
        label: "xeokit-webgpu-sky-shader",
        code: SHADER_SOURCE
      });
    }
    return this._shaderModule;
  }
}

function writeVec4(dest: Float32Array, offset: number, x: number, y: number, z: number, w: number): void {
  dest[offset] = x;
  dest[offset + 1] = y;
  dest[offset + 2] = z;
  dest[offset + 3] = w;
}

const SHADER_SOURCE = `
struct SkyUniforms {
  invViewProj: mat4x4<f32>,
  worldUp: vec4<f32>,
  skyColor: vec4<f32>,
  horizonColor: vec4<f32>,
  groundColor: vec4<f32>,
  sunDirection: vec4<f32>,
  sunColor: vec4<f32>,
  params: vec4<f32>,
  flags: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) rayDir: vec3<f32>,
};

@group(0) @binding(0) var<uniform> sky: SkyUniforms;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let positions = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0)
  );
  let position = positions[vertexIndex];
  let world = sky.invViewProj * vec4<f32>(position, 1.0, 1.0);

  var output: VertexOutput;
  output.rayDir = world.xyz / world.w;
  output.position = vec4<f32>(position, 1.0, 1.0);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let dir = normalize(input.rayDir);

  // Elevation: +1 at zenith, 0 at horizon, -1 at nadir.
  let elevation = dot(dir, sky.worldUp.xyz);

  // Sky half (elevation > 0): exponential ramp from horizon to zenith.
  let blendInv = 1.0 / max(sky.params.x, 0.001);
  let skyT = 1.0 - exp(-max(elevation, 0.0) * blendInv * 3.0);

  // Ground half (elevation < 0): linear ramp controlled by horizonBlend.
  let groundT = clamp(-elevation * blendInv, 0.0, 1.0);

  var color = sky.horizonColor.xyz;
  color = mix(color, sky.skyColor.xyz, skyT);
  color = mix(color, sky.groundColor.xyz, groundT);

  if (sky.flags.x != 0.0) {
    // Sun disc: sharp edge with a thin antialiased ring.
    let cosA = dot(dir, sky.sunDirection.xyz);
    let discEdge = 0.0015;
    let disc = smoothstep(sky.params.y - discEdge, sky.params.y + discEdge, cosA);

    // Radial glow: pow gives a compact halo that falls off quickly.
    let glow = pow(max(0.0, cosA), sky.params.z) * sky.params.w;

    // Horizon haze: brighten the horizon band in the direction of the sun.
    let horizonBand = 1.0 - smoothstep(0.0, sky.params.x * 2.5, abs(elevation));
    let sunFloor = sky.sunDirection.xy;
    let dirFloor = dir.xy;
    var sunAzimuth = 0.0;
    if (length(sunFloor) > 0.001 && length(dirFloor) > 0.001) {
      sunAzimuth = dot(normalize(dirFloor), normalize(sunFloor));
    }
    let haze = horizonBand * max(0.0, sunAzimuth) * 0.18;

    color += sky.sunColor.xyz * (disc + glow + haze);
  }

  return vec4<f32>(color, 1.0);
}
`;
