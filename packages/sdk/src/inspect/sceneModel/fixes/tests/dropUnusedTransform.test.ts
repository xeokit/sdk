import {TrianglesPrimitive} from "../../../../base/constants";
import {Scene} from "../../../../model/scene";
import {dropUnusedTransform} from "../dropUnusedTransform";


function model() {
  return new Scene().createModel({id: "m"}).value!;
}


function addMesh(sceneModel: ReturnType<typeof model>) {
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
}


describe("dropUnusedTransform", () => {

  it("ignores stale same-id mesh parent refs when dropping unused transforms", () => {
    const sceneModel = model();
    expect(sceneModel.createTransform({id: "t"}).ok).toBe(true);
    addMesh(sceneModel);
    (sceneModel.meshes["mesh"] as any)._parentTransform = {id: "t", destroyed: false};

    const res = dropUnusedTransform.apply({resourceId: "t"} as any, sceneModel as any);

    expect(res.ok).toBe(true);
    expect((res as any).value.fixed).toBe(true);
    expect(sceneModel.transforms["t"]).toBeUndefined();
  });
});
