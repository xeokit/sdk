import fs from "fs";
import path from "path";

describe("WebGLRenderer scalar surface layer contract", () => {
  const drawTechniqueSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/drawOps/DrawTechnique.ts"),
    "utf8"
  );
  const meshAttributeTextureSource = fs.readFileSync(
    path.resolve(__dirname, "../internal/gpuMemoryManager/dataTextures/MeshAttributeTexture.ts"),
    "utf8"
  );

  it("packs scalar clearcoat and sheen material factors in the mesh attribute texture", () => {
    expect(meshAttributeTextureSource).toContain("base + 18` scalar surface layer params");
    expect(meshAttributeTextureSource).toContain("const packedClearcoat = this.buffer[base + 18] >>> 0");
    expect(meshAttributeTextureSource).toContain("const sheen8 = item.sheen !== undefined");
    expect(meshAttributeTextureSource).toContain("this.buffer[base + 18] = (clearcoat8 | (roughness8 << 8) | (sheen8 << 16) | (sheenRoughness8 << 24)) >>> 0");
    expect(meshAttributeTextureSource).toContain("clearcoat: (packedClearcoat & 0xff) / 255");
    expect(meshAttributeTextureSource).toContain("clearcoatRoughness: ((packedClearcoat >>> 8) & 0xff) / 255");
    expect(meshAttributeTextureSource).toContain("sheen: ((packedClearcoat >>> 16) & 0xff) / 255");
    expect(meshAttributeTextureSource).toContain("sheenRoughness: ((packedClearcoat >>> 24) & 0xff) / 255");
  });

  it("keeps scalar clearcoat and sheen in the WebGL PBR direct and IBL paths", () => {
    expect(drawTechniqueSource).toContain("float clearcoat = clamp(vClearcoat.x, 0.0, 1.0)");
    expect(drawTechniqueSource).toContain("float clearcoatRoughness = max(vClearcoat.y, PBR_MIN_ROUGHNESS)");
    expect(drawTechniqueSource).toContain("float sheen = clamp(vClearcoat.z, 0.0, 1.0)");
    expect(drawTechniqueSource).toContain("float sheenRoughness = max(vClearcoat.w, PBR_MIN_ROUGHNESS)");
    expect(drawTechniqueSource).toContain("float clearcoatSpecular = clearcoat * Dcc * Gcc * Fcc / max(4.0 * NdotL * NdotV, 1e-4)");
    expect(drawTechniqueSource).toContain("vec3 sheenDirect = albedo * sheen * pow(max(1.0 - VdotH, 0.0), sheenExponent) * (1.0 - metallic)");
    expect(drawTechniqueSource).toContain("vec3 directContrib = ((diffuse + specular + sheenDirect) * clearcoatBaseAttenuation + vec3(clearcoatSpecular)) * directLight");
    expect(drawTechniqueSource).toContain("vec3  clearcoatIBLSpec = clearcoatSpecEnv * (0.04 * clearcoatBRDFLUT.x + clearcoatBRDFLUT.y) * clearcoat * clearcoatIBLOcclusion");
    expect(drawTechniqueSource).toContain("vec3  iblSheen = iblDiffuseEnv * albedo * sheenIBLWeight");
    expect(drawTechniqueSource).toContain("vec3  iblContrib = (iblDiff + iblSpec + iblSheen) * (1.0 - clearcoat * clearcoatFNV) + clearcoatIBLSpec");
  });
});
