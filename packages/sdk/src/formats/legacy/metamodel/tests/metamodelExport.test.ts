import {Data} from "../../../../model/data/Data";
import {MetaModelExporter} from "../MetaModelExporter";
import {MetaModelLoader} from "../MetaModelLoader";

function buildDataModel() {
  const dm = new Data().createModel({id: "m", projectId: "p1", author: "me", schema: "IFC4"}).value!;
  dm.createPropertySet({id: "ps1", name: "Pset", type: "Default", properties: [{name: "Height", value: 3, type: "number"}]});
  dm.createObject({id: "root", name: "Root", type: "IfcProject"});
  dm.createObject({id: "wall", name: "Wall", type: "IfcWall", propertySetIds: ["ps1"]});
  dm.createRelationship({type: "IfcRelAggregates", relatingObjectId: "root", relatedObjectId: "wall"});
  return dm;
}

describe("MetaModelExporter", () => {
  it("exports a DataModel to MetaModelParams", async () => {
    const meta: any = await new MetaModelExporter().write({dataModel: buildDataModel()});
    expect(meta.metaObjects.length).toBe(2);
    const wall = meta.metaObjects.find((o: any) => o.id === "wall");
    expect(wall.parent).toBe("root");
    expect(wall.propertySetIds).toEqual(["ps1"]);
    expect(meta.propertySets.length).toBe(1);
    expect(meta.propertySets[0].properties[0].name).toBe("Height");
    expect(meta.projectId).toBe("p1");
    expect(meta.author).toBe("me");
  });

  it("round-trips back through MetaModelLoader", async () => {
    const meta = await new MetaModelExporter().write({dataModel: buildDataModel()});
    const dst = new Data().createModel({id: "m2"}).value!;
    await new MetaModelLoader().load({fileData: meta, dataModel: dst});
    expect(Object.keys(dst.objects).sort()).toEqual(["root", "wall"]);
    expect(Object.keys(dst.propertySets)).toEqual(["ps1"]);
    const rels = dst.relationships.filter((r: any) => r.relatedObject.id === "wall");
    expect(rels.length).toBe(1);
    expect(rels[0].relatingObject.id).toBe("root");
  });
});
