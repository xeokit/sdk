import {TrianglesPrimitive} from "../../../../base/constants";
import {Scene} from "../../../../model/scene";
import {dropDuplicateObject} from "../dropDuplicateObject";


function model() {
  return new Scene().createModel({id: "m"}).value!;
}


function addTriangleGeometry(sceneModel: ReturnType<typeof model>, id: string) {
  const res = sceneModel.createGeometry({
    id,
    primitive: TrianglesPrimitive,
    positions: [
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ],
    indices: [0, 1, 2],
  });
  expect(res.ok).toBe(true);
}


function addObject(sceneModel: ReturnType<typeof model>, objectId: string, meshId: string, geometryId = "g") {
  expect(sceneModel.createMesh({
    id: meshId,
    geometryId,
  }).ok).toBe(true);
  expect(sceneModel.createObject({
    id: objectId,
    meshIds: [meshId],
  }).ok).toBe(true);
}


describe("dropDuplicateObject", () => {

  it("ignores stale foreign mesh refs when destroying duplicate objects", () => {
    const sceneModel = model();
    addTriangleGeometry(sceneModel, "g");
    addObject(sceneModel, "canonical", "canonicalMesh");
    addObject(sceneModel, "duplicate", "duplicateMesh");
    addObject(sceneModel, "foreign", "foreignMesh");

    sceneModel.objects["duplicate"].meshes.push(sceneModel.meshes["foreignMesh"]);

    const res = dropDuplicateObject.apply({
      resourceId: "canonical",
      context: {duplicates: ["duplicate"]},
    } as any, sceneModel as any);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(sceneModel.objects["duplicate"]).toBeUndefined();
    expect(sceneModel.meshes["duplicateMesh"]).toBeUndefined();
    expect(sceneModel.objects["foreign"]).toBeDefined();
    expect(sceneModel.meshes["foreignMesh"]).toBeDefined();
    expect(sceneModel.meshes["foreignMesh"].object?.id).toBe("foreign");
    expect(sceneModel.objects["foreign"].meshes.map(mesh => mesh.id)).toEqual(["foreignMesh"]);
  });
});
