import {extensionOf, resolveLoaderId, resolveExporterId, FORMAT_BY_EXTENSION} from "../resolveFormat";

describe("resolveFormat (xeoconvert generic --in/--out)", () => {

  describe("extensionOf", () => {
    it("returns the lowercased final extension, ignoring directories", () => {
      expect(extensionOf("/a/b/Model.GLB")).toBe(".glb");
      expect(extensionOf("C:\\models\\thing.Xgf")).toBe(".xgf");
      expect(extensionOf("model.city.json")).toBe(".json"); // last dot only
    });
    it("returns '' when there is no extension or it's a dotfile", () => {
      expect(extensionOf("model")).toBe("");
      expect(extensionOf("/path/.hidden")).toBe(""); // leading dot, no real ext
      expect(extensionOf("")).toBe("");
    });
  });

  describe("resolveLoaderId", () => {
    it("maps known input extensions to loader ids", () => {
      expect(resolveLoaderId("a.glb")).toBe("glb");
      expect(resolveLoaderId("a.gltf")).toBe("glb");
      expect(resolveLoaderId("a.xgf")).toBe("xgf");
      expect(resolveLoaderId("a.ifc")).toBe("ifc");
      expect(resolveLoaderId("a.bim")).toBe("dotbim");
      expect(resolveLoaderId("a.las")).toBe("las");
      expect(resolveLoaderId("a.laz")).toBe("las");
      expect(resolveLoaderId("a.e57")).toBe("e57");
      expect(resolveLoaderId("a.fbx")).toBe("fbx");
      expect(resolveLoaderId("a.obj")).toBe("obj");
      expect(resolveLoaderId("a.ply")).toBe("ply");
      expect(resolveLoaderId("a.mtl")).toBe("mtl");
      expect(resolveLoaderId("a.usdz")).toBe("usdz");
      expect(resolveLoaderId("a.3dxml")).toBe("threedxml");
      expect(resolveLoaderId("a.fds")).toBe("fds");
      expect(resolveLoaderId("a.splat")).toBe("gaussiansplat");
      expect(resolveLoaderId("a.xkt")).toBe("xkt");
    });
    it("throws a guiding error on unknown/ambiguous extensions", () => {
      expect(() => resolveLoaderId("a.json")).toThrow(/--pipeline/);
      expect(() => resolveLoaderId("a.dwg")).toThrow(/\.dwg|input loader/i);
      // .dxf / .svg are export-only — no loader.
      expect(() => resolveLoaderId("a.dxf")).toThrow(/input loader/i);
      expect(() => resolveLoaderId("a.svg")).toThrow(/input loader/i);
      expect(() => resolveLoaderId("noext")).toThrow(/none/);
    });
  });

  describe("resolveExporterId", () => {
    it("maps known output extensions to exporter ids", () => {
      expect(resolveExporterId("a.glb")).toBe("glb");
      expect(resolveExporterId("a.xgf")).toBe("xgf");
      expect(resolveExporterId("a.xgfstream")).toBe("xgfstream");
      expect(resolveExporterId("a.ifc")).toBe("ifc");
      expect(resolveExporterId("a.bim")).toBe("dotbim");
      expect(resolveExporterId("a.fbx")).toBe("fbx");
      expect(resolveExporterId("a.obj")).toBe("obj");
      expect(resolveExporterId("a.ply")).toBe("ply");
      expect(resolveExporterId("a.mtl")).toBe("mtl");
      expect(resolveExporterId("a.usdz")).toBe("usdz");
      expect(resolveExporterId("a.3dxml")).toBe("threedxml");
      expect(resolveExporterId("a.fds")).toBe("fds");
      expect(resolveExporterId("a.splat")).toBe("gaussiansplat");
      expect(resolveExporterId("a.xkt")).toBe("xkt");
      expect(resolveExporterId("a.dxf")).toBe("dxf"); // export-only
      expect(resolveExporterId("a.svg")).toBe("svg"); // export-only
      expect(resolveExporterId("a.e57")).toBe("e57"); // E57 round-trips
    });
    it("throws for import-only formats (no exporter) and unknown extensions", () => {
      expect(() => resolveExporterId("a.las")).toThrow(/output exporter/);
      expect(() => resolveExporterId("a.json")).toThrow(/--pipeline/);
    });
  });

  it("same-extension in/out resolves to the same family (optimize/validate in place)", () => {
    expect(resolveLoaderId("m.xgf")).toBe(resolveExporterId("m.xgf"));
  });

  it("every binding's ids are plausible (non-empty strings)", () => {
    for (const [ext, b] of Object.entries(FORMAT_BY_EXTENSION)) {
      expect(ext.startsWith(".")).toBe(true);
      if (b.loader) expect(typeof b.loader).toBe("string");
      if (b.exporter) expect(typeof b.exporter).toBe("string");
    }
  });
});
