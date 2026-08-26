import {TrianglesPrimitive} from "../../../../base/constants";
import {Scene} from "../../../../model/scene";
import {pruneDanglingMeshRefs} from "../pruneDanglingMeshRefs";


describe("pruneDanglingMeshRefs", () => {

  it("does not remove a valid mesh when applying a stale dangling issue", () => {
    const sceneModel = new Scene().createModel({id: "m"}).value!;
    expect(sceneModel.createGeometry({
      id: "g",
      primitive: TrianglesPrimitive,
      positions: [0, 0, 0,  1, 0, 0,  0, 1, 0],
      indices: [0, 1, 2],
    }).ok).toBe(true);
    expect(sceneModel.createMesh({
      id: "mesh",
      geometryId: "g",
    }).ok).toBe(true);
    expect(sceneModel.createObject({
      id: "object",
      meshIds: ["mesh"],
    }).ok).toBe(true);

    const res = pruneDanglingMeshRefs.apply({
      resourceId: "object",
      context: {danglingMeshId: "mesh"},
    } as any, sceneModel as any);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(false);
    expect((res as any).value.reason).toBe("no-op");
    expect(sceneModel.objects["object"].meshes.map(mesh => mesh.id)).toEqual(["mesh"]);
    expect(sceneModel.meshes["mesh"].object?.id).toBe("object");
  });
});
