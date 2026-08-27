import fs from "fs";
import path from "path";

describe("WebGLRenderer SAO debug contract", () => {
  const drawTechniqueSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/drawOps/DrawTechnique.ts"),
    "utf8"
  );
  const saoOcclusionSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/renderManager/sao/SAOOcclusionRenderer.ts"),
    "utf8"
  );
  const saoPipelineSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/renderManager/sao/SAOPipeline.ts"),
    "utf8"
  );

  it("routes SAO debug modes through the WebGL draw and occlusion shaders", () => {
    expect(drawTechniqueSource).toContain("saoDebugMode: program.getLocation(\"saoDebugMode\")");
    expect(drawTechniqueSource).toContain("gl.uniform1f(uniforms.saoDebugMode, getSAODebugModeId(view.effects.sao.debug))");
    expect(drawTechniqueSource).toContain("uniform float     saoDebugMode;");
    expect(drawTechniqueSource).toContain("float saoDebugModeId = floor(saoDebugMode + 0.5)");
    expect(drawTechniqueSource).toContain("saoDebugModeId >= 1.0 && saoDebugModeId <= 4.0");
    expect(drawTechniqueSource).toContain("saoDebugModeId == 5.0");

    expect(saoOcclusionSource).toContain("const randomSeed = 0");
    expect(saoOcclusionSource).toContain("uniform float       uDebugMode");
    expect(saoOcclusionSource).toContain("gl.uniform1f(this.#uDebugMode, getSAODebugModeId(sao.debug))");
    expect(saoOcclusionSource).toContain("vec3 centerViewNormal = getViewNormal( viewPosition, vUV )");
    expect(saoOcclusionSource).toContain("if( floor( uDebugMode + 0.5 ) == 1.0 )");
    expect(saoOcclusionSource).toContain("if( floor( uDebugMode + 0.5 ) == 2.0 )");
    expect(saoOcclusionSource).toContain("float ambientOcclusion = getAmbientOcclusion( viewPosition, centerViewNormal )");
  });

  it("keeps raw SAO debug modes out of the blur pass", () => {
    expect(saoPipelineSource).toContain("isRawSAODebugMode(view.effects.sao.debug)");
    expect(saoPipelineSource).toContain("view.effects.sao.blur && !isRawSAODebugMode(view.effects.sao.debug)");
  });
});
