import {WEBGL_INFO, WebGLProgram} from "../../../webglutils";
import {LinesPrimitive, OrthoProjectionType, PointsPrimitive, TrianglesPrimitive} from "../../../constants";
import {RENDER_PASSES} from "../../renderGraph/RENDER_PASSES";
import type {RenderContext} from "../../RenderContext";
import {type GPUMemoryReadIF} from "../../gpuMemory/GPUMemoryReadIF";
import {RenderLayer} from "../../renderGraph/RenderLayer";

const defaultColor = new Float32Array([1, 1, 1, 1]);

export type RenderPassValue = typeof RENDER_PASSES[keyof typeof RENDER_PASSES];

/**
 * Abstract base class for rendering renderGraph in a WebGL context.
 *
 * Provides a foundation for implementing rendering techniques for primitives (e.g., triangles, lines, points).
 * Manages shader construction, WebGL program binding, and rendering logic. Designed for subclassing.
 *
 * ### Key Features:
 * - **Dynamic Shaders**: Subclasses define vertex/fragment shader construction.
 * - **Hash-Based Configurations**: Tracks unique renderer configurations.
 * - **WebGL Integration**: Manages uniforms, attributes, and textures.
 *
 * ### Subclass Requirements:
 * - `buildVertexShader()`: Constructs vertex shader code.
 * - `buildFragmentShader()`: Constructs fragment shader code.
 *
 * ### Lifecycle:
 * 1. **Initialization**: Builds WebGL program and initializes resources.
 * 2. **Validation**: Ensures renderer validity with `getValid()`.
 * 3. **Binding**: Prepares WebGL state with `bind()`.
 * 4. **Rendering**: Executes rendering logic with `renderLayer()`.
 * 5. **Cleanup**: Releases resources with `destroy()`.
 *
 * Data textures (DTX) in this renderer
 * ------------------------------------
 * We avoid VBO attribute streams and instead fetch all per-render data from textures
 * with texelFetch(). A 1D logical tileIndex is mapped into 2D texel coords using a fixed
 * width (texWidth = 4096): x = base % 4096, y = base / 4096.
 *
 * Integer data is stored in INTEGER textures and fetched via `usampler2D` so values
 * are NOT normalized. Float data (matrices/colors/scales) uses `sampler2D`.
 *
 * Textures and roles:
 * - uPrimToMeshLookup (usampler2D): u32 mesh tileIndex per primitive (packed in RGBA bytes).
 * - uIndices / edgeIndicesTex (usampler2D): connectivity indices (u32 packed RGBA).
 * - uPositions (usampler2D): quantized vertex positions; one texel per vertex, RGB = X,Y,Z
 *   (e.g., RGBA16UI with A unused). Dequant in VS: offset + scale * vec3(q.rgb).
 * - geometryAttribs (sampler2D): per-geometry dequant params (vec3 offset/scale) and
 *   vertexBase (when stored as u32, fetch from an integer page or pack/unpack accordingly).
 * - uMeshAttribs (sampler2D): per-mesh view flags/color and indices to other tables.
 * - uMeshMatrices / tileViewMatrices (sampler2D): model/view mat4 packed as 4 vec4 texels,
 *   atlas-organized with matsPerRow for addressing.
 *
 * Vertex shader flow:
 *   primIndex = gl_VertexID / 3
 *   meshIndex = getMeshIndex(uBaseIndex + primIndex)
 *   meshAttrs = getMeshAttribs(meshIndex)
 *   vertexIndex = getVertexIndex(meshAttrs.indicesBase + primIndex)
 *   qPos      = texelFetch(uPositions, uv(vertexIndex), 0).rgb  // integer RGB
 *   geomAttrs = getGeometryAttribs(meshAttrs.geometryIndex)
 *   modelPos  = vec4(geomAttrs.dequantizeOffset + geomAttrs.dequantizeScale * vec3(qPos), 1.0)
 *   worldPos  = modelMatrix(meshIndex) * modelPos
 *   viewPos   = tileViewMatrix(meshAttrs.tileIndex) * worldPos
 *   gl_Position = uProjMatrix * viewPos
 *
 * Why textures:
 * - Scales to huge scenes; updates are partial via texSubImage2D.
 * - Avoids large/fragmented VBOs; all addressing is done in-shader with texelFetch().
 */
export abstract class LayerRenderer {

  private _renderContext: RenderContext;
  private _gpuMemoryReadIF: GPUMemoryReadIF;
  private _program: WebGLProgram|null;

  errors: string[];
  edges: boolean;

