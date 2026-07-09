import {TrianglesPrimitive} from "../../../base/constants";
import {intersectSceneRayTriangle} from "../intersectSceneRayTriangle";

const IDENTITY = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

function makeCollisionIndex() {
  const mesh = {
    id: "mesh",
    worldMatrix: IDENTITY,
    geometry: {
      primitive: TrianglesPrimitive,
      aabb: [0, 0, 0, 1, 1, 0],
      positionsCompressed: new Uint16Array([
        0, 0, 0,
        65535, 0, 0,
        0, 65535, 0,
      ]),
      indices: new Uint16Array([0, 1, 2]),
    },
  };

  return {
    intersectRay: jest.fn(() => [{objectId: "object", tEnter: 0}]),
    scene: {
      objects: {
        object: {meshes: [mesh]},
      },
    },
  } as any;
}

describe("intersectSceneRayTriangle", () => {
  it("returns the world-space face normal when requested", () => {
    const hit = intersectSceneRayTriangle(
      makeCollisionIndex(),
      [0.25, 0.25, 1],
      [0, 0, -1],
      {pickSurfaceNormal: true},
    );

    expect(hit).not.toBeNull();
    expect(Array.from(hit!.worldNormal!)).toEqual([0, 0, 1]);
  });

  it("does not compute a face normal unless requested", () => {
    const hit = intersectSceneRayTriangle(
      makeCollisionIndex(),
      [0.25, 0.25, 1],
      [0, 0, -1],
    );

    expect(hit).not.toBeNull();
    expect(hit!.worldNormal).toBeNull();
  });
});
