import {LinesPrimitive} from "../../../../../../../base/constants";
import {BatchPatternResources} from "../BatchPatternResources";

function createMockGL(): WebGL2RenderingContext {
  let nextId = 1;
  const gl: Record<string, unknown> = {
    TEXTURE_2D: 0x0DE1,
    UNPACK_ALIGNMENT: 0x0CF5,
    NEAREST: 0x2600,
    CLAMP_TO_EDGE: 0x812F,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    UNSIGNED_BYTE: 0x1401,
    UNSIGNED_SHORT: 0x1403,
    UNSIGNED_INT: 0x1405,
    FLOAT: 0x1406,
    RED: 0x1903,
    RG: 0x8227,
    RGB: 0x1907,
    RGBA: 0x1908,
    RED_INTEGER: 0x8D94,
    RG_INTEGER: 0x8228,
    RGB_INTEGER: 0x8D98,
    RGBA_INTEGER: 0x8D99,
    R32F: 0x822E,
    RGBA32F: 0x8814,
    RGBA32UI: 0x8D70,
    createTexture: () => ({id: nextId++}),
    bindTexture: () => undefined,
    pixelStorei: () => undefined,
    texParameteri: () => undefined,
    texStorage2D: () => undefined,
    texSubImage2D: () => undefined,
    deleteTexture: () => undefined
  };
  return gl as unknown as WebGL2RenderingContext;
}

function allocate(resources: BatchPatternResources): void {
  for (const resource of resources.getAllocatableResources()) {
    const result = resource.allocate();
    expect(result.ok).toBe(true);
  }
}

describe("BatchPatternResources", () => {

  it("releases polyline cumulative-distance portions", () => {
    const resources = new BatchPatternResources({
      gl: createMockGL(),
      batchIndex: 0,
      maxBatchIndices: 16
    });
    allocate(resources);

    const baselineUsedBytes = resources.getUsedBytes();
    const geometryAttributeTexture = {
      setItem: jest.fn()
    };

    const handle = resources.allocatePolylineCumDist(
      {
        primitive: LinesPrimitive,
        indices: new Uint32Array([0, 1, 1, 2, 2, 3]),
        positionsCompressed: new Uint16Array([
          0, 0, 0,
          65535, 0, 0,
          65535, 65535, 0,
          0, 65535, 0
        ]),
        aabb: new Float32Array([0, 0, 0, 10, 10, 0])
      } as any,
      4,
      geometryAttributeTexture as any
    );

    expect(handle).not.toBeNull();
    expect(resources.getUsedBytes()).toBe(baselineUsedBytes + 12);

    resources.freePolylineCumDistHandle(handle);

    expect(resources.getUsedBytes()).toBe(baselineUsedBytes);
  });
});
