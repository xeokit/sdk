import {DrawTechnique} from "../../DrawTechnique";

/**
 * Renders triangles into the shadow-map depth FBO from the light's point of view.
 *
 * Reuses the full mesh/transform vertex pipeline from the base class so that the
 * same data-texture bindings used by the color pass apply here. After vsMainBegin
 * sets gl_Position from the camera matrices, {@link vsShadowDepthLogic} overrides
 * it using the uniform `uShadowLightVP * viewPos`.
 *
 * The fragment shader writes a throwaway color; what matters is that the depth
 * buffer of the bound FBO gets populated. For UV-bearing batches we also sample
 * the albedo atlas and discard glTF MASK fragments so alpha-mapped surfaces cast
 * cutout shadows instead of rectangular card shadows. BLEND materials use a
 * stable alpha hash so PCF resolves them as partial-coverage shadows instead of
 * solid silhouettes.
 *
 * @internal
 */
export class TrianglesShadowDepthTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 3;

  constructor(
    renderContext,
    gpuMemoryReader,
    opts: {
      vboGeometry?: boolean;
      vboTileUniform?: boolean;
      vboViewAttributes?: boolean;
      hasUVs?: boolean;
    } = {},
  ) {
    super(renderContext, gpuMemoryReader, {
      vboGeometry: opts.vboGeometry === true,
      vboTileUniform: opts.vboTileUniform === true,
      vboViewAttributes: opts.vboViewAttributes === true,
      hasUVs: opts.hasUVs === true,
    });
  }

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsLambertShadingDeclarations();
    this.vsShadowSharedDeclarations();
    this.vsMainBegin();
    this.vsLambertShadingLogic();
    this.vsSlicingLogic();
    this.vsShadowDepthLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsEmit(
      "flat in vec4 vColor;"
    );
    if (this.hasUVs) {
      this.fsEmit(
        "in vec2 vUV;",
        "flat in vec2 vAlbedoUVOffset;",
        "flat in vec2 vAlbedoUVScale;",
        "flat in uint vAlphaMode;",
        "flat in float vAlphaCutoff;",
        "uniform sampler2D uAlbedoAtlas;"
      );
    }
    this.fsEmit(
      "out vec4 outColor;",
      "float shadowAlphaHash(vec2 p) {",
      "    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));",
      "}",
      "float shadowCoverageFromBlendAlpha(float alpha) {",
      "    alpha = clamp(alpha, 0.0, 1.0);",
      "    return alpha < 0.02 ? 0.0 : alpha * alpha;",
      "}",
      "void main(void) {"
    );
    if (this.hasUVs) {
      this.fsEmit(
        "    float shadowAlpha = vColor.a;",
        "    if (vAlphaMode == 2u) {",
        "        vec2 albedoAtlasUV = fract(vUV) * vAlbedoUVScale + vAlbedoUVOffset;",
        "        shadowAlpha = texture(uAlbedoAtlas, albedoAtlasUV).a * vColor.a;",
        "    }",
        "    if (vAlphaMode == 1u) {",
        "        vec2 albedoAtlasUV = fract(vUV) * vAlbedoUVScale + vAlbedoUVOffset;",
        "        float albedoAlpha = texture(uAlbedoAtlas, albedoAtlasUV).a * vColor.a;",
        "        if (albedoAlpha < vAlphaCutoff) discard;",
        "    } else if (shadowAlpha < 0.999) {",
        "        float shadowCoverage = shadowCoverageFromBlendAlpha(shadowAlpha);",
        "        if (shadowCoverage <= 0.0 || shadowAlphaHash(gl_FragCoord.xy) > shadowCoverage) discard;",
        "    }"
      );
    } else {
      this.fsEmit(
        "    if (vColor.a < 0.999) {",
        "        float shadowCoverage = shadowCoverageFromBlendAlpha(vColor.a);",
        "        if (shadowCoverage <= 0.0 || shadowAlphaHash(gl_FragCoord.xy) > shadowCoverage) discard;",
        "    }"
      );
    }
    this.fsEmit(
      "    outColor = vec4(0.0);",
      "}"
    );
  }
}
