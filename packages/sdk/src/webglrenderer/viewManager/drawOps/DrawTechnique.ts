import {WEBGL_INFO, WebGLProgram} from "../../../webglutils";
import {LinesPrimitive, OrthoProjectionType, PointsPrimitive, TrianglesPrimitive} from "../../../constants";
import {RENDER_PASSES, type RenderPassValue} from "../RENDER_PASSES";
import type {RenderContext} from "../RenderContext";
import {type GPUMemoryReader} from "../gpuMemoryManager/GPUMemoryReader";
import {type MeshBatch} from "../meshManager/MeshBatch";
import {SDKErrorType, type SDKResult} from "../../../core";
import {type WebGLContextProvider} from "../../../webglutils/WebGLContextProvider";

const defaultColor = new Float32Array([1, 1, 1, 1]);

/**
 * Base class for GPU draw techniques.
 *
 * Used by {@link DrawOp}s to perform actual draw calls.
 *
 * A {@link DrawTechnique} encapsulates:
 * - GLSL source generation (vertex + fragment)
 * - WebGL program compilation/linking ({@link WebGLProgram})
 * - Uniform / sampler discovery and per-pass binding
 * - Issuing draw calls for a {@link MeshBatch}
 *
 * Techniques are *render-pass aware* but do not own render-pass routing:
 * callers pass a {@link RenderPassValue} to {@link drawMesh},
 * and the technique binds uniforms accordingly.
 *
 * ## Responsibilities
 * - Build shader sources via {@link buildVertexShader} and {@link buildFragmentShader}.
 * - Compile/link the program and cache uniform/sampler locations in {@link init}.
 * - Bind the program and set pass/view-dependent uniforms in {@link _bind}.
 * - Bind batch data textures from {@link GPUMemoryReader} and draw primitives in {@link _draw}.
 *
 * ## Lifecycle
 * - Call {@link init} once after construction to allocate GPU resources.
 * - Call {@link destroy} to release GPU resources.
 * - On WebGL context loss/restoration, call {@link webglContextRestored} to recreate state.
 *
 * Subclasses must implement:
 * - {@link buildVertexShader}
 * - {@link buildFragmentShader}
 *
 * These methods are called during {@link init} to generate the GLSL source code,
 * and would typically use helper methods like {@link vsCode}, {@link vsHeader},
 * and {@link vsCommonDefines}, provided by the base class, to construct the shader source
 * (i.e. Template Method / Template Base Class pattern).
 *
 * @internal
 */

export abstract class DrawTechnique {

  private _renderContext: RenderContext;
  private _gpuMemoryReader: GPUMemoryReader;
  private _program: WebGLProgram | null;

  /**
   * Compilation errors encountered during program initialization.
   * Available after `init()` is called.
   */
  public errors: string[];

  /**
   * When true, the technique binds silhouette-related uniforms using "edge" material
   * settings (edgeColor/edgeAlpha) instead of fill settings (fillColor/fillAlpha).
   *
   * Used by silhouette-like techniques that can render both filled silhouettes
   * and edge silhouettes.
   */
  public edges: boolean;

  /**
   * Vertex shader source code. Available after `init()` is called.
   */
  public vertexShaderSrc: string;

  /**
   * Fragment shader source code. Available after `init()` is called.
   */
  public fragmentShaderSrc: string;

  /**
   * Uniforms and attributes for the shader program.
   * Populated during the `build()` method based on what's included in the shader source.
   */
  private _uniforms: {
    renderPass: WebGLUniformLocation; // Current draw pass (e.g., color, pick, silhouette)
    primBaseIndex: WebGLUniformLocation; // Base tileIndex for the current draw call
    primitiveType: WebGLUniformLocation; // Primitive type being rendered (triangles, lines, points)
    pointCloudIntensityRange: WebGLUniformLocation; // Intensity range for point cloud rendering
    nearPlaneHeight: WebGLUniformLocation; // Near plane height for perspective point size calculation
    silhouetteColor: WebGLUniformLocation; // Color used for silhouette rendering
    gammaFactor: WebGLUniformLocation; // Gamma correction factor
    pickZNear: WebGLUniformLocation; // Near plane for pick rendering
    snapCameraEyeRTC: WebGLUniformLocation; // Snapped camera eye position in RTC space
    pointSize: WebGLUniformLocation; // Size of points for point rendering
    intensityRange: WebGLUniformLocation; // Intensity range for point rendering
    pickZFar: WebGLUniformLocation;
    pickClipPos: WebGLUniformLocation;
    drawingBufferSize: WebGLUniformLocation;
    sectionPlanes: any[];
    projMatrix: WebGLUniformLocation;
    lightPos: WebGLUniformLocation[];
    lightDir: WebGLUniformLocation[];
    lightColor: WebGLUniformLocation[];
    lightAttenuation: WebGLUniformLocation[];
    lightAmbient: WebGLUniformLocation;
    saoParams: WebGLUniformLocation;
  };

  /**
   * Attributes for the shader program.
   */
  private _attributes: {};

  /**
   * Samplers for the shader program.
   */
  private _samplers: {
    primitiveMeshIndex: WebGLUniformLocation; // Prim tileIndex -> mesh lookup
    meshAttributeTexture: WebGLUniformLocation; // Mesh attributes
    meshViewAttributeTexture: WebGLUniformLocation; // Mesh view attributes
    meshMatrixTexture: WebGLUniformLocation; // RTC modeling matrices
    geometryAttributes: WebGLUniformLocation; // Geometry attributes
    geometryQuantRangeTexture: WebGLUniformLocation; // Quantization ranges
    vertexPositionTexture: WebGLUniformLocation; // Quantized vertex positions
    vertexColorTexture: WebGLUniformLocation; // Vertex RGB colors
    indexTexture: WebGLUniformLocation; // Primitive connectivity indices
    edgeIndexTexture: WebGLUniformLocation; // Edge connectivity indices
    viewTileCameraMatrixTexture: WebGLUniformLocation; // GPUTile view matrices
    saoOcclusionTexture: WebGLUniformLocation; // SAO occlusion texture
  };

  /**
   * Temp vertex shader source _buffer.
   */
  private _vertSrcBuf: string[];

  /**
   * Temp fragment shader source _buffer.
   */
  private _fragSrcBuf: string[];

