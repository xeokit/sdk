import type {RenderContext} from "../../RenderContext";
import type {WebGLAbstractTexture} from "../../webGL";

import {WebGLProgram, WebGLRenderBuffer} from "../../webGL";
import {SDKErrorType, type SDKResult} from "../../../../../../base/core";
import {SMAA_AREA_TEXTURE_URL, SMAA_SEARCH_TEXTURE_URL} from "./SMAALookupTextures";

type LookupTexture = {
  texture: WebGLTexture | null;
  loaded: boolean;
};

/**
 * Fullscreen SMAA 1x post-process.
 *
 * Runs after tonemap on the LDR image. The pipeline is three fullscreen
 * passes: color-edge detection, blend-weight calculation, then neighborhood
 * blending to the currently-bound framebuffer (normally the canvas).
 *
 * Shader logic is adapted from the SMAA 2.8 WebGL port used by Three.js.
 *
 * @internal
 */
export class SMAAPipeline {

  private readonly _renderContext: RenderContext;
  private _edgesProgram: WebGLProgram | null = null;
  private _weightsProgram: WebGLProgram | null = null;
  private _blendProgram: WebGLProgram | null = null;
  private _edgesTarget: WebGLRenderBuffer | null = null;
  private _weightsTarget: WebGLRenderBuffer | null = null;
  private _areaTexture: LookupTexture | null = null;
  private _searchTexture: LookupTexture | null = null;
  private _destroyed = false;

  private _uEdgesInput: WebGLUniformLocation | null = null;
  private _uEdgesResolution: WebGLUniformLocation | null = null;
  private _uWeightsEdges: WebGLUniformLocation | null = null;
  private _uWeightsArea: WebGLUniformLocation | null = null;
  private _uWeightsSearch: WebGLUniformLocation | null = null;
  private _uWeightsResolution: WebGLUniformLocation | null = null;
  private _uBlendWeights: WebGLUniformLocation | null = null;
  private _uBlendColor: WebGLUniformLocation | null = null;
  private _uBlendResolution: WebGLUniformLocation | null = null;

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  /** True once shader programs and the two SMAA lookup textures are ready. */
  get ready(): boolean {
    return !!(
      this._edgesProgram &&
      this._weightsProgram &&
      this._blendProgram &&
      this._edgesTarget &&
      this._weightsTarget &&
      this._areaTexture?.loaded &&
      this._searchTexture?.loaded
    );
  }

