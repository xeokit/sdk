import {AmbientLight, DirLight, PointLight} from "../../viewer";
import {WEBGL_INFO, WebGLProgram} from "../../webglutils";
import {LinesPrimitive, OrthoProjectionType, PointsPrimitive, TrianglesPrimitive} from "../../constants";
import {RENDER_PASSES} from "../layers/RENDER_PASSES";
import type {RenderContext} from "../RenderContext";
import {type Layer} from "../layers/Layer";
import {type GPUDataMemoryViewIF} from "../gpuDataMemory/GPUDataMemoryViewIF";

const defaultColor = new Float32Array([1, 1, 1, 1]);

export type RenderPassValue = typeof RENDER_PASSES[keyof typeof RENDER_PASSES];

/**
 * Abstract base class for rendering layers in a WebGL context.
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
 * We avoid VBO attribute streams and instead fetch all per-draw data from textures
 * with texelFetch(). A 1D logical index is mapped into 2D texel coords using a fixed
 * width (texWidth = 4096): x = base % 4096, y = base / 4096.
 *
 * Integer data is stored in INTEGER textures and fetched via `usampler2D` so values
 * are NOT normalized. Float data (matrices/colors/scales) uses `sampler2D`.
 *
 * Textures and roles:
 * - primToMeshLookup (usampler2D): u32 mesh index per primitive (packed in RGBA bytes).
 * - uniqueIndices / uniqueEdgeIndices (usampler2D): connectivity indices (u32 packed RGBA).
 * - positions (usampler2D): quantized vertex positions; one texel per vertex, RGB = X,Y,Z
 *   (e.g., RGBA16UI with A unused). Dequant in VS: offset + scale * vec3(q.rgb).
 * - geometryAttributes (sampler2D): per-geometry dequant params (vec3 offset/scale) and
 *   vertexBase (when stored as u32, fetch from an integer page or pack/unpack accordingly).
 * - meshAttributes (sampler2D): per-mesh view flags/color and indices to other tables.
 * - meshMatrices / tileViewMatrices (sampler2D): model/view mat4 packed as 4 vec4 texels,
 *   atlas-organized with matsPerRow for addressing.
 *
 * Vertex shader flow:
 *   primIndex = gl_VertexID / 3
 *   meshIndex = getMeshIndexForPrim(primIndex)
 *   meshAttrs = getMeshAttributes(meshIndex)
 *   vertexIndex = getVertexIndex(meshAttrs.uniqueIndicesBase + primIndex)
 *   qPos      = texelFetch(positions, uv(vertexIndex), 0).rgb  // integer RGB
 *   geomAttrs = getGeometryAttributes(meshAttrs.geometryIndex)
 *   modelPos  = vec4(geomAttrs.dequantizeOffset + geomAttrs.dequantizeScale * vec3(qPos), 1.0)
 *   worldPos  = modelMatrix(meshIndex) * modelPos
 *   viewPos   = tileViewMatrix(meshAttrs.tileIndex) * worldPos
 *   gl_Position = projMatrix * viewPos
 *
 * Why textures:
 * - Scales to huge scenes; updates are partial via texSubImage2D.
 * - Avoids large/fragmented VBOs; all addressing is done in-shader with texelFetch().
 */
export abstract class LayerRenderer {

  private _renderContext: RenderContext;
  private _dtxMemoryView: GPUDataMemoryViewIF;
  private _program: WebGLProgram | null;

  errors: string[];
  edges: boolean;

