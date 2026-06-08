import {buildUSDA, type USDAScene} from "./buildUSDA";

describe("buildUSDA", () => {
  const scene: USDAScene = {
    materials: [
      {name: "mat_0", color: [0.2, 0.4, 0.6], opacity: 0.5, metallic: 0.1, roughness: 0.8},
    ],
    objects: [
      {
        name: "wall",
        meshes: [
          {
            name: "mesh_0",
            positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
            indices: [0, 1, 2],
            normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
            // column-major translate(10, 20, 30)
            matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1],
            materialName: "mat_0",
          },
        ],
      },
    ],
  };

  const usda = buildUSDA(scene);

  it("starts with the usda magic and metadata", () => {
    expect(usda.startsWith("#usda 1.0")).toBe(true);
    expect(usda).toContain(`defaultPrim = "World"`);
    expect(usda).toContain(`upAxis = "Y"`);
  });

  it("emits the mesh geometry", () => {
    expect(usda).toContain(`def Mesh "mesh_0"`);
    expect(usda).toContain(`point3f[] points = [(0, 0, 0), (1, 0, 0), (0, 1, 0)]`);
    expect(usda).toContain(`int[] faceVertexCounts = [3]`);
    expect(usda).toContain(`int[] faceVertexIndices = [0, 1, 2]`);
    expect(usda).toContain(`normal3f[] normals = [(0, 0, 1), (0, 0, 1), (0, 0, 1)]`);
  });

  it("emits the UsdPreviewSurface material and binding", () => {
    expect(usda).toContain(`def Material "mat_0"`);
    expect(usda).toContain(`uniform token info:id = "UsdPreviewSurface"`);
    expect(usda).toContain(`color3f inputs:diffuseColor = (0.2, 0.4, 0.6)`);
    expect(usda).toContain(`float inputs:opacity = 0.5`);
    expect(usda).toContain(`rel material:binding = </World/Looks/mat_0>`);
  });

  it("writes the transform as USD row-major rows (translation in the last row)", () => {
    // Column-major storage chunked into rows → translation [10,20,30] lands in row 3.
    expect(usda).toContain(
      `matrix4d xformOp:transform = ( (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 1, 0), (10, 20, 30, 1) )`,
    );
    expect(usda).toContain(`uniform token[] xformOpOrder = ["xformOp:transform"]`);
  });
});
