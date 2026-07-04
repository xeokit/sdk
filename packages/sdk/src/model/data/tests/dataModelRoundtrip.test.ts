import {Data} from "../Data";
import {SDKErrorType} from "../../../base/core";

// Drives the REAL DataModel / DataObject / PropertySet / Property / Relationship
// classes. There is NO build() step — createObject/createPropertySet/
// createRelationship register their components immediately and return the
// SDKResult {ok, value}. fromParams() is invoked by the DataModel constructor,
// so re-creating a model from toParams() output in a fresh Data is the round-trip.

// Builds one model with 2 objects, a PropertySet (2 properties) and a
// Relationship between the objects. Returns the live DataModel.
function buildModel(data: Data) {
  const model = data.createModel({id: "model1"}).value!;

  // PropertySet with two Properties of differing value types.
  const psResult = model.createPropertySet({
    id: "ps1",
    name: "Wall Properties",
    type: "WallSet",
    properties: [
      {name: "FireRating", value: "REI60", type: "IfcLabel", valueType: "string"},
      {name: "Height", value: 3.2, type: "IfcReal", valueType: "double"},
    ],
  });
  expect(psResult.ok).toBe(true);

  const o1 = model.createObject({id: "obj1", type: "IfcWall", name: "Wall A", propertySetIds: ["ps1"]});
  const o2 = model.createObject({id: "obj2", type: "IfcDoor", name: "Door B"});
  expect(o1.ok).toBe(true);
  expect(o2.ok).toBe(true);

  const rel = model.createRelationship({
    type: "IfcRelAggregates",
    relatingObjectId: "obj1",
    relatedObjectId: "obj2",
  });
  expect(rel.ok).toBe(true);

  return model;
}

describe("DataModel round-trip + component behavior", () => {

  it("serializes to the expected document shape via toParams()", () => {
    const model = buildModel(new Data());

    const result = model.toParams();
    expect(result.ok).toBe(true);
    const params = result.value!;

    // Top-level identity.
    expect(params.id).toBe("model1");

    // Objects: id / type / name survive.
    expect(params.objects).toHaveLength(2);
    const objById = Object.fromEntries(params.objects!.map(o => [o.id, o]));
    expect(objById.obj1.type).toBe("IfcWall");
    expect(objById.obj1.name).toBe("Wall A");
    expect(objById.obj2.type).toBe("IfcDoor");
    expect(objById.obj2.name).toBe("Door B");
    // Object's PropertySet membership is serialized as propertySetIds.
    expect(objById.obj1.propertySetIds).toEqual(["ps1"]);

    // PropertySets: id + properties (name/value/type).
    expect(params.propertySets).toHaveLength(1);
    const ps = params.propertySets![0];
    expect(ps.id).toBe("ps1");
    expect(ps.name).toBe("Wall Properties");
    expect(ps.properties).toHaveLength(2);
    const propByName = Object.fromEntries(ps.properties!.map(p => [p.name, p]));
    expect(propByName.FireRating.value).toBe("REI60");
    expect(propByName.FireRating.type).toBe("IfcLabel");
    expect(propByName.Height.value).toBe(3.2);          // numeric value preserved as-is (no stringification)
    expect(propByName.Height.valueType).toBe("double");

    // Relationships: type + relating/related ids.
    expect(params.relationships).toHaveLength(1);
    const r = params.relationships![0];
    expect(r.type).toBe("IfcRelAggregates");
    expect(r.relatingObjectId).toBe("obj1");
    expect(r.relatedObjectId).toBe("obj2");
  });

  it("round-trips losslessly through fromParams() into a fresh Data", () => {
    const params = buildModel(new Data()).toParams().value!;

    // Rebuild in a brand-new Data. The DataModel constructor calls fromParams()
    // with these params, so createModel() alone performs the rebuild.
    const data2 = new Data();
    const rebuilt = data2.createModel(params).value!;

    // Counts + ids match.
    expect(Object.keys(rebuilt.objects).sort()).toEqual(["obj1", "obj2"]);
    expect(Object.keys(rebuilt.propertySets)).toEqual(["ps1"]);
    expect(rebuilt.relationships).toHaveLength(1);

    // Object type/name survive.
    expect(rebuilt.objects.obj1.type).toBe("IfcWall");
    expect(rebuilt.objects.obj1.name).toBe("Wall A");
    expect(rebuilt.objects.obj2.type).toBe("IfcDoor");

    // PropertySet membership survives: obj1 references the rebuilt ps1 instance.
    expect(rebuilt.objects.obj1.propertySets).toHaveLength(1);
    expect(rebuilt.objects.obj1.propertySets![0].id).toBe("ps1");

    // Property names + values + valueTypes survive.
    const rps = rebuilt.propertySets.ps1;
    const rebuiltProps = Object.fromEntries(rps.properties.map(p => [p.name, p]));
    expect(rebuiltProps.FireRating.value).toBe("REI60");
    expect(rebuiltProps.Height.value).toBe(3.2);
    expect(rebuiltProps.Height.valueType).toBe("double");

    // Relationship endpoints survive and reference the rebuilt objects.
    const rr = rebuilt.relationships[0];
    expect(rr.type).toBe("IfcRelAggregates");
    expect(rr.relatingObject).toBe(rebuilt.objects.obj1);
    expect(rr.relatedObject).toBe(rebuilt.objects.obj2);

    // Lossless check: a second toParams() yields an equivalent document.
    expect(rebuilt.toParams().value).toEqual(params);
  });

  it("exposes Property values through PropertySet/Property getters", () => {
    const model = buildModel(new Data());
    const ps = model.propertySets.ps1;

    // PropertySet getters reflect what was set.
    expect(ps.id).toBe("ps1");
    expect(ps.name).toBe("Wall Properties");
    expect(ps.type).toBe("WallSet");
    expect(ps.properties).toHaveLength(2);

    // Property getters: name / value / type / valueType.
    const height = ps.properties.find(p => p.name === "Height")!;
    expect(height.value).toBe(3.2);
    expect(height.type).toBe("IfcReal");
    expect(height.valueType).toBe("double");
  });

  it("wires Relationship references and type correctly", () => {
    const model = buildModel(new Data());
    const rel = model.relationships[0];

    expect(rel.type).toBe("IfcRelAggregates");
    // References are live DataObject instances, not ids.
    expect(rel.relatingObject).toBe(model.objects.obj1);
    expect(rel.relatedObject).toBe(model.objects.obj2);

    // The relationship is mirrored onto the participating objects:
    // relating object holds it under `related`, related object under `relating`.
    expect(model.objects.obj1.related.IfcRelAggregates).toContain(rel);
    expect(model.objects.obj2.relating.IfcRelAggregates).toContain(rel);
  });

  it("rejects toParams when a relationship endpoint is outside the DataModel", () => {
    const data = new Data();
    const sourceModel = data.createModel({id: "source"}).value!;
    const targetModel = data.createModel({id: "target"}).value!;
    expect(sourceModel.createObject({id: "a", type: "Thing", name: "A"}).ok).toBe(true);
    expect(targetModel.createObject({id: "b", type: "Thing", name: "B"}).ok).toBe(true);
    expect(sourceModel.createRelationship({
      type: "references",
      relatingObjectId: "a",
      relatedObjectId: "b",
    }).ok).toBe(true);

    const result = sourceModel.toParams();

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.type).toBe(SDKErrorType.InvalidOperation);
      expect(result.error).toMatch(/endpoint to be owned by the exported DataModel/);
      expect(result.error).toContain("a->b#references");
    }
  });
});