  init(): SDKResult<void> {
    const edgesProgram = new WebGLProgram(this._renderContext, {
      vertex: EDGES_VS_SRC,
      fragment: EDGES_FS_SRC
    });
    const edgesResult = edgesProgram.init();
    if (edgesResult.ok === false) {
      edgesProgram.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SMAAPipeline.init] Edge shader compile/link failed: ${edgesResult.error}`
      };
    }

    const weightsProgram = new WebGLProgram(this._renderContext, {
      vertex: WEIGHTS_VS_SRC,
      fragment: WEIGHTS_FS_SRC
    });
    const weightsResult = weightsProgram.init();
    if (weightsResult.ok === false) {
      edgesProgram.destroy();
      weightsProgram.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SMAAPipeline.init] Weight shader compile/link failed: ${weightsResult.error}`
      };
    }

    const blendProgram = new WebGLProgram(this._renderContext, {
      vertex: BLEND_VS_SRC,
      fragment: BLEND_FS_SRC
    });
    const blendResult = blendProgram.init();
    if (blendResult.ok === false) {
      edgesProgram.destroy();
      weightsProgram.destroy();
      blendProgram.destroy();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[SMAAPipeline.init] Blend shader compile/link failed: ${blendResult.error}`
      };
    }

    this._edgesProgram = edgesProgram;
    this._weightsProgram = weightsProgram;
    this._blendProgram = blendProgram;

    this._uEdgesInput = edgesProgram.getSampler("uInput");
    this._uEdgesResolution = edgesProgram.getLocation("uResolution");
    this._uWeightsEdges = weightsProgram.getSampler("uEdges");
    this._uWeightsArea = weightsProgram.getSampler("uArea");
    this._uWeightsSearch = weightsProgram.getSampler("uSearch");
    this._uWeightsResolution = weightsProgram.getLocation("uResolution");
    this._uBlendWeights = blendProgram.getSampler("uWeights");
    this._uBlendColor = blendProgram.getSampler("uColor");
    this._uBlendResolution = blendProgram.getLocation("uResolution");

    this._edgesTarget = new WebGLRenderBuffer(
      this._renderContext.webglCanvasElement,
      this._renderContext.gl,
      {depthTexture: false, colorFilter: "linear"}
    );
    this._weightsTarget = new WebGLRenderBuffer(
      this._renderContext.webglCanvasElement,
      this._renderContext.gl,
      {depthTexture: false, colorFilter: "linear"}
    );

    this._areaTexture = this._createLookupTexture(SMAA_AREA_TEXTURE_URL, "linear");
    this._searchTexture = this._createLookupTexture(SMAA_SEARCH_TEXTURE_URL, "nearest");

    return {ok: true, value: undefined};
  }

  /**
   * Runs SMAA into the currently-bound framebuffer. Caller sets the final
   * viewport beforehand.
   */
  render(params: { inputTexture: WebGLAbstractTexture; viewportWidth: number; viewportHeight: number }): void {
    if (!this.ready) return;
    const gl = this._renderContext.gl;
    const width = params.viewportWidth;
    const height = params.viewportHeight;
    if (width <= 0 || height <= 0) return;

    const invW = 1.0 / width;
    const invH = 1.0 / height;

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    this._edgesTarget!.setSize([width, height]);
    this._weightsTarget!.setSize([width, height]);

    // Pass 1: LDR color -> color edge mask.
    this._edgesTarget!.bind(gl.RGBA8);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this._edgesProgram!.bind();
    this._renderContext.lastProgramId = -1;
    params.inputTexture.bind(0);
    if (this._uEdgesInput) gl.uniform1i(this._uEdgesInput, 0);
    if (this._uEdgesResolution) gl.uniform2f(this._uEdgesResolution, invW, invH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const edgesTexture = this._edgesTarget!.getTexture();
    this._edgesTarget!.unbind();

    // Pass 2: edge mask + lookup tables -> blend weights.
    this._weightsTarget!.bind(gl.RGBA8);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this._weightsProgram!.bind();
    this._renderContext.lastProgramId = -1;
    edgesTexture.bind(0);
    this._bindRawTexture(this._areaTexture!.texture, 1);
    this._bindRawTexture(this._searchTexture!.texture, 2);
    if (this._uWeightsEdges) gl.uniform1i(this._uWeightsEdges, 0);
    if (this._uWeightsArea) gl.uniform1i(this._uWeightsArea, 1);
    if (this._uWeightsSearch) gl.uniform1i(this._uWeightsSearch, 2);
    if (this._uWeightsResolution) gl.uniform2f(this._uWeightsResolution, invW, invH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const weightsTexture = this._weightsTarget!.getTexture();
    this._weightsTarget!.unbind();

    // Pass 3: blend original LDR color to the canvas.
    gl.viewport(0, 0, width, height);
    this._blendProgram!.bind();
    this._renderContext.lastProgramId = -1;
    weightsTexture.bind(0);
    params.inputTexture.bind(1);
    if (this._uBlendWeights) gl.uniform1i(this._uBlendWeights, 0);
    if (this._uBlendColor) gl.uniform1i(this._uBlendColor, 1);
    if (this._uBlendResolution) gl.uniform2f(this._uBlendResolution, invW, invH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }

  destroy(): void {
    this._destroyed = true;
    this._edgesProgram?.destroy();
    this._weightsProgram?.destroy();
    this._blendProgram?.destroy();
    this._edgesTarget?.destroy();
    this._weightsTarget?.destroy();

    const gl = this._renderContext.gl;
    if (this._areaTexture?.texture) gl.deleteTexture(this._areaTexture.texture);
    if (this._searchTexture?.texture) gl.deleteTexture(this._searchTexture.texture);

    this._edgesProgram = null;
    this._weightsProgram = null;
    this._blendProgram = null;
    this._edgesTarget = null;
    this._weightsTarget = null;
    this._areaTexture = null;
    this._searchTexture = null;
  }

  private _createLookupTexture(url: string, filter: "linear" | "nearest"): LookupTexture {
    const gl = this._renderContext.gl;
    const texture = gl.createTexture();
    const state: LookupTexture = {texture, loaded: false};
    if (!texture) return state;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    const glFilter = filter === "linear" ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, glFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, glFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0])
    );
    gl.bindTexture(gl.TEXTURE_2D, null);

    const image = new Image();
    image.onload = () => {
      if (this._destroyed || this._renderContext.contextLost) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.bindTexture(gl.TEXTURE_2D, null);
      state.loaded = true;
      (this._renderContext.activeView as any)?.needsRender?.();
    };
    image.onerror = () => {
      state.loaded = false;
    };
    image.src = url;

    return state;
  }

  private _bindRawTexture(texture: WebGLTexture | null, unit: number): void {
    const gl = this._renderContext.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }
}

const FULLSCREEN_TRIANGLE = `
void emitFullscreenTriangle(out vec2 uv) {
    vec2 pos = vec2(
        float((gl_VertexID & 1) << 2) - 1.0,
        float((gl_VertexID & 2) << 1) - 1.0
    );
    uv = pos * 0.5 + 0.5;
    gl_Position = vec4(pos, 0.0, 1.0);
}`;

const EDGES_VS_SRC = `#version 300 es
precision highp float;

uniform vec2 uResolution;

out vec2 vUV;
out vec4 vOffset0;
out vec4 vOffset1;
out vec4 vOffset2;

${FULLSCREEN_TRIANGLE}

void main(void) {
    emitFullscreenTriangle(vUV);
    vOffset0 = vUV.xyxy + uResolution.xyxy * vec4(-1.0, 0.0, 0.0,  1.0);
    vOffset1 = vUV.xyxy + uResolution.xyxy * vec4( 1.0, 0.0, 0.0, -1.0);
    vOffset2 = vUV.xyxy + uResolution.xyxy * vec4(-2.0, 0.0, 0.0,  2.0);
}`;

const EDGES_FS_SRC = `#version 300 es
precision highp float;

in vec2 vUV;
in vec4 vOffset0;
in vec4 vOffset1;
in vec4 vOffset2;

out vec4 outColor;

uniform sampler2D uInput;

const float SMAA_THRESHOLD = 0.05;

void main(void) {
    vec2 threshold = vec2(SMAA_THRESHOLD, SMAA_THRESHOLD);
    vec4 delta;
    vec3 C = texture(uInput, vUV).rgb;

    vec3 Cleft = texture(uInput, vOffset0.xy).rgb;
    vec3 t = abs(C - Cleft);
    delta.x = max(max(t.r, t.g), t.b);

    vec3 Ctop = texture(uInput, vOffset0.zw).rgb;
    t = abs(C - Ctop);
    delta.y = max(max(t.r, t.g), t.b);

    vec2 edges = step(threshold, delta.xy);
    if (dot(edges, vec2(1.0)) == 0.0) discard;

    vec3 Cright = texture(uInput, vOffset1.xy).rgb;
    t = abs(C - Cright);
    delta.z = max(max(t.r, t.g), t.b);

    vec3 Cbottom = texture(uInput, vOffset1.zw).rgb;
    t = abs(C - Cbottom);
    delta.w = max(max(t.r, t.g), t.b);

    float maxDelta = max(max(max(delta.x, delta.y), delta.z), delta.w);

    vec3 Cleftleft = texture(uInput, vOffset2.xy).rgb;
    t = abs(C - Cleftleft);
    delta.z = max(max(t.r, t.g), t.b);

    vec3 Ctoptop = texture(uInput, vOffset2.zw).rgb;
    t = abs(C - Ctoptop);
    delta.w = max(max(t.r, t.g), t.b);

    maxDelta = max(maxDelta, max(delta.z, delta.w));
    edges.xy *= step(0.5 * maxDelta, delta.xy);

    outColor = vec4(edges, 0.0, 0.0);
}`;

const WEIGHTS_VS_SRC = `#version 300 es
precision highp float;

uniform vec2 uResolution;

out vec2 vUV;
out vec2 vPixcoord;
out vec4 vOffset0;
out vec4 vOffset1;
out vec4 vOffset2;

#define SMAA_MAX_SEARCH_STEPS 8

${FULLSCREEN_TRIANGLE}

void main(void) {
    emitFullscreenTriangle(vUV);
    vPixcoord = vUV / uResolution;
    vOffset0 = vUV.xyxy + uResolution.xyxy * vec4(-0.25, 0.125, 1.25, 0.125);
    vOffset1 = vUV.xyxy + uResolution.xyxy * vec4(-0.125, 0.25, -0.125, -1.25);
    vOffset2 = vec4(vOffset0.xz, vOffset1.yw) + vec4(-2.0, 2.0, -2.0, 2.0) * uResolution.xxyy * float(SMAA_MAX_SEARCH_STEPS);
}`;

const WEIGHTS_FS_SRC = `#version 300 es
precision highp float;

in vec2 vUV;
in vec2 vPixcoord;
in vec4 vOffset0;
in vec4 vOffset1;
in vec4 vOffset2;

out vec4 outColor;

uniform sampler2D uEdges;
uniform sampler2D uArea;
uniform sampler2D uSearch;
uniform vec2 uResolution;

#define SMAA_MAX_SEARCH_STEPS 8
#define SMAA_AREATEX_MAX_DISTANCE 16
#define SMAA_AREATEX_PIXEL_SIZE (1.0 / vec2(160.0, 560.0))
#define SMAA_AREATEX_SUBTEX_SIZE (1.0 / 7.0)
#define SMAASampleLevelZeroOffset(tex, coord, offset) texture(tex, coord + vec2(offset) * uResolution)

float SMAASearchLength(sampler2D searchTex, vec2 e, float bias, float scale) {
    e.r = bias + e.r * scale;
    return 255.0 * texture(searchTex, e).r;
}

float SMAASearchXLeft(sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end) {
    vec2 e = vec2(0.0, 1.0);
    for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) {
        e = texture(edgesTex, texcoord).rg;
        texcoord -= vec2(2.0, 0.0) * uResolution;
        if (!(texcoord.x > end && e.g > 0.8281 && e.r == 0.0)) break;
    }
    texcoord.x += 0.25 * uResolution.x;
    texcoord.x += uResolution.x;
    texcoord.x += 2.0 * uResolution.x;
    texcoord.x -= uResolution.x * SMAASearchLength(searchTex, e, 0.0, 0.5);
    return texcoord.x;
}

