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
 * and would typically use inspectors methods like {@link vsCode}, {@link vsHeader},
 * and {@link vsCommonDefines}, provided by the base class, to construct the shader source
 * (i.e. Template Method / Template Base Class pattern).
 *
 * Note: Lambert shading now computes the face normal in the fragment shader from
 * `dFdx/dFdy(vViewPos)` instead of reconstructing the full triangle in the vertex shader.
 * This preserves the template-method API used by concrete techniques such as
 * `TrianglesDrawColorTechnique` while removing the expensive per-vertex triangle refetch.
 *
 * @internal
 */

export abstract class DrawTechnique {

  /**
   * Number of vertices per primitive: 3 for triangles, 2 for lines, 1 for points.
   * Emitted as a compile-time constant into the vertex shader.
   */
  protected abstract readonly vertsPerPrim: number;

  /**
   * When false, vertex positions are addressed directly (no index-buffer lookup).
   * Override to false in point-cloud techniques.
   */
  protected readonly useIndexBuffer: boolean = true;

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
   * When true, the technique binds uniforms for picking rendering (e.g., pickZNear/pickZFar)
   * and uses picking-specific draw ranges from the batch's view data textures.
   *
   * Used by the pick rendering pass to render meshes with unique pick colors and output depth for picking.
   */
  public picking: boolean;

  /**
   * Vertex shader source code. Available after `init()` is called.
   */
  public vertexShaderSrc: string;

  /**
   * Vertex shader source code with comments included.
   *
   * Note that comments are not supported in WebGL shader compilation,
   * so this is for debugging/inspection purposes only.
   *
   * Available after `init()` is called.
   */
  public vertexShaderCommentedSrc: string;

  /**
   * Fragment shader source code. Available after `init()` is called.
   */
  public fragmentShaderSrc: string;

  /**
   * Fragment shader source code with comments included.
   *
   * Note that comments are not supported in WebGL shader compilation,
   * so this is for debugging/inspection purposes only.
   *
   * Available after `init()` is called.
   */
  public fragmentShaderCommentedSrc: string;

