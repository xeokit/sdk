import {TrianglesPrimitive} from "../../../../../../base/constants";
import {RENDER_PASSES} from "../../../RENDER_PASSES";
import {GPUMemoryCheckResult} from "../../GPUMemoryCheckResult";
import {DTXGeometryStorage} from "../DTXGeometryStorage";

function createMockGL(): WebGL2RenderingContext {
  const gl: Record<string, unknown> = {
    UNSIGNED_INT: 0x1405,
    UNSIGNED_SHORT: 0x1403,
    RG_INTEGER: 0x8228,
    RGB_INTEGER: 0x8D98,
    RGBA_INTEGER: 0x8D99,
    RGBA32F: 0x8814,
    RGBA32UI: 0x8D70,
    RG32UI: 0x823C,
    RGB32UI: 0x8D71,
    createTexture: jest.fn(),
    bindTexture: jest.fn(),
    pixelStorei: jest.fn(),
    texParameteri: jest.fn(),
    texStorage2D: jest.fn(),
    texSubImage2D: jest.fn(),
    deleteTexture: jest.fn()
  };
  return gl as unknown as WebGL2RenderingContext;
}

function createStorage(): DTXGeometryStorage {
  return new DTXGeometryStorage({
    gl: createMockGL(),
    batchIndex: 0,
    memoryConfigs: {
      maxViews: 2,
      maxBatchPrims: 2,
      maxBatchGeometries: 4,
      maxBatchIndices: 64,
      maxBatchVertices: 64
    } as any,
    bins: [RENDER_PASSES.OPAQUE],
    getNumGeometries: () => 0
  });
}

function createTriangleMesh(edgeIndexCount = 0): any {
  return {
    geometry: {
      primitive: TrianglesPrimitive,
      positionsCompressed: new Uint16Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0
      ]),
      indices: new Uint32Array([0, 1, 2]),
      edgeIndices: edgeIndexCount > 0 ? new Uint32Array(edgeIndexCount) : undefined
    }
  };
}

describe("DTXGeometryStorage.canAddMesh", () => {

  it("checks primitive draw-list capacity in every view", () => {
    const storage = createStorage();
    const resources = storage.getResources();
    resources.primitiveMeshIndexTextures[1].createPortion(2, 10, RENDER_PASSES.OPAQUE);

    const result = storage.canAddMesh(createTriangleMesh(), true);

    expect(result).toBe(GPUMemoryCheckResult.NotEnoughPrimSpace);
  });

  it("checks edge draw-list capacity in every view", () => {
    const storage = createStorage();
    const resources = storage.getResources();
    resources.edgeMeshIndexTextures[1].createPortion(2, 10, RENDER_PASSES.OPAQUE);

    const result = storage.canAddMesh(createTriangleMesh(2), true);

    expect(result).toBe(GPUMemoryCheckResult.NotEnoughEdgeIndexSpace);
  });
});
