import {LinesPrimitive} from "../../../base/constants";
import {SDKErrorType} from "../../../base/core";
import {parse} from "../versions/v1_0/parse";

const OPS = {
  constructPath: 1,
  rectangle: 2,
  moveTo: 3,
  lineTo: 4,
  curveTo: 5,
  curveTo2: 6,
  curveTo3: 7,
  closePath: 8,
  stroke: 9,
  closeStroke: 10,
  fill: 11,
  eoFill: 12,
  fillStroke: 13,
  eoFillStroke: 14,
  closeFillStroke: 15,
  closeEOFillStroke: 16,
  endPath: 17,
  save: 18,
  restore: 19,
  transform: 20,
  setStrokeRGBColor: 21,
  setLineWidth: 22,
};

function createSceneModelStub() {
  const geometries: Record<string, any> = {};
  const materials: Record<string, any> = {};
  const meshes: Record<string, any> = {};
  const objects: Record<string, any> = {};

  return {
    sceneModel: {
      id: "pdfModel",
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

describe("PDF parser", () => {

  it("rejects invalid parse inputs", async () => {
    const missingModel = await parse({fileData: new Uint8Array([1]).buffer} as any, {pdfjs: {getDocument: jest.fn(), OPS}});
    expect(missingModel.ok).toBe(false);
    if (missingModel.ok === false) {
      expect(missingModel.type).toBe(SDKErrorType.InvalidInput);
      expect(missingModel.error).toContain("sceneModel is required");
    }

    const {sceneModel} = createSceneModelStub();
    sceneModel.destroyed = true;
    const destroyed = await parse({sceneModel, fileData: new Uint8Array([1]).buffer}, {pdfjs: {getDocument: jest.fn(), OPS}});
    expect(destroyed.ok).toBe(false);
    if (destroyed.ok === false) {
      expect(destroyed.type).toBe(SDKErrorType.InvalidOperation);
      expect(destroyed.error).toContain("SceneModel already destroyed");
    }
  });

  it("loads a minimal injected pdf.js document into one page SceneObject", async () => {
    const {sceneModel, geometries, materials, meshes, objects} = createSceneModelStub();
    const destroy = jest.fn(async () => undefined);
    const page = {
      getViewport: jest.fn(() => ({width: 100, height: 50})),
      getOperatorList: jest.fn(async () => ({
        fnArray: [
          OPS.setStrokeRGBColor,
          OPS.setLineWidth,
          OPS.constructPath,
          OPS.stroke,
        ],
        argsArray: [
          [1, 0, 0],
          [2],
          [[OPS.moveTo, OPS.lineTo], [0, 0, 10, 0]],
          [],
        ],
      })),
      getTextContent: jest.fn(async () => ({items: []})),
      objs: {get: jest.fn()},
    };
    const pdfjs = {
      OPS,
      getDocument: jest.fn(() => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: jest.fn(async () => page),
          destroy,
        }),
      })),
    };

    const result = await parse({
      sceneModel,
      fileData: new Uint8Array([1, 2, 3]).buffer,
    }, {
      pdfjs,
      renderText: false,
      renderImages: false,
      renderFills: false,
      scale: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.value.pages).toEqual([
      {
        pageNumber: 1,
        width: 200,
        height: 100,
        offset: [0, 0, 0],
        segmentCount: 1,
        triangleCount: 0,
        imageCount: 0,
        textCount: 0,
      },
    ]);

    const geometry = Object.values(geometries)[0] as any;
    expect(geometry.primitive).toBe(LinesPrimitive);
    expect(Array.from(geometry.positions)).toEqual([0, 0, 0, 20, 0, 0]);
    expect(Array.from(geometry.indices)).toEqual([0, 1]);

    const material = Object.values(materials)[0] as any;
    expect(material.color).toEqual([1, 0, 0]);
    expect(material.lineWidth).toBe(3);

    const mesh = Object.values(meshes)[0] as any;
    expect(mesh.position).toEqual([0, 0, 0]);
    expect(objects["pdfModel-page-1"].meshIds).toEqual([mesh.id]);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
