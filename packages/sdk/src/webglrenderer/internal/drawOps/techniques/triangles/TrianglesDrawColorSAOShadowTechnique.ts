import {DrawTechnique} from "../../DrawTechnique";

/**
 * Draws colored triangles with Lambert shading and BOTH Scalable Ambient
 * Obscurance and directional shadow mapping applied in the fragment shader.
 *
 * Applied in order Lambert → shadow → SAO. Order matters here because the
 * shadow stage clamps the shadowed result to `g_ambient * albedo` (the
 * ambient floor — see fsDrawShadowLogic), and that floor doesn't carry
 * the SAO factor. If SAO ran first, its darkening would be erased in
 * shadowed regions when the shadow clamp kicked in. Running SAO last
 * means it modulates whatever lit/shadowed value the shadow stage
 * produced, so AO crevices stay visible regardless of whether they're
 * also in cast shadow.
 *
 * @internal
 */
export class TrianglesDrawColorSAOShadowTechnique extends DrawTechnique {

  protected readonly vertsPerPrim = 3;

  protected buildVertexShader(): void {
    this.vsHeader();
    this.vsCommonDeclarations();
    this.vsSlicingDeclarations();
    this.vsLambertShadingDeclarations();
    this.vsDrawShadowDeclarations();
    this.vsMainBegin();
    this.vsLambertShadingLogic();
    this.vsSlicingLogic();
    this.vsDrawShadowLogic();
    this.vsMainEnd();
  }

  protected buildFragmentShader(): void {
    this.fsHeader();
    this.fsPrecisionDeclarations();
    this.fsColorDeclarations();
    this.fsSlicingDeclarations();
    this.fsLambertShadingDeclarations();
    this.fsDrawSAODeclarations();
    this.fsDrawShadowDeclarations();
    this.fsMainBegin();
    this.fsSlicingLogic();
    this.fsLambertShadingLogic();
    this.fsDrawShadowLogic();
    this.fsDrawSAOLogic();
    this.fsOutputColor();
    this.fsMainEnd();
  }
}