  /**
   * Uniforms and attributes for the shader program.
   * Populated during the `build()` method based on what's included in the shader source.
   */
  private _uniforms: {
    renderPass: WebGLUniformLocation; // Current render pass (e.g., color, pick, silhouette)
    baseIndex: WebGLUniformLocation; // Base tileIndex for the current render call
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
    primToMeshLookup: WebGLUniformLocation; // Prim tileIndex -> mesh lookup
    meshAttribs: WebGLUniformLocation; // Mesh attributes
    meshViewAttribs: WebGLUniformLocation; // Mesh view attributes
    meshMatrices: WebGLUniformLocation; // RTC modeling matrices
    geometryAttribs: WebGLUniformLocation; // Geometry attributes
    geometryQuantRanges: WebGLUniformLocation; // Quantization ranges
    positions: WebGLUniformLocation; // World-space vertex positions
    indices: WebGLUniformLocation; // Primitive connectivity indices
    edgeIndices: WebGLUniformLocation; // Edge connectivity indices
    tileViewMatrices: WebGLUniformLocation; // Tile view matrices
    saoOcclusionTexture: WebGLUniformLocation; // SAO occlusion texture
  };

  /**
   * Temp vertex shader source _buffer.
   */
  private _vertexSrcBuf: string[];

  /**
   * Temp fragment shader source _buffer.
   */
  private _fragmentSrcBuf: string[];

  /**
   * Creates a new LayerRenderer instance.
   * @param renderContext
   * @param gpuMemoryReadIF
   * @param cfg
   */
  constructor( renderContext: RenderContext, gpuMemoryReadIF: GPUMemoryReadIF, cfg: {edges: boolean} = {edges: false} ) {
    this._renderContext = renderContext;
    this._gpuMemoryReadIF = gpuMemoryReadIF;
    this.edges = cfg.edges;
    this._build();
  }

  /**
   * Abstract method to build the vertex shader source code.
   * Subclasses must implement this method to define the fragment shader logic
   * based on their specific rendering requirements.
   */
  abstract buildVertexShader();

  /**
   * Abstract method to build the fragment shader source code.
   * Subclasses must implement this method to define the fragment shader logic
   * based on their specific rendering requirements.
   */
  abstract buildFragmentShader();

  /**
   * Inserts a line of custom vertex shader code into the generated vertex shader source.
   */
  protected vertexCode( src ) {
    this._vertexSrcBuf.push(src);
  }

  /**
   * Generates the vertex shader header.
   */
  protected vsHeader() {
    this._vertexSrcBuf
      .push(
        '#version 300 es',
        `// ${this.constructor.name} vertex shader`);
  }