  /**
   * Uniforms and attributes for the shader program.
   * Populated during the `build()` method based on what's included in the shader source.
   */
  private _uniforms: {
    renderPass: WebGLUniformLocation; // Current draw pass (e.g., color, pick, silhouette)
    primBaseIndex: WebGLUniformLocation; // Base tileIndex for the current draw call
    pointCloudIntensityRange: WebGLUniformLocation; // Intensity range for point cloud rendering
    nearPlaneHeight: WebGLUniformLocation; // Near plane height for perspective point size calculation
    silhouetteColor: WebGLUniformLocation; // Color used for silhouette rendering
    gammaFactor: WebGLUniformLocation; // Gamma correction factor
    pickZNear: WebGLUniformLocation; // Near plane for pick rendering
    batchIndex: WebGLUniformLocation; // Batch index for pick rendering
    snapCameraEyeRTC: WebGLUniformLocation; // Snapped camera eye position in RTC space
    perspectivePoints: WebGLUniformLocation; // Whether to use perspective point size
    perspectivePointsMinMax: WebGLUniformLocation; // Min/max point size for perspective points
    roundPoints: WebGLUniformLocation; // Whether to render round points (vs. square)
    pointSize: WebGLUniformLocation; // Size of points for point rendering
    intensityRange: WebGLUniformLocation; // Intensity range for point rendering
    pickZFar: WebGLUniformLocation; // Far plane for rendering pick depth
    pickClipPos: WebGLUniformLocation; // Clip-space position for pick rendering (used to reconstruct view ray)
    drawingBufferSize: WebGLUniformLocation; // Size of the drawing buffer (canvas) in pixels, used for pick ray calculations
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
  constructor(renderContext: RenderContext, gpuMemoryReader: GPUMemoryReader, cfg: { edges?: boolean, picking?: boolean } = {
    edges: false,
    picking: false
  }) {
    if (cfg.picking && cfg.edges) { // Edges are an un-pickable visual effect
      throw new Error("Invalid DrawTechnique configuration: cannot have both picking and edges enabled.");
    }
    this._renderContext = renderContext;
    this._gpuMemoryReader = gpuMemoryReader;
    this.edges = cfg.edges === true;
    this.picking = cfg.picking === true;
    this._program = null;
  }

  /**
   * Initializes this draw technique by building and compiling the shader program.
   *
   * Calls the abstract methods {@link buildVertexShader} and {@link buildFragmentShader} to generate the shader sources,
   * then compiles the program and retrieves uniform/sampler locations.
   */
  public init(): SDKResult<any> {

    this._vertSrcBuf = [];
    this._fragSrcBuf = [];

    this.buildVertexShader();
    this.buildFragmentShader();

    const vertSrc = [];
    const vertCommentedSrc = [];

    const fragSrc = [];
    const fragCommentedSrc = [];

    joinSrc(this._vertSrcBuf, vertSrc, vertCommentedSrc);
    joinSrc(this._fragSrcBuf, fragSrc, fragCommentedSrc);

    this.vertexShaderSrc = vertSrc.join("\n");
    this.fragmentShaderSrc = fragSrc.join("\n");

    this.vertexShaderCommentedSrc = vertCommentedSrc.join("\n");
    this.fragmentShaderCommentedSrc = fragCommentedSrc.join("\n");

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

  /**
   * Initializes the shader program by compiling/linking and retrieving uniform/sampler locations.
   * @private
   */
  private _initProgram(): SDKResult<any> {

    const result = this._program.init();

    if (result.ok === false) {
      return result;
    }

    const program = this._program;

    this._uniforms = {
      primBaseIndex: program.getLocation("uPrimBaseIndex"),
      renderPass: program.getLocation("uRenderPass"),
      gammaFactor: program.getLocation("uGammaFactor"),
      projMatrix: program.getLocation("uProjMatrix"),
      snapCameraEyeRTC: program.getLocation("snapCameraEyeRTC"),
      perspectivePoints: program.getLocation("uPerspectivePoints"),
      perspectivePointsMinMax: program.getLocation("uPerspectivePointsMinMax"),
      roundPoints: program.getLocation("uRoundPoints"),
      pointSize: program.getLocation("pointSize"),
      intensityRange: program.getLocation("intensityRange"),
      nearPlaneHeight: program.getLocation("uNearPlaneHeight"),
      pointCloudIntensityRange: program.getLocation("pointCloudIntensityRange"),
      pickZNear: program.getLocation("pickZNear"),
      pickZFar: program.getLocation("pickZFar"),
      pickClipPos: program.getLocation("pickClipPos"),
      batchIndex: program.getLocation("batchIndex"),
      drawingBufferSize: program.getLocation("drawingBufferSize"),
      silhouetteColor: program.getLocation("uSilhouetteColor"),
      sectionPlanes: [],
      lightColor: [
        program.getLocation("uLightColor1"),
        program.getLocation("uLightColor2"),
        program.getLocation("uLightColor3")
      ],
      lightDir: [
        program.getLocation("uLightDir1"),
        program.getLocation("uLightDir2"),
        program.getLocation("uLightDir3")
      ],
      lightPos: [],
      lightAttenuation: [],
      lightAmbient: program.getLocation("uLightAmbient"),
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
      edgeIndexTexture: program.getSampler("uEdgeIndexTexture"), // TODO: Maybe redundant
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

    const renderContext = this._renderContext;
    const view = renderContext.activeView;
    const gl = this._renderContext.gl;
    const samplers = this._samplers;
    const dataTextures = this._gpuMemoryReader.dataTextures;
    const batchDataTextures = dataTextures.batches[meshBatch.gpuMemoryBatchIndex];
    const viewIndex = view.viewIndex;
    const batchViewDataTextures = batchDataTextures.views[viewIndex];

    const drawRange =
      this.edges
        ? batchViewDataTextures.renderPassEdgePrimitiveRanges.get(renderPass)
        : (this.picking
          ? batchViewDataTextures.pickPrimitiveRange // Draw all bins for picking
          : batchViewDataTextures.renderPassPrimitiveRanges.get(renderPass));

    if (!drawRange || drawRange.numPrims === 0) {
      return {
        ok: true,
        value: null // Nothing to draw for this pass
      };
    }

    const drawInspector
      = (renderContext.renderInspector && renderContext.renderInspector.enabled)
      ? renderContext.renderInspector
      : null;

    if (!this._bind(renderPass)) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DrawTechnique._draw] Failed to bind the shader program."
      };
    }

    const primitiveMeshIndexTexture
      = this.edges
      ? batchViewDataTextures.edgeMeshIndexTexture
      : batchViewDataTextures.primitiveMeshIndexTexture;

    renderContext.textureUnit = 0;

    // TODO: Avoid re-binding this set of textures if already bound for this batch.

    this._bindTexture(samplers.viewTileCameraMatrixTexture,
      (this._renderContext.rayPicking
        ? dataTextures.viewTilePickMatrixTexture
        : dataTextures.viewTileCameraMatrixTexture)
        [view.viewIndex]);

    this._bindTexture(samplers.primitiveMeshIndex, primitiveMeshIndexTexture);
    this._bindTexture(samplers.vertexPositionTexture, batchDataTextures.vertexPositionTexture);
    this._bindTexture(samplers.vertexColorTexture, batchDataTextures.vertexColorTexture);
    this._bindTexture(samplers.meshMatrixTexture, batchDataTextures.meshMatrixTexture);
    this._bindTexture(samplers.meshAttributeTexture, batchDataTextures.meshAttributeTexture);
    this._bindTexture(samplers.meshViewAttributeTexture, batchViewDataTextures.meshViewAttributeTexture);
    this._bindTexture(samplers.geometryAttributes, batchDataTextures.geometryAttributeTexture);
    this._bindTexture(samplers.geometryQuantRangeTexture, batchDataTextures.geometryQuantRangeTexture);
    //   this._bindTexture(samplers.edgeIndexTexture, batchDataTextures.edgeIndexTexture); // TODO: Redundant?
    this._bindTexture(samplers.indexTexture,
      this.edges
        ? batchDataTextures.edgeIndexTexture
        : batchDataTextures.indexTexture);

    if (this._uniforms.batchIndex) {
      gl.uniform1ui(this._uniforms.batchIndex, meshBatch.gpuMemoryBatchIndex);
    }

    gl.uniform1i(this._uniforms.primBaseIndex, 0);

    switch (meshBatch.primitive) {
      case TrianglesPrimitive:
        if (this.edges) {
          gl.drawArrays(gl.LINES, drawRange.firstPrim * 2, drawRange.numPrims * 2); // Edges draw range
        } else {
          gl.drawArrays(gl.TRIANGLES, drawRange.firstPrim * 3, drawRange.numPrims * 3); // Triangles draw range
        }
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

    drawInspector?.drawMeshBatch(meshBatch, renderPass, {
      firstPrim: drawRange.firstPrim,
      numPrims: drawRange.numPrims
    });

    return {
      ok: true,
      value: null
    };
  }

  /**
   * Abstract method to build the vertex shader source code.
   * Subclasses must implement this method to define the fragment shader logic
   * based on their specific rendering requirements.
   * Called during `init()`.
   */
  protected abstract buildVertexShader();

  /**
   * Abstract method to build the fragment shader source code.
   * Subclasses must implement this method to define the fragment shader logic
   * based on their specific rendering requirements.
   * Called during `init()`.
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
      .push(`#version 300 es

// ${this.constructor.name} vertex shader

// This shader renders primitives by fetching all geometry,
// transform, and attribute data from GPU data textures.
// The pipeline is:
//   gl_VertexID → primitive → mesh → geometry → vertex → model → world → view → clip`);
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
        vViewPos    = vec3(0.0);
}`);
  }

  /**
   * Generates vertex shader precision definitions and common definitions.
   */
  protected vsCommonDefines() {
    this._vertSrcBuf.push(`

// ─────────────────────────────────────────────────────────────
// Global draw configuration
// ─────────────────────────────────────────────────────────────

uniform int uRenderPass;
uniform int uPrimBaseIndex;

uniform mat4 uProjMatrix;

// ─────────────────────────────────────────────────────────────
// GPU data textures (structured storage via texelFetch)
// ─────────────────────────────────────────────────────────────

uniform highp usampler2D uPrimitiveMeshIndexTexture;
uniform highp usampler2D uVertexPositionTexture;
uniform highp usampler2D uVertexColorTexture;
uniform highp usampler2D uIndexTexture;
// uniform highp usampler2D uEdgeIndexTexture;
uniform highp sampler2D  uViewTileCameraMatrixTexture;
uniform highp sampler2D  uMeshMatrixTexture;
uniform highp usampler2D uMeshAttributeTexture;
uniform highp usampler2D uMeshViewAttributeTexture;
uniform highp usampler2D uGeometryAttributeTexture;
uniform highp sampler2D  uGeometryQuantRangeTexture;

// ─────────────────────────────────────────────────────────────
// Data structures stored inside textures
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Utility: Convert linear index → 2D texture coordinate
// ─────────────────────────────────────────────────────────────

ivec2 texCoord(uint index, uint texWidth) {
  return ivec2(int(index % texWidth), int(index / texWidth));
}

// ─────────────────────────────────────────────────────────────
// Primitive lookups
// ─────────────────────────────────────────────────────────────

uint getPrimitiveMeshIndex(uint primIndex) {
  const uint texWidth = 4096u;
  return texelFetch(uPrimitiveMeshIndexTexture, texCoord(primIndex * 2u, texWidth), 0).r;
}

uint getPrimitiveOffsetWithinGeometry(uint primIndex) {
  const uint texWidth = 4096u;
  return texelFetch(uPrimitiveMeshIndexTexture, texCoord((primIndex * 2u) + 1u, texWidth), 0).r;
}

// ─────────────────────────────────────────────────────────────
// Vertex + index fetch
// ─────────────────────────────────────────────────────────────

uint getVertexIndex(uint vertexIndexNum) {
  const uint texWidth = 4096u;
  return texelFetch(uIndexTexture, texCoord(vertexIndexNum, texWidth), 0).r;
}

uvec3 getVertexPosition(uint vertexIndexWithinGeometry) {
  const uint texWidth = 4096u;
  return texelFetch(uVertexPositionTexture, texCoord(vertexIndexWithinGeometry, texWidth), 0).rgb;
}

uvec4 getVertexColor(uint vertexIndexWithinGeometry) {
  const uint texWidth = 4096u;
  return texelFetch(uVertexColorTexture, texCoord(vertexIndexWithinGeometry, texWidth), 0).rgba;
}

// ─────────────────────────────────────────────────────────────
// Geometry + mesh metadata fetch
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Matrix fetch (stored as 4 consecutive texels per matrix)
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Packs a uint into an RGBA color (each channel stores one byte).
// Little-endian byte order: R = least significant byte
// ─────────────────────────────────────────────────────────────

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
  protected vsLambertShadingDefines(silhouette?: boolean) {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Lambertian directional lighting configuration
// ─────────────────────────────────────────────────────────────
`,
      "uniform vec4 uLightAmbient;",
      "uniform vec3 uLightDir1;",
      "uniform vec4 uLightColor1;",
      "uniform vec3 uLightDir2;",
      "uniform vec4 uLightColor2;",
      "uniform vec3 uLightDir3;",
      "uniform vec4 uLightColor3;",
      "flat out vec4 vColor;",
      "out vec3 vViewPos;",
      silhouette ? "uniform vec4 uSilhouetteColor;" : "");
  }

  /**
   * Generates vertex shader definitions for silhouette rendering.
   * @protected
   */
  protected vsSilhouetteDefines() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Silhouette rendering configuration
// ─────────────────────────────────────────────────────────────

uniform vec4 uSilhouetteColor;
flat out vec4 vColor;`);
  }

  /**
   * Generates vertex shader definitions for flat color rendering.
   * @protected
   */
  protected vsDrawFlatColorDefs() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Flat color rendering configuration
// ─────────────────────────────────────────────────────────────

flat out vec4 vColor;`);
  }

  /**
   * Generates vertex shader definitions for vertex color rendering.
   * @protected
   */
  protected vsDrawVertexColorDefs() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Vertex color rendering configuration
