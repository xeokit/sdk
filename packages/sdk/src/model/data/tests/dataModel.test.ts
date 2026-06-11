import {Data} from "../Data";

// Drives the REAL Data + DataModel + DataObject + Relationship classes.
// There is no `build()` step in this SDK: createObject/createPropertySet/
// createRelationship register and wire everything synchronously and return the
// SDKResult `{ok:true,value}` / `{ok:false,error,type}` convention.

// A relationship type. The `relating`/`related` maps on DataObject are keyed by
// this value (typed `[key:number]` but used with whatever the caller passes).
const AGGREGATES = "aggregates";

describe("Data + DataModel build lifecycle", () => {

  it("starts empty and registers a model in data.models[id]", () => {
    const data = new Data();
    expect(data.destroyed).toBe(false);
    expect(Object.keys(data.models)).toHaveLength(0);
    expect(Object.keys(data.objects)).toHaveLength(0);

    const r = data.createModel({id: "myModel"});
    expect(r.ok).toBe(true);
    const model = r.value;
    // Retrievable via the `models` accessor, keyed by id.
    expect(data.models["myModel"]).toBe(model);
    expect(model.id).toBe("myModel");
  });

  it("creates objects + property set, wires a relationship, and indexes them", () => {
    const data = new Data();
    const model = data.createModel({id: "m1"}).value;

    // PropertySet with one Property.
    const psResult = model.createPropertySet({
      id: "ps1",
      name: "Wall Props",
      type: "WallPset",
      properties: [{name: "FireRating", value: "REI60", type: "string"}],
    });
    expect(psResult.ok).toBe(true);
    expect(data.propertySets["ps1"]).toBe(psResult.value);
    expect(model.propertySets["ps1"]).toBe(psResult.value);

    // Relating object (the "parent"), carrying the property set.
    const o1 = model.createObject({
      id: "obj1",
      type: "IfcBuildingStorey",
      name: "Level 1",
      propertySetIds: ["ps1"],
    });
    expect(o1.ok).toBe(true);

    // Related object (the "child").
    const o2 = model.createObject({
      id: "obj2",
      type: "IfcWall",
      name: "Wall A",
    });
    expect(o2.ok).toBe(true);

    // Objects appear in Data.objects and DataModel.objects with right ids/types/names.
    expect(data.objects["obj1"]).toBe(o1.value);
    expect(data.objects["obj2"]).toBe(o2.value);
    expect(model.objects["obj1"].type).toBe("IfcBuildingStorey");
    expect(model.objects["obj1"].name).toBe("Level 1");
    expect(model.objects["obj2"].type).toBe("IfcWall");

    // Indexed by type on both Data and DataModel.
    expect(Object.keys(data.objectsByType["IfcWall"])).toContain("obj2");
    expect(Object.keys(model.objectsByType["IfcBuildingStorey"])).toContain("obj1");
    expect(data.typeCounts["IfcWall"]).toBe(1);

    // The data object carries the referenced property set.
    expect(o1.value.propertySets?.[0]).toBe(psResult.value);

    // Wire obj1 -> obj2 (obj1 relates obj2). No build() needed.
    const rel = model.createRelationship({
      type: AGGREGATES,
      relatingObjectId: "obj1",
      relatedObjectId: "obj2",
    });
    expect(rel.ok).toBe(true);
    expect(model.relationships).toHaveLength(1);

    // The relating object lists the related as a child via `related[type]`.
    expect(o1.value.related[AGGREGATES]).toHaveLength(1);
    expect(o1.value.related[AGGREGATES][0].relatedObject).toBe(o2.value);

    // The related object lists the relating as a parent via `relating[type]`.
    expect(o2.value.relating[AGGREGATES]).toHaveLength(1);
    expect(o2.value.relating[AGGREGATES][0].relatingObject).toBe(o1.value);
  });

  it("getObjectIdsByType returns the ids for a type", () => {
    const data = new Data();
    const model = data.createModel({id: "m2"}).value;
    model.createObject({id: "w1", type: "IfcWall", name: "W1"});
    model.createObject({id: "w2", type: "IfcWall", name: "W2"});
    model.createObject({id: "d1", type: "IfcDoor", name: "D1"});

    const walls = data.getObjectIdsByType("IfcWall");
    expect(walls.ok).toBe(true);
    expect(walls.value.sort()).toEqual(["w1", "w2"]);

    // Unknown type yields an empty array (still ok:true).
    const none = data.getObjectIdsByType("IfcNope");
    expect(none.ok).toBe(true);
    expect(none.value).toEqual([]);
  });

  describe("failure contract", () => {

    it("rejects a duplicate object id within a model", () => {
      const data = new Data();
      const model = data.createModel({id: "m3"}).value;
      expect(model.createObject({id: "x", type: "IfcWall", name: "X"}).ok).toBe(true);

      const dup = model.createObject({id: "x", type: "IfcWall", name: "X again"});
      expect(dup.ok).toBe(false);
      if (dup.ok === false) {
        expect(dup.error).toMatch(/already created/);
      }
    });

    it("rejects a relationship referencing a missing object", () => {
      const data = new Data();
      const model = data.createModel({id: "m4"}).value;
      model.createObject({id: "real", type: "IfcWall", name: "Real"});

      const bad = model.createRelationship({
        type: AGGREGATES,
        relatingObjectId: "real",
        relatedObjectId: "ghost", // does not exist
      });
      expect(bad.ok).toBe(false);
      if (bad.ok === false) {
        expect(bad.error).toMatch(/Related DataObject not found/);
      }
    });

    it("rejects a duplicate model id in the same Data", () => {
      const data = new Data();
      expect(data.createModel({id: "dup"}).ok).toBe(true);
      const again = data.createModel({id: "dup"});
      expect(again.ok).toBe(false);
    });
  });

  it("destroying a model removes it from Data and sets its destroyed flag", () => {
    const data = new Data();
    const model = data.createModel({id: "m5"}).value;
    model.createObject({id: "a", type: "IfcWall", name: "A"});
    model.createObject({id: "b", type: "IfcDoor", name: "B"});

    expect(data.objects["a"]).toBeDefined();
    expect(data.objects["b"]).toBeDefined();

    const res = model.destroy();
    expect(res.ok).toBe(true);
    expect(model.destroyed).toBe(true);

    // The model is unregistered from Data.models.
    expect(data.models["m5"]).toBeUndefined();

    // Single-model objects are purged from data.objects on destroy: each is
    // owned by exactly one model (models.length===1), so destroy takes the
    // delete branch rather than just detaching the model.
    expect(data.objects["a"]).toBeUndefined();
    expect(data.objects["b"]).toBeUndefined();

    // ...and the purged objects (both roots, having no relationships) are
    // removed from data.rootObjects too, leaving no dangling references.
    expect(data.rootObjects["a"]).toBeUndefined();
    expect(data.rootObjects["b"]).toBeUndefined();

    // Operating on a destroyed model fails.
    const after = model.createObject({id: "c", type: "IfcWall", name: "C"});
    expect(after.ok).toBe(false);
  });

  it("data.destroy() clears all contained models", () => {
    const data = new Data();
    const m = data.createModel({id: "m6"}).value;
    m.createObject({id: "z", type: "IfcWall", name: "Z"});

    const res = data.destroy();
    expect(res.ok).toBe(true);
    // clear() destroyed the contained model, removing it from data.models.
    expect(data.models["m6"]).toBeUndefined();
    expect(m.destroyed).toBe(true);

    // destroy() sets the destroyed flag, so a second call is rejected.
    expect(data.destroyed).toBe(true);
    expect(data.destroy().ok).toBe(false);
  });

  it("an object shared by two models survives one model's destroy, detaching only that owner", () => {
    const data = new Data();
    const m1 = data.createModel({id: "ma"}).value;
    const m2 = data.createModel({id: "mb"}).value;

    // Same object id created in both models -> shared, owned by both.
    const shared = m1.createObject({id: "s", type: "IfcWall", name: "S"}).value;
    m2.createObject({id: "s", type: "IfcWall", name: "S"});
    expect(shared.models).toHaveLength(2);

    // Destroying one owner detaches it but keeps the object alive in Data,
    // since the other model still owns it.
    m1.destroy();
    expect(data.objects["s"]).toBe(shared);
    expect(shared.models).toEqual([m2]);

    // Destroying the last owner now purges it.
    m2.destroy();
    expect(data.objects["s"]).toBeUndefined();
  });

  it("fires onDataObjectDestroyed once per destroyed object, regardless of shared type", () => {
    const data = new Data();
    const model = data.createModel({id: "m7"}).value;
    // Two objects of the SAME type, plus a relationship between them. The old
    // code gated destroy cleanup on the per-type count reaching zero, so the
    // event only fired for the last object of each type.
    model.createObject({id: "a", type: "IfcWall", name: "A"});
    model.createObject({id: "b", type: "IfcWall", name: "B"});
    model.createRelationship({type: AGGREGATES, relatingObjectId: "a", relatedObjectId: "b"});

    const destroyed: string[] = [];
    data.events.onDataObjectDestroyed.subscribe((_d, obj) => destroyed.push(obj.id));

    model.destroy();

    expect(destroyed.sort()).toEqual(["a", "b"]);
  });

  it("unwires a destroyed object's relationships from a surviving neighbour and re-roots it", () => {
    const data = new Data();
    const m1 = data.createModel({id: "p1"}).value;
    const m2 = data.createModel({id: "p2"}).value;

    // Parent lives only in m1; child is shared by both models so it survives
    // m1's destruction. The aggregation edge is created in m1.
    m1.createObject({id: "Parent", type: "IfcBuilding", name: "Parent"});
    const child = m1.createObject({id: "Child", type: "IfcWall", name: "Child"}).value;
    m2.createObject({id: "Child", type: "IfcWall", name: "Child"});
    m1.createRelationship({type: AGGREGATES, relatingObjectId: "Parent", relatedObjectId: "Child"});

    // Before destroy: Child has an incoming edge, so it is NOT a root.
    expect(child.relating[AGGREGATES]).toHaveLength(1);
    expect(data.rootObjects["Child"]).toBeUndefined();

    m1.destroy();

    // Parent is gone; Child survives (still owned by m2).
    expect(data.objects["Parent"]).toBeUndefined();
    expect(data.objects["Child"]).toBe(child);

    // The relationship is fully unwired from the survivor's incoming list...
    expect(child.relating[AGGREGATES]).toHaveLength(0);
    // ...and, having lost its last incoming edge, Child is a root again
    // (in both Data and its surviving model).
    expect(data.rootObjects["Child"]).toBe(child);
    expect(m2.rootObjects["Child"]).toBe(child);
  });

  it("removes only the destroyed model's objects from objectsByType, leaving shared-type survivors", () => {
    const data = new Data();
    const m1 = data.createModel({id: "t1"}).value;
    const m2 = data.createModel({id: "t2"}).value;
    m1.createObject({id: "X", type: "IfcWall", name: "X"});
    m2.createObject({id: "Y", type: "IfcWall", name: "Y"});
    expect(data.typeCounts["IfcWall"]).toBe(2);

    m1.destroy();

    // X is removed from the type bucket per-object; Y (in m2) stays; the bucket
    // is kept because the count hasn't reached zero.
    expect(data.objectsByType["IfcWall"]["X"]).toBeUndefined();
    expect(data.objectsByType["IfcWall"]["Y"]).toBeDefined();
    expect(data.typeCounts["IfcWall"]).toBe(1);
  });
});
