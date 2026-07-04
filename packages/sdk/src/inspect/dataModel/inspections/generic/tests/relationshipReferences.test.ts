import {Data, type DataModel} from "../../../../../model/data";
import {InspectionRegistry} from "../../../InspectionRegistry";
import {inspectDataModel} from "../../../inspectDataModel";
import {relationshipReferences} from "../relationshipReferences";


const REL = "IfcRelAggregates";


function relationshipIssues(dataModel: DataModel) {
  const report = inspectDataModel({
    dataModel,
    registry: new InspectionRegistry([relationshipReferences]),
  });
  return report.issues;
}


describe("relationshipReferences", () => {

  it("reports a related endpoint removed from the shared Data registry", () => {
    const data = new Data();
    const sourceModel = data.createModel({id: "source"}).value!;
    const targetModel = data.createModel({id: "target"}).value!;
    expect(sourceModel.createObject({id: "a", type: "IfcProject"}).ok).toBe(true);
    expect(targetModel.createObject({id: "b", type: "IfcBuilding"}).ok).toBe(true);
    expect(sourceModel.createRelationship({
      type: REL,
      relatingObjectId: "a",
      relatedObjectId: "b",
    }).ok).toBe(true);

    expect(targetModel.destroy().ok).toBe(true);

    expect(relationshipIssues(sourceModel)).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "RELATIONSHIP_DANGLING_RELATED_OBJECT",
        resourceId: `a->b#${REL}`,
        context: {objectId: "b", type: REL},
      }),
    ]);
  });

  it("reports stale same-id relationship endpoint objects", () => {
    const dataModel = new Data().createModel({id: "m"}).value!;
    expect(dataModel.createObject({id: "a", type: "IfcProject"}).ok).toBe(true);
    expect(dataModel.createObject({id: "b", type: "IfcBuilding"}).ok).toBe(true);
    expect(dataModel.createRelationship({
      type: REL,
      relatingObjectId: "a",
      relatedObjectId: "b",
    }).ok).toBe(true);
    (dataModel as any).data.objects["b"] = {id: "b", type: "IfcBuilding"};

    expect(relationshipIssues(dataModel)).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "RELATIONSHIP_DANGLING_RELATED_OBJECT",
        resourceId: `a->b#${REL}`,
        summary: "stale related 'b'",
      }),
    ]);
  });

  it("continues to report live self-references as warnings", () => {
    const dataModel = new Data().createModel({id: "m"}).value!;
    expect(dataModel.createObject({id: "a", type: "IfcProject"}).ok).toBe(true);
    expect(dataModel.createRelationship({
      type: REL,
      relatingObjectId: "a",
      relatedObjectId: "a",
    }).ok).toBe(true);

    expect(relationshipIssues(dataModel)).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "RELATIONSHIP_SELF_REFERENCE",
        resourceId: `a->a#${REL}`,
      }),
    ]);
  });
});
