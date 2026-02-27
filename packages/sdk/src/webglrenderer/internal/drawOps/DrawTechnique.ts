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
    primitiveType: WebGLUniformLocation; // Primitive type being rendered (triangles, lines, points)
    pointCloudIntensityRange: WebGLUniformLocation; // Intensity range for point cloud rendering
    nearPlaneHeight: WebGLUniformLocation; // Near plane height for perspective point size calculation
    silhouetteColor: WebGLUniformLocation; // Color used for silhouette rendering
    gammaFactor: WebGLUniformLocation; // Gamma correction factor
    pickZNear: WebGLUniformLocation; // Near plane for pick rendering
    snapCameraEyeRTC: WebGLUniformLocation; // Snapped camera eye position in RTC space
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

    const bindTexture = (sampler, dataTexture) => {
      if (!sampler || !dataTexture) {
        return;
      }
      gl.activeTexture(gl["TEXTURE" + renderContext.textureUnit]);
      gl.bindTexture(gl.TEXTURE_2D, dataTexture.texture);
      gl.uniform1i(sampler, renderContext.textureUnit);
      renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
    };

    bindTexture(samplers.viewTileCameraMatrixTexture,
      (this._renderContext.rayPicking
        ? dataTextures.viewTilePickMatrixTexture
        : dataTextures.viewTileCameraMatrixTexture)
        [view.viewIndex]);

    bindTexture(samplers.primitiveMeshIndex, primitiveMeshIndexTexture);
    bindTexture(samplers.vertexPositionTexture, batchDataTextures.vertexPositionTexture);
    bindTexture(samplers.vertexColorTexture, batchDataTextures.vertexColorTexture);
    bindTexture(samplers.meshMatrixTexture, batchDataTextures.meshMatrixTexture);
    bindTexture(samplers.meshAttributeTexture, batchDataTextures.meshAttributeTexture);
    bindTexture(samplers.meshViewAttributeTexture, batchViewDataTextures.meshViewAttributeTexture);
    bindTexture(samplers.geometryAttributes, batchDataTextures.geometryAttributeTexture);
    bindTexture(samplers.geometryQuantRangeTexture, batchDataTextures.geometryQuantRangeTexture);
 //   bindTexture(samplers.edgeIndexTexture, batchDataTextures.edgeIndexTexture); // TODO: Redundant?
    bindTexture(samplers.indexTexture,
      this.edges
        ? batchDataTextures.edgeIndexTexture
        : batchDataTextures.indexTexture);

    gl.uniform1i(this._uniforms.primBaseIndex, 0);

    const drawPrimitiveType // Draw LINES for batches in edge rendering pass, even if the mesh primitive is TRIANGLES
      = this.edges
      ? LinesPrimitive
      : meshBatch.primitive;

    gl.uniform1i(this._uniforms.primitiveType, drawPrimitiveType);

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

    for (let i = 0; i < 12; i++) {
      gl.activeTexture(gl["TEXTURE" + i]);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    return {
      ok: true,
      value: null
    };

    // } catch (error) {
    //   return {
    //     ok: false,
    //     type: SDKErrorType.InvalidOperation,
    //     error: error instanceof Error ? error.message : "[DrawTechnique._draw] An unknown error occurred during draw."
    //   };
    // }
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
        vViewPos    = vec4(0.0);
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
uniform int uPrimitiveType;

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

// ─────────────────────────────────────────────────────────────
// Get the eye position in world space from the view matrix
// ─────────────────────────────────────────────────────────────

vec3 getEyePosition(mat4 viewMatrix) {
    // Invert the view matrix to get the world matrix
    mat4 invView = inverse(viewMatrix);
    // The translation part (last column) is the eye position in world space
    return invView[3].xyz;
}

// ─────────────────────────────────────────────────────────────
// Returns true if the triangle (a,b,c) in VIEW SPACE is facing the eye.
// Assumes a right-handed view space with the camera at (0,0,0).
// For conventional OpenGL view space (camera looks down -Z), this works as expected.
// ─────────────────────────────────────────────────────────────

bool triangleFacesEyeVS(vec3 aVS, vec3 bVS, vec3 cVS) {
    // Triangle normal from winding (right-hand rule)
    vec3 n = normalize(cross(bVS - aVS, cVS - aVS));

    // Eye position in view space is the origin
    vec3 eyeVS = vec3(0.0);

    // Vector from triangle toward the eye (use centroid for stability)
    vec3 toEye = normalize(eyeVS - (aVS + bVS + cVS) * (1.0 / 3.0));

    // Facing the eye if normal points (at least partially) toward the eye
    return dot(n, toEye) > 0.0;
}

`);
  }

  /**
   * Generates vertex shader definitions for Lambert shading.
   * @protected
   */
  protected vsLambertShadingDefines() {
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
      "out vec4 vColor;",
      "out vec4 vViewPos;");
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
out vec4 vColor;`);
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

out vec4 vColor;`);
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

out vec4 vColor;`);
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

uniform float nearPlaneHeight;
uniform vec2 intensityRange;
uniform float pointSize;`);
  }

  /**
   * Generates vertex shader definitions for pick rendering.
   * @protected
   */
  protected vsPickMeshDefines() {
    this._vertSrcBuf.push(`
// ─────────────────────────────────────────────────────────────
// Pick rendering configuration
// ─────────────────────────────────────────────────────────────