  /**
   * Creates a new DrawTechnique.
   *
   * @param renderContext
   * @param gpuMemoryReader
   * @param cfg
   */
  constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader, cfg: { edges: boolean } = {edges: false}) {
    this._renderContext = renderContext;
    this._gpuMemoryReader = gpuMemoryReader;
    this.edges = cfg.edges;
    this._program = null;
  }

  /**
   * Initializes this draw technique by building and compiling the shader program.
   */
  public init(): SDKResult<any> {

    this._vertSrcBuf = [];
    this._fragSrcBuf = [];

    this.buildVertexShader();
    this.buildFragmentShader();

    this.vertexShaderSrc = joinSansComments(this._vertSrcBuf);
    this.fragmentShaderSrc = joinSansComments(this._fragSrcBuf);

    this._program = new WebGLProgram(this._renderContext as WebGLContextProvider, {
      vertex: this.vertexShaderSrc,
      fragment: this.fragmentShaderSrc,
    });

    this._vertSrcBuf = [];
    this._fragSrcBuf = [];

    return this._initProgram();
  }

  /**
   * Notifies draw technique that the WebGL context has been restored.
   *
   * This allows the technique to recreate its shaders after context loss.
   *
   * @returns Result indicating success or failure.
   */
  webglContextRestored(): SDKResult<void> {
    if (!this._program) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DrawTechnique.webglContextRestored] Shader program is not initialized."
      };
    }
    return this._initProgram();
  }

  private _initProgram(): SDKResult<any> {

    const result = this._program.init();

    if (result.ok === false) {
      return result;
    }

    const program = this._program;

    this._uniforms = {
      primBaseIndex: program.getLocation("uPrimBaseIndex"),
      renderPass: program.getLocation("uRenderPass"),
      primitiveType: program.getLocation("uPrimitiveType"),
      gammaFactor: program.getLocation("uGammaFactor"),
      projMatrix: program.getLocation("uProjMatrix"),
      snapCameraEyeRTC: program.getLocation("snapCameraEyeRTC"),
      pointSize: program.getLocation("pointSize"),
      intensityRange: program.getLocation("intensityRange"),
      nearPlaneHeight: program.getLocation("nearPlaneHeight"),
      pointCloudIntensityRange: program.getLocation("pointCloudIntensityRange"),
      pickZNear: program.getLocation("pickZNear"),
      pickZFar: program.getLocation("pickZFar"),
      pickClipPos: program.getLocation("pickClipPos"),
      drawingBufferSize: program.getLocation("drawingBufferSize"),
      silhouetteColor: program.getLocation("uSilhouetteColor"),
      sectionPlanes: [],
      lightColor: [],
      lightDir: [],
      lightPos: [],
      lightAttenuation: [],
      lightAmbient: program.getLocation("lightAmbient"),
      saoParams: program.getLocation("saoParams")
    };

    // const lights = view.lightsList;
    // for (let i = 0, len = lights.length; i < len; i++) {
    //   const light = lights[i];
    //   if (light instanceof DirLight) {
    //     this._uniforms.lightColor[i] = program.getLocation("lightColor" + i);
    //     this._uniforms.lightPos[i] = null;
    //     this._uniforms.lightDir[i] = program.getLocation("lightDir" + i);
    //     break;
    //   } else {
    //     this._uniforms.lightColor[i] = program.getLocation("lightColor" + i);
    //     this._uniforms.lightPos[i] = program.getLocation("lightPos" + i);
    //     this._uniforms.lightDir[i] = null;
    //     this._uniforms.lightAttenuation[i] = program.getLocation("lightAttenuation" + i);
    //   }
    // }
    //
    // const uniforms = this._uniforms;
    //
    // for (let i = 0, len = view.sectionPlanesList.length; i < len; i++) {
    //   uniforms.sectionPlanes.push({
    //     active: program.getLocation("sectionPlaneActive" + i),
    //     pos: program.getLocation("sectionPlanePos" + i),
    //     dir: program.getLocation("sectionPlaneDir" + i)
    //   });
    // }

    this._attributes = {};

    this._samplers = {
      primitiveMeshIndex: program.getSampler("uPrimitiveMeshIndexTexture"),
      meshAttributeTexture: program.getSampler("uMeshAttributeTexture"),
      meshViewAttributeTexture: program.getSampler("uMeshViewAttributeTexture"),
      meshMatrixTexture: program.getSampler("uMeshMatrixTexture"),
      geometryAttributes: program.getSampler("uGeometryAttributeTexture"),
      geometryQuantRangeTexture: program.getSampler("uGeometryQuantRangeTexture"),
      viewTileCameraMatrixTexture: program.getSampler("uViewTileCameraMatrixTexture"),
      vertexPositionTexture: program.getSampler("uVertexPositionTexture"),
      vertexColorTexture: program.getSampler("uVertexColorTexture"),
      indexTexture: program.getSampler("uIndexTexture"),
      edgeIndexTexture: program.getSampler("uEdgeIndextexture"),
      saoOcclusionTexture: program.getSampler("saoOcclusionTexture")
    };

    return {
      ok: true,
      value: null
    };
  }

  /**
   * Notifies draw technique that the WebGL context has been lost.
   */
  webglContextLost() {
  }

  /**
   * Draws a batch of meshes for the specified render pass.
   */
  public drawBatch(meshBatch: MeshBatch, renderPass: RenderPassValue): SDKResult<any> {
    return this._draw(meshBatch, renderPass);
  }

  /**
   * Draws a specific mesh within a batch, for the specified render pass.
   */
  public drawMesh(meshBatch: MeshBatch, meshIndex: number, renderPass: RenderPassValue): SDKResult<any> {
    return this._draw(meshBatch, renderPass, meshIndex);
  }

  private _draw(meshBatch: MeshBatch, renderPass: RenderPassValue, meshIndex?: number): SDKResult<any> {

    if (!this._program) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DrawTechnique._draw] Shader program is not initialized."
      };
    }

    try {
      if (!this._bind(renderPass)) {
        return {
          ok: false,
          type: SDKErrorType.InvalidOperation,
          error: "[DrawTechnique._draw] Failed to bind the shader program."
        };
      }

      const renderContext = this._renderContext;
      const view = renderContext.activeView;
      const gl = this._renderContext.gl;

      renderContext.textureUnit = 0;

      const bindTexture = (sampler, dataTexture) => {
        if (!sampler || !dataTexture) {
          return;
        }
        gl.activeTexture(gl["TEXTURE" + renderContext.textureUnit]);
        gl.bindTexture(gl.TEXTURE_2D, dataTexture.texture);
        gl.uniform1i(sampler, renderContext.textureUnit);
        renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
      };

      const samplers = this._samplers;
      const dataTextures = this._gpuMemoryReader.dataTextures;
      const batchDataTextures = dataTextures.batches[meshBatch.gpuMemoryBatchIndex];
      const viewIndex = view.viewIndex;

      bindTexture(samplers.viewTileCameraMatrixTexture,
        (this._renderContext.rayPicking
          ? dataTextures.viewTilePickMatrixTexture
          : dataTextures.viewTileCameraMatrixTexture)
          [view.viewIndex]);

      const batchViewDataTextures = batchDataTextures.views[viewIndex];
      const primitiveMeshIndexTexture = batchViewDataTextures.primitiveMeshIndexTexture;

      bindTexture(samplers.primitiveMeshIndex, primitiveMeshIndexTexture);
      bindTexture(samplers.vertexPositionTexture, batchDataTextures.vertexPositionTexture);
      bindTexture(samplers.vertexColorTexture, batchDataTextures.vertexColorTexture);
      bindTexture(samplers.meshMatrixTexture, batchDataTextures.meshMatrixTexture);
      bindTexture(samplers.meshAttributeTexture, batchDataTextures.meshAttributeTexture);
      bindTexture(samplers.meshViewAttributeTexture, batchViewDataTextures.meshViewAttributeTexture);
      bindTexture(samplers.geometryAttributes, batchDataTextures.geometryAttributeTexture);
      bindTexture(samplers.geometryQuantRangeTexture, batchDataTextures.geometryQuantRangeTexture);
      bindTexture(samplers.edgeIndexTexture, batchDataTextures.edgeIndexTexture);
      bindTexture(samplers.indexTexture, batchDataTextures.indexTexture);

      const drawRange = batchViewDataTextures.renderPassPrimitiveRanges.get(renderPass);
      if (!drawRange || drawRange.numPrims === 0) {
        return {
          ok: true,
          value: null // Nothing to draw for this pass
        };
      }

      gl.uniform1i(this._uniforms.primBaseIndex, drawRange.firstPrim);
      gl.uniform1i(this._uniforms.primitiveType, meshBatch.primitive);

      switch (meshBatch.primitive) {
        case TrianglesPrimitive:
          gl.drawArrays(gl.TRIANGLES, drawRange.firstPrim * 3, drawRange.numPrims * 3);
          break;
        case LinesPrimitive:
          gl.drawArrays(gl.LINES, drawRange.firstPrim * 2, drawRange.numPrims * 2);
          break;
        case PointsPrimitive:
          gl.drawArrays(gl.POINTS, drawRange.firstPrim, drawRange.numPrims);
          break;
        default:
          return {
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `[DrawTechnique._draw] Unsupported Batch primitive type: ${meshBatch.primitive}`
          };
      }

      for (let i = 0; i < 12; i++) {
        gl.activeTexture(gl["TEXTURE" + i]);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }

      return {
        ok: true,
        value: null
      };

    } catch (error) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: error instanceof Error ? error.message : "[DrawTechnique._draw] An unknown error occurred during draw."
      };
    }
  }

  /**
   * Abstract method to build the vertex shader source code.
   * Subclasses must implement this method to define the fragment shader logic
   * based on their specific rendering requirements.
   */
  protected abstract buildVertexShader();

  /**
   * Abstract method to build the fragment shader source code.
   * Subclasses must implement this method to define the fragment shader logic
   * based on their specific rendering requirements.
   */
  protected abstract buildFragmentShader();

  /**
   * Inserts a line of custom vertex shader code into the generated vertex shader source.
   */
  protected vsCode(src) {
    this._vertSrcBuf.push(src);
  }

  /**
   * Generates the vertex shader header.
   */
  protected vsHeader() {
    this._vertSrcBuf
      .push(
        '#version 300 es',
        `// ${this.constructor.name} vertex shader`);
  }

  /**
   * Generates a simple internal vertex shader main function.
   */
  protected vsDebugMain() {
    this._vertSrcBuf.push(
      `void main(void) {
        vec2 p;
        if (gl_VertexID % 3 == 0)      p = vec2(-0.5, -0.5);
        else if (gl_VertexID % 3 == 1) p = vec2( 0.5, -0.5);
        else                           p = vec2( 0.0,  0.5);
        gl_Position = vec4(p, 0.0, 1.0);
        vColor      = vec4(1.0, 0.3, 0.1, 1.0);
        vViewPos    = vec4(0.0);
}`);
  }

  /**
   * Generates vertex shader precision definitions and common definitions.
   */
  protected vsCommonDefines() {
    this._vertSrcBuf.push(
      `uniform int uRenderPass;
uniform int uPrimBaseIndex;
uniform int uPrimitiveType;

uniform mat4 uProjMatrix;

uniform highp usampler2D uPrimitiveMeshIndexTexture;
uniform highp usampler2D uVertexPositionTexture;
uniform highp usampler2D uVertexColorTexture;
uniform highp usampler2D uIndexTexture;
uniform highp usampler2D uEdgeIndextexture;
uniform highp sampler2D  uViewTileCameraMatrixTexture;
uniform highp sampler2D  uMeshMatrixTexture;
uniform highp usampler2D uMeshAttributeTexture;
uniform highp usampler2D uMeshViewAttributeTexture;
uniform highp usampler2D uGeometryAttributeTexture;
uniform highp sampler2D  uGeometryQuantRangeTexture;

struct QuantRange {
  vec3 offset;
  vec3 scale;
};

struct MeshAttribTable {
  uint tileIndex;
  uint geometryIndex;
};

struct MeshViewAttributes {
  uvec4 color;
  uvec4 renderFlags;
};

struct GeometryAttributes {
  uint verticesBase;
  uint indicesBase;
  uint edgeIndicesBase;
};

ivec2 texCoord(uint index, uint texWidth) {
  return ivec2(int(index % texWidth), int(index / texWidth));
}

uint getPrimitiveMeshIndex(uint primIndex) {
  const uint texWidth = 4096u;
  return texelFetch(uPrimitiveMeshIndexTexture, texCoord(primIndex * 2u, texWidth), 0).r;
}

uint getPrimitiveOffsetWithinGeometry(uint primIndex) {
  const uint texWidth = 4096u;
  return texelFetch(uPrimitiveMeshIndexTexture, texCoord((primIndex * 2u) + 1u, texWidth), 0).r;
}

uint getVertexIndex(uint vertexIndexNum) {
  const uint texWidth = 4096u;
  return texelFetch(uIndexTexture, texCoord(vertexIndexNum, texWidth), 0).r;
}

uvec3 getVertexPosition(uint vertexIndexWithinGeometry) {
  const uint texWidth = 4096u;
  return texelFetch(uVertexPositionTexture, texCoord(vertexIndexWithinGeometry, texWidth), 0).rgb;
}

uvec3 getVertexColor(uint vertexIndexWithinGeometry) {
  const uint texWidth = 4096u;
  return texelFetch(uVertexColorTexture, texCoord(vertexIndexWithinGeometry, texWidth), 0).rgb;
}

QuantRange getGeometryQuantRange(uint geometryIndex) {
  const uint texWidth = 2048u;
  const uint texelsPerItem = 2u;
  uint base = geometryIndex * texelsPerItem;
  vec4 texel0 = texelFetch(uGeometryQuantRangeTexture, texCoord(base + 0u, texWidth), 0);
  vec4 texel1 = texelFetch(uGeometryQuantRangeTexture, texCoord(base + 1u, texWidth), 0);
  QuantRange r;
  r.offset = texel0.rgb;
  r.scale  = texel1.rgb;
  return r;
}

GeometryAttributes getGeometryAttributeTexture(uint geometryIndex) {
  const uint texWidth = 4096u;
  uvec4 texel = texelFetch(uGeometryAttributeTexture, texCoord((geometryIndex), texWidth), 0);
  GeometryAttributes s;
  s.verticesBase    = texel.r;
  s.indicesBase     = texel.g;
  s.edgeIndicesBase = texel.b;
  return s;
}

MeshAttribTable getMeshAttribTable(uint meshIndex) {
  const uint texWidth = 4096u;
  uvec4 texel = texelFetch(uMeshAttributeTexture, texCoord((meshIndex), texWidth), 0);
  MeshAttribTable s;
  s.tileIndex      = texel.r;
  s.geometryIndex  = texel.g;
  return s;
}

MeshViewAttributes getMeshViewAttributes(uint meshIndex) {
  const uint texWidth = 4096u;
  uint base = meshIndex * 2u;
  MeshViewAttributes s;
  s.color       = texelFetch(uMeshViewAttributeTexture, texCoord(base + 0u, texWidth), 0);
  s.renderFlags = texelFetch(uMeshViewAttributeTexture, texCoord(base + 1u, texWidth), 0);
  return s;
}

mat4 getTileViewMatrix(uint tileIndex) {
  const uint texWidth = 4096u;
  uint base = tileIndex * 4u;
  vec4 m0 = texelFetch(uViewTileCameraMatrixTexture, texCoord(base + 0u, texWidth), 0);
  vec4 m1 = texelFetch(uViewTileCameraMatrixTexture, texCoord(base + 1u, texWidth), 0);
  vec4 m2 = texelFetch(uViewTileCameraMatrixTexture, texCoord(base + 2u, texWidth), 0);
  vec4 m3 = texelFetch(uViewTileCameraMatrixTexture, texCoord(base + 3u, texWidth), 0);
  return mat4(m0, m1, m2, m3);
}

mat4 getMeshMatrix(uint meshIndex) {
  const uint texWidth = 4096u;
  uint base = meshIndex * 4u;
  vec4 m0 = texelFetch(uMeshMatrixTexture, texCoord(base + 0u, texWidth), 0);
  vec4 m1 = texelFetch(uMeshMatrixTexture, texCoord(base + 1u, texWidth), 0);
  vec4 m2 = texelFetch(uMeshMatrixTexture, texCoord(base + 2u, texWidth), 0);
  vec4 m3 = texelFetch(uMeshMatrixTexture, texCoord(base + 3u, texWidth), 0);
  return mat4(m0, m1, m2, m3);
}

// Packs a uint into an RGBA color (each channel stores one byte).
// Little-endian byte order: R = least significant byte
vec4 packUintToRGBA8(uint v) {
   return vec4(
     float( ( v        & 0xFFu)),
     float( ((v >> 8u) & 0xFFu)),
     float(((v >> 16u) & 0xFFu)),
     float(((v >> 24u) & 0xFFu))
   ) / 255.0;
}
`);
  }

  /**
   * Generates vertex shader definitions for Lambert shading.
   * @protected
   */
  protected vsLambertShadingDefines() {
    this._vertSrcBuf.push(
      "uniform vec4 uLightAmbient;",
      "uniform vec3 uLightDir1;",
      "uniform vec4 uLightColor1;",
      "uniform vec3 uLightDir2;",
      "uniform vec4 uLightColor2;",
      "uniform vec3 uLightDir3;",
      "uniform vec4 uLightColor3;",
      "out vec4 vColor;",
      "out vec4 vViewPos;");
  }

  /**
   * Generates vertex shader definitions for silhouette rendering.
   * @protected
   */
  protected vsSilhouetteDefines() {
    this._vertSrcBuf.push(
      "uniform vec4 uSilhouetteColor;",
      "out vec4 vColor;");
  }

  /**
   * Generates vertex shader definitions for flat color rendering.
   * @protected
   */
  protected vsDrawFlatColorDefs() {
    this._vertSrcBuf.push("out vec4 vColor;");
  }

  /**
   * Generates vertex shader definitions for vertex color rendering.
   * @protected
   */
  protected vsDrawVertexColorDefs() {
    this._vertSrcBuf.push("out vec4 vColor;");
  }

  /**
   * Generates vertex shader definitions for depth rendering.
   * @protected
   */
  protected vsDrawDepthDefines() {
    this._vertSrcBuf.push("out highp vec2 vHighPrecisionZW;");
  }

  protected vsPointsDefines(): void {
    this._vertSrcBuf.push(
      "uniform float nearPlaneHeight;",
      "uniform vec2 intensityRange;",
      "uniform float pointSize;");
  }

  /**
   * Generates vertex shader definitions for pick rendering.
   * @protected
   */
  protected vsPickMeshDefines() {
    this._vertSrcBuf.push(
      "out     vec4 vPickColor;",
      "uniform vec2 drawingBufferSize;",
      "uniform vec2 pickClipPos;",
      "vec4 remapPickClipPos(vec4 clipPos) {",
      "    clipPos.xy /= clipPos.w;",
      //if (viewportSize === 1) {
      "    clipPos.xy = (clipPos.xy - pickClipPos) * drawingBufferSize;",
      // } else {
      //     src.push(`    clipPos.xy = (clipPos.xy - pickClipPos) * (drawingBufferSize / float(${viewportSize}));`);
      // }
      "    clipPos.xy *= clipPos.w;",
      "    return clipPos;",
      "}");
  }

  /**
   * Generates vertex shader definitions for slicing (section planes).
   * @protected
   */
  protected vsSlicingDefines() {
    // if (this._renderContext.view.getNumAllocatedSectionPlanes() > 0) {
    //   const src = this._vertSrcBuf;
    //   src.push("out vec4 vWorldPosition;");
    //   src.push("out boolean vClippable;");
    // }
  }

  /**
   * Generates the opening of the vertex shader main function.
   * @protected
   */
  protected vsMainOpen() { // default
    this._vertSrcBuf.push("void main(void) {");
    this._vsMeshLogic();
    this._vsMeshLogic2();
  }

  /**
   * Generates the opening of the vertex shader main function for draw rendering.
   * @protected
   */
  protected vsDrawMainOpen() { // default
    this._vertSrcBuf.push("void main(void) {");
    this._vsMeshLogic();
    this._vsMeshLogic2();
  }

  /**
   * Generates the opening of the vertex shader main function for pick rendering.
   * @protected
   */
  protected vsPickMainOpen() { // pick
    this._vertSrcBuf.push("void main(void) {");
    this._vsMeshLogic();
    this._vertSrcBuf.push(
      `    int pickFlag = int(meshViewAttributes.renderFlags.b >> 8u & 0xFu);`,
      `    if (pickFlag != uRenderPass) {`,
      "        gl_Position = vec4(2.0, 0.0, 0.0, 1.0);",
      "        return;",
      "    }");
    this._vsMeshLogic2();
  }

  /**
   * Generates the closing of the vertex shader main function.
   * @protected
   */
  protected vsMainClose() { // default, silhouette, pick
    this._vertSrcBuf.push(
      "}");
  }

  /**
   * Generates vertex shader logic for slicing (section planes).
   * @protected
   */
  protected vsSlicingLogic() {
    // if (this._renderContext.view.getNumAllocatedSectionPlanes() > 0) {
    //   const src = this._vertSrcBuf;
    //   src.push("      vWorldPosition = worldPos;");
    //   src.push("      vClippable = (int(uMeshViewAttributeTexture.renderFlags) >> 12 & 0xF) == 1;");
    // }
  }

  /**
   * Generates vertex shader logic for mesh processing.
   * @private
   */
  private _vsMeshLogic() { // before renderPass check
    this._vertSrcBuf.push(
      "    uint drawVertexIndex  = uint(gl_VertexID);",
      "    uint numVertsPerPrim  = uint(uPrimitiveType == " + TrianglesPrimitive + " ? 3u : (uPrimitiveType == " + LinesPrimitive + " ? 2u : 1u));",

      // We are drawing a portion of the primitive array, so adjust the primIndex accordingly

      "    uint drawPrimIndex   = drawVertexIndex / numVertsPerPrim;",
      "    uint primIndex       = uint(uPrimBaseIndex) + drawPrimIndex;",

      // Lookup the mesh and primitive offset for this primitive
      // The primitive offset is the index of the primitive within the mesh's geometry

      "    uint meshIndex       = getPrimitiveMeshIndex( primIndex );",

      "    MeshViewAttributes meshViewAttributes = getMeshViewAttributes( meshIndex );",

      `    if (meshViewAttributes.color.a == 3u) {`,
      // "              gl_Position = vec4(3.0, 3.0, 3.0, 1.0);", // Cull vertex
      // "              return;",
      "    };",

      "    uint primOffset      = getPrimitiveOffsetWithinGeometry( primIndex );"
    );
  }

  /**
   * Generates vertex shader logic for mesh processing (part 2).
   * @private
   */
  private _vsMeshLogic2() { // after renderPass check
    this._vertSrcBuf.push(
      "    MeshAttribTable  meshAttributeTexture       = getMeshAttribTable( meshIndex );",

      "    uint             tileIndex         = meshAttributeTexture.tileIndex;",
      "    uint             geometryIndex     = meshAttributeTexture.geometryIndex;",

      "    GeometryAttributes  geometryAttributes   = getGeometryAttributeTexture( geometryIndex );",

      "    uint localVert = drawVertexIndex % numVertsPerPrim;", // 0, 1, 2 for triangle; 0, 1 for line; 0 for point
      "    uint vertexOffsetWithinGeometry = (primOffset * numVertsPerPrim) + localVert;",

      "    uint vertexIndexWithinGeometry = (uPrimitiveType == 20000)", // Points
      "       ? vertexOffsetWithinGeometry",
      "       : getVertexIndex(geometryAttributes.indicesBase + vertexOffsetWithinGeometry);",

      "    QuantRange       quantRange        = getGeometryQuantRange( geometryIndex );",

      "    mat4             modelMatrix       = getMeshMatrix( meshIndex );",
      "    mat4             viewMatrix        = getTileViewMatrix( tileIndex );",

      "    uvec3            quantPos          = getVertexPosition( geometryAttributes.verticesBase + vertexIndexWithinGeometry );",
      "    vec4             modelPos          = vec4( quantRange.offset + ( quantRange.scale * vec3( quantPos )), 1.0); ",
      "    vec4             worldPos          = modelMatrix * modelPos; ",
      "    vec4             viewPos           = viewMatrix * worldPos; ",
      "    vec4             clipPos           = uProjMatrix * viewPos; ",

      "    gl_Position = clipPos;"
    );
  }

  /**
   * Generates vertex shader logic for Lambert shading.
   * @protected
   */
  protected vsLambertShadingLogic() {
    this._vertSrcBuf.push(

      // For triangles, get the three vertex positions for the triangle

      "    uint triIndex = geometryAttributes.indicesBase + primOffset * numVertsPerPrim;",

      "    uint ia = getVertexIndex(triIndex + 0u);",
      "    uint ib = getVertexIndex(triIndex + 1u);",
      "    uint ic = getVertexIndex(triIndex + 2u);",

      // Dequantized positions in OBJECT space

      // "    vec3 a_obj = quantRange.offset + quantRange.scale * vec3(getVertexPosition(ia));",
      // "    vec3 b_obj = quantRange.offset + quantRange.scale * vec3(getVertexPosition(ib));",
      // "    vec3 c_obj = quantRange.offset + quantRange.scale * vec3(getVertexPosition(ic));",

      // Transform to WORLD space

      // "    vec3 pa_w = (modelMatrix * vec4(a_obj, 1.0)).xyz;",
      // "    vec3 pb_w = (modelMatrix * vec4(b_obj, 1.0)).xyz;",
      // "    vec3 pc_w = (modelMatrix * vec4(c_obj, 1.0)).xyz;",

      "    vec3 pa = vec4(viewMatrix * (modelMatrix * vec4( quantRange.offset + (quantRange.scale * vec3(getVertexPosition(ia))), 1.0))).xyz;",
      "    vec3 pb = vec4(viewMatrix * (modelMatrix * vec4( quantRange.offset + (quantRange.scale * vec3(getVertexPosition(ib))), 1.0))).xyz;",
      "    vec3 pc = vec4(viewMatrix * (modelMatrix * vec4( quantRange.offset + (quantRange.scale * vec3(getVertexPosition(ic))), 1.0))).xyz;",

      "    vec3 normal = normalize(cross(pc - pa, pb - pa));",

      "    float lambertian = 1.0;",
      "    vec3 reflectedColor = vec3(0.0, 0.0, 0.0);",

      " vec4 lightAmbient = vec4(0.3, 0.3, 0.3, 1.0);",
      " vec3 lightDir1 = normalize(vec3(0.0, 0.0, -1.0));",
      " vec4 lightColor1 = vec4(0.7, 0.7, 0.7, 1.0);",
      " vec3 lightDir2 = normalize(vec3(-1.0, -1.0, -1.0));",
      " vec4 lightColor2 = vec4(1.0, 1.0, 1.0, 0.5);",
      " vec3 lightDir3 = normalize(vec3(-1.0, 1.0, 1.0));",
      " vec4 lightColor3 = vec4(1.0, 1.0, 1.0, 0.2);",

      // "    lambertian = max(dot(normal, normalize(lightDir1)), 0.0);",
      // "    reflectedColor += lambertian * (lightColor1.rgb * lightColor1.a);",

      "    lambertian = max( dot(normal, normalize(lightDir2)), 0.0);",
      "   if (lambertian < 0.0) lambertian = lambertian * -1.0;",
      "    reflectedColor += lambertian * (lightColor2.rgb * lightColor2.a);",
      //
      // "    lambertian = max(dot(normal, normalize(lightDir3)), 0.0);",
      // "    reflectedColor += lambertian * (lightColor3.rgb * lightColor3.a);",

      "    vec4 color = vec4(meshViewAttributes.color) /255.0;",

     "   vColor =  vec4((lightAmbient.rgb * lightAmbient.a * color.rgb) + (reflectedColor * color.rgb), 1.0);",

    //  "    vColor = vec4(color.rgb, 1.0);");
     );
  }

  /**
   * Generates vertex shader logic for silhouette rendering.
   * @protected
   */
  protected vsSilhouetteLogic() {
    this._vertSrcBuf.push(
      //  "    vColor = vec4(uSilhouetteColor.r, uSilhouetteColor.g, uSilhouetteColor.b, 0.5);"
      "    vColor = vec4(1.0, 1.0, 0.0, 1.0);"
    );
  }

  /**
   * Generates vertex shader logic for flat color rendering.
   * @protected
   */
  protected vsDrawFlatColorLogic() {
    this._vertSrcBuf.push(
      // "    vec4 color = vec4(meshViewAttributes.color) / 255.0;",
      // "    vColor = vec4(color.rgb, 1.0);"

      "    vColor = vec4(1.0, 1.0, 0.0, 1.0);"
    );
  }

  /**
   * Generates vertex shader logic for vertex color rendering.
   * @protected
   */
  protected vsDrawVertexColorLogic() {
    this._vertSrcBuf.push(
      "    uvec3 color = getVertexColor(vertexIndexWithinGeometry);",
      "    vColor = vec4( float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);"
    );
  }

  /**
   * Generates vertex shader logic for depth rendering.
   * @protected
   */
  protected vsDrawDepthLogic() {
    this._vertSrcBuf.push(
      "    vHighPrecisionZW = gl_Position.zw;"
    );
  }

  /**
   * Generates a mock vertex shader for testing.
   * @protected
   */
  protected vsDrawMock() {
    this._vertSrcBuf.push(`#version 300 es
precision highp float;
out vec4 vColor;
void main() {
    vec2 p = (gl_VertexID == 0) ? vec2(-1.0, -1.0)
           : (gl_VertexID == 1) ? vec2( 3.0, -1.0)
                                : vec2(-1.0,  3.0);
    gl_Position = vec4(p, 0.0, 1.0);
    vColor = vec4(1.0, 0.0, 1.0, 1.0);
}`);
  }

  /**
   * Generates a second mock vertex shader for testing.
   * This time, the uProjMatrix is used.
   * @protected
   */
  protected vsDrawMock2() {
    this._vertSrcBuf.push(`#version 300 es
precision highp float;
uniform mat4 uProjMatrix;
out vec4 vColor;

vec3 mockModelPos(int vid) {
    int i = vid % 3;
    if (i == 0) return vec3(-0.5, -0.5, -0.95);
    if (i == 1) return vec3( 0.5, -0.5, -0.95);
    return        vec3( 0.0,  0.5, -0.95);
}

void main() {
    vec4 viewPos = vec4(mockModelPos(gl_VertexID), 1.0);
    gl_Position = uProjMatrix * viewPos;
    vColor = vec4(0.0, 1.0, 1.0, 1.0);
}
`);
  }

  /**
   * Generates a third mock vertex shader for testing.
   * This time, the uVertexPositionTexture is tested.
   * @protected
   */
  protected vsDrawMock3() {
    this._vertSrcBuf.push(`#version 300 es
precision highp float;
precision highp usampler2D;

uniform highp usampler2D uVertexPositionTexture;
out vec4 vColor;

ivec2 texCoord(uint index, uint texWidth) {
    return ivec2(int(index % texWidth), int(index / texWidth));
}

uvec3 getVertexPosition(uint vertexIndexWithinGeometry) {
    const uint texWidth = 4096u;
    return texelFetch(uVertexPositionTexture, texCoord(vertexIndexWithinGeometry, texWidth), 0).rgb;
}

void main() {
    uvec3 q = getVertexPosition(uint(gl_VertexID));
   vec3 p = (vec3(q) / 1024.0) * 2.0 - 1.0;
    gl_Position = vec4(p.xy, 0.0, 1.0);
    vColor = vec4(fract(vec3(q) / 255.0), 1.0);
}
`);
  }

  /**
   * Generates a mock fragment shader for testing.
   * @protected
   */
  protected fsDrawMock() {
    this._fragSrcBuf.push("#version 300 es",
"precision highp float;",
"in vec4 vColor;",
"out vec4 outColor;",
"void main() {",
"    outColor = vColor;",
"}");
  }

  /**
   * Generates vertex shader logic for pick rendering.
   * @protected
   */
  protected vsPickMeshLogic() {
    this._vertSrcBuf.push("    vPickColor = packUintToRGBA8(meshIndex);");
  }


  /**
   * Generates vertex shader logic for point size and intensity filtering.
   * @protected
   */
  protected vsPointsFilterLogicOpenBlock() {
    // const src = this._vertSrcBuf;
    // const pointsMaterial = this._renderContext.view.pointsMaterial;
    // if (pointsMaterial.filterIntensity) {
    //   src.push("float intensity = float(color.a) / 255.0;")
    //   src.push("if (intensity < intensityRange[0] || intensity > intensityRange[1]) {");
    //   src.push("   gl_Position = vec4(2.0, 0.0, 0.0, 0.0);");
    //   src.push("} else {");
    // }
  }

  /**
   * Generates vertex shader logic for point size and intensity filtering.
   * @protected
   */
  protected vsPointsFilterLogicCloseBlock() {
    // const pointsMaterial = this._renderContext.view.pointsMaterial;
    // if (pointsMaterial.filterIntensity) {
    //   this._vertSrcBuf.push("}");
    // }
  }

  /**
   * Generates vertex shader logic for point size calculation.
   * @protected
   */
  protected vsPointsGeometryLogic() {
    const src = this._vertSrcBuf;
    const pointsMaterial = this._renderContext.activeView.pointsMaterial;
    // if (pointsMaterial.perspectivePoints) {
    //     src.push("gl_PointSize = (nearPlaneHeight * pointSize) / clipPos.w;");
    //     src.push("gl_PointSize = max(gl_PointSize, " + Math.floor(pointsMaterial.minPerspectivePointSize) + ".0);");
    //     src.push("gl_PointSize = min(gl_PointSize, " + Math.floor(pointsMaterial.maxPerspectivePointSize) + ".0);");
    // } else {
    src.push("gl_PointSize = pointSize;");
    //       }
  }

  /**
   * Inserts a line of custom vertex shader code into the generated vertex shader source.
   */
  protected fragmentCode(src) {
    this._fragSrcBuf.push(src);
  }

  /**
   * Generates the fragment shader header.
   * @protected
   */
  protected fsHeader() {
    this._fragSrcBuf.push(
      '#version 300 es',
      `// ${this.constructor.name} fragment shader`);
  }

  /**
   * Generates fragment shader precision definitions.
   * @protected
   */
  protected fsPrecisionDefines() {
    this._fragSrcBuf.push(
      "#ifdef GL_FRAGMENT_PRECISION_HIGH",
      "precision highp float;",
      "precision highp int;",
      "precision highp usampler2D;",
      "precision highp isampler2D;",
      "precision highp sampler2D;",
      "#else",
      "precision mediump float;",
      "precision mediump int;",
      "precision mediump usampler2D;",
      "precision mediump isampler2D;",
      "precision mediump sampler2D;",
      "#endif");
  }

  /**
   * Generates fragment shader common definitions.
   * @protected
   */
  protected fsCommonDefines() {
    this._fragSrcBuf.push(
      "vec4 color;",
      "out vec4 outColor;");
  }

  /**
   * Generates fragment shader defines for silhouette rendering.
   * @protected
   */
  protected fsSilhouetteDefines() {
    this._fragSrcBuf.push("in vec4 vColor;");
  }

  /**
   * Generates fragment shader logic for silhouette rendering.
   * @protected
   */
  protected fsSilhouetteLogic() {
    this._fragSrcBuf.push("color = vColor;");
  }

  /**
   * Generates fragment shader defines for flat-shaded color rendering.
   * @protected
   */
  protected fsDrawFlatColorDefines() {
    this._fragSrcBuf.push("in vec4 vColor;");
  }

  /**
   * Generates fragment shader logic for flat-shaded color rendering.
   * @protected
   */
  protected fsDrawFlatColorLogic() {
    this._fragSrcBuf.push("color = vColor;");
  }

  /**
   * Generates fragment shader defines for Lambert shading.
   * @protected
   */
  protected fsLambertShadingDefines() {
    const src = this._fragSrcBuf;
    const view = this._renderContext.activeView;
    src.push(
      "in vec4 vColor;",
      "in vec4 vViewPos;");
  }

  /**
   * Generates fragment shader logic for Lambert shading.
   * @protected
   */
  protected fsLambertShadingLogic() {
    this._fragSrcBuf.push("color = vColor;");
  }

  /**
   * Generates fragment shader defines for depth rendering.
   * @protected
   */
  protected fsDrawDepthDefines() {
    this._fragSrcBuf.push("in vec2 vHighPrecisionZW;");
  }

  /**
   * Generates fragment shader logic for depth rendering.
   * @protected
   */
  protected fsDrawDepthLogic() {
    this._fragSrcBuf.push(
      "    float depthFragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;",
      "    color = vec4(vec3(1.0 - depthFragCoordZ), 1.0); ");
  }

  /**
   * Generates fragment shader defines for screen-space ambient occlusion (SAO).
   * @protected
   */
  protected fsDrawSAODefs() {
    this._fragSrcBuf.push(
      "uniform sampler2D saoOcclusionTexture;",
      "uniform vec4      saoParams;",
      "const float       saoUnpackDownScale = 255. / 256.;",
      "const vec3        saoPackFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );",
      "const vec4        saoUnpackFactors = saoUnpackDownScale / vec4( saoPackFactors, 1. );",
      "float saoUnpackRGBToFloat( const in vec4 v ) {",
      "    return dot( v, saoUnpackFactors );",
      "}");
  }

  /**
   * Generates fragment shader logic for screen-space ambient occlusion (SAO).
   * @protected
   */
  protected fsDrawSAOLogic() {
    this._fragSrcBuf.push(
      "   float saoViewportWidth = saoParams[0];",
      "   float saoViewportHeight = saoParams[1];",
      "   float saoBlendCutoff = saoParams[2];",
      "   float saoBlendFactor = saoParams[3];",
      "   vec2  saoUV = vec2(gl_FragCoord.x / saoViewportWidth, gl_FragCoord.y / saoViewportHeight);",
      "   float saoAmbient = smoothstep(saoBlendCutoff, 1.0, saoUnpackRGBToFloat(texture(saoOcclusionTexture, saoUV))) * saoBlendFactor;",
      "   color = vec4(color.rgb * saoAmbient, 1.0);");
  }

  /**
   * Generates fragment shader defines for pick rendering.
   * @protected
   */
  protected fsPickMeshDefines() {
    this._fragSrcBuf.push("in vec4 vPickColor;");
  }

  /**
   * Generates fragment shader logic for pick rendering.
   * @protected
   */
  protected fsPickMeshLogic() {
    this._fragSrcBuf.push("color = vPickColor;");
  }

  /**
   * Generates fragment shader defines for slicing (section planes).
   * @protected
   */
  protected fsSlicingDefines() {
    // const numSectionPlanes = this._renderContext.view.getNumAllocatedSectionPlanes();
    // if (numSectionPlanes === 0) {
    //   return;
    // }
    // const src = this._fragSrcBuf;
    // src.push("in vec4 vWorldPosition;");
    // src.push("in boolean vClippable;");
    // for (let i = 0; i < numSectionPlanes; i++) {
    //   src.push("uniform bool sectionPlaneActive" + i + ";");
    //   src.push("uniform vec3 sectionPlanePos" + i + ";");
    //   src.push("uniform vec3 sectionPlaneDir" + i + ";");
    // }
  }

  /**
   * Generates fragment shader logic for slicing (section planes).
   * @protected
   */
  protected fsSlicingLogic() {
    // const numSectionPlanes = this._renderContext.view.getNumAllocatedSectionPlanes();
    // if (numSectionPlanes === 0) {
    //   return;
    // }
    // const src = this._fragSrcBuf;
    // src.push("  if (vClippable) {");
    // src.push("    float dist = 0.0;");
    // for (let i = 0; i < numSectionPlanes; i++) {
    //   src.push("    if (sectionPlaneActive" + i + ") {");
    //   src.push("      dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
    //   src.push("    }");
    // }
    // src.push("    if (dist > 0.0) { discard; }");
    // src.push("  }");
  }

  /**
   * Generates the opening of the fragment shader main function.
   * @protected
   */
  protected fsMainOpen() {
    this._fragSrcBuf.push("void main(void) {");
  }


  /**
   * Generates the closing of the fragment shader main function.
   * @protected
   */
  protected fsMainClose() {
    this._fragSrcBuf.push("}");
  }

  /**
   * Generates fragment shader logic for point rendering.
   * @protected
   */
  protected fsPointsGeometryLogic(): void {
    //if (this._renderContext.view.pointsMaterial.roundPoints) {
    // const src = this._fragSrcBuf;
    // src.push("  vec2 cxy = 2.0 * gl_PointCoord - 1.0;");
    // src.push("  float r = dot(cxy, cxy);");
    // src.push("  if (r > 1.0) {");
    // src.push("       discard;");
    // src.push("  }");
    //   }
  }

  /**
   * Generates fragment shader logic for common output.
   * @protected
   */
  protected fsCommonOutput() {
    this._fragSrcBuf.push("outColor = color;");
  }

  /**
   * Binds the shader program and sets up the necessary uniforms and textures for rendering.
   * @param renderPass The draw pass identifier, which determines the rendering context (e.g., solid fill, silhouette, picking).
   * @private
   */
  private _bind(renderPass: RenderPassValue): boolean {

    const view = this._renderContext.activeView;
    const gl = this._renderContext.gl;
    const uniforms = this._uniforms;
    const renderContext = this._renderContext;
    const program = this._program;

    if (!program) {
      renderContext.lastProgramId = -1;
      return false;
    }

    if (renderContext.lastProgramId === program.id) {
      return true; // Already bound
    }

    program.bind();

    renderContext.lastProgramId = program.id;
    renderContext.textureUnit = 0;

    if (uniforms.renderPass) {
      gl.uniform1i(uniforms.renderPass, renderPass);
    }

    if (uniforms.projMatrix) {
      gl.uniformMatrix4fv(uniforms.projMatrix, false, <any>(renderPass === RENDER_PASSES.PICK
        ? renderContext.pickProjMatrix
        : view.camera.projMatrix));
    }

    if (uniforms.pointSize) {
      gl.uniform1f(uniforms.pointSize, view.pointsMaterial.pointSize);
    }

    if (uniforms.nearPlaneHeight) {
      gl.uniform1f(uniforms.nearPlaneHeight, (view.camera.projectionType === OrthoProjectionType) ? 1.0 : (gl.drawingBufferHeight / (2 * Math.tan(0.5 * view.camera.perspectiveProjection.fov * Math.PI / 180.0))));
    }

    if (uniforms.pickZNear) {
      gl.uniform1f(uniforms.pickZNear, renderContext.pickZNear);
      gl.uniform1f(uniforms.pickZFar, renderContext.pickZFar);
    }

    if (uniforms.drawingBufferSize) {
      gl.uniform2f(uniforms.drawingBufferSize, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    if (uniforms.pickClipPos) {
      gl.uniform2fv(uniforms.pickClipPos, <any>renderContext.pickClipPos);
    }

    if (uniforms.lightAmbient) {
      gl.uniform4fv(uniforms.lightAmbient, <any>view.getAmbientColorAndIntensity());
    }

    // for (let i = 0, len = view.lightsList.length; i < len; i++) {
    //   const light = view.lightsList[i];
    //   if (uniforms.lightColor[i]) {
    //     gl.uniform4f(uniforms.lightColor[i], light.color[0], light.color[1], light.color[2], light.intensity);
    //   }
    //   if (uniforms.lightPos[i]) {
    //     const pointLight = <PointLight>light;
    //     gl.uniform3fv(uniforms.lightPos[i], <any>pointLight.pos);
    //   }
    //   if (uniforms.lightDir[i]) {
    //     const dirLight = <DirLight>light;
    //     gl.uniform3fv(uniforms.lightDir[i], <any>dirLight.dir);
    //   }
    // }

    if (uniforms.silhouetteColor) {
      if (this.edges) {
        if (renderPass === RENDER_PASSES.XRAYED) {
          const material = view.xrayMaterial;
          const color = material.edgeColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        } else if (renderPass === RENDER_PASSES.HIGHLIGHTED) {
          const material = view.highlightMaterial;
          const color = material.edgeColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        } else if (renderPass === RENDER_PASSES.SELECTED) {
          const material = view.selectedMaterial;
          const color = material.edgeColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        } else {
          gl.uniform4fv(uniforms.silhouetteColor, defaultColor);
        }
      } else {
        if (renderPass === RENDER_PASSES.XRAYED) {
          const material = view.xrayMaterial;
          const color = material.fillColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
        } else if (renderPass === RENDER_PASSES.HIGHLIGHTED) {
          const material = view.highlightMaterial;
          const color = material.fillColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
        } else if (renderPass === RENDER_PASSES.SELECTED) {
          const material = view.selectedMaterial;
          const color = material.fillColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
        } else {
          gl.uniform4fv(uniforms.silhouetteColor, defaultColor);
        }
      }
    }

    const sao = view.sao;
    const saoEnabled = sao.possible;
    if (saoEnabled) {
      // if (uniforms.saoParams) {
      //   gl.uniform4f(uniforms.saoParams, gl.drawingBufferWidth, gl.drawingBufferHeight, sao.blendCutoff, sao.blendFactor);
      //   program.bindTexture(
      //     this._samplers.saoOcclusionTexture,
      //     renderContext.saoOcclusionTexture,
      //     renderContext.textureUnit);
      //   renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
      // }
    }
    return true;
  }

  /**
   * Destroys the shader program and cleans up resources.
   */
  destroy() {
    if (this._program) {
      this._program.destroy();
    }
    this._program = null;
  }


}


function joinSansComments(srcLines) {
  const src = [];
  let line;
  let n;
  for (let i = 0, len = srcLines.length; i < len; i++) {
    line = srcLines[i];
    n = line.indexOf("/");
    if (n > 0) {
      if (line.charAt(n + 1) === "/") {
        line = line.substring(0, n);
      }
    }
    src.push(line);
  }
  return src.join("\n");
}