  vsDebugMain() {
    this._vertexSrcBuf.push(
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
   * Generates the vertex shader precision definitions and common definitions.
   */
  protected vsCommonDefines() {
    this._vertexSrcBuf.push(
      "uniform int uRenderPass;         // RENDER_PASSES",
      "uniform int uBaseIndex;          // Base primitive tileIndex for this render call",

      "uniform highp usampler2D uPrimToMeshLookup;   // DTXPointerArray",
      "uniform highp usampler2D uPositions;          // DTXPositionsArray",
      "uniform highp usampler2D uIndices;            // DTXArray",
      "uniform highp usampler2D uEdgeIndices;        // DTXArray",
      "uniform highp sampler2D  uTileViewMatrices;   // DTXMatrixArray",
      "uniform highp sampler2D  uMeshMatrices;       // DTXMatrixArray",
      "uniform highp usampler2D uMeshAttribs;        // DTXMeshAttribs",
      "uniform highp usampler2D uMeshViewAttribs;    // DTXMeshViewAttribs",
      "uniform highp usampler2D uGeometryAttribs;    // DTXGeometryAttribs",
      "uniform highp sampler2D  uGeometryQuantRanges;// DTXQuantRanges",

      "uniform mat4 uProjMatrix;        // Projection matrix (from view)",

      "struct QuantRange {",
      "  vec3 offset;",
      "  vec3 scale;",
      "};",

      "struct MeshAttribs {",
      "  uint tileIndex;",
      "  uint geometryIndex;",
      "  uint indicesBase;",
      "  uint edgeIndicesBase;",
      "  uint primsBase;",
      "};",

      "struct MeshViewAttribs {",
      "  uvec4 color;",
      "  uvec4 flags1;",
      "  uvec4 flags2;",
      "};",

      "struct GeometryAttribs {",
      "  uint verticesBase;",
      "};",

      "ivec2 texCoord(uint index, uint texWidth) {",
      "  return ivec2(int(index % texWidth), int(index / texWidth));",
      "}",

      "uint getMeshIndex(uint drawPrimID) {",
   //    " return 0u;",
      "  const uint texWidth = 4096u;",
      "  return texelFetch(uPrimToMeshLookup, texCoord(drawPrimID, texWidth), 0).r;",
      "}",

    //   "uint getMeshIndex(uint drawPrimID) {",
    // //  " return 0u;",
    //   "  const uint texWidth = 4096u;",
    //   "  uvec4 px = texelFetch(uPrimToMeshLookup, texCoord(drawPrimID, texWidth), 0);",
    //   "  return (px.r) | (px.g << 8) | (px.b << 16) | (px.a << 24);",
    //   "}",

      "uint getVertexIndex(uint vertexIndexNum) {",
      "  const uint texWidth = 4096u;",
      "  return texelFetch(uIndices, texCoord(vertexIndexNum, texWidth), 0).r;",
      //
      // "  uvec4 packed = texelFetch(uIndices, texCoord(vertexIndexNum, texWidth), 0);",
      // "  return packed.r + (packed.g << 8u) + (packed.b << 16u) + (packed.a << 24u);",
      "}",

      "uvec3 getPosition(uint vertexIndex) {",
      "  const uint texWidth = 4096u;",
      "  return texelFetch(uPositions, texCoord(vertexIndex, texWidth), 0).rgb;",
      "}",

      "QuantRange getGeometryQuantRange(uint geometryIndex) {",
      "  const uint texWidth = 2048u;",
      "  const uint texelsPerItem = 2u;",
      "  uint base = geometryIndex * texelsPerItem;",
      "  vec4 t0 = texelFetch(uGeometryQuantRanges, texCoord(base + 0u, texWidth), 0);",
      "  vec4 t1 = texelFetch(uGeometryQuantRanges, texCoord(base + 1u, texWidth), 0);",
      "  QuantRange r;",
      "  r.offset = t0.rgb;",
      "  r.scale = t1.rgb;",
      "  return r;",
      "}",

      "GeometryAttribs getGeometryAttribs(uint geometryIndex) {",
      "  const uint texWidth = 4096u;",
      "  uvec4 lanes1 = texelFetch(uGeometryAttribs, texCoord((geometryIndex), texWidth), 0);",
      "  GeometryAttribs s;",
      "  s.verticesBase = lanes1.r;",
      // "  s.indicesBase = lanes1.g;",
      // "  s.edgeIndicesBase = lanes1.b;",
      "  return s;",
      "}",

      "MeshViewAttribs getMeshViewAttribs(uint meshIndex) {",
      "  const uint texWidth = 4096u;",
      "  uint base = meshIndex * 3u;",
      "  MeshViewAttribs s;",
      "  s.color  = texelFetch(uMeshViewAttribs, texCoord(base + 0u, texWidth), 0);",
      "  s.flags1 = texelFetch(uMeshViewAttribs, texCoord(base + 1u, texWidth), 0);",
      "  s.flags2 = texelFetch(uMeshViewAttribs, texCoord(base + 2u, texWidth), 0);",
      "  return s;",
      "}",

      "MeshAttribs getMeshAttribs(uint meshIndex) {",
      "  const uint texWidth = 4096u;",
      "  uvec4 lanes1 = texelFetch(uMeshAttribs, texCoord((meshIndex*2u) + 0u, texWidth), 0);",
      "  uvec4 lanes2 = texelFetch(uMeshAttribs, texCoord((meshIndex*2u) + 1u, texWidth), 0);",
      "  MeshAttribs s;",
      "  s.tileIndex      = lanes1.r;  // uint",
      "  s.geometryIndex  = lanes1.g;  // uint",
      "  s.indicesBase    = lanes1.b;  // uint",
      "  s.edgeIndicesBase= lanes1.a;  // uint",
      "  s.primsBase      = lanes2.r;  // uint",
      "  return s;",
      "}",

      "mat4 getTileViewMatrix(uint tileIndex) {",
      "  const uint matsPerRow = 512u;",
      "  const uint texWidth = matsPerRow * 4u;",
      "  uint base = tileIndex * 4u;",
      "  vec4 m0 = texelFetch(uTileViewMatrices, texCoord(base + 0u, texWidth), 0);",
      "  vec4 m1 = texelFetch(uTileViewMatrices, texCoord(base + 1u, texWidth), 0);",
      "  vec4 m2 = texelFetch(uTileViewMatrices, texCoord(base + 2u, texWidth), 0);",
      "  vec4 m3 = texelFetch(uTileViewMatrices, texCoord(base + 3u, texWidth), 0);",
      "  return mat4(m0, m1, m2, m3);",
      "}",

      "mat4 getMeshMatrix(uint meshIndex) {",

      // "  return mat4(1.0);",

      "  const uint matsPerRow = 512u;",
      "  const uint texWidth = matsPerRow * 4u;",
      "  uint base = meshIndex * 4u;",
      "  vec4 m0 = texelFetch(uMeshMatrices, texCoord(base + 0u, texWidth), 0);",
      "  vec4 m1 = texelFetch(uMeshMatrices, texCoord(base + 1u, texWidth), 0);",
      "  vec4 m2 = texelFetch(uMeshMatrices, texCoord(base + 2u, texWidth), 0);",
      "  vec4 m3 = texelFetch(uMeshMatrices, texCoord(base + 3u, texWidth), 0);",
      "  return mat4(m0, m1, m2, m3);",
      "}",


      "vec3 mockModelPos(int vid) {",
      "  int i = vid % 3;",
      "  if (i == 0) return vec3(-0.5, -0.5, 0.0);",
      "  if (i == 1) return vec3( 0.5, -0.5, 0.0);",
      "  return        vec3( 0.0,  0.5, 0.0);",
      "}",

      "mat4 mockViewMat() {",
      "  const vec3 eye = vec3(0.0, 0.0, 5.0);",
      "  const vec3 center = vec3(0.0, 0.0, 0.0);",
      "  const vec3 up = vec3(0.0, 1.0, 0.0);",
      "  vec3 f = normalize(center - eye);",
      "  vec3 s = normalize(cross(f, up));",
      "  vec3 u = cross(s, f);",
      "  return mat4(",
      "    vec4( s, 0.0),",
      "    vec4( u, 0.0),",
      "    vec4(-f, 0.0),",
      "    vec4(-vec3(dot(s, eye), dot(u, eye), dot(-f, eye)), 1.0)",
      "  );",
      "}",

      "mat4 mockProjMat() {",
      "  float fov = radians(90.0);",
      "  float near = 0.1;",
      "  float far  = 1000.0;",
      "  float aspect = 1.0;",
      "  float f = 1.0 / tan(fov * 0.5);",
      "",
      "  return mat4(",
      "    f / aspect, 0.0, 0.0, 0.0,",
      "    0.0,        f,   0.0, 0.0,",
      "    0.0,        0.0, (far + near) / (near - far), -1.0,",
      "    0.0,        0.0, (2.0 * far * near) / (near - far), 0.0",
      "  );",
      "}",

      "mat4 mockMeshMat() {",
      "  return mat4(1.0);",
      "}",

      "QuantRange mockQuantRange() {",
      "   QuantRange r;",
      "   r.offset = vec3(0.0);",
      "   r.scale = vec3(5.0);",
      "   return r;",
      "}",

      "uvec3 mockPosition(int vertexID) {",
      "    if (vertexID % 3 == 0) {",
      "        return uvec3(0, 0, 0);",
      "    } else if (vertexID % 3 == 1) {",
      "        return uvec3(1.5, 0, 0);",
      "    } else {",
      "        return uvec3(0, 1.5, 0);",
      "    }",
      "}"
    );
  }

  protected vsDrawLambertDefs() {
    this._vertexSrcBuf.push(
      "out vec4 vColor;",
      "out vec4 vViewPos;");
  }

  protected vsSilhouetteDefines() {
    this._vertexSrcBuf.push(
      "uniform vec4 uSilhouetteColor;",
      "out vec4 vColor;");
  }

  protected vsDrawFlatColorDefs() {
    this._vertexSrcBuf.push(
      "out vec4 vColor;");
  }

  protected vsPointsDefines(): void {
    this._vertexSrcBuf.push(
      "uniform float nearPlaneHeight;",
      "uniform vec2 intensityRange;",
      "uniform float pointSize;");
  }

  protected vsPickMeshDefs() {
    this._vertexSrcBuf.push(
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

  protected vsSlicingDefines() {
    // if (this._renderContext.view.getNumAllocatedSectionPlanes() > 0) {
    //   const src = this._vertexSrcBuf;
    //   src.push("out vec4 vWorldPosition;");
    //   src.push("out boolean vClippable;");
    // }
  }

  protected vsDrawMainOpen() { // default
    this._vertexSrcBuf.push(
      "void main(void) {");
    this._vertexMeshLogic();
    // this._vertexSrcBuf.push(
    //   `    int colorFlag = int(meshViewAttribs.flags1.r & 0xFu);`,
    //   `    if ( colorFlag != uRenderPass) {`,
    //   "        gl_Position = vec4(2.0, 0.0, 0.0, 1.0);",
    //   "        return;",
    //   "    } ");
    this._vertexMeshLogic2();
  }

  protected vsSilhouetteMainOpen() { // silhouette
    this._vertexSrcBuf.push(
      "void main(void) {");
    this._vertexMeshLogic();
    // this._vertexSrcBuf.push(
    //   "    int silhouetteFlag = int (meshViewAttribs.flags1.g >> 4u & 0xFu);",
    //   `    if (silhouetteFlag != uRenderPass) {`,
    //   "        gl_Position = vec4(2.0, 0.0, 0.0, 1.0);",
    //   "        return;",
    //   "    }");
    this._vertexMeshLogic2();
  }

  protected vertexPickMainOpen() { // pick
    this._vertexSrcBuf.push(
      "void main(void) {");
    this._vertexMeshLogic();
    this._vertexSrcBuf.push(
      `    int pickFlag = int(meshViewAttribs.flags1.b >> 8u & 0xFu);`,
      `    if (pickFlag != uRenderPass) {`,
      "        gl_Position = vec4(2.0, 0.0, 0.0, 1.0);",
      "        return;",
      "    }");
    this._vertexMeshLogic2();
  }

  protected vsMainClose() { // default, silhouette, pick
    this._vertexSrcBuf.push(
      "}");
  }

  protected vsSlicingLogic() {
    // if (this._renderContext.view.getNumAllocatedSectionPlanes() > 0) {
    //   const src = this._vertexSrcBuf;
    //   src.push("      vWorldPosition = worldPos;");
    //   src.push("      vClippable = (int(meshViewAttribs.flags1) >> 12 & 0xF) == 1;");
    // }
  }

  private _vertexMeshLogic() { // before renderPass check
    this._vertexSrcBuf.push(
      "    uint drawVertexID     = uint(uBaseIndex + gl_VertexID);",
        "    uint drawPrimID       = drawVertexID / 3u;",

      "    uint meshIndex = getMeshIndex( drawPrimID );", // Per-prim

     // "    uint meshIndex = getMeshIndex( drawVertexID);", // Per-vertex

      "    MeshViewAttribs meshViewAttribs = getMeshViewAttribs( meshIndex );",

      `    if (meshViewAttribs.color.a == 3u) {`,
      "              gl_Position = vec4(3.0, 3.0, 3.0, 1.0);", // Cull vertex
      "              return;",
      "    };"
    );
  }

  private _vertexMeshLogic2() { // after renderPass check
    this._vertexSrcBuf.push(
      "    MeshAttribs      meshAttribs       = getMeshAttribs( meshIndex );", // Attributes global to meshes in all views
      "    uint             geometryIndex     = meshAttribs.geometryIndex;",
      "    GeometryAttribs  geometryAttribs   = getGeometryAttribs( geometryIndex );", // Geometry attributes
      "    uint             vertexIndex       = getVertexIndex( drawVertexID );", // Index of vertex global positions array
      "    mat4             viewMatrix        = getTileViewMatrix( meshAttribs.tileIndex );",
      "    mat4             meshMatrix        = getMeshMatrix( meshIndex );",
      "    uvec3            quantPos          = getPosition( vertexIndex );",
      "    QuantRange       quantRange        = getGeometryQuantRange( geometryIndex );",
      "    vec4             modelPos          = vec4( quantRange.offset + (quantRange.scale * vec3( quantPos )), 1.0); ",
      "    vec4             worldPos          = meshMatrix * modelPos; ",
      "    vec4             viewPos           = viewMatrix * worldPos; ",
      "    vec4             clipPos           = uProjMatrix * viewPos; ",
      "    gl_Position = clipPos;");
  }

  protected vsDrawLambertLogic() {
    this._vertexSrcBuf.push(
      "    vec4 color = vec4(meshViewAttribs.color) / 255.0;",
      "    vColor = vec4(color.rgb, 1.0);");

    // this._vertexSrcBuf.push(
    //   "    vColor = vec4(1.0, 0.0, 0.0, 1.0);"
    // );
  }

  protected vsSilhouetteLogic() {
    this._vertexSrcBuf.push(
      //  "    vColor = vec4(uSilhouetteColor.r, uSilhouetteColor.g, uSilhouetteColor.b, 0.5);"
      "    vColor = vec4(1.0, 1.0, 0.0, 1.0);"
    );
  }

  protected vsDrawFlatColorLogic() {
    this._vertexSrcBuf.push(
      // "    vec4 color = vec4(meshViewAttribs.color) / 255.0;",
      // "    vColor = vec4(color.rgb, 1.0);"

      "    vColor = vec4(1.0, 1.0, 0.0, 1.0);"
    );
  }

  protected vertexPickMeshLogic() {
    this._vertexSrcBuf.push(
      "    vPickColor = vec4(float(pickColor.r) / 255.0, float(pickColor.g) / 255.0, float(pickColor.b) / 255.0, float(pickColor.a) / 255.0);");
  }


  protected vertexPointsFilterLogicOpenBlock() {
    // const src = this._vertexSrcBuf;
    // const pointsMaterial = this._renderContext.view.pointsMaterial;
    // if (pointsMaterial.filterIntensity) {
    //   src.push("float intensity = float(color.a) / 255.0;")
    //   src.push("if (intensity < intensityRange[0] || intensity > intensityRange[1]) {");
    //   src.push("   gl_Position = vec4(2.0, 0.0, 0.0, 0.0);");
    //   src.push("} else {");
    // }
  }

  protected vertexPointsFilterLogicCloseBlock() {
    // const pointsMaterial = this._renderContext.view.pointsMaterial;
    // if (pointsMaterial.filterIntensity) {
    //   this._vertexSrcBuf.push("}");
    // }
  }

  protected vertexPointsGeometryLogic() {
    const src = this._vertexSrcBuf;
    const pointsMaterial = this._renderContext.view.pointsMaterial;
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
  protected fragmentCode( src ) {
    this._fragmentSrcBuf.push(src);
  }

  protected fsHeader() {
    this._fragmentSrcBuf.push(
      '#version 300 es',
      `// ${this.constructor.name} fragment shader`);
  }

  protected fsPrecisionDefines() {
    this._fragmentSrcBuf.push(
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

  protected fsCommonDefines() {
    this._fragmentSrcBuf.push(
      "vec4 color;",
      "out vec4 outColor;");
  }

  protected fsSilhouetteDefines() {
    this._fragmentSrcBuf.push(
      "in vec4 vColor;"
    );
  }

  protected fsDrawFlatColorDefines() {
    this._fragmentSrcBuf.push("in vec4 vColor;");
  }

  protected fsDrawLambertDefs() {
    const src = this._fragmentSrcBuf;
    const view = this._renderContext.view;
    src.push(
      "in vec4 vColor;",
      "in vec4 vViewPos;",
      "uniform vec4 lightAmbient;");
    // view.lightsList.forEach((light, i) => {
    //   if (!(light instanceof AmbientLight)) {
    //     src.push(`uniform vec4 lightColor${i};`);
    //     if (light instanceof DirLight) {
    //       src.push(`uniform vec3 lightDir${i};`);
    //     } else if (light instanceof PointLight) {
    //       src.push(`uniform vec3 lightPos${i};`);
    //     }
    //   }
    // });
  }

  protected fragmentDrawDepthDefs() {
    this._fragmentSrcBuf.push("in vec2 vHighPrecisionZW;");
  }

  protected fragmentDrawSAODefs() {
    this._fragmentSrcBuf.push(
      "uniform sampler2D saoOcclusionTexture;",
      "uniform vec4      saoParams;",
      "const float       saoUnpackDownScale = 255. / 256.;",
      "const vec3        saoPackFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );",
      "const vec4        saoUnpackFactors = saoUnpackDownScale / vec4( saoPackFactors, 1. );",
      "float saoUnpackRGBToFloat( const in vec4 v ) {",
      "    return dot( v, saoUnpackFactors );",
      "}");
  }


  protected fragmentPickMeshDefs() {
    this._fragmentSrcBuf.push(
      "in vec4 vPickColor;");
  }

  protected fsSlicingDefines() {
    // const numSectionPlanes = this._renderContext.view.getNumAllocatedSectionPlanes();
    // if (numSectionPlanes === 0) {
    //   return;
    // }
    // const src = this._fragmentSrcBuf;
    // src.push("in vec4 vWorldPosition;");
    // src.push("in boolean vClippable;");
    // for (let i = 0; i < numSectionPlanes; i++) {
    //   src.push("uniform bool sectionPlaneActive" + i + ";");
    //   src.push("uniform vec3 sectionPlanePos" + i + ";");
    //   src.push("uniform vec3 sectionPlaneDir" + i + ";");
    // }
  }

  protected fsMainOpen() {
    this._fragmentSrcBuf.push(
      "void main(void) {");
  }

  protected fsMainClose() {
    this._fragmentSrcBuf.push(
      "}");
  }

  protected fsDrawLambertLogic() {
    const src = this._fragmentSrcBuf;
    const view = this._renderContext.view;
    this._fragmentSrcBuf.push(
      "    color = vColor;"
    );
    //
    // "vec3 reflectedColor = vec3(0.0, 0.0, 0.0);",
    // "vec3 viewLightDir = vec3(0.0, 0.0, -1.0);",
    // "float lambertian = 1.0;",
    // "vec3 xTangent = dFdx( vViewPos.xyz );",
    // "vec3 yTangent = dFdy( vViewPos.xyz );",
    // "vec3 viewNormal = normalize( cross( xTangent, yTangent ) );");
    // for (let i = 0, len = view.lightsList.length; i < len; i++) {
    //   const light = view.lightsList[i];
    //   if (light instanceof AmbientLight) {
    //     continue;
    //   }
    //   if (light instanceof DirLight) {
    //     src.push(`viewLightDir = normalize(lightDir${i});`);
    //   } else if (light instanceof PointLight) {
    //     src.push(`viewLightDir = -normalize(lightPos${i} - viewPos.xyz);`);
    //   } else {
    //     continue;
    //   }
    //   src.push("lambertian = max(dot(-viewNormal, viewLightDir), 0.0);");
    //   src.push(`reflectedColor += lambertian * (lightColor${i}.rgb * lightColor${i}.a);`);
    // }
    // src.push("color = vec4((lightAmbient.rgb * lightAmbient.a * vColor.rgb) + (reflectedColor * vColor.rgb), vColor.a);");
  }

  protected fsDrawFlatColorLogic() {
    this._fragmentSrcBuf.push(
      "    color = vColor;");
  }

  protected fragmentDrawSAOLogic() {
    this._fragmentSrcBuf.push(
      "   float saoViewportWidth = saoParams[0];",
      "   float saoViewportHeight = saoParams[1];",
      "   float saoBlendCutoff = saoParams[2];",
      "   float saoBlendFactor = saoParams[3];",
      "   vec2  saoUV = vec2(gl_FragCoord.x / saoViewportWidth, gl_FragCoord.y / saoViewportHeight);",
      "   float saoAmbient = smoothstep(saoBlendCutoff, 1.0, saoUnpackRGBToFloat(texture(saoOcclusionTexture, saoUV))) * saoBlendFactor;",
      "   color = vec4(color.rgb * saoAmbient, 1.0);");
  }

  protected fragmentDrawDepthLogic() {
    this._fragmentSrcBuf.push(
      "    float depthFragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;",
      "    color = vec4(vec3(1.0 - depthFragCoordZ), 1.0); ");
  }

  protected fsSilhouetteLogic() {
    this._fragmentSrcBuf.push(
      "    color = vColor;");
  }

  protected fragmentPickMeshLogic() {
    this._fragmentSrcBuf.push(
      "    color = vPickColor;");
  }

  protected fsSlicingLogic() {
    // const numSectionPlanes = this._renderContext.view.getNumAllocatedSectionPlanes();
    // if (numSectionPlanes === 0) {
    //   return;
    // }
    // const src = this._fragmentSrcBuf;
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

  protected fragmentPointsGeometryLogic(): void {
    //if (this._renderContext.view.pointsMaterial.roundPoints) {
    // const src = this._fragmentSrcBuf;
    // src.push("  vec2 cxy = 2.0 * gl_PointCoord - 1.0;");
    // src.push("  float r = dot(cxy, cxy);");
    // src.push("  if (r > 1.0) {");
    // src.push("       discard;");
    // src.push("  }");
    //   }
  }

  protected fsCommonOutput() {
    this._fragmentSrcBuf.push(
      "    outColor = color;"
      //"    outColor= vec4(1.0, 0.0, 1.0, 1.0);"
    );
  }

  /**
   * Renders a _layer.
   * @param layer The _layer to render, which contains the primitives and their attributes.
   * @param renderPass The render pass identifier, which determines the rendering context (e.g., solid fill, silhouette, picking).
   */
  renderLayer( layer: RenderLayer, renderPass: RenderPassValue ): void {
    if (!this._program) {
      throw new Error("Shader program is not initialized.");
    }
    if (!layer) {
      throw new Error("Invalid _layer provided.");
    }
    if (renderPass < 0) {
      throw new Error("Invalid render pass provided.");
    }
    if (!this._bind(renderPass)) {
      return;
    }

    const renderContext = this._renderContext;
    const view = renderContext.view;
    const gl = this._renderContext.gl;

    renderContext.textureUnit = 0;

    const bindTexture = ( sampler, texture ) => {
      if (!sampler || !texture) {
        return;
      }

      gl.activeTexture(gl["TEXTURE" + renderContext.textureUnit]);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(sampler, renderContext.textureUnit);
      renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
    }

    const samplers = this._samplers;
    const dataTextures = this._gpuMemoryReadIF.dataTextures;
    const layerDataTextures = dataTextures.layers[layer.gpuLayerIndex];

    bindTexture(samplers.tileViewMatrices, dataTextures.tileViewMatrices[view.viewIndex].texture); // TODO: Bind this texture once in _bind()

    bindTexture(samplers.primToMeshLookup, layerDataTextures.primToMeshLookup);
    bindTexture(samplers.positions, layerDataTextures.positions);
    bindTexture(samplers.meshMatrices, layerDataTextures.meshMatrices);
    bindTexture(samplers.meshAttribs, layerDataTextures.meshAttribs);
    bindTexture(samplers.meshViewAttribs, layerDataTextures.meshViewAttribs[view.viewIndex]);
    bindTexture(samplers.geometryAttribs, layerDataTextures.geometryAttribs);
    bindTexture(samplers.geometryQuantRanges, layerDataTextures.geometryQuantRanges);
    bindTexture(samplers.edgeIndices, layerDataTextures.edgeIndices);
    bindTexture(samplers.indices, layerDataTextures.indices);

    gl.uniform1i(this._uniforms.baseIndex, layer.baseIndex);

    switch (layer.primitive) {
      case TrianglesPrimitive:
        gl.drawArrays(gl.TRIANGLES, 0, layer.numIndices);
        break;
      case LinesPrimitive:
        gl.drawArrays(gl.LINES, 0, layer.numIndices);
        break;
      case PointsPrimitive:
        gl.drawArrays(gl.POINTS, 0, layer.numIndices);
        break;
      default:
        console.error(`Unsupported Layer primitive type: ${layer.primitive}`);
    }
    // TODO: Add support for drawing only a portion of the indices?
  }

  /**
   * Binds the shader program and sets up the necessary uniforms and textures for rendering.
   * @param renderPass The render pass identifier, which determines the rendering context (e.g., solid fill, silhouette, picking).
   * @private
   */
  private _bind( renderPass: RenderPassValue ): boolean {

    const view = this._renderContext.view;
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

    gl.uniform1i(uniforms.renderPass, renderPass);

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
        if (renderPass === RENDER_PASSES.SILHOUETTE_XRAYED) {
          const material = view.xrayMaterial;
          const color = material.edgeColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        } else if (renderPass === RENDER_PASSES.SILHOUETTE_HIGHLIGHTED) {
          const material = view.highlightMaterial;
          const color = material.edgeColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        } else if (renderPass === RENDER_PASSES.SILHOUETTE_SELECTED) {
          const material = view.selectedMaterial;
          const color = material.edgeColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        } else {
          gl.uniform4fv(uniforms.silhouetteColor, defaultColor);
        }
      } else {
        if (renderPass === RENDER_PASSES.SILHOUETTE_XRAYED) {
          const material = view.xrayMaterial;
          const color = material.fillColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
        } else if (renderPass === RENDER_PASSES.SILHOUETTE_HIGHLIGHTED) {
          const material = view.highlightMaterial;
          const color = material.fillColor;
          gl.uniform4f(uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
        } else if (renderPass === RENDER_PASSES.SILHOUETTE_SELECTED) {
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

  private _build(): void {

    const view = this._renderContext.view;
    const gl = this._renderContext.gl;

    this._vertexSrcBuf = [];
    this._fragmentSrcBuf = [];

    this.buildVertexShader()
    this.buildFragmentShader()

    this._program = new WebGLProgram(gl, {
      vertex: joinSansComments(this._vertexSrcBuf),
      fragment: joinSansComments(this._fragmentSrcBuf)
    });

    this._vertexSrcBuf = [];
    this._fragmentSrcBuf = [];

    if (this._program.errors) {
      this.errors = this._program.errors;
      return;
    }

    const program = this._program;

    this._uniforms = {
      baseIndex: program.getLocation("uBaseIndex"),
      renderPass: program.getLocation("uRenderPass"),
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
      primToMeshLookup: program.getSampler("uPrimToMeshLookup"),
      meshAttribs: program.getSampler("uMeshAttribs"),
      meshViewAttribs: program.getSampler("uMeshViewAttribs"),
      meshMatrices: program.getSampler("uMeshMatrices"),
      geometryAttribs: program.getSampler("uGeometryAttribs"),
      geometryQuantRanges: program.getSampler("uGeometryQuantRanges"),
      tileViewMatrices: program.getSampler("uTileViewMatrices"),
      positions: program.getSampler("uPositions"),
      indices: program.getSampler("uIndices"),
      edgeIndices: program.getSampler("uEdgeIndices"),
      saoOcclusionTexture: program.getSampler("saoOcclusionTexture")
    };
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


function joinSansComments( srcLines ) {
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
