import {encode} from "../versions/1_0/encode";
import {parse} from "../versions/1_0/parse";

// The datamodel format is semantic only — no geometry. encode() delegates to
// DataModel.toParams() and stamps a version; parse() hands the document back to
// DataModel.fromParams(). We stub those two methods to exercise the round-trip.

// A minimal DataModelParams: one Building containing one Wall, related by an
// IfcRelAggregates relationship, plus a single property set.
function buildParams() {
  return {
    id: "myDataModel",
    projectId: "myProject",
    author: "tester",
    propertySets: [
      {
        id: "ps1",
        name: "Pset_BuildingCommon",
        type: "default",
        properties: [{name: "isExternal", value: true, type: "boolean", valueType: 0}],
      },
    ],
    objects: [
      {id: "Building1", type: "Building", name: "Building", propertySetIds: ["ps1"]},
      {id: "Wall1", type: "Wall", name: "Wall", propertySetIds: []},
    ],
    relationships: [
      {type: "aggregates", relatingObjectId: "Building1", relatedObjectId: "Wall1"},
    ],
  };
}

// A source DataModel stub whose toParams() yields the params above.
function buildSourceDataModel() {
  return {toParams: () => ({ok: true, value: buildParams()})};
}

describe("datamodel format", () => {

  it("encodes a DataModel to a DataModelParams document", async () => {
    const doc = await encode({dataModel: buildSourceDataModel() as any} as any);

    expect(doc.version).toBe("1.0");
    expect(doc.id).toBe("myDataModel");
    expect(doc.projectId).toBe("myProject");
    expect(doc.author).toBe("tester");

    expect(doc.objects).toHaveLength(2);
    expect(doc.objects.map((o: any) => o.id)).toEqual(["Building1", "Wall1"]);
    expect(doc.objects[0].type).toBe("Building");

    expect(doc.relationships).toHaveLength(1);
    expect(doc.relationships[0]).toMatchObject({
      type: "aggregates",
      relatingObjectId: "Building1",
      relatedObjectId: "Wall1",
    });

    expect(doc.propertySets).toHaveLength(1);
    expect(doc.propertySets[0].properties[0].name).toBe("isExternal");
  });

  it("throws when no DataModel is supplied (toParams() never runs)", async () => {
    // Quirk: with no dataModel, encode() uses `{}` as the result, then tries to
    // read `.value` (undefined) and set `.version` on it — so it throws rather
    // than producing an empty document. A DataModel is effectively required.
    await expect(encode({} as any)).rejects.toThrow();
  });

  it("throws when the source DataModel fails to encode", async () => {
    const bad = {toParams: () => ({ok: false, error: "boom"})};
    await expect(encode({dataModel: bad as any} as any)).rejects.toThrow(/boom/);
  });

  it("round-trips objects and relationships back through parse", async () => {
    const doc = await encode({dataModel: buildSourceDataModel() as any} as any);

    // Capturing destination DataModel: parse() feeds the document to fromParams().
    let captured: any;
    const dstDataModel = {
      fromParams: (params: any) => {
        captured = params;
        return {ok: true, value: {}};
      },
    };

    await parse({fileData: doc, dataModel: dstDataModel} as any);

    expect(captured).toBe(doc);
    expect(captured.id).toBe("myDataModel");

    expect(captured.objects).toHaveLength(2);
    const byId: Record<string, any> = {};
    for (const o of captured.objects) byId[o.id] = o;
    expect(byId.Building1.type).toBe("Building");
    expect(byId.Wall1.type).toBe("Wall");

    expect(captured.relationships).toHaveLength(1);
    expect(captured.relationships[0].relatingObjectId).toBe("Building1");
    expect(captured.relationships[0].relatedObjectId).toBe("Wall1");
  });

  it("rejects when the destination DataModel fails to import", async () => {
    const dstDataModel = {fromParams: () => ({ok: false, error: "nope"})};
    await expect(parse({fileData: buildParams(), dataModel: dstDataModel} as any)).rejects.toMatch(/nope/);
  });
});
