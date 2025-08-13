import {AmbientLight, DirLight, PointLight} from "../../viewer";
import {WEBGL_INFO, WebGLProgram} from "../../webglutils";
import {LinesPrimitive, OrthoProjectionType, PointsPrimitive, TrianglesPrimitive} from "../../constants";
import {RENDER_PASSES} from "../RENDER_PASSES";
import type {RenderContext} from "../RenderContext";
import {Layer} from "../layer/Layer";

const defaultColor = new Float32Array([1, 1, 1, 1]);

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
 */
export abstract class LayerRenderer {

  renderContext: RenderContext;
  program: WebGLProgram | null;
  errors: string[];
  edges: boolean;

  /**
   * Uniforms and attributes for the shader program.
   * Populated during the `build()` method based on what's included in the shader source.
   */
  private uniforms: {
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
  private attributes: {};

  /**
   * Samplers for the shader program.
   */
  private samplers: {
    primToMeshLookup: string; // Prim index -> mesh lookup
    meshAttributes: string; // Mesh attributes
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
   * @param cfg
   */
  constructor(renderContext: RenderContext, cfg: { edges: boolean } = {edges: false}) {
    this.renderContext = renderContext;
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

      "uniform highp sampler2D primToMeshLookup;",
      "uniform highp sampler2D tileViewMatrices;",
      "uniform highp sampler2D positions;",
      "uniform highp sampler2D uniqueIndices;",
      "uniform highp sampler2D edgeIndices;",
      "uniform highp sampler2D meshMatrices;",
      "uniform highp sampler2D meshAttributes;",
      "uniform highp sampler2D geometryAttributes;",

      "uniform mat4 projMatrix;",

      "struct MeshAttributes {",
      "  int tileIndex;",
      "  int geometryIndex;",
      "  int uniqueIndicesbase;",
      "  int uniqueEdgeIndicesbase;",
      "};",

      "struct MeshViewAttributes {",
      "  vec4 color;",
      "  vec4 flags;",
      "  vec4 flags2;",
      "};",

      // TODO: Light struct and SectionPlane struct


      "int unpackMeshIndex(int primIndex) {",
      "  int texWidth = 4096;",
      "  vec4 packed = texelFetch(primToMeshLookup, ivec2(primIndex % texWidth, primIndex / texWidth), 0);",
      "  return uint(packed.r) + (uint(packed.g) << 8u) + (uint(packed.b) << 16u) + (uint(packed.a) << 24u);",
      "}",

      "MeshAttributes unpackMeshAttributes(int meshIndex) {",
      "  MeshAttributes s;",
      "  int texWidth = 4096;",
      "  vec4 packed1 = texelFetch(meshAttributes, ivec2((meshIndex + 0) % texWidth, (meshIndex + 0) / texWidth), 0);",
      "  s.tileIndex = uint(packed1.r) + (uint(packed1.g) << 8u) + (uint(packed1.b) << 16u) + (uint(packed1.a) << 24u);",
      "  vec4 packed2 = texelFetch(meshAttributes, ivec2((meshIndex + 4) % texWidth, (meshIndex + 4) / texWidth), 0);",
      "  s.geometryIndex = uint(packed2.r) + (uint(packed2.g) << 8u) + (uint(packed2.b) << 16u) + (uint(packed2.a) << 24u);",
      "  vec4 packed3 = texelFetch(meshAttributes, ivec2((meshIndex + 8) % texWidth, (meshIndex + 8) / texWidth), 0);",
      "  s.uniqueIndicesBase = uint(packed3.r) + (uint(packed3.g) << 8u) + (uint(packed3.b) << 16u) + (uint(packed3.a) << 24u);",
      "  vec4 packed4 = texelFetch(meshAttributes, ivec2((meshIndex + 12) % texWidth, (meshIndex + 12) / texWidth), 0);",
      "  s.uniqueEdgeIndicesBase = uint(packed4.r) + (uint(packed4.g) << 8u) + (uint(packed4.b) << 16u) + (uint(packed4.a) << 24u);",
      "  return s;",
      "}",

      "MeshViewAttributes unpackMeshViewAttributes(int meshIndex) {",
      "  MeshViewAttributes s;",
      "  int texWidth = 4096;",
      "  s.flags1 = texelFetch(meshAttributes, ivec2((meshIndex + 0) % texWidth, (meshIndex + 0) / texWidth), 0);",
      "  s.flags2 = texelFetch(meshAttributes, ivec2((meshIndex + 4) % texWidth, (meshIndex + 4) / texWidth), 0);",
      "  s.color  = texelFetch(meshAttributes, ivec2((meshIndex + 8) % texWidth, (meshIndex + 8) / texWidth), 0);",
      "  return s;",
      "}",

      "mat4 unpackTileViewMatrix(int tileIndex) {",
      "  int matsPerRow = 512;",
      "  float row = floor(index / matsPerRow);",
      "  float col = mod(index, matsPerRow) * 4.0;",
      "  vec4 m0 = texelFetch(tileViewMatrices, ivec2(col + 0.0, row), 0);",
      "  vec4 m1 = texelFetch(tileViewMatrices, ivec2(col + 1.0, row), 0);",
      "  vec4 m2 = texelFetch(tileViewMatrices, ivec2(col + 2.0, row), 0);",
      "  vec4 m3 = texelFetch(tileViewMatrices, ivec2(col + 3.0, row), 0);",
      "  return mat4(m0, m1, m2, m3);",
      "}",

      "mat4 unpackModelMatrix(int meshIndex) {",
      "  int matsPerRow = 512;",
      "  float row = floor(index / matsPerRow);",
      "  float col = mod(index, matsPerRow) * 4.0;",
      "  vec4 m0 = texelFetch(meshMatrices, ivec2(col + 0.0, row), 0);",
      "  vec4 m1 = texelFetch(meshMatrices, ivec2(col + 1.0, row), 0);",
      "  vec4 m2 = texelFetch(meshMatrices, ivec2(col + 2.0, row), 0);",
      "  vec4 m3 = texelFetch(meshMatrices, ivec2(col + 3.0, row), 0);",
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
    // if (this.renderContext.view.getNumAllocatedSectionPlanes() > 0) {
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
      `      int colorFlag = (int(meshViewAttributes.flags) & 0xF);`,
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
      "      int silhouetteFlag = (int(meshViewAttributes.flags) >> 4 & 0xF);",
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
      `      int pickFlag = (int(meshViewAttributes.flags) >> 8 & 0xF);`,
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
    // if (this.renderContext.view.getNumAllocatedSectionPlanes() > 0) {
    //   const src = this._vertexSrcBuf;
    //   src.push("      vWorldPosition = worldPosition;");
    //   src.push("      vClippable = (int(meshViewAttributes.flags) >> 12 & 0xF) == 1;");
    // }
  }

  private _vertexMeshLogic() {
    this._vertexSrcBuf.push(
      "          int primIndex = (gl_VertexID / 3);", // TODO: Assumes triangles
      "          int meshIndex = unpackMeshIndex(primIndex);",
      "          MeshViewAttributes meshViewAttributes = unpackMeshViewAttributes(meshIndex);",
      `          if (meshViewAttributes.color.a == 0u) {`,
  //    "              gl_Position = vec4(3.0, 3.0, 3.0, 1.0);", // Cull vertex
    //  "              return;",
      "          };");
  }

  private _vertexMeshLogic2() {
    this._vertexSrcBuf.push(
      "          MeshAttributes meshAttributes = unpackMeshAttributes(meshIndex);",
      "          mat4 viewMatrix = unpackTileViewMatrix(meshAttributes.tileIndex);",
      "          mat4 modelMatrix = unpackModelMatrix(meshIndex);",
      // Positions dequantization range, sampled from per-geometry dequantization ranges texture
      "          ivec2 geometryDequantizeRangesCoords = ivec2(int(geometryIndex) % 512, int(geometryIndex) / 512);",
      "          vec3 positionsDecompressOffset = texelFetch (geometryAttributes, ivec2(geometryDequantizeRangesCoords.x*8+0, geometryDequantizeRangesCoords.y), 0);",
      "          vec3 positionsDecompressScale = texelFetch (geometryAttributes, ivec2(geometryDequantizeRangesCoords.x*8+0, geometryDequantizeRangesCoords.y), 0);",
      //  Model, World, View and Clip space coordinates
      "          vec4 modelPosition = (vec4(positionsDecompressOffset + (positionsDecompressScale * position), 1.0)); ",
      "          vec4 worldPosition = modelMatrix * modelPosition; ",
      "          vec4 viewPosition  = viewMatrix * worldPosition; ",
      "          gl_Position = projMatrix * viewPosition;");
  }

  protected vsDrawLambertLogic() {
    this._vertexSrcBuf.push(
      "         vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);",
      "          vViewPosition = viewPosition;");
  }

  protected vsSilhouetteLogic() {
    this._vertexSrcBuf.push(
      "          vColor = vec4(silhouetteColor.r, silhouetteColor.g, silhouetteColor.b, 0.5);");
  }

  protected vsDrawFlatColorLogic() {
    this._vertexSrcBuf.push(
      "          vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);");
  }

  protected vertexPickMeshLogic() {
    this._vertexSrcBuf.push(
      "          vPickColor = vec4(float(pickColor.r) / 255.0, float(pickColor.g) / 255.0, float(pickColor.b) / 255.0, float(pickColor.a) / 255.0);");
  }


  protected vertexPointsFilterLogicOpenBlock() {
    // const src = this._vertexSrcBuf;
    // const pointsMaterial = this.renderContext.view.pointsMaterial;
    // if (pointsMaterial.filterIntensity) {
    //   src.push("float intensity = float(color.a) / 255.0;")
    //   src.push("if (intensity < intensityRange[0] || intensity > intensityRange[1]) {");
    //   src.push("   gl_Position = vec4(2.0, 0.0, 0.0, 0.0);");
    //   src.push("} else {");
    // }
  }

  protected vertexPointsFilterLogicCloseBlock() {
    // const pointsMaterial = this.renderContext.view.pointsMaterial;
    // if (pointsMaterial.filterIntensity) {
    //   this._vertexSrcBuf.push("}");
    // }
  }

  protected vertexPointsGeometryLogic() {
    const src = this._vertexSrcBuf;
    const pointsMaterial = this.renderContext.view.pointsMaterial;
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
    this._vertexSrcBuf.push(
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

  protected fsSilhouetteDefs() {
    this._fragmentSrcBuf.push(
      "in vec4 vColor;"
    );
  }

  protected fsDrawFlatColorDefines() {
    this._fragmentSrcBuf.push("in vec4 vColor;");
  }

  protected fsDrawLambertDefs() {
    const src = this._fragmentSrcBuf;
    const view = this.renderContext.view;
    src.push(
      "in vec4 vColor;",
      "in vec4 vViewPosition;",
      "uniform vec4 lightAmbient;");
    view.lightsList.forEach((light, i) => {
      if (!(light instanceof AmbientLight)) {
        src.push(`uniform vec4 lightColor${i};`);
        if (light instanceof DirLight) {
          src.push(`uniform vec3 lightDir${i};`);
        } else if (light instanceof PointLight) {
          src.push(`uniform vec3 lightPos${i};`);
        }
      }
    });
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
    // const numSectionPlanes = this.renderContext.view.getNumAllocatedSectionPlanes();
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
    this._vertexSrcBuf.push(
      "void main(void) {");
  }

  protected fsMainClose() {
    this._vertexSrcBuf.push(
      "}");
  }

  protected fsDrawLambertLogic() {
    const src = this._fragmentSrcBuf;
    const view = this.renderContext.view;
    this._fragmentSrcBuf.push("vec3 reflectedColor = vec3(0.0, 0.0, 0.0);",
      "vec3 viewLightDir = vec3(0.0, 0.0, -1.0);",
      "float lambertian = 1.0;",
      "vec3 xTangent = dFdx( vViewPosition.xyz );",
      "vec3 yTangent = dFdy( vViewPosition.xyz );",
      "vec3 viewNormal = normalize( cross( xTangent, yTangent ) );");
    for (let i = 0, len = view.lightsList.length; i < len; i++) {
      const light = view.lightsList[i];
      if (light instanceof AmbientLight) {
        continue;
      }
      if (light instanceof DirLight) {
        src.push(`viewLightDir = normalize(lightDir${i});`);
      } else if (light instanceof PointLight) {
        src.push(`viewLightDir = -normalize(lightPos${i} - viewPosition.xyz);`);
      } else {
        continue;
      }
      src.push("lambertian = max(dot(-viewNormal, viewLightDir), 0.0);");
      src.push(`reflectedColor += lambertian * (lightColor${i}.rgb * lightColor${i}.a);`);
    }
    src.push("color = vec4((lightAmbient.rgb * lightAmbient.a * vColor.rgb) + (reflectedColor * vColor.rgb), vColor.a);");
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
    // const numSectionPlanes = this.renderContext.view.getNumAllocatedSectionPlanes();
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
    //if (this.renderContext.view.pointsMaterial.roundPoints) {
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
  renderLayer(layer: Layer, renderPass: number): void {
    if (!this.program) {
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
    const gl = this.renderContext.gl;
    // Select which portion of DTX primitives to draw for the layer
    const primitiveBase = 0; // TODO: Per-layer value
    gl.uniform1i(this.uniforms.primitiveBase, primitiveBase);
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
  private _bind(renderPass: number): boolean {

    const view = this.renderContext.view;
    const gl = this.renderContext.gl;
    const uniforms = this.uniforms;
    const renderContext = this.renderContext;

    if (!this.program) {
      renderContext.lastProgramId = -1;
      return false;
    }

    if (renderContext.lastProgramId === this.program.id) {
      return true; // Already bound
    }

    this.program.bind();

    renderContext.lastProgramId = this.program.id;
    renderContext.textureUnit = 0;

    gl.uniform1i(uniforms.renderPass, renderPass);

    const samplers = this.samplers;
    const dataTextures = renderContext.dtxMemory.dataTextures;

    this.program.bindTexture(samplers.tileViewMatrices, dataTextures.tileViewMatrices[view.viewIndex], renderContext.textureUnit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;

    this.program.bindTexture(samplers.primToMeshLookup, dataTextures.primToMeshLookup, renderContext.textureUnit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;

    // Positions

    this.program.bindTexture(samplers.positions, dataTextures.positions, renderContext.textureUnit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;

    // Mesh modeling matrices

    this.program.bindTexture(samplers.meshMatrices, dataTextures.meshMatrices, renderContext.textureUnit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;

    // Mesh attributes

    this.program.bindTexture(samplers.meshAttributes, dataTextures.meshAttributes, renderContext.textureUnit);
    renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;

    // Per-geometry dequantization range

    this.program.bindTexture(samplers.geometryAttributes,
      dataTextures.geometryAttributes,
      renderContext.textureUnit);
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

    for (let i = 0, len = view.lightsList.length; i < len; i++) {
      const light = view.lightsList[i];
      if (this.uniforms.lightColor[i]) {
        gl.uniform4f(this.uniforms.lightColor[i], light.color[0], light.color[1], light.color[2], light.intensity);
      }
      if (this.uniforms.lightPos[i]) {
        const pointLight = <PointLight>light;
        gl.uniform3fv(this.uniforms.lightPos[i], <any>pointLight.pos);
      }
      if (this.uniforms.lightDir[i]) {
        const dirLight = <DirLight>light;
        gl.uniform3fv(this.uniforms.lightDir[i], <any>dirLight.dir);
      }
    }

    if (this.uniforms.silhouetteColor) {
      if (this.edges) {
        if (renderPass === RENDER_PASSES.SILHOUETTE_XRAYED) {
          const material = view.xrayMaterial;
          const color = material.edgeColor;
          gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        } else if (renderPass === RENDER_PASSES.SILHOUETTE_HIGHLIGHTED) {
          const material = view.highlightMaterial;
          const color = material.edgeColor;
          gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        } else if (renderPass === RENDER_PASSES.SILHOUETTE_SELECTED) {
          const material = view.selectedMaterial;
          const color = material.edgeColor;
          gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], material.edgeAlpha);
        } else {
          gl.uniform4fv(this.uniforms.silhouetteColor, defaultColor);
        }
      } else {
        if (renderPass === RENDER_PASSES.SILHOUETTE_XRAYED) {
          const material = view.xrayMaterial;
          const color = material.fillColor;
          gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
        } else if (renderPass === RENDER_PASSES.SILHOUETTE_HIGHLIGHTED) {
          const material = view.highlightMaterial;
          const color = material.fillColor;
          gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
        } else if (renderPass === RENDER_PASSES.SILHOUETTE_SELECTED) {
          const material = view.selectedMaterial;
          const color = material.fillColor;
          gl.uniform4f(this.uniforms.silhouetteColor, color[0], color[1], color[2], material.fillAlpha);
        } else {
          gl.uniform4fv(this.uniforms.silhouetteColor, defaultColor);
        }
      }
    }

    const sao = view.sao;
    const saoEnabled = sao.possible;
    if (saoEnabled) {
      if (this.uniforms.saoParams) {
        gl.uniform4f(this.uniforms.saoParams, gl.drawingBufferWidth, gl.drawingBufferHeight, sao.blendCutoff, sao.blendFactor);
        this.program.bindTexture(
          this.samplers.saoOcclusionTexture,
          renderContext.saoOcclusionTexture,
          renderContext.textureUnit);
        renderContext.textureUnit = (renderContext.textureUnit + 1) % WEBGL_INFO.MAX_TEXTURE_UNITS;
      }
    }
    return true;
  }

  private _build(): void {

    const view = this.renderContext.view;
    const gl = this.renderContext.gl;

    this._vertexSrcBuf = [];
    this._fragmentSrcBuf = [];

    this.buildVertexShader()
    this.buildFragmentShader()

    this.program = new WebGLProgram(gl, {
      vertex: joinSansComments(this._vertexSrcBuf),
      fragment: joinSansComments(this._fragmentSrcBuf)
    });

    this._vertexSrcBuf = [];
    this._fragmentSrcBuf = [];

    if (this.program.errors) {
      this.errors = this.program.errors;
      return;
    }

    const program = this.program;

    this.uniforms = {
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

    const lights = view.lightsList;
    for (let i = 0, len = lights.length; i < len; i++) {
      const light = lights[i];
      if (light instanceof DirLight) {
        this.uniforms.lightColor[i] = program.getLocation("lightColor" + i);
        this.uniforms.lightPos[i] = null;
        this.uniforms.lightDir[i] = program.getLocation("lightDir" + i);
        break;
      } else {
        this.uniforms.lightColor[i] = program.getLocation("lightColor" + i);
        this.uniforms.lightPos[i] = program.getLocation("lightPos" + i);
        this.uniforms.lightDir[i] = null;
        this.uniforms.lightAttenuation[i] = program.getLocation("lightAttenuation" + i);
      }
    }

    const uniforms = this.uniforms;

    for (let i = 0, len = view.sectionPlanesList.length; i < len; i++) {
      uniforms.sectionPlanes.push({
        active: program.getLocation("sectionPlaneActive" + i),
        pos: program.getLocation("sectionPlanePos" + i),
        dir: program.getLocation("sectionPlaneDir" + i)
      });
    }

    this.attributes = {};

    this.samplers = {
      primToMeshLookup: "primToMeshLookup",
      meshAttributes: "meshAttributes",
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
    if (this.program) {
      this.program.destroy();
    }
    this.program = null;
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
