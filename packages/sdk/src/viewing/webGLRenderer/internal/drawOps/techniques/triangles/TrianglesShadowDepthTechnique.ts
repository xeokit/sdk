import {DrawTechnique} from "../../DrawTechnique";

/**
 * Renders triangles into the shadow-map depth FBO from the light's point of view.
 *
 * Reuses the full mesh/transform vertex pipeline from the base class so that the
 * same data-texture bindings used by the color pass apply here. After vsMainBegin
 * sets gl_Position from the camera matrices, {@link vsShadowDepthLogic} overrides
 * it using the uniform `uShadowLightVP * worldPos`.
 *
 * The fragment shader writes a throwaway color; what matters is that the depth
 * buffer of the bound FBO gets populated.
 *
 * @internal
 */
export class TrianglesShadowDepthTechnique extends DrawTechnique {

  public readonly vertsPerPrim = 3;

  constructor(
    renderContext,
    gpuMemoryReader,
    opts: { vboGeometry?: boolean; vboTileUniform?: boolean; vboViewAttributes?: boolean } = {},
  ) {
    super(renderContext, gpuMemoryReader, {
      vboGeometry: opts.vboGeometry === true,
      vboTileUniform: opts.vboTileUniform === true,
      vboViewAttributes: opts.vboViewAttributes === true,
    });
  }

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsShadowSharedDeclarations();
    this.vsMainBegin();
    this.vsSlicingLogic();
    this.vsShadowDepthLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsEmit(
      "out vec4 outColor;",
      "void main(void) {",
      "    outColor = vec4(0.0);",
      "}"
    );
  }
}
