import fs from "fs";
import path from "path";

describe("WebGPURenderer IBL contract", () => {
  const iblManagerSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/renderManager/WebGPUIBLManager.ts"),
    "utf8"
  );
  const renderManagerSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/renderManager/RenderManager.ts"),
    "utf8"
  );

  it("uses a filtered source cubemap for material reflections at the parity quality tier", () => {
    expect(iblManagerSource).toContain("const BRDF_LUT_SIZE = 256");
    expect(iblManagerSource).toContain("const BRDF_SAMPLE_COUNT = 256");
    expect(iblManagerSource).toContain("const SOURCE_SIZE = 256");
    expect(iblManagerSource).toContain("const SOURCE_MIPS = 9");
    expect(iblManagerSource).toContain("const IRRADIANCE_SIZE = 32");
    expect(iblManagerSource).toContain("const PREFILTER_SIZE = 128");
    expect(iblManagerSource).toContain("const PREFILTER_MIPS = 8");
    expect(iblManagerSource).toContain("const PREFILTER_SAMPLE_COUNT = 128");
    expect(iblManagerSource).toContain("createSourceCubeMap(createEnvironmentSampler(view))");
    expect(iblManagerSource).toContain("const color = env.sample(dir, env.sourceMipLevel?.(dir, SOURCE_SIZE) ?? 0)");
    expect(iblManagerSource).toContain("const saTexel = 4 * PI / (CUBE_FACE_COUNT * SOURCE_SIZE * SOURCE_SIZE)");
    expect(iblManagerSource).toContain("const lod = Math.max(0, 0.5 * Math.log2(saSample / saTexel))");
    expect(iblManagerSource).toContain("env.sample(l, lod)");
  });

  it("matches the WebGL split-sum BRDF LUT geometry remap", () => {
    expect(iblManagerSource).toContain("const k = (roughness * roughness) / 2");
    expect(iblManagerSource).toContain("return ndotv / (ndotv * (1 - k) + k) * ndotl / (ndotl * (1 - k) + k)");
    expect(iblManagerSource).not.toContain("const a = roughness * roughness;\n  const k = (a * a) / 2");
  });

  it("honors LDR equirectangular IBL environments through CPU-readable image sampling", () => {
    expect(iblManagerSource).toContain("const ldrImage = view ? ((view as any).lights?.ibl?.environmentImage as TexImageSource | undefined) : undefined");
    expect(iblManagerSource).toContain("return createEquirectEnvironmentSampler(readLDRImagePixels(ldrImage), up)");
    expect(iblManagerSource).toContain("ctx.drawImage(source as any, 0, 0, width, height)");
    expect(iblManagerSource).toContain("srgbByteToLinear(Number(data[src]))");
  });

  it("does not build active IBL resources for pick or snap passes", () => {
    const inactivePrepareCalls = renderManagerSource.match(/_iblManager\.prepare\(view, \{active: false\}\)/g) || [];
    expect(inactivePrepareCalls).toHaveLength(2);
  });
});
