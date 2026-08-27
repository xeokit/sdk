import fs from "fs";
import path from "path";

describe("WebGL/WebGPU shadow cascade math contract", () => {
  const webglShadowPipelineSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/renderManager/shadows/ShadowPipeline.ts"),
    "utf8"
  );
  const webgpuShadowPipelineSource = fs.readFileSync(
    path.resolve(__dirname, "../../webGPU/internal/renderManager/shadows/WebGPUShadowPipeline.ts"),
    "utf8"
  );

  it("routes both shadow pipelines through the shared math helpers", () => {
    for (const source of [webglShadowPipelineSource, webgpuShadowPipelineSource]) {
      expect(source).toContain("computeShadowCascadeSplits");
      expect(source).toContain("fitShadowCascadeToCamera");
      expect(source).toContain("isFiniteShadowAABB");
      expect(source).not.toContain("private _computeCascadeSplits");
      expect(source).not.toContain("function fitLightProjectionToCamera");
    }
  });

  it("keeps WebGL's view-space shader contract behind a shared world-space fit", () => {
    expect(webglShadowPipelineSource).toContain("mulMat4(this._lightProj as any, this._lightView as any, this._worldLightVP as any)");
    expect(webglShadowPipelineSource).toContain("mulMat4(this._worldLightVP as any, inverseCameraViewMatrix as Mat4, this._lightVP as any)");
  });
});