  /**
   * Uniforms and attributes for the shader program.
   * Populated during the `build()` method based on what's included in the shader source.
   */
  private _uniforms: {
    primitiveBase: WebGLUniformLocation;
    viewIndex: WebGLUniformLocation;
    renderPass: WebGLUniformLocation;
    pointCloudIntensityRange: WebGLUniformLocation;
    nearPlaneHeight: WebGLUniformLocation;
    silhouetteColor: WebGLUniformLocation;
    gammaFactor: WebGLUniformLocation;
    pickZNear: WebGLUniformLocation;
    snapCameraEyeRTC: WebGLUniformLocation;
    pointSize: WebGLUniformLocation;
    intensityRange: WebGLUniformLocation;
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
    primToMeshLookup: string; // Prim index -> mesh lookup
    meshAttributes: string; // Mesh attributes
    meshViewAttributes: string; // Mesh view attributes
    meshMatrices: string; // RTC modeling matrices
    geometryAttributes: string; // Geometry attributes
    positions: string; // World-space vertex positions
    uniqueIndices: string; // Primitive connectivity indices
    uniqueEdgeIndices: string; // Edge connectivity indices
    tileViewMatrices: string;
    saoOcclusionTexture: string;
  };

  private _vertexSrcBuf: string[];
  private _fragmentSrcBuf: string[];


