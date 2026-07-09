import {LinesPrimitive, TrianglesPrimitive} from "../../../base/constants";
import {SDKErrorType} from "../../../base/core";
import {emit} from "../versions/v1_0/parse";

function createSceneModelStub() {
  const geometries: Record<string, any> = {};
  const materials: Record<string, any> = {};
  const meshes: Record<string, any> = {};
  const objects: Record<string, any> = {};

  return {
    sceneModel: {
      id: "dwgModel",
      destroyed: false,
      geometries,
      materials,
      meshes,
      objects,
      createGeometry: jest.fn((params: any) => {
        geometries[params.id] = params;
        return {ok: true, value: params};
      }),
      createMaterial: jest.fn((params: any) => {
        materials[params.id] = params;
        return {ok: true, value: params};
      }),
      createMesh: jest.fn((params: any) => {
        meshes[params.id] = params;
        return {ok: true, value: params};
      }),
      createObject: jest.fn((params: any) => {
        objects[params.id] = params;
        return {ok: true, value: params};
      }),
    } as any,
    geometries,
    materials,
    meshes,
    objects,
  };
}

describe("DWG emit", () => {

  it("emits line and face entities into layer-based SceneObjects", async () => {
    const {sceneModel, geometries, objects} = createSceneModelStub();

    const result = await emit({
      sceneModel,
      document: {
        entities: [
          {
            type: "LINE",
            layer: "Walls",
            color: [1, 0, 0],
            lineWidth: 0.5,
            start: [0, 0, 0],
            end: [2, 0, 0],
          },
          {
            type: "3DFACE",
            layer: "Slabs",
            color: [0, 1, 0],
            corners: [
              [0, 0, 0],
              [1, 0, 0],
              [0, 1, 0],
              [0, 1, 0],
            ],
          },
        ],
      } as any,
    }, {
      scale: 2,
      objectIdStrategy: "layer",
      renderText: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.value.segmentCount).toBe(1);
    expect(result.value.triangleCount).toBe(1);
    expect(result.value.sceneObjectIds.sort()).toEqual(["dwgModel-Slabs", "dwgModel-Walls"]);

    const lineGeometry = Object.values(geometries).find((geometry: any) => geometry.primitive === LinesPrimitive) as any;
    expect(lineGeometry).toBeDefined();
    expect(Array.from(lineGeometry.positions)).toEqual([0, 0, 0, 4, 0, 0]);
    expect(Array.from(lineGeometry.indices)).toEqual([0, 1]);

    const faceGeometry = Object.values(geometries).find((geometry: any) => geometry.primitive === TrianglesPrimitive) as any;
    expect(faceGeometry).toBeDefined();
    expect(Array.from(faceGeometry.positions)).toEqual([0, 0, 0, 2, 0, 0, 0, 2, 0]);
    expect(Array.from(faceGeometry.indices)).toEqual([0, 1, 2]);

    expect(objects["dwgModel-Walls"].meshIds).toHaveLength(1);
    expect(objects["dwgModel-Slabs"].meshIds).toHaveLength(1);
  });

  it("rejects invalid emit inputs", async () => {
    const missingModel = await emit({document: {entities: []}} as any);
    expect(missingModel.ok).toBe(false);
    if (missingModel.ok === false) {
      expect(missingModel.type).toBe(SDKErrorType.InvalidInput);
      expect(missingModel.error).toContain("sceneModel is required");
    }

    const {sceneModel} = createSceneModelStub();
    const missingEntities = await emit({sceneModel, document: {}} as any);
    expect(missingEntities.ok).toBe(false);
    if (missingEntities.ok === false) {
      expect(missingEntities.type).toBe(SDKErrorType.InvalidInput);
      expect(missingEntities.error).toContain("entities array");
    }
  });
});