float SMAASearchXRight(sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end) {
    vec2 e = vec2(0.0, 1.0);
    for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) {
        e = texture(edgesTex, texcoord).rg;
        texcoord += vec2(2.0, 0.0) * uResolution;
        if (!(texcoord.x < end && e.g > 0.8281 && e.r == 0.0)) break;
    }
    texcoord.x -= 0.25 * uResolution.x;
    texcoord.x -= uResolution.x;
    texcoord.x -= 2.0 * uResolution.x;
    texcoord.x += uResolution.x * SMAASearchLength(searchTex, e, 0.5, 0.5);
    return texcoord.x;
}

float SMAASearchYUp(sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end) {
    vec2 e = vec2(1.0, 0.0);
    for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) {
        e = texture(edgesTex, texcoord).rg;
        texcoord += vec2(0.0, 2.0) * uResolution;
        if (!(texcoord.y > end && e.r > 0.8281 && e.g == 0.0)) break;
    }
    texcoord.y -= 0.25 * uResolution.y;
    texcoord.y -= uResolution.y;
    texcoord.y -= 2.0 * uResolution.y;
    texcoord.y += uResolution.y * SMAASearchLength(searchTex, e.gr, 0.0, 0.5);
    return texcoord.y;
}

float SMAASearchYDown(sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end) {
    vec2 e = vec2(1.0, 0.0);
    for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) {
        e = texture(edgesTex, texcoord).rg;
        texcoord -= vec2(0.0, 2.0) * uResolution;
        if (!(texcoord.y < end && e.r > 0.8281 && e.g == 0.0)) break;
    }
    texcoord.y += 0.25 * uResolution.y;
    texcoord.y += uResolution.y;
    texcoord.y += 2.0 * uResolution.y;
    texcoord.y -= uResolution.y * SMAASearchLength(searchTex, e.gr, 0.5, 0.5);
    return texcoord.y;
}