  /**
   * Creates a new LayerRenderer instance.
   * @param renderContext
   * @param dtxMemoryView
   * @param cfg
   */
  constructor(renderContext: RenderContext, dtxMemoryView: GPUDataMemoryViewIF, cfg: { edges: boolean } = {edges: false}) {
    this._renderContext = renderContext;
    this._dtxMemoryView = dtxMemoryView;
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
  protected vertexCode(src) {
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

  /**
   * Generates the vertex shader precision definitions and common definitions.
   */
  protected vsCommonDefines() {
    this._vertexSrcBuf.push(
      "uniform int primitiveBase;",
      "uniform int viewIndex;",
      "uniform int renderPass;",

      "uniform highp usampler2D primToMeshLookup;",
      "uniform highp sampler2D tileViewMatrices;",
      "uniform highp usampler2D positions;",
      "uniform highp usampler2D uniqueIndices;",
      "uniform highp usampler2D edgeIndices;",
      "uniform highp sampler2D meshMatrices;",
      "uniform highp sampler2D meshAttributes;",
      "uniform highp sampler2D meshViewAttributes;",
      "uniform highp sampler2D geometryAttributes;",

      "uniform mat4 projMatrix;",

      "struct GeometryAttributes {",
      "  uint vertexBase;",
      "  vec3 dequantizeOffset;",
      "  vec3 dequantizeScale;",
      "};",

      "struct MeshAttributes {",
      "  uint tileIndex;",
      "  uint geometryIndex;",
      "  uint uniqueIndicesBase;",
      "  uint uniqueEdgeIndicesBase;",
      "};",

      "struct MeshViewAttributes {",
      "  vec4 color;",
      "  vec4 flags1;",
      "  vec4 flags2;",
      "};",

      // TODO: Light struct and SectionPlane struct

      "uint getVertexIndex(uint index) {",
      "  uint texWidth = 4096u;",
      "  uvec4 packed = texelFetch(uniqueIndices, ivec2(index % texWidth, index / texWidth), 0);",
      "  return packed.r + (packed.g << 8u) + (packed.b << 16u) + (packed.a << 24u);",
      "}",

      "uvec3 getPosition(uint vertexIndex) {",
      "  uint texWidth = 4096u;",
      "  return texelFetch(positions, ivec2(vertexIndex % texWidth, vertexIndex / texWidth), 0).rgb;",
      "}",

      // "uvec3[3] getPositions(uint ia, uint ib, uint ic) {",
      // "  uvec3 positions[3];",
      // "  positions[0] = getPosition(ia);",
      // "  positions[1] = getPosition(ib);",
      // "  positions[2] = getPosition(ic);",
      // "  return positions;",
      // "}",

      "GeometryAttributes getGeometryAttributes(uint geometryIndex) {",
      "  GeometryAttributes s;",
      "  uint texWidth = 4096u;",
      "  uint base = geometryIndex * 12u;",
      "  vec4 packed1 = texelFetch(geometryAttributes, ivec2((base + 0u) % texWidth, (base + 0u) / texWidth), 0);",
      "  s.vertexBase = uint(packed1.r) + (uint(packed1.g) << 8u) + (uint(packed1.b) << 16u) + (uint(packed1.a) << 24u);",
      "  s.dequantizeOffset  = texelFetch(geometryAttributes, ivec2((base + 4u) % texWidth, (base + 4u) / texWidth), 0).rgb;",
      "  s.dequantizeScale  = texelFetch(geometryAttributes, ivec2((base + 8u) % texWidth, (base + 8u) / texWidth), 0).rgb;",
      "  return s;",
      "}",

      "uint getMeshIndexForPrim(uint primIndex) {",
      "  uint texWidth = 4096u;",
      "  uvec4 packed = texelFetch(primToMeshLookup, ivec2(primIndex % texWidth, primIndex / texWidth), 0);",
      "  return uint(packed.r) + (uint(packed.g) << 8u) + (uint(packed.b) << 16u) + (uint(packed.a) << 24u);",
      "}",

      "MeshAttributes getMeshAttributes(uint meshIndex) {",
      "  MeshAttributes s;",
      "  uint texWidth = 4096u;",
      "  uint base = meshIndex * 16u;",
      "  vec4 packed1 = texelFetch(meshAttributes, ivec2((base + 0u) % texWidth, (base + 0u) / texWidth), 0);",
      "  s.tileIndex = uint(packed1.r) + (uint(packed1.g) << 8u) + (uint(packed1.b) << 16u) + (uint(packed1.a) << 24u);",
      "  vec4 packed2 = texelFetch(meshAttributes, ivec2((base + 4u) % texWidth, (base + 4u) / texWidth), 0);",
      "  s.geometryIndex = uint(packed2.r) + (uint(packed2.g) << 8u) + (uint(packed2.b) << 16u) + (uint(packed2.a) << 24u);",
      "  vec4 packed3 = texelFetch(meshAttributes, ivec2((base + 8u) % texWidth, (base + 8u) / texWidth), 0);",
      "  s.uniqueIndicesBase = uint(packed3.r) + (uint(packed3.g) << 8u) + (uint(packed3.b) << 16u) + (uint(packed3.a) << 24u);",
      "  vec4 packed4 = texelFetch(meshAttributes, ivec2((base + 12u) % texWidth, (base + 12u) / texWidth), 0);",
      "  s.uniqueEdgeIndicesBase = uint(packed4.r) + (uint(packed4.g) << 8u) + (uint(packed4.b) << 16u) + (uint(packed4.a) << 24u);",
      "  return s;",
      "}",

      "MeshViewAttributes getMeshViewAttributes(uint meshIndex) {",
      "  MeshViewAttributes s;",
      "  uint texWidth = 4096u;",
      "  uint base = meshIndex * 12u;",
      "  s.flags1 = texelFetch(meshViewAttributes, ivec2((base + 0u) % texWidth, (base + 0u) / texWidth), 0);",
      "  s.flags2 = texelFetch(meshViewAttributes, ivec2((base + 4u) % texWidth, (base + 4u) / texWidth), 0);",
      "  s.color  = texelFetch(meshViewAttributes, ivec2((base + 8u) % texWidth, (base + 8u) / texWidth), 0);",
      "  return s;",
      "}",

      "mat4 getTileViewMatrix(uint tileIndex) {",
      "  uint matsPerRow = 512u;",
      "  uint texWidth = matsPerRow * 4u;",
      "  uint base = tileIndex * 4u;",
      "  vec4 m0 = texelFetch(tileViewMatrices, ivec2((base + 0u) % texWidth, (base + 0u) / texWidth), 0);",
      "  vec4 m1 = texelFetch(tileViewMatrices, ivec2((base + 1u) % texWidth, (base + 1u) / texWidth), 0);",
      "  vec4 m2 = texelFetch(tileViewMatrices, ivec2((base + 2u) % texWidth, (base + 2u) / texWidth), 0);",
      "  vec4 m3 = texelFetch(tileViewMatrices, ivec2((base + 3u) % texWidth, (base + 3u) / texWidth), 0);",
      "  return mat4(m0, m1, m2, m3);",
      "}",

      "mat4 getMeshMatrix(uint meshIndex) {",
      "  uint matsPerRow = 512u;",
      "  uint texWidth = matsPerRow * 4u;",
      "  uint base = meshIndex * 4u;",
      "  vec4 m0 = texelFetch(meshMatrices, ivec2((base + 0u) % texWidth, (base + 0u) / texWidth), 0);",
      "  vec4 m1 = texelFetch(meshMatrices, ivec2((base + 1u) % texWidth, (base + 1u) / texWidth), 0);",
      "  vec4 m2 = texelFetch(meshMatrices, ivec2((base + 2u) % texWidth, (base + 2u) / texWidth), 0);",
      "  vec4 m3 = texelFetch(meshMatrices, ivec2((base + 3u) % texWidth, (base + 3u) / texWidth), 0);",
      "  return mat4(m0, m1, m2, m3);",
      "}");
  }

  protected vsDrawLambertDefs() {
    this._vertexSrcBuf.push(
      "out vec4 vColor;",
      "out vec4 vViewPosition;");
  }

  protected vsSilhouetteDefines() {
    this._vertexSrcBuf.push(
      "uniform vec4 silhouetteColor;",
      "out vec4 vColor;");
  }

  protected vertexDrawFlatColorDefs() {
    this._vertexSrcBuf.push(
      "out vec4 vColor;");
  }

  protected vsPointsDefines(): void {
    this._vertexSrcBuf.push(
      "uniform float nearPlaneHeight;",
      "uniform vec2 intensityRange;",
      "uniform float pointSize;");
  }

  protected vertexPickMeshDefs() {
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

  protected vsDrawMainOpen() {
    this._vertexSrcBuf.push(
      "void main(void) {");
    this._vertexMeshLogic();
    this._vertexSrcBuf.push(
      `      int colorFlag = (int(meshViewAttributes.flags1) & 0xF);`,
      `      if (colorFlag != renderPass) {`,
      "          gl_Position = vec4(2.0, 0.0, 0.0, 1.0);",
      "      } else {");
    this._vertexMeshLogic2();
  }

  protected vsSilhouetteMainOpen() {
    this._vertexSrcBuf.push(
      "void main(void) {");
    this._vertexMeshLogic();
    this._vertexSrcBuf.push(
      "      int silhouetteFlag = (int(meshViewAttributes.flags1) >> 4 & 0xF);",
      `      if (silhouetteFlag != renderPass) {`,
      "          gl_Position = vec4(2.0, 0.0, 0.0, 1.0);",
      "      } else {");
    this._vertexMeshLogic2();
  }

  protected vertexPickMainOpen() {
    this._vertexSrcBuf.push(
      "void main(void) {");
    this._vertexMeshLogic();
    this._vertexSrcBuf.push(
      `      int pickFlag = (int(meshViewAttributes.flags1) >> 8 & 0xF);`,
      `      if (pickFlag != renderPass) {`,
      "          gl_Position = vec4(2.0, 0.0, 0.0, 1.0);",
      "      } else {");
    this._vertexMeshLogic2();
  }

  protected vsMainClose() {
    this._vertexSrcBuf.push(
      "      }",
      "}");
  }

  protected vsSlicingLogic() {
    // if (this._renderContext.view.getNumAllocatedSectionPlanes() > 0) {
    //   const src = this._vertexSrcBuf;
    //   src.push("      vWorldPosition = worldPosition;");
    //   src.push("      vClippable = (int(meshViewAttributes.flags1) >> 12 & 0xF) == 1;");
    // }
  }

  private _vertexMeshLogic() {
    this._vertexSrcBuf.push(
      "          uint primIndex = uint(gl_VertexID / 3);", // TODO: Assumes triangles
      "          uint meshIndex = getMeshIndexForPrim(primIndex);",
      "          MeshViewAttributes meshViewAttributes = getMeshViewAttributes(meshIndex);",
      `          if (meshViewAttributes.color.a == 0.0) {`,
      //    "              gl_Position = vec4(3.0, 3.0, 3.0, 1.0);", // Cull vertex
      //  "              return;",
      "          };");
  }

  private _vertexMeshLogic2() {
    this._vertexSrcBuf.push(
      "          MeshAttributes meshAttributes = getMeshAttributes(meshIndex);",
      "          mat4 viewMatrix = getTileViewMatrix(meshAttributes.tileIndex);",
      "          mat4 modelMatrix = getMeshMatrix(meshIndex);",
      "          uint vertexIndex = getVertexIndex(meshAttributes.uniqueIndicesBase + primIndex);",
      "          uvec3 position = getPosition(vertexIndex);",
      "          GeometryAttributes geometryAttributes = getGeometryAttributes(meshAttributes.geometryIndex);",
      "          vec4 modelPosition = (vec4(geometryAttributes.dequantizeOffset + (geometryAttributes.dequantizeScale * vec3(position)), 1.0)); ",
      "          vec4 worldPosition = modelMatrix * modelPosition; ",
      "          vec4 viewPosition  = viewMatrix * worldPosition; ",
      "          gl_Position = projMatrix * viewPosition;");
  }

  protected vsDrawLambertLogic() {
    this._vertexSrcBuf.push(
      "          vec4 color = meshViewAttributes.color;",
      "          vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);",
      "          vViewPosition = viewPosition;");
  }

  protected vsSilhouetteLogic() {
    this._vertexSrcBuf.push(
      "          vColor = vec4(silhouetteColor.r, silhouetteColor.g, silhouetteColor.b, 0.5);");
  }

  protected vsDrawFlatColorLogic() {
    this._vertexSrcBuf.push(
      "          vec4 color = meshViewAttributes.color;",
      "          vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);");
  }

  protected vertexPickMeshLogic() {
    this._vertexSrcBuf.push(
      "          vPickColor = vec4(float(pickColor.r) / 255.0, float(pickColor.g) / 255.0, float(pickColor.b) / 255.0, float(pickColor.a) / 255.0);");
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
  protected fragmentCode(src) {
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
      "in vec4 vViewPosition;",
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
    this._fragmentSrcBuf.push("vec3 reflectedColor = vec3(0.0, 0.0, 0.0);",
      "vec3 viewLightDir = vec3(0.0, 0.0, -1.0);",
      "float lambertian = 1.0;",
      "vec3 xTangent = dFdx( vViewPosition.xyz );",
      "vec3 yTangent = dFdy( vViewPosition.xyz );",
      "vec3 viewNormal = normalize( cross( xTangent, yTangent ) );");
    // for (let i = 0, len = view.lightsList.length; i < len; i++) {
    //   const light = view.lightsList[i];
    //   if (light instanceof AmbientLight) {
    //     continue;
    //   }
    //   if (light instanceof DirLight) {
    //     src.push(`viewLightDir = normalize(lightDir${i});`);
    //   } else if (light instanceof PointLight) {
    //     src.push(`viewLightDir = -normalize(lightPos${i} - viewPosition.xyz);`);
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
      "    outColor = color;");
  }

  /**
   * Renders a layer.
   * @param layer The layer to render, which contains the primitives and their attributes.
   * @param renderPass The render pass identifier, which determines the rendering context (e.g., solid fill, silhouette, picking).
   */
  renderLayer(layer: Layer, renderPass: RenderPassValue): void {
    if (!this._program) {
      console.error("Shader program is not initialized.");
      return;
    }
    if (!layer) {
      console.error("Invalid layer provided.");
      return;
    }
    if (renderPass < 0) {
      console.error("Invalid render pass provided.");
      return;
    }
    this._bind(renderPass);
    const gl = this._renderContext.gl;
    // Select which portion of DTX primitives to draw for the layer
    const primitiveBase = 0; // TODO: Per-layer value
    gl.uniform1i(this._uniforms.primitiveBase, primitiveBase);
    // Draw the layer's primitives
    const numIndices = layer.numIndices;
    switch (layer.primitive) {
      case TrianglesPrimitive:
        gl.drawArrays(gl.TRIANGLES, 0, numIndices);
        break;
      case LinesPrimitive:
        gl.drawArrays(gl.LINES, 0, numIndices);
        break;
      case PointsPrimitive:
        gl.drawArrays(gl.POINTS, 0, numIndices);
        break;
      default:
        console.error(`Unsupported primitive type: ${layer.primitive}`);
        break;
    }
    // TODO: Add support for drawing only a portion of the indices?
  }

  /**
   * Binds the shader program and sets up the necessary uniforms and textures for rendering.
   * @param renderPass The render pass identifier, which determines the rendering context (e.g., solid fill, silhouette, picking).
   * @private
   */
  private _bind(renderPass: RenderPassValue): boolean {

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

    const samplers = this._samplers;
    const dataTextures = this._dtxMemoryView.dataTextures;

    program.bindTexture(samplers.tileViewMatrices, dataTextures.tileViewMatrices[view.viewIndex], renderContext.textureUnit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;

    program.bindTexture(samplers.primToMeshLookup, dataTextures.primToMeshLookup, renderContext.textureUnit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;

    // Positions

    program.bindTexture(samplers.positions, dataTextures.positions, renderContext.textureUnit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;

    // Mesh modeling matrices

    program.bindTexture(samplers.meshMatrices, dataTextures.meshMatrices, renderContext.textureUnit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;

    // Mesh attributes

    program.bindTexture(samplers.meshAttributes, dataTextures.meshAttributes, renderContext.textureUnit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;

    // Mesh view attributes

    program.bindTexture(samplers.meshViewAttributes, dataTextures.meshViewAttributes[view.viewIndex], renderContext.textureUnit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;

    // Per-geometry dequantization range

    program.bindTexture(samplers.geometryAttributes, dataTextures.geometryAttributes, renderContext.textureUnit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;

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
      if (uniforms.saoParams) {
        gl.uniform4f(uniforms.saoParams, gl.drawingBufferWidth, gl.drawingBufferHeight, sao.blendCutoff, sao.blendFactor);
        program.bindTexture(
          this._samplers.saoOcclusionTexture,
          renderContext.saoOcclusionTexture,
          renderContext.textureUnit);
        renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
      }
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
      primitiveBase: program.getLocation("primitiveBase"),
      viewIndex: program.getLocation("viewIndex"), // IDs the View currently being rendered
      renderPass: program.getLocation("renderPass"), // IDs the render pass - draw, pick, silhouette etc
      gammaFactor: program.getLocation("gammaFactor"),
      projMatrix: program.getLocation("projMatrix"),
      snapCameraEyeRTC: program.getLocation("snapCameraEyeRTC"),
      pointSize: program.getLocation("pointSize"),
      intensityRange: program.getLocation("intensityRange"),
      nearPlaneHeight: program.getLocation("nearPlaneHeight"),
      pointCloudIntensityRange: program.getLocation("pointCloudIntensityRange"),
      pickZNear: program.getLocation("pickZNear"),
      pickZFar: program.getLocation("pickZFar"),
      pickClipPos: program.getLocation("pickClipPos"),
      drawingBufferSize: program.getLocation("drawingBufferSize"),
      silhouetteColor: program.getLocation("silhouetteColor"),
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
      primToMeshLookup: "primToMeshLookup",
      meshAttributes: "meshAttributes",
      meshViewAttributes: "meshViewAttributes",
      meshMatrices: "meshMatrices",
      geometryAttributes: "geometryAttributes",
      tileViewMatrices: "tileViewMatrices",
      positions: "positions",
      uniqueIndices: "uniqueIndices",
      uniqueEdgeIndices: "uniqueEdgeIndices",
      saoOcclusionTexture: "saoOcclusionTexture"
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
