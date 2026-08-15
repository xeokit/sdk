import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import {createMat4Float64, mulMat4, type Mat4} from "../../../../../base/math/matrix";
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

export interface InfiniteGridRendererOptions {
  minorStep?: number;
  majorStep?: number;
  axisWidth?: number;
  fadeStart?: number;
  fadeEnd?: number;
  gridHalfSize?: number;
  followCamera?: boolean;
  minorColor?: [number, number, number];
  majorColor?: [number, number, number];
  xAxisColor?: [number, number, number];
  zAxisColor?: [number, number, number];
  worldUp?: [number, number, number];
  worldRight?: [number, number, number];
  worldForward?: [number, number, number];
}

/**
 * Infinite ground grid renderer for WebGPU.
 *
 * Mirrors the WebGLRenderer InfiniteGridRenderer: one camera-relative
 * fullscreen floor-plane quad, derivative-antialiased minor/major/axis lines,
 * alpha blending, and no depth writes.
 *
 * @internal
 */
export class InfiniteGridRenderer {

  private static readonly _UNIFORM_FLOATS = 56;
  private static readonly _UNIFORM_BYTES = InfiniteGridRenderer._UNIFORM_FLOATS * 4;

  private readonly _renderContext: RenderContext;
  private readonly _viewProjMatrix: Mat4 = createMat4Float64();
  private readonly _webGPUViewProjMatrix: Mat4 = createMat4Float64();
  private readonly _rteViewMatrix: Mat4 = createMat4Float64();
  private readonly _uniformData = new Float32Array(InfiniteGridRenderer._UNIFORM_FLOATS);
  private readonly _pipelines: {[colorTargetFormat: string]: WebGPURenderPipelineLike} = {};

  private _uniformBuffer: WebGPUBufferLike | null = null;
  private _bindGroupLayout: WebGPUBindGroupLayoutLike | null = null;
  private _pipelineLayout: WebGPUPipelineLayoutLike | null = null;
  private _bindGroup: WebGPUBindGroupLike | null = null;
  private _shaderModule: WebGPUShaderModuleLike | null = null;

  /**
   * When true, RenderManager renders this grid each frame.
   */
  public enabled: boolean = false;

  public minorStep: number;
  public majorStep: number;
  public axisWidth: number;
  public fadeStart: number;
  public fadeEnd: number;
  public gridHalfSize: number;
  public followCamera: boolean;
  public minorColor: [number, number, number];
  public majorColor: [number, number, number];
  public xAxisColor: [number, number, number];
  public zAxisColor: [number, number, number];
  public worldUp: [number, number, number];
  public worldRight: [number, number, number];
  public worldForward: [number, number, number];

  public initialized = false;
  public destroyed = false;

  constructor(renderContext: RenderContext, options: InfiniteGridRendererOptions = {}) {
    this._renderContext = renderContext;
    this.minorStep = options.minorStep ?? 1.0;
    this.majorStep = options.majorStep ?? 10.0;
    this.axisWidth = options.axisWidth ?? 0.06;
    this.fadeStart = options.fadeStart ?? 80.0;
    this.fadeEnd = options.fadeEnd ?? 500.0;
    this.gridHalfSize = options.gridHalfSize ?? 1000.0;
    this.followCamera = options.followCamera ?? true;
    this.minorColor = options.minorColor ?? [0.24, 0.27, 0.31];
    this.majorColor = options.majorColor ?? [0.42, 0.46, 0.52];
    this.xAxisColor = options.xAxisColor ?? [0.93, 0.36, 0.30];
    this.zAxisColor = options.zAxisColor ?? [0.33, 0.62, 0.96];
    this.worldUp = options.worldUp ?? [0, 0, 1];
    this.worldRight = options.worldRight ?? [1, 0, 0];
    this.worldForward = options.worldForward ?? [0, 1, 0];
  }

