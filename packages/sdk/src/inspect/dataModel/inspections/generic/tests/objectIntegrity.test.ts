import {Data, type DataModel} from "../../../../../model/data";
import {InspectionRegistry} from "../../../InspectionRegistry";
import {inspectDataModel} from "../../../inspectDataModel";
import {objectIntegrity} from "../objectIntegrity";


function objectIssues(dataModel: DataModel) {
  const report = inspectDataModel({
    dataModel,
    registry: new InspectionRegistry([objectIntegrity]),
  });
  return report.issues;
}


describe("objectIntegrity", () => {

  it("reports PropertySet refs removed from the inspected DataModel", () => {
    const data = new Data();
    const owner = data.createModel({id: "owner"}).value!;
    const survivor = data.createModel({id: "survivor"}).value!;
    expect(owner.createPropertySet({id: "ps", name: "Props", type: "Pset"}).ok).toBe(true);
    expect(owner.createObject({
      id: "obj",
      type: "IfcWall",
      propertySetIds: ["ps"],
    }).ok).toBe(true);
    expect(survivor.createObject({id: "obj", type: "IfcWall"}).ok).toBe(true);

    expect(owner.destroy().ok).toBe(true);

    expect(objectIssues(survivor)).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "OBJECT_DANGLING_PROPERTY_SET_REF",
        resourceId: "obj",
        context: {propertySetId: "ps"},
      }),
    ]);
  });

  it("reports stale same-id PropertySet refs", () => {
    const dataModel = new Data().createModel({id: "m"}).value!;
    expect(dataModel.createPropertySet({id: "ps", name: "Props", type: "Pset"}).ok).toBe(true);
    expect(dataModel.createObject({
      id: "obj",
      type: "IfcWall",
      propertySetIds: ["ps"],
    }).ok).toBe(true);
    (dataModel as any).propertySets["ps"] = {id: "ps", name: "Props", type: "Pset"};

    expect(objectIssues(dataModel)).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "OBJECT_DANGLING_PROPERTY_SET_REF",
        resourceId: "obj",
        summary: "stale 'ps'",
      }),
    ]);
  });

  it("continues to report duplicate live PropertySet refs", () => {
    const dataModel = new Data().createModel({id: "m"}).value!;
    expect(dataModel.createPropertySet({id: "ps", name: "Props", type: "Pset"}).ok).toBe(true);
    expect(dataModel.createObject({
      id: "obj",
      type: "IfcWall",
      propertySetIds: ["ps"],
    }).ok).toBe(true);
    (dataModel.objects["obj"].propertySets as any).push(dataModel.propertySets["ps"]);

    expect(objectIssues(dataModel)).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "OBJECT_DUPLICATE_PROPERTY_SET_REF",
        resourceId: "obj",
      }),
    ]);
  });
});
