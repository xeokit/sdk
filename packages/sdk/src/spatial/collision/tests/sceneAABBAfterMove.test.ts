import {Scene} from "../../../model/scene/Scene";
import {TrianglesPrimitive} from "../../../base/constants";
import {getSceneCollisionIndex} from "../getSceneCollisionIndex";

// Regression: a fit/pick issued right after a mesh translate must see the moved
// bounds. onSceneMeshMatrixChanged is dispatched synchronously from the matrix
// setter, so the collision index is marked dirty before the query runs.
describe("scene collision AABB after a mesh translate", () => {
  it("getSceneAABB reflects a translate without waiting for the deferred event", () => {
    const scene = new Scene();
    const model = scene.createModel({id: "m"}).value!;
    model.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1,
                  -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1],
      indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7],
    });
    model.createMesh({id: "mesh", geometryId: "g"});
    model.createObject({id: "obj", meshIds: ["mesh"]});

    const idx = getSceneCollisionIndex(scene);
    expect(Array.from(idx.getSceneAABB()!)).toEqual([-1, -1, -1, 1, 1, 1]);

    model.meshes["mesh"].matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 100, 0, 0, 1];

    expect(Array.from(idx.getSceneAABB()!)).toEqual([99, -1, -1, 101, 1, 1]);
  });
});