  public init(): SDKResult<void> {
    if (this.destroyed) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[InfiniteGridRenderer] Renderer has been destroyed"
      };
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
    if (!this.enabled) {
      return {ok: true, value: false};
    }
    if (!this.initialized) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[InfiniteGridRenderer.render] Renderer not initialized - call init() first."
      };
    }
    if (!params.passEncoder.setPipeline || !params.passEncoder.setBindGroup || !params.passEncoder.draw) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: "[InfiniteGridRenderer.render] WebGPU render pass encoder does not expose fullscreen drawing methods."
      };
    }

    const resourceResult = this._ensureResources();
    if (resourceResult.ok === false) {
      return resourceResult;
    }
    const pipelineResult = this._getPipeline();
    if (pipelineResult.ok === false) {
      return pipelineResult;
    }

    this._writeUniforms(params.viewRenderState);
    this._renderContext.device.queue.writeBuffer(resourceResult.value.uniformBuffer, 0, this._uniformData);

    params.passEncoder.setPipeline(pipelineResult.value);
    params.passEncoder.setBindGroup(0, resourceResult.value.bindGroup);
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

  private _writeUniforms(viewRenderState: ViewRenderState): void {
    const camera = viewRenderState.view.camera as {
      viewMatrix: ArrayLike<number>;
      projMatrix: ArrayLike<number>;
      eye?: ArrayLike<number>;
    };
    const eye = camera.eye ?? [0, 0, 0];

    const vm = this._rteViewMatrix;
    const src = camera.viewMatrix;
    for (let i = 0; i < 16; i++) {
      vm[i] = src[i];
    }
    vm[12] = 0;
    vm[13] = 0;
    vm[14] = 0;
    mulMat4(camera.projMatrix as Mat4, vm, this._viewProjMatrix);
    mulMat4(WEBGPU_CLIP_SPACE_MATRIX as Mat4, this._viewProjMatrix, this._webGPUViewProjMatrix);

    const up = this.worldUp;
    const upDot = eye[0] * up[0] + eye[1] * up[1] + eye[2] * up[2];
    const gridCenter = this.followCamera
      ? [-up[0] * upDot, -up[1] * upDot, -up[2] * upDot]
      : [-eye[0], -eye[1], -eye[2]];
    const axisWidth = this.minorStep * this.axisWidth;

    const uniforms = this._uniformData;
    uniforms.set(this._webGPUViewProjMatrix as ArrayLike<number>, 0);
    writeVec4(uniforms, 16, gridCenter[0], gridCenter[1], gridCenter[2], 1);
    writeVec4(uniforms, 20, 0, 0, 0, 1);
    writeVec4(uniforms, 24, this.worldRight[0], this.worldRight[1], this.worldRight[2], 0);
    writeVec4(uniforms, 28, this.worldForward[0], this.worldForward[1], this.worldForward[2], 0);
    writeVec4(uniforms, 32, this.minorColor[0], this.minorColor[1], this.minorColor[2], 1);
    writeVec4(uniforms, 36, this.majorColor[0], this.majorColor[1], this.majorColor[2], 1);
    writeVec4(uniforms, 40, this.xAxisColor[0], this.xAxisColor[1], this.xAxisColor[2], 1);
    writeVec4(uniforms, 44, this.zAxisColor[0], this.zAxisColor[1], this.zAxisColor[2], 1);
    writeVec4(uniforms, 48, this.gridHalfSize, this.minorStep, this.majorStep, axisWidth);
    writeVec4(uniforms, 52, this.fadeStart, this.fadeEnd, 0, 0);
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
        label: "xeokit-webgpu-infinite-grid-uniforms",
        size: InfiniteGridRenderer._UNIFORM_BYTES,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      });
      this._bindGroupLayout = device.createBindGroupLayout({
        label: "xeokit-webgpu-infinite-grid-bind-group-layout",
        entries: [{
          binding: 0,
          visibility: GPU_SHADER_STAGE.VERTEX | GPU_SHADER_STAGE.FRAGMENT,
          buffer: {type: "uniform"}
        }]
      });
      this._pipelineLayout = device.createPipelineLayout({
        label: "xeokit-webgpu-infinite-grid-pipeline-layout",
        bindGroupLayouts: [this._bindGroupLayout]
      });
      this._bindGroup = device.createBindGroup({
        label: "xeokit-webgpu-infinite-grid-bind-group",
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
        error: `[InfiniteGridRenderer._ensureResources] Failed to allocate WebGPU grid resources: ${e instanceof Error ? e.message : String(e)}`
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
        error: "[InfiniteGridRenderer._getPipeline] Pipeline layout was not initialized."
      };
    }

    try {
      const shaderModule = this._getShaderModule();
      const pipeline = this._renderContext.device.createRenderPipeline({
        label: "xeokit-webgpu-infinite-grid-pipeline",
        layout: this._pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: "vs_main",
          buffers: []
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fs_main",
          targets: [{
            format: colorTargetFormat,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
              }
            },
            writeMask: 0xF
          }]
        },
        depthStencil: {
          format: DEPTH_FORMAT,
          depthWriteEnabled: false,
          depthCompare: "less-equal"
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
        error: `[InfiniteGridRenderer._getPipeline] Failed to create WebGPU grid pipeline: ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  private _getShaderModule(): WebGPUShaderModuleLike {
    if (!this._shaderModule) {
      this._shaderModule = this._renderContext.device.createShaderModule({
        label: "xeokit-webgpu-infinite-grid-shader",
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
struct GridUniforms {
  viewProj: mat4x4<f32>,
  gridCenter: vec4<f32>,
  cameraPos: vec4<f32>,
  worldRight: vec4<f32>,
  worldForward: vec4<f32>,
  minorColor: vec4<f32>,
  majorColor: vec4<f32>,
  xAxisColor: vec4<f32>,
  zAxisColor: vec4<f32>,
  params: vec4<f32>,
  fade: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
};

@group(0) @binding(0) var<uniform> grid: GridUniforms;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let positions = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0)
  );
  let quadPos = positions[vertexIndex];
  let worldPos = grid.gridCenter.xyz
    + grid.worldRight.xyz * (quadPos.x * grid.params.x)
    + grid.worldForward.xyz * (quadPos.y * grid.params.x);

  var output: VertexOutput;
  output.worldPos = worldPos;
  output.position = grid.viewProj * vec4<f32>(worldPos, 1.0);
  return output;
}

fn lineFactor(coord: f32, stepSize: f32) -> f32 {
  let x = coord / stepSize;
  let fw = max(fwidth(x), 1e-6);
  let d = abs(fract(x - 0.5) - 0.5) / fw;
  return 1.0 - min(d, 1.0);
}

fn gridFactor(p: vec2<f32>, stepSize: f32) -> f32 {
  let gx = lineFactor(p.x, stepSize);
  let gz = lineFactor(p.y, stepSize);
  return max(gx, gz);
}

fn axisFactor(coord: f32, widthWorld: f32) -> f32 {
  let fw = max(fwidth(coord), 1e-6);
  let w = max(widthWorld, fw);
  let d = abs(coord) / w;
  return 1.0 - smoothstep(0.0, 1.0, d);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let p = vec2<f32>(
    dot(input.worldPos, grid.worldRight.xyz),
    dot(input.worldPos, grid.worldForward.xyz)
  );

  let minor = gridFactor(p, grid.params.y);
  let major = gridFactor(p, grid.params.z);
  let axisX = axisFactor(p.x, grid.params.w);
  let axisZ = axisFactor(p.y, grid.params.w);

  var color = vec3<f32>(0.0);
  color += grid.minorColor.xyz * minor * 0.8;
  color += grid.majorColor.xyz * major;
  color = mix(color, grid.xAxisColor.xyz, axisX);
  color = mix(color, grid.zAxisColor.xyz, axisZ);

  let camFloor = vec2<f32>(
    dot(grid.cameraPos.xyz, grid.worldRight.xyz),
    dot(grid.cameraPos.xyz, grid.worldForward.xyz)
  );
  let distFloor = distance(camFloor, p);
  let fade = 1.0 - smoothstep(grid.fade.x, grid.fade.y, distFloor);

  let lineAlpha = max(max(minor * 0.55, major), max(axisX, axisZ));
  let alpha = lineAlpha * fade;

  if (alpha < 0.01) {
    discard;
  }

  return vec4<f32>(color, alpha);
}
`;