vec2 SMAAArea(sampler2D areaTex, vec2 dist, float e1, float e2, float offset) {
    vec2 texcoord = float(SMAA_AREATEX_MAX_DISTANCE) * round(4.0 * vec2(e1, e2)) + dist;
    texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + (0.5 * SMAA_AREATEX_PIXEL_SIZE);
    texcoord.y += SMAA_AREATEX_SUBTEX_SIZE * offset;
    return texture(areaTex, texcoord).rg;
}

vec4 SMAABlendingWeightCalculationPS(vec2 texcoord, vec2 pixcoord, sampler2D edgesTex, sampler2D areaTex, sampler2D searchTex, ivec4 subsampleIndices) {
    vec4 weights = vec4(0.0);
    vec2 e = texture(edgesTex, texcoord).rg;

    if (e.g > 0.0) {
        vec2 d;
        vec2 coords;
        coords.x = SMAASearchXLeft(edgesTex, searchTex, vOffset0.xy, vOffset2.x);
        coords.y = vOffset1.y;
        d.x = coords.x;

        float e1 = texture(edgesTex, coords).r;

        coords.x = SMAASearchXRight(edgesTex, searchTex, vOffset0.zw, vOffset2.y);
        d.y = coords.x;
        d = d / uResolution.x - pixcoord.x;

        vec2 sqrt_d = sqrt(abs(d));
        coords.y -= 1.0 * uResolution.y;
        float e2 = SMAASampleLevelZeroOffset(edgesTex, coords, ivec2(1, 0)).r;

        weights.rg = SMAAArea(areaTex, sqrt_d, e1, e2, float(subsampleIndices.y));
    }

    if (e.r > 0.0) {
        vec2 d;
        vec2 coords;
        coords.y = SMAASearchYUp(edgesTex, searchTex, vOffset1.xy, vOffset2.z);
        coords.x = vOffset0.x;
        d.x = coords.y;

        float e1 = texture(edgesTex, coords).g;

        coords.y = SMAASearchYDown(edgesTex, searchTex, vOffset1.zw, vOffset2.w);
        d.y = coords.y;
        d = d / uResolution.y - pixcoord.y;

        vec2 sqrt_d = sqrt(abs(d));
        coords.y -= 1.0 * uResolution.y;
        float e2 = SMAASampleLevelZeroOffset(edgesTex, coords, ivec2(0, 1)).g;

        weights.ba = SMAAArea(areaTex, sqrt_d, e1, e2, float(subsampleIndices.x));
    }

    return weights;
}

