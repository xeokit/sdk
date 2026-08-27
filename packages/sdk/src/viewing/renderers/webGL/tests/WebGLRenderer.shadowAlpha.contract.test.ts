import fs from "fs";
import path from "path";

describe("WebGLRenderer alpha-mapped shadow contract", () => {
  const shadowDepthSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/drawOps/techniques/triangles/TrianglesShadowDepthTechnique.ts"),
    "utf8"
  );
  const drawOpsSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/drawOps/DrawOps.ts"),
    "utf8"
  );
  const drawTechniqueSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/drawOps/DrawTechnique.ts"),
    "utf8"
  );
  const materialResourcesSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/gpuMemoryManager/materials/BatchMaterialResources.ts"),
    "utf8"
  );
  const textureAtlasSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/gpuMemoryManager/dataTextures/TextureAtlas.ts"),
    "utf8"
  );

  it("routes UV batches through an alpha-aware shadow-depth variant", () => {
    expect(drawOpsSource).toContain("const shadowDepthVariants = (cfg = {}) => ({");
    expect(drawOpsSource).toContain("withUVs: saveForCleanup(new TrianglesShadowDepthTechnique(renderContext, gpuMemoryReader, {...cfg, hasUVs: true}))");
    expect(drawOpsSource).toContain("shadowDepth: triangleSurfaceOp(trianglesShadowDepthDTX, trianglesShadowDepthVBO, OPAQUE)");
    expect(drawOpsSource).toContain("shadowDepthTransparent: triangleSurfaceOp(trianglesShadowDepthDTX, trianglesShadowDepthVBO, TRANSPARENT)");
  });

  it("clips glTF MASK texels before WebGL shadow-map depth is written", () => {
    expect(shadowDepthSource).toContain("hasUVs?: boolean");
    expect(shadowDepthSource).toContain("this.vsLambertShadingDeclarations()");
    expect(shadowDepthSource).toContain("this.vsLambertShadingLogic()");
    expect(shadowDepthSource).toContain("uniform sampler2D uAlbedoAtlas");
    expect(shadowDepthSource).toContain("if (vAlphaMode == 1u)");
    expect(shadowDepthSource).toContain("float albedoAlpha = texture(uAlbedoAtlas, albedoAtlasUV).a * vColor.a");
    expect(shadowDepthSource).toContain("if (albedoAlpha < vAlphaCutoff) discard");
    expect(shadowDepthSource).toContain("float shadowAlphaHash(vec2 p)");
    expect(shadowDepthSource).toContain("float shadowCoverageFromBlendAlpha(float alpha)");
    expect(shadowDepthSource).toContain("return alpha < 0.02 ? 0.0 : alpha * alpha");
    expect(shadowDepthSource).toContain("float shadowCoverage = shadowCoverageFromBlendAlpha(shadowAlpha)");
    expect(shadowDepthSource).toContain("float shadowCoverage = shadowCoverageFromBlendAlpha(vColor.a)");
    expect(shadowDepthSource).toContain("shadowAlphaHash(gl_FragCoord.xy) > shadowCoverage");
    expect(shadowDepthSource).toContain("outColor = vec4(0.0)");
  });

  it("sanitizes RGB only for WebGL albedo atlas entries used by MASK materials", () => {
    expect(materialResourcesSource).toContain("const sanitizeAlphaMaskRGB = sceneMesh.effectiveAlphaMode === 1");
    expect(materialResourcesSource).toContain("{sanitizeAlphaMaskRGB}");
    expect(textureAtlasSource).toContain("sanitizeAlphaMaskedColorImageData");
    expect(textureAtlasSource).toContain("ALPHA_MASK_RGB_ENTRY_SUFFIX");
    expect(textureAtlasSource).toContain("options.sanitizeAlphaMaskRGB === true");
  });

  it("uses raw-depth blocker search and weighted PCF for WebGL contact-hardening shadows", () => {
    expect(drawTechniqueSource).toContain("uniform sampler2D       uShadowMap0");
    expect(drawTechniqueSource).toContain("uniform vec4            uShadowSoftParams");
    expect(drawTechniqueSource).toContain("vec3 shadowCascadeDebugColor");
    expect(drawTechniqueSource).toContain("float shadowAverageBlockerDepth");
    expect(drawTechniqueSource).toContain("float shadowDepthCompare");
    expect(drawTechniqueSource).toContain("vec2 uv00 = clamp((base + vec2(0.5, 0.5)) * texel, minUv, maxUv)");
    expect(drawTechniqueSource).toContain("return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y)");
    expect(drawTechniqueSource).toContain("float shadowWeightedPCF");
    expect(drawTechniqueSource).toContain("uShadowSoftParams.x > 0.5");
    expect(drawTechniqueSource).toContain("float blockerDepth = -1.0");
    expect(drawTechniqueSource).toContain("float visibility = 1.0");
    expect(drawTechniqueSource).toContain("float receiverBlockerSeparation = max(refDepth - blockerDepth, 0.0) * uShadowCascadeDepthRanges[shadowCascade]");
    expect(drawTechniqueSource).toContain("float penumbraTexels = receiverBlockerSeparation * max(uShadowSoftParams.y, 0.0) / max(uShadowCascadeTexelSizes[shadowCascade], 0.000001)");
    expect(drawTechniqueSource).toContain("litSum += shadowCompareAt(cascade, shadowUv.xy + off, refDepth) * weight");
    expect(drawTechniqueSource).toContain("weightSum += weight");
    expect(drawTechniqueSource).toContain("visibility = shadowWeightedPCF(shadowCascade, shadowUv.xy, refDepth, texel, r, filterRadius)");
    expect(drawTechniqueSource).toContain("float shadowDebugMode = floor(uShadowSoftParams.w + 0.5)");
    expect(drawTechniqueSource).toContain("shadowDebugMode == 3.0");
    expect(drawTechniqueSource).toContain("color = vec4(shadowCascadeDebugColor(shadowCascade), color.a)");
    expect(drawTechniqueSource).toContain("shadowDebugMode == 4.0");
    expect(drawTechniqueSource).toContain("shadowDebugMode == 5.0");
    expect(drawTechniqueSource).toContain("shadowDebugMode == 6.0");
    expect(drawTechniqueSource).toContain("shadowDebugMode == 7.0");
    expect(drawTechniqueSource).toContain("shadowDebugMode == 8.0");
    expect(drawTechniqueSource).toContain("gl.uniform4fv(uniforms.shadowSoftParams, renderContext.shadowSoftParams)");
  });
});
