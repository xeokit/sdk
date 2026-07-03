import {Scene} from "../Scene";


describe("SceneTransform hierarchy", () => {

  it("rejects reparenting that would create a cycle", () => {
    const model = new Scene().createModel({id: "m"}).value!;
    model.createTransform({id: "a"});
    model.createTransform({id: "b", parentTransformId: "a"});
    model.createTransform({id: "c", parentTransformId: "b"});

    const a = model.transforms["a"];
    const b = model.transforms["b"];
    const c = model.transforms["c"];

    const result = a.setParentTransformId("c");

    expect(result.ok).toBe(false);
    expect(a.parentTransform).toBeNull();
    expect(b.parentTransform).toBe(a);
    expect(c.parentTransform).toBe(b);
    expect(a.childTransforms).toContain(b);
    expect(b.childTransforms).toContain(c);
    expect(c.childTransforms).toHaveLength(0);
  });
});