// ─────────────────────────────────────────────────────────────

flat out vec4 vColor;`);
  }

  /**
   * Generates vertex shader definitions for depth rendering.
   * @protected
   */
  protected vsDrawDepthDefines() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Vertex color rendering configuration
// ─────────────────────────────────────────────────────────────

out highp vec2 vHighPrecisionZW;`);
  }

  /**
   * Generates vertex shader definitions for point rendering.
   * @protected
   */
  protected vsPointsDefines(): void {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Point rendering configuration
// ─────────────────────────────────────────────────────────────

uniform float uNearPlaneHeight;
uniform vec2 intensityRange;
uniform int uPerspectivePoints;
uniform vec2 uPerspectivePointsMinMax;
uniform float pointSize;`);
  }

  /**
   * Generates vertex shader definitions for pick rendering.
   * @protected
   */
  protected vsPickDefines() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Pick common rendering configuration
// ─────────────────────────────────────────────────────────────

uniform vec2 drawingBufferSize;
uniform vec2 pickClipPos;
uniform vec2 pickZRange;
uniform uint batchIndex;

flat out uint vBatchIndex;
flat out uint vMeshIndex;
     out vec4 vViewPosition;

// In pick rendering, we render meshes in their pick-space positions, which are derived from the clip-space
// positions but with XY remapped to [0,1] based on the viewport and with Z remapped to [0,1] based on the view's
// near/far planes. This allows us to encode the pick ID in the RGB channels of the rendered color,
// and reconstruct the view-space position from the depth (Z) channel. The function below performs the inverse
// of this remapping to get back to clip space for rendering.

vec4 remapPickClipPos(vec4 clipPos) {
    clipPos.xy /= clipPos.w;
    clipPos.xy = (clipPos.xy - pickClipPos) * drawingBufferSize;
    clipPos.xy *= clipPos.w;
    return clipPos;
}`);
  }

  /**
   * Generates vertex shader definitions for pick rendering.
   * @protected
   */
  protected vsPickMeshDefines() {
//     this._vertSrcBuf.push(`
// // ─────────────────────────────────────────────────────────────
// // Pick mesh rendering configuration
// // ─────────────────────────────────────────────────────────────
//
// flat out vec4 vPickColor;
// `);
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
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Vertex shader main function
// ─────────────────────────────────────────────────────────────

void main(void) {`);
    this._vsMeshLogic();
    this._vsMeshLogic2();
  }

  /**
   * Generates the opening of the vertex shader main function for draw rendering.
   * @protected
   */
  protected vsDrawMainOpen() { // default
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Vertex shader main function for draw rendering
// ─────────────────────────────────────────────────────────────

void main(void) {`);
    this._vsMeshLogic();
    this._vsMeshLogic2();
  }

  /**
   * Generates the opening of the vertex shader main function for pick rendering.
   * @protected
   */
  protected vsPickMainOpen() { // pick
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Vertex shader main function for pick rendering
// ─────────────────────────────────────────────────────────────

void main(void) {`);
    this._vsMeshLogic();
    this._vertSrcBuf.push(
      `    uint pickable = meshViewAttributes.renderFlags.g;`,
      `    if (pickable == 255u) {`,
      //  "        gl_Position = vec4(2.0, 0.0, 0.0, 1.0);",
      // "        return;",
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
    this._vertSrcBuf.push(`
     // Identify which "draw vertex" we are processing
    uint drawVertexIndex  = uint(gl_VertexID);

    // Compile-time topology constant: 3 = triangles, 2 = lines, 1 = points.
    const uint numVertsPerPrim = ${this.vertsPerPrim}u;

    // Map draw vertex → draw primitive
    // Example (triangles): vertices 0,1,2 -> prim 0; 3,4,5 -> prim 1; etc.
    uint drawPrimIndex = drawVertexIndex / numVertsPerPrim;

    // Convert draw primitive → global primitive index
    // uPrimBaseIndex allows batching multiple draws into a big primitive table.
    uint primIndex = uint(uPrimBaseIndex) + drawPrimIndex;

    // Primitive → mesh resolution
    // Each primitive belongs to a mesh; meshIndex selects transforms + attributes.
    uint meshIndex = getPrimitiveMeshIndex( primIndex );

    // Fetch mesh view properties (color + flags)
    MeshViewAttributes meshViewAttributes = getMeshViewAttributes( meshIndex );

    // Cull fully-transparent meshes
    if (meshViewAttributes.color.a == 3u) {
      // gl_Position = vec4(3.0, 3.0, 3.0, 1.0); // Cull vertex
     //  return;
    }

    // Primitive → offset inside the geometry’s primitive list
    // This tells us which triangle/line/point we are within the geometry.
    uint primOffset = getPrimitiveOffsetWithinGeometry( primIndex );
    `);
  }

  /**
   * Generates vertex shader logic for mesh processing (part 2).
   * @private
   */
  private _vsMeshLogic2() { // after renderPass check
    this._vertSrcBuf.push(`
    // Mesh → tile + geometry resolution
    // tileIndex selects the view matrix; geometryIndex selects vertex/index ranges.
    MeshAttribTable meshAttributeTexture = getMeshAttribTable( meshIndex );
    uint tileIndex = meshAttributeTexture.tileIndex;
    uint geometryIndex = meshAttributeTexture.geometryIndex;

    // Geometry → base offsets resolution
    // These bases are added to local offsets to index into the big packed buffers.
    GeometryAttributes  geometryAttributes = getGeometryAttributeTexture( geometryIndex );

    // Determine local vertex number within this primitive
    // Triangles: localVert ∈ {0,1,2}
    // Lines:     localVert ∈ {0,1}
    // Points:    localVert = 0
    uint localVert = drawVertexIndex % numVertsPerPrim; // 0, 1, 2 for triangle; 0, 1 for line; 0 for point

    // Convert (primitive offset, localVert) → vertex offset within geometry
    // For triangles: vertexOffsetWithinGeometry = primOffset*3 + localVert
    uint vertexOffsetWithinGeometry = (primOffset * numVertsPerPrim) + localVert;

    // Resolve final vertex index within geometry.
    // Indexed primitives (triangles, lines) fetch from the index buffer.
    // Non-indexed primitives (points) use vertexOffsetWithinGeometry directly.
    uint vertexIndexWithinGeometry = ${this.useIndexBuffer
      ? `getVertexIndex(geometryAttributes.${this.edges ? "edgeIndicesBase" : "indicesBase"} + vertexOffsetWithinGeometry)`
      : `vertexOffsetWithinGeometry`};

    // Dequantization parameters for this geometry
    // Vertex positions are stored quantized; quantRange turns uvec3 into float vec3.
    QuantRange quantRange = getGeometryQuantRange(geometryIndex);

    // Fetch quantized vertex position, then dequantize into model space
    // quantPos: integer-like packed value
    // modelPos.xyz = offset + scale * quantPos
    uvec3 quantPos = getVertexPosition(geometryAttributes.verticesBase + vertexIndexWithinGeometry);
    vec4 modelPos  = vec4(quantRange.offset + (quantRange.scale * vec3(quantPos)), 1.0);

    // Fetch transforms
    // modelMatrix: mesh-local → world
    // viewMatrix:  world → view (tile camera)
    mat4 modelMatrix = getMeshMatrix(meshIndex);
    mat4 viewMatrix  = getTileViewMatrix(tileIndex);

    // Apply transforms through the standard pipeline
    vec4 worldPos = modelMatrix * modelPos;      // model → world
    vec4 viewPos  = viewMatrix  * worldPos;      // world → view
    vec4 clipPos  = uProjMatrix * viewPos;       // view  → clip

    // Write final clip-space position for rasterization
    gl_Position = clipPos;`
    );
  }

  protected vsLambertShadingLogic(silhouette?: boolean) {
    this._vertSrcBuf.push(`
    // ─────────────────────────────────────────────────────────
    // Lighting section: pass through data needed by the fragment shader
    // ─────────────────────────────────────────────────────────
    // Lambert shading is computed per-fragment from dFdx/dFdy of view-space
    // position. That gives a flat face normal without reconstructing the full
    // triangle in the vertex shader.

    // Fetch mesh base color or silhouette color
    vec4 color = ${silhouette
      ? "vec4(uSilhouetteColor.r, uSilhouetteColor.g, uSilhouetteColor.b, uSilhouetteColor.a);"
      : "vec4(meshViewAttributes.color) / 255.0; // Stored as RGBA8 in uvec4, convert to float 0..1."}

    // Pass through the base color and view-space position.
    // vColor remains flat per primitive/mesh color.
    // vViewPos is interpolated for fragment derivatives.
    vColor = color;
    vViewPos = viewPos.xyz;`
    );
  }

  /**
   * Generates vertex shader logic for silhouette rendering.
   * @protected
   */
  protected vsSilhouetteLogic() {
    this._vertSrcBuf.push(`
    // Output constant silhouette color
    vColor = vec4(uSilhouetteColor.r, uSilhouetteColor.g, uSilhouetteColor.b, uSilhouetteColor.a);`);
  }

  /**
   * Generates vertex shader logic for flat color rendering.
   * @protected
   */

  protected vsDrawFlatColorLogic() {
    this._vertSrcBuf.push(`
    // Output flat color from mesh view attributes
    vec4 color = vec4(meshViewAttributes.color) / 255.0;
    vColor = color;`);
  }

  /**
   * Generates vertex shader logic for vertex color rendering.
   * @protected
   */
  protected vsDrawVertexColorLogic() {
    this._vertSrcBuf.push(`
    // Output vertex color
    uvec4 color = getVertexColor(vertexIndexWithinGeometry);
    vColor = vec4( float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);`);
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
   * Generates vertex shader logic for pick rendering.
   * @protected
   */
  protected vsPickMeshLogic() {
    this._vertSrcBuf.push(
      "    vBatchIndex = batchIndex;",
      "    vMeshIndex = meshIndex;",
      "    vViewPosition = viewPos;",
      "    gl_Position = remapPickClipPos(gl_Position);");
  }

  /**
   * Generates vertex shader logic for depth pick rendering.
   * @protected
   */
  protected vsPickDepthLogic() {
    this._vertSrcBuf.push(
      "    vHighPrecisionZW = remapPickClipPos(gl_Position).zw;"
    );
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
    this._vertSrcBuf.push(
      `  if (uPerspectivePoints == 1) {
     gl_PointSize = (uNearPlaneHeight * pointSize) / clipPos.w;
     gl_PointSize = max(gl_PointSize, uPerspectivePointsMinMax[0]);
     gl_PointSize = min(gl_PointSize, uPerspectivePointsMinMax[1]);
   } else {
      gl_PointSize = pointSize;
   }`);
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
    this._fragSrcBuf.push("flat in vec4 vColor;");
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
    this._fragSrcBuf.push("flat in vec4 vColor;");
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
    src.push(
      "flat in vec4 vColor;",
      "in vec3 vViewPos;",
      "uniform vec4 uLightAmbient;",
      "uniform vec3 uLightDir1;",
      "uniform vec4 uLightColor1;",
      "uniform vec3 uLightDir2;",
      "uniform vec4 uLightColor2;",
      "uniform vec3 uLightDir3;",
      "uniform vec4 uLightColor3;");
  }

  /**
   * Generates fragment shader logic for Lambert shading.
   * @protected
   */
  protected fsLambertShadingLogic() {
    this._fragSrcBuf.push(`
    // Reconstruct a face normal in view space from position derivatives.
    // This gives a flat-shaded normal per fragment without refetching the
    // whole triangle in the vertex shader.
    vec3 dX = dFdx(vViewPos);
    vec3 dY = dFdy(vViewPos);
    vec3 normal = normalize(cross(dX, dY));

    // Lambert diffuse term (N·L), clamped to [0,1].
    // The renderer convention for directional lights is typically the direction
    // the light travels, so we negate it for the surface-to-light direction.
    float lambertian = max(dot(normal, normalize(uLightDir2)), 0.0);

    // Accumulate reflected/diffuse light contribution.
    // uLightColor2.rgb * uLightColor2.a acts like (color * intensity).
    vec3 reflectedColor = vec3(0.0);
    reflectedColor += lambertian * (uLightColor2.rgb * uLightColor2.a);

    // Combine ambient + diffuse lighting.
    // Ambient is applied to base color, diffuse multiplies base color as well.
    vec3 lit = (uLightAmbient.rgb * uLightAmbient.a * vColor.rgb) + (vColor.rgb * reflectedColor);

    color = vec4(lit, vColor.a);`);
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
    this._fragSrcBuf.push(
      `flat in uint vMeshIndex;
       flat in uint vBatchIndex;

       in vec4 vViewPosition; // view-space position, used for reconstructing depth in fragment shader

       uniform float pickZNear;
       uniform float pickZFar;

       layout(location = 0) out vec4 outBatchIndex;
       layout(location = 1) out vec4 outMeshIndex;
       layout(location = 2) out vec4 outDepth;

       // Packs a 32-bit uint into 4 normalized 8-bit color channels.
       // R = least-significant byte, A = most-significant byte.
       vec4 packUintToRGBA8(uint v) {
         return vec4(
           float( v         & 0xFFu),
           float((v >> 8u)  & 0xFFu),
           float((v >> 16u) & 0xFFu),
           float((v >> 24u) & 0xFFu)
         ) / 255.0;
      }

      // Packs a normalized float in [0,1] into RGBA8.
      vec4 packDepth(const in float depth) {
        const vec4 bitShift = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);
        const vec4 bitMask  = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);
        vec4 res = fract(depth * bitShift);
        res -= res.xxyz * bitMask;
        return res;
      }`);
  }

  /**
   * Generates fragment shader logic for pick rendering.
   * @protected
   */
  // protected fsPickMeshLogic() {
  //   this._fragSrcBuf.push("color = vPickColor;");
  // }

  protected fsPickMeshLogic() {
    this._fragSrcBuf.push(`
    outBatchIndex = packUintToRGBA8(vBatchIndex);
    outMeshIndex  = packUintToRGBA8(vMeshIndex);
    float zNormalizedDepth = abs((pickZNear + vViewPosition.z) / (pickZFar - pickZNear));
    outDepth      = packDepth(zNormalizedDepth);
    `);
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
   * Generates fragment shader defines for point rendering.
   * @protected
   */
  protected fsPointsDefines(): void {
    this._fragSrcBuf.push(`uniform int uRoundPoints;`);
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
    this._fragSrcBuf.push(`
  // For points, we have the option of rendering them as circles instead of squares.
  // If roundPoints is enabled, we discard fragments outside a unit circle inscribed within the square point sprite.
  if (uRoundPoints == 1) {
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) {
      discard;
    }
  }`);
  }

  /**
   * Generates fragment shader logic for common output.
   * @protected
   */
  protected fsCommonOutput() {
    this._fragSrcBuf.push("outColor = color;");
  }

  private _bindTexture(sampler: WebGLUniformLocation | null, dataTexture: { texture: WebGLTexture | null } | null): void {
    if (!sampler || !dataTexture) return;
    const rc = this._renderContext;
    const gl = rc.gl;
    gl.activeTexture(gl.TEXTURE0 + rc.textureUnit);
    gl.bindTexture(gl.TEXTURE_2D, dataTexture.texture);
    gl.uniform1i(sampler, rc.textureUnit);
    rc.textureUnit = (rc.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
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

    if (renderContext.lastProgramId === program.id && renderContext.lastRenderPass === renderPass) {
      return true;
    }

    if (renderContext.lastProgramId !== program.id) {
      program.bind();
      renderContext.lastProgramId = program.id;
      renderContext.textureUnit = 0;
    }

    renderContext.lastRenderPass = renderPass;

    if (uniforms.renderPass) {
      gl.uniform1i(uniforms.renderPass, renderPass);
    }

    if (uniforms.projMatrix) {
      gl.uniformMatrix4fv(uniforms.projMatrix, false, <any>(renderPass === RENDER_PASSES.PICK
        ? renderContext.pickProjMatrix
        : view.camera.projMatrix));
    }

    if (uniforms.perspectivePoints) {
      gl.uniform1i(uniforms.perspectivePoints, view.pointsMaterial.perspectivePoints ? 1 : 0);
    }

    if (uniforms.perspectivePointsMinMax) {
      gl.uniform2f(uniforms.perspectivePointsMinMax, view.pointsMaterial.minPerspectivePointSize, view.pointsMaterial.maxPerspectivePointSize);
    }

    if (uniforms.pointSize) {
      gl.uniform1f(uniforms.pointSize, view.pointsMaterial.pointSize);
    }

    if (uniforms.roundPoints) {
      gl.uniform1i(uniforms.roundPoints, view.pointsMaterial.roundPoints ? 1 : 0);
    }

    if (uniforms.nearPlaneHeight) {
      gl.uniform1f(uniforms.nearPlaneHeight,
        (view.camera.projectionType === OrthoProjectionType)
          ? 1.0
          : gl.drawingBufferHeight / (2 * Math.tan(0.5 * view.camera.perspectiveProjection.fov * Math.PI / 180.0)));
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

    // Bind up to three directional lights for Lambert shading.
    // Keep the binding generic here so we do not need concrete light class imports.
    const lights = <any[]>(((view as any).lightsList) || []);
    for (let i = 0; i < 3; i++) {
      const light = lights[i];
      const dirLoc = uniforms.lightDir[i];
      const colorLoc = uniforms.lightColor[i];

      if (dirLoc) {
        // if (light && light.dir) {
        //   gl.uniform3f(dirLoc, light.dir[0], light.dir[1], light.dir[2]);
        // } else {
          gl.uniform3f(dirLoc, 0.0, 1.0, 1.0);
        //}
      }

      if (colorLoc) {
        if (light && light.color) {
          const intensity = (light.intensity !== undefined && light.intensity !== null) ? light.intensity : 1.0;
          gl.uniform4f(colorLoc, light.color[0], light.color[1], light.color[2], intensity);
        } else {
          gl.uniform4f(colorLoc, 0.0, 0.0, 0.0, 0.0);
        }
      }
    }

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
          const material = view.edges;
          const color = material.edgeColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
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


function joinSrc(srcLines: string[], srcLinesWithoutComments: string[], srcLinesWithComments: string[]) {
  for (let i = 0, len = srcLines.length; i < len; i++) {
    // Split each element into lines if it contains newlines
    const lines = srcLines[i].split(/\r\n|\r|\n/);
    for (let n = 0; n < lines.length; n++) {
      let line = lines[n];
      srcLinesWithComments.push(line);
      // Remove line comments (//)
      const idx = line.indexOf("//");
      if (idx >= 0) line = line.slice(0, idx);
      // Remove inline block comments (/* ... */) -- only if on a single line
      line = line.replace(/\/\*.*?\*\//g, "");
      // Preserve leading spaces (do not trim)
      // Only skip lines that are completely empty or whitespace
      if (line.match(/\S/)) srcLinesWithoutComments.push(line);
    }
  }
}
