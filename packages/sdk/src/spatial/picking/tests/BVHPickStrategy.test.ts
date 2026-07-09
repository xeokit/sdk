import {BVHPickStrategy} from "../BVHPickStrategy";

function makeRaycaster() {
  return {
    pick: jest.fn(() => ({
      ok: true,
      value: {
        hit: true,
        objectId: "object",
        meshId: "mesh",
        worldPos: [1, 2, 3],
        worldNormal: [0, 1, 0],
        rayOrigin: [1, 2, 4],
        rayDir: [0, 0, -1],
        triangleIndex: 7,
      },
    })),
  };
}

describe("BVHPickStrategy surface normals", () => {
  it("forwards pickSurfaceNormal to the raycaster and returns the normal", () => {
    const raycaster = makeRaycaster();
    const strategy = new BVHPickStrategy({} as any, raycaster as any);

    const result = strategy.pick({
      view: {} as any,
      canvasPos: [10, 20],
      pickSurfaceNormal: true,
    });

    expect(raycaster.pick).toHaveBeenCalledWith(expect.objectContaining({
      pickSurfaceNormal: true,
    }));
    expect(result.worldNormal).toEqual([0, 1, 0]);
  });

  it("keeps worldNormal null when the caller did not request one", () => {
    const raycaster = makeRaycaster();
    const strategy = new BVHPickStrategy({} as any, raycaster as any);

    const result = strategy.pick({
      view: {} as any,
      canvasPos: [10, 20],
    });

    expect(raycaster.pick).toHaveBeenCalledWith(expect.objectContaining({
      pickSurfaceNormal: false,
    }));
    expect(result.worldNormal).toBeNull();
  });
});