out     vec4 vPickColor;
uniform vec2 drawingBufferSize;
uniform vec2 pickClipPos;

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
      `    int pickFlag = int(meshViewAttributes.renderFlags.b >> 8u & 0xFu);`,
      `    if (pickFlag != uRenderPass) {`,
      // "        gl_Position = vec4(2.0, 0.0, 0.0, 1.0);",
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

    // Determine topology: how many vertices per primitive?
    //   triangles: 3
    //   lines:     2
    //   points:    1
    uint numVertsPerPrim =
        uint(uPrimitiveType == ${TrianglesPrimitive} ? 3u :   // triangles
            (uPrimitiveType == ${LinesPrimitive} ? 2u : 1u)); // lines or points

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

    // Resolve final vertex index within geometry
    // - For non-indexed points (uPrimitiveType == 20000), we treat vertexOffsetWithinGeometry as direct.
    // - Otherwise, we fetch an index from the index buffer, using geometryAttributes.indicesBase / edgeIndicesBase.
    uint vertexIndexWithinGeometry =
        (uPrimitiveType == 20000)
        ? vertexOffsetWithinGeometry
        : getVertexIndex(geometryAttributes.${this.edges ? "edgeIndicesBase" : "indicesBase"} + vertexOffsetWithinGeometry);

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

  protected vsLambertShadingLogic() {
    this._vertSrcBuf.push(`
    // ─────────────────────────────────────────────────────────
    // Lighting section: compute a face normal from the full triangle
    // ─────────────────────────────────────────────────────────
    // Even though we are in a per-vertex shader, we reconstruct the entire
    // triangle (3 indices + 3 positions) to compute a consistent face normal.
    // This yields flat shading: all 3 vertices get the same normal-derived light.

    // Compute the starting index of the triangle in the index buffer
    // triIndex points at the first of the three indices for this triangle.
    uint triIndex = geometryAttributes.indicesBase + primOffset * numVertsPerPrim;

    // Fetch triangle vertex indices (within geometry)
    uint ia = getVertexIndex(triIndex + 0u);
    uint ib = getVertexIndex(triIndex + 1u);
    uint ic = getVertexIndex(triIndex + 2u);

    // Fetch quantized positions for all three triangle vertices
    uvec3 qa = getVertexPosition(geometryAttributes.verticesBase + ia);
    uvec3 qb = getVertexPosition(geometryAttributes.verticesBase + ib);
    uvec3 qc = getVertexPosition(geometryAttributes.verticesBase + ic);

    // Dequantize + transform those triangle vertices into view space
    vec3 pa = (viewMatrix * (modelMatrix * vec4(quantRange.offset + quantRange.scale * vec3(qa), 1.0))).xyz;
    vec3 pb = (viewMatrix * (modelMatrix * vec4(quantRange.offset + quantRange.scale * vec3(qb), 1.0))).xyz;
    vec3 pc = (viewMatrix * (modelMatrix * vec4(quantRange.offset + quantRange.scale * vec3(qc), 1.0))).xyz;

    // Ensure a consistent winding relative to the camera
    // If the triangle is not facing the eye with the current vertex order,
    // we swap two vertices to flip the winding. This makes the computed
    // normal consistently oriented (reduces “inside-out” lighting).
    if (!triangleFacesEyeVS(pa, pb, pc)) {
        vec3 tmp = pb;
        pb = pc;
        pc = tmp;
    }

    // Compute face normal in view space
    vec3 normal = -normalize(cross(pc - pa, pb - pa));

    // Set up Lambert lighting accumulation
    float lambertian = 1.0;
    vec3 reflectedColor = vec3(0.0);

    vec4 lightAmbient = vec4(0.3, 0.3, 0.3, 1.0);
    vec3 lightDir1    = normalize(vec3(0.0, 0.0, -1.0));
    vec4 lightColor1  = vec4(0.7, 0.7, 0.7, 1.0);
    vec3 lightDir2    = normalize(vec3(-1.0, 1.0, 1.0));
    vec4 lightColor2  = vec4(1.0, 1.0, 1.0, 0.5);
    vec3 lightDir3    = normalize(vec3(-1.0, 1.0, 1.0));
    vec4 lightColor3  = vec4(1.0, 1.0, 1.0, 0.2);

    // Lambert diffuse term (N·L), clamped to [0,1]
    // Currently using lightDir2 only.
    lambertian = max(dot(normal, normalize(lightDir2)), 0.0);

    // Fetch mesh base color
    // Stored as RGBA8 in uvec4, convert to float 0..1.
    vec4 color = vec4(meshViewAttributes.color) / 255.0;

    // Accumulate reflected/diffuse light contribution
    // lightColor2.rgb * lightColor2.a acts like (color * intensity).
    reflectedColor += lambertian * (lightColor2.rgb * lightColor2.a);

    // Combine ambient + diffuse lighting
    // Ambient is applied to base color, diffuse multiplies base color as well.
    vec3 lit = (lightAmbient.rgb * lightAmbient.a * color.rgb) + (color.rgb * reflectedColor);

    // Output to fragment shader
    // Alpha is preserved from mesh color.
    vColor = vec4(lit, color.a);`
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
    vColor = vec4( float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, float(color.a) / 255.0);`);
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
      gl.uniform1f(uniforms.nearPlaneHeight,
        (view.camera.projectionType === OrthoProjectionType)
          ? 1.0
          : (gl.drawingBufferHeight / (2 * Math.tan(0.5 * view.camera.perspectiveProjection.fov * Math.PI / 180.0))));
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
