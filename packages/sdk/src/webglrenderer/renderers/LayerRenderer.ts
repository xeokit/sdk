import {AmbientLight, DirLight, PointLight} from "../../viewer";
import {WEBGL_INFO, WebGLProgram} from "../../webglutils";
import {LinesPrimitive, OrthoProjectionType, PointsPrimitive, TrianglesPrimitive} from "../../constants";
import {RENDER_PASSES} from "../RENDER_PASSES";
import type {RenderContext} from "../RenderContext";
import {Layer} from "../layer/Layer";

const defaultColor = new Float32Array([1, 1, 1, 1]);

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

/**
 * @private
 */
export abstract class LayerRenderer {

  renderContext: RenderContext;
  hash: string;
  program: WebGLProgram | null;
  errors: string[];
  edges: boolean;

  needBuild: boolean;

  uniforms: {
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

  attributes: {};

  samplers: {
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

  constructor(renderContext: RenderContext, cfg: { edges: boolean } = {edges: false}) {
    this.renderContext = renderContext;
    this.needBuild = true;
    this.edges = cfg.edges;
    this.build();
  }

  abstract getHash(): string;

  get lambertShadingHash() {
    return this.renderContext.view.getLightsHash();
  }

  get slicingHash() {
    return this.renderContext.view.getSectionPlanesHash();
  }

  get pointsHash() {
    const pointsMaterial = this.renderContext.view.pointsMaterial;
    return `${pointsMaterial.roundPoints}-${pointsMaterial.perspectivePoints}`;
  }

  needRebuild() {
    this.needBuild = true;
  }

  getValid() {
    if (!this.needBuild) {
      return true;
    }
    this.needBuild = false;
    return this.hash === this.getHash();
  };

  build(): void {

    const view = this.renderContext.view;
    const gl = this.renderContext.gl;

    const vertexSrc = [];
    const fragmentSrc = [];

    this.buildVertexShader(vertexSrc)
    this.buildFragmentShader(fragmentSrc)

    this.program = new WebGLProgram(gl, {
      vertex: joinSansComments(vertexSrc),
      fragment: joinSansComments(fragmentSrc)
    });

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

    this.hash = this.getHash();

    this.needBuild = false;
  }

  abstract buildVertexShader(src: string[]);

  abstract buildFragmentShader(src: string[]);

  vertexHeader(src: string[]) {
    src.push('#version 300 es');
    src.push(`// ${this.constructor.name} vertex shader`);
  }

  vertexCommonDefs(src: string[]) {

    src.push("uniform int primitiveBase;");
    src.push("uniform int viewIndex;");
    src.push("uniform int renderPass;");

    src.push("uniform highp sampler2D primToMeshLookup;");
    src.push("uniform highp sampler2D tileViewMatrices;");
    src.push("uniform highp sampler2D positions;");
    src.push("uniform highp sampler2D uniqueIndices;");
    src.push("uniform highp sampler2D dtxEdgeIndicesTexture;");
    src.push("uniform highp sampler2D meshMatrices;");
    src.push("uniform highp sampler2D meshAttributes;");
    src.push("uniform highp sampler2D geometryAttributes;");

    src.push("uniform mat4 projMatrix;");

    src.push("struct MeshAttributes {");
    src.push("  int tileIndex;");
    src.push("  int geometryIndex;");
    src.push("  int uniqueIndicesbase;");
    src.push("  int uniqueEdgeIndicesbase;");
    src.push("};");

    src.push("struct MeshViewAttributes {");
    src.push("  vec4 color;");
    src.push("  vec4 flags;");
    src.push("  vec4 flags2;");
    src.push("};");

    src.push("int unpackMeshIndex(int primIndex) {");
    src.push("  int texWidth = 4096;")
    src.push("  vec4 packed = texelFetch(primToMeshLookup, ivec2(primIndex % texWidth, primIndex / texWidth), 0);");
    src.push("  return uint(packed.r) + (uint(packed.g) << 8u) + (uint(packed.b) << 16u) + (uint(packed.a) << 24u);");
    src.push("}");

    src.push("MeshAttributes unpackMeshAttributes(int meshIndex) {");
    src.push("  MeshAttributes s;");
    src.push("  int texWidth = 4096;")
    src.push("  vec4 packed1 = texelFetch(meshAttributes, ivec2((meshIndex + 0) % texWidth, (meshIndex + 0) / texWidth), 0);");
    src.push("  s.tileIndex = uint(packed1.r) + (uint(packed1.g) << 8u) + (uint(packed1.b) << 16u) + (uint(packed1.a) << 24u);");
    src.push("  vec4 packed2 = texelFetch(meshAttributes, ivec2((meshIndex + 4) % texWidth, (meshIndex + 4) / texWidth), 0);");
    src.push("  s.geometryIndex = uint(packed2.r) + (uint(packed2.g) << 8u) + (uint(packed2.b) << 16u) + (uint(packed2.a) << 24u);");
    src.push("  vec4 packed3 = texelFetch(meshAttributes, ivec2((meshIndex + 8) % texWidth, (meshIndex + 8) / texWidth), 0);");
    src.push("  s.uniqueIndicesBase = uint(packed3.r) + (uint(packed3.g) << 8u) + (uint(packed3.b) << 16u) + (uint(packed3.a) << 24u);");
    src.push("  vec4 packed4 = texelFetch(meshAttributes, ivec2((meshIndex + 12) % texWidth, (meshIndex + 12) / texWidth), 0);");
    src.push("  s.uniqueEdgeIndicesBase = uint(packed4.r) + (uint(packed4.g) << 8u) + (uint(packed4.b) << 16u) + (uint(packed4.a) << 24u);");
    src.push("  return s;");
    src.push("}");

    src.push("MeshViewAttributes unpackMeshViewAttributes(int meshIndex) {");
    src.push("  MeshViewAttributes s;");
    src.push("  int texWidth = 4096;")
    src.push("  s.flags1 = texelFetch(meshAttributes, ivec2((meshIndex + 0) % texWidth, (meshIndex + 0) / texWidth), 0);");
    src.push("  s.flags2 = texelFetch(meshAttributes, ivec2((meshIndex + 4) % texWidth, (meshIndex + 4) / texWidth), 0);");
    src.push("  s.color  = texelFetch(meshAttributes, ivec2((meshIndex + 8) % texWidth, (meshIndex + 8) / texWidth), 0);");
    src.push("  return s;");
    src.push("}");

    src.push("mat4 unpackTileViewMatrix(int tileIndex) {");
    src.push("  int matsPerRow = 512;")
    src.push("  float row = floor(index / matsPerRow);");
    src.push("  float col = mod(index, matsPerRow) * 4.0;");
    src.push("  vec4 m0 = texelFetch(tileViewMatrices, ivec2(col + 0.0, row), 0);");
    src.push("  vec4 m1 = texelFetch(tileViewMatrices, ivec2(col + 1.0, row), 0);");
    src.push("  vec4 m2 = texelFetch(tileViewMatrices, ivec2(col + 2.0, row), 0);");
    src.push("  vec4 m3 = texelFetch(tileViewMatrices, ivec2(col + 3.0, row), 0);");
    src.push("  return mat4(m0, m1, m2, m3);");
    src.push("}");

    src.push("mat4 unpackModelMatrix(int meshIndex) {");
    src.push("  int matsPerRow = 512;")
    src.push("  float row = floor(index / matsPerRow);");
    src.push("  float col = mod(index, matsPerRow) * 4.0;");
    src.push("  vec4 m0 = texelFetch(meshMatrices, ivec2(col + 0.0, row), 0);");
    src.push("  vec4 m1 = texelFetch(meshMatrices, ivec2(col + 1.0, row), 0);");
    src.push("  vec4 m2 = texelFetch(meshMatrices, ivec2(col + 2.0, row), 0);");
    src.push("  vec4 m3 = texelFetch(meshMatrices, ivec2(col + 3.0, row), 0);");
    src.push("  return mat4(m0, m1, m2, m3);");
    src.push("}");
  }

  vertexPickMeshDefs(src: string[]) {
    src.push("out     vec4 vPickColor;");
    src.push("uniform vec2 drawingBufferSize;");
    src.push("uniform vec2 pickClipPos;");
    src.push("vec4 remapPickClipPos(vec4 clipPos) {");
    src.push("    clipPos.xy /= clipPos.w;");
    //if (viewportSize === 1) {
    src.push("    clipPos.xy = (clipPos.xy - pickClipPos) * drawingBufferSize;");
    // } else {
    //     src.push(`    clipPos.xy = (clipPos.xy - pickClipPos) * (drawingBufferSize / float(${viewportSize}));`);
    // }
    src.push("    clipPos.xy *= clipPos.w;")
    src.push("    return clipPos;")
    src.push("}");
  }

  vertexSlicingDefs(src: string[]) {
    if (this.renderContext.view.getNumAllocatedSectionPlanes() > 0) {
      src.push("out vec4 vWorldPosition;");
      src.push("out boolean vClippable;");
    }
  }

  vertexDrawMainOpen(src: string[]) {
    src.push("void main(void) {");
    this._vertexMeshLogic(src);
    src.push(`      int colorFlag = (int(meshViewAttributes.flags) & 0xF);`);
    src.push(`      if (colorFlag != renderPass) {`);
    src.push("          gl_Position = vec4(2.0, 0.0, 0.0, 1.0);");
    src.push("      } else {");
    this._vertexMeshLogic2(src);
  }

  vertexSilhouetteMainOpen(src: string[]) {
    src.push("void main(void) {");
    this._vertexMeshLogic(src);
    src.push("      int silhouetteFlag = (int(meshViewAttributes.flags) >> 4 & 0xF);")
    src.push(`      if (silhouetteFlag != renderPass) {`);
    src.push("          gl_Position = vec4(2.0, 0.0, 0.0, 1.0);");
    src.push("      } else {");
    this._vertexMeshLogic2(src);
  }

  vertexPickMainOpen(src: string[]) {
    src.push("void main(void) {");
    this._vertexMeshLogic(src);
    src.push(`      int pickFlag = (int(meshViewAttributes.flags) >> 8 & 0xF);`);
    src.push(`      if (pickFlag != renderPass) {`);
    src.push("          gl_Position = vec4(2.0, 0.0, 0.0, 1.0);");
    src.push("      } else {");
    this._vertexMeshLogic2(src);
  }

  vertexMainClose(src: string[]) {
    src.push("      }");
    src.push("}");
  }

  vertexSlicingLogic(src: string[]) {
    if (this.renderContext.view.getNumAllocatedSectionPlanes() > 0) {
      src.push("      vWorldPosition = worldPosition;");
      src.push("      vClippable = (int(meshViewAttributes.flags) >> 12 & 0xF) == 1;");
    }
  }

  _vertexMeshLogic(src: string[]) {

    src.push("int primIndex = (gl_VertexID / 3);"); // TODO: Assumes triangles

    src.push("int meshIndex = unpackMeshIndex(primIndex);");

    src.push("MeshViewAttributes meshViewAttributes = unpackMeshViewAttributes(meshIndex);");

    src.push(`if (meshViewAttributes.color.a == 0u) {`);
    src.push("   gl_Position = vec4(3.0, 3.0, 3.0, 1.0);"); // Cull vertex
    src.push("   return;");
    src.push("};");
  }

  _vertexMeshLogic2(src: string[]) {

    src.push("MeshAttributes meshAttributes = unpackMeshAttributes(meshIndex);");

    src.push("mat4 viewMatrix = unpackTileViewMatrix(meshAttributes.tileIndex);");

    src.push("mat4 modelMatrix = unpackModelMatrix(meshIndex);");

    // Positions dequantization range, sampled from per-geometry dequantization ranges texture

    src.push("ivec2 geometryDequantizeRangesCoords = ivec2(int(geometryIndex) % 512, int(geometryIndex) / 512);");
    src.push("vec3 positionsDecompressOffset = texelFetch (geometryAttributes, ivec2(geometryDequantizeRangesCoords.x*8+0, geometryDequantizeRangesCoords.y), 0);");
    src.push("vec3 positionsDecompressScale = texelFetch (geometryAttributes, ivec2(geometryDequantizeRangesCoords.x*8+0, geometryDequantizeRangesCoords.y), 0);");

    //  Model, World, View and Clip space coordinates

    src.push("vec4 modelPosition = (vec4(positionsDecompressOffset + (positionsDecompressScale * position), 1.0)); ");
    src.push("vec4 worldPosition = modelMatrix * modelPosition; ");
    src.push("vec4 viewPosition  = viewMatrix * worldPosition; ");
    src.push("gl_Position = projMatrix * viewPosition;");
  }

  vertexDrawLambertDefs(src: string[]) {
    src.push("out vec4 vColor;");
    src.push("out vec4 vViewPosition;");
  }

  vertexDrawLambertLogic(src: string[]) {
    src.push("vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);");
    src.push("vViewPosition = viewPosition;");
  }

  vertexSilhouetteDefs(src: string[]) {
    src.push("          uniform vec4 silhouetteColor;");
    src.push("          out vec4 vColor;");
  }

  vertexSilhouetteLogic(src: string[]) {
    src.push("          vColor = vec4(silhouetteColor.r, silhouetteColor.g, silhouetteColor.b, 0.5);");
  }

  vertexDrawFlatColorLogic(src: string[]) {
    src.push("          vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);");
  }

  vertexDrawFlatColorDefs(src: string[]) {
    src.push("          out vec4 vColor;");
  }

  vertexDrawEdgesColorLogic(src: string[]) {
    src.push("          vColor = vec4(float(color.r-200.0) / 255.0, float(color.g-200.0) / 255.0, float(color.b-200.0) / 255.0, 1.0);");
  }

  vertexPickMeshLogic(src: string[]) {
    src.push("          vPickColor = vec4(float(pickColor.r) / 255.0, float(pickColor.g) / 255.0, float(pickColor.b) / 255.0, float(pickColor.a) / 255.0);");
  }

  vertexPointsDrawDefs(src: string[]): void {
    src.push("out vec4 vColor;");
  }

  vertexDrawPointsColorsLogic(src: string[]): void {
    src.push("vColor = vec4(float(color.r) / 255.0, float(color.g) / 255.0, float(color.b) / 255.0, 1.0);");
  }

  vertexPointsGeometryDefs(src: string[]): void {
    const pointsMaterial = this.renderContext.view.pointsMaterial;
    if (pointsMaterial.perspectivePoints) {
      src.push("uniform float nearPlaneHeight;");
    }
    if (pointsMaterial.filterIntensity) {
      src.push("uniform vec2 intensityRange;");
    }
    src.push("uniform float pointSize;");
  }

  vertexPointsFilterLogicOpenBlock(src: string[]) {
    const pointsMaterial = this.renderContext.view.pointsMaterial;
    if (pointsMaterial.filterIntensity) {
      src.push("float intensity = float(color.a) / 255.0;")
      src.push("if (intensity < intensityRange[0] || intensity > intensityRange[1]) {");
      src.push("   gl_Position = vec4(2.0, 0.0, 0.0, 0.0);");
      src.push("} else {");
    }
  }

  vertexPointsFilterLogicCloseBlock(src: string[]) {
    const pointsMaterial = this.renderContext.view.pointsMaterial;
    if (pointsMaterial.filterIntensity) {
      src.push("}");
    }
  }

  vertexPointsGeometryLogic(src: string[]) {
    const pointsMaterial = this.renderContext.view.pointsMaterial;
    // if (pointsMaterial.perspectivePoints) {
    //     src.push("gl_PointSize = (nearPlaneHeight * pointSize) / clipPos.w;");
    //     src.push("gl_PointSize = max(gl_PointSize, " + Math.floor(pointsMaterial.minPerspectivePointSize) + ".0);");
    //     src.push("gl_PointSize = min(gl_PointSize, " + Math.floor(pointsMaterial.maxPerspectivePointSize) + ".0);");
    // } else {
    src.push("gl_PointSize = pointSize;");
    //       }
  }

  fragmentHeader(src: string[]) {
    src.push('#version 300 es');
    src.push(`// ${this.constructor.name} fragment shader`);
  }

  fragmentPrecisionDefs(src: string[]) {
    src.push("#ifdef GL_FRAGMENT_PRECISION_HIGH");
    src.push("precision highp float;");
    src.push("precision highp int;");
    src.push("precision highp usampler2D;");
    src.push("precision highp isampler2D;");
    src.push("precision highp sampler2D;");
    src.push("#else");
    src.push("precision mediump float;");
    src.push("precision mediump int;");
    src.push("precision mediump usampler2D;");
    src.push("precision mediump isampler2D;");
    src.push("precision mediump sampler2D;");
    src.push("#endif");

  }

  fragmentCommonDefs(src: string[]) {
    src.push("vec4 color;");
    src.push("out vec4 outColor;");
  }

  fragmentDrawLambertDefs(src: string[]) {
    const view = this.renderContext.view;
    src.push("in vec4 vColor;");
    src.push("in vec4 vViewPosition;");
    src.push("uniform vec4 lightAmbient;");
    for (let i = 0, len = view.lightsList.length; i < len; i++) {
      const light = view.lightsList[i];
      if (light instanceof AmbientLight) {
        continue;
      }
      src.push(`uniform vec4 lightColor${i};`);
      if (light instanceof DirLight) {
        src.push(`uniform vec3 lightDir${i};`);
      }
      if (light instanceof PointLight) {
        src.push(`uniform vec3 lightPos${i};`);
      }
    }
  }

  fragmentDrawLambertLogic(src: string[]) {
    const view = this.renderContext.view;
    src.push("vec3 reflectedColor = vec3(0.0, 0.0, 0.0);");
    src.push("vec3 viewLightDir = vec3(0.0, 0.0, -1.0);");
    src.push("float lambertian = 1.0;");
    src.push("vec3 xTangent = dFdx( vViewPosition.xyz );");
    src.push("vec3 yTangent = dFdy( vViewPosition.xyz );");
    src.push("vec3 viewNormal = normalize( cross( xTangent, yTangent ) );");
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

  fragmentDrawSAODefs(src: string[]) {
    src.push("uniform sampler2D saoOcclusionTexture;");
    src.push("uniform vec4      saoParams;");
    src.push("const float       saoUnpackDownScale = 255. / 256.;");
    src.push("const vec3        saoPackFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );");
    src.push("const vec4        saoUnpackFactors = saoUnpackDownScale / vec4( saoPackFactors, 1. );");
    src.push("float saoUnpackRGBToFloat( const in vec4 v ) {");
    src.push("    return dot( v, saoUnpackFactors );");
    src.push("}");
  }

  fragmentSilhouetteDefs(src: string[]) {
    src.push(
      "in vec4 vColor;",
    );
  }

  fragmentDrawFlatColorDefs(src: string[]) {
    src.push("in vec4 vColor;");
  }

  fragmentDrawFlatColorLogic(src: string[]) {
    src.push("color = vColor;");
  }

  fragmentDrawSAOLogic(src: string[]) {
    // Doing SAO blend in the main solid fill draw shader just so that edge lines can be drawn over the top
    // TODO: Would be more efficient to defer this, then render lines later, using same depth buffer for Z-reject
    src.push("   float saoViewportWidth = saoParams[0];");
    src.push("   float saoViewportHeight = saoParams[1];");
    src.push("   float saoBlendCutoff = saoParams[2];");
    src.push("   float saoBlendFactor = saoParams[3];");
    src.push("   vec2  saoUV = vec2(gl_FragCoord.x / saoViewportWidth, gl_FragCoord.y / saoViewportHeight);");
    src.push("   float saoAmbient = smoothstep(saoBlendCutoff, 1.0, saoUnpackRGBToFloat(texture(saoOcclusionTexture, saoUV))) * saoBlendFactor;");
    src.push("   color = vec4(color.rgb * saoAmbient, 1.0);");
  }

  fragmentDrawDepthDefs(src: string[]) {
    src.push("in vec2 vHighPrecisionZW;");
  }

  fragmentDrawDepthLogic(src: string[]) {
    src.push("float depthFragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;");
    src.push("color = vec4(vec3(1.0 - depthFragCoordZ), 1.0); ");
  }

  fragmentSilhouetteLogic(src: string[]) {
    src.push("color = vColor;");
  }

  fragmentPickMeshDefs(src: string[]) {
    src.push("in vec4 vPickColor;");
  }

  fragmentPickMeshLogic(src: string[]) {
    src.push("color = vPickColor;");
  }

  fragmentSlicingDefs(src: string[]) {
    const numSectionPlanes = this.renderContext.view.getNumAllocatedSectionPlanes();
    if (numSectionPlanes === 0) {
      return;
    }
    src.push("in vec4 vWorldPosition;");
    src.push("in boolean vClippable;");
    for (let i = 0; i < numSectionPlanes; i++) {
      src.push("uniform bool sectionPlaneActive" + i + ";");
      src.push("uniform vec3 sectionPlanePos" + i + ";");
      src.push("uniform vec3 sectionPlaneDir" + i + ";");
    }
  }

  fragmentSlicingLogic(src: string[]) {
    const numSectionPlanes = this.renderContext.view.getNumAllocatedSectionPlanes();
    if (numSectionPlanes === 0) {
      return;
    }
    src.push("  if (vClippable) {");
    src.push("    float dist = 0.0;");
    for (let i = 0; i < numSectionPlanes; i++) {
      src.push("    if (sectionPlaneActive" + i + ") {");
      src.push("      dist += clamp(dot(-sectionPlaneDir" + i + ".xyz, vWorldPosition.xyz - sectionPlanePos" + i + ".xyz), 0.0, 1000.0);");
      src.push("    }");
    }
    src.push("    if (dist > 0.0) { discard; }");
    src.push("  }");
  }

  fragmentPointsGeometryLogic(src: string[]): void {
    if (this.renderContext.view.pointsMaterial.roundPoints) {
      src.push("  vec2 cxy = 2.0 * gl_PointCoord - 1.0;");
      src.push("  float r = dot(cxy, cxy);");
      src.push("  if (r > 1.0) {");
      src.push("       discard;");
      src.push("  }");
    }
  }

  fragmentCommonOutput(src: string[]) {
    src.push("outColor = color;");
  }

  bind(renderPass: number): boolean {

    const view = this.renderContext.view;
    const gl = this.renderContext.gl;
    const uniforms = this.uniforms;
    const renderContext = this.renderContext;

    renderContext.textureUnit = 0;

    if (this.program && !this.getValid()) {
      this.program.destroy();
      this.program = null;
    }

    if (!this.program) {
      this.build();
      renderContext.lastProgramId = -1;
      if (this.errors) {
        return false;
      }
    }

    if (!this.program) {
      return false;
    }

    if (renderContext.lastProgramId === this.program.id) {
      return true; // Already bound
    }

    this.program.bind();

    renderContext.lastProgramId = this.program.id;

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

  renderLayer(layer: Layer, renderPass: number) {

    const view = this.renderContext.view;
    const gl = this.renderContext.gl;
    const uniforms = this.uniforms;
    const renderContext = this.renderContext;

    if (!this.program) {
      return false;
    }

    const primitiveBase = 0;

    gl.uniform1i(uniforms.primitiveBase, primitiveBase);

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
    }
    // TODO: Support drawing only a portion of the indices?
  }

  destroy() {
    if (this.program) {
      this.program.destroy();
    }
    this.program = null;
  }
}