void main(void) {
    outColor = SMAABlendingWeightCalculationPS(vUV, vPixcoord, uEdges, uArea, uSearch, ivec4(0));
}`;

const BLEND_VS_SRC = `#version 300 es
precision highp float;

uniform vec2 uResolution;

out vec2 vUV;
out vec4 vOffset0;
out vec4 vOffset1;

${FULLSCREEN_TRIANGLE}

void main(void) {
    emitFullscreenTriangle(vUV);
    vOffset0 = vUV.xyxy + uResolution.xyxy * vec4(-1.0, 0.0, 0.0,  1.0);
    vOffset1 = vUV.xyxy + uResolution.xyxy * vec4( 1.0, 0.0, 0.0, -1.0);
}`;

const BLEND_FS_SRC = `#version 300 es
precision highp float;

in vec2 vUV;
in vec4 vOffset0;
in vec4 vOffset1;

out vec4 outColor;

uniform sampler2D uWeights;
uniform sampler2D uColor;
uniform vec2 uResolution;

void main(void) {
    vec4 a;
    a.xz = texture(uWeights, vUV).xz;
    a.y = texture(uWeights, vOffset1.zw).g;
    a.w = texture(uWeights, vOffset1.xy).a;

    if (dot(a, vec4(1.0)) < 1e-5) {
        outColor = texture(uColor, vUV);
        return;
    }

    vec2 offset;
    offset.x = a.a > a.b ? a.a : -a.b;
    offset.y = a.g > a.r ? -a.g : a.r;

    if (abs(offset.x) > abs(offset.y)) {
        offset.y = 0.0;
    } else {
        offset.x = 0.0;
    }

    vec4 C = texture(uColor, vUV);
    vec2 neighborUV = vUV + sign(offset) * uResolution;
    vec4 Cop = texture(uColor, neighborUV);
    float s = max(abs(offset.x), abs(offset.y));

    C.rgb = pow(max(C.rgb, vec3(0.0)), vec3(2.2));
    Cop.rgb = pow(max(Cop.rgb, vec3(0.0)), vec3(2.2));
    vec4 mixedColor = mix(C, Cop, s);
    mixedColor.rgb = pow(max(mixedColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));

    outColor = mixedColor;
}`;
