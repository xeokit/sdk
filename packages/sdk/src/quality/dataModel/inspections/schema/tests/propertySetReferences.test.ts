import {Data, type DataModel} from "../../../../../model/data";
import type {DataFormatSchema} from "../../../DataFormatSchema";
import {InspectionRegistry} from "../../../InspectionRegistry";
import {inspectDataModel} from "../../../qualityDataModel";
import {propertySetReferences} from "../propertySetReferences";


const SCHEMA: DataFormatSchema = {
  id: "test",
  objectTypes: {
    IfcWall: {
      requiredPropertySets: ["ps"],
    },
  },
};


function propertySetIssues(dataModel: DataModel) {
  const report = inspectDataModel({
    dataModel,
    schema: SCHEMA,
    registry: new InspectionRegistry([propertySetReferences]),
  });
  return report.issues;
}


describe("propertySetReferences", () => {

  it("does not satisfy required PropertySet rules with stale refs", () => {
    const dataModel = new Data().createModel({id: "m", schema: "test"}).value!;
    expect(dataModel.createPropertySet({id: "ps", name: "Props", type: "Pset"}).ok).toBe(true);
    expect(dataModel.createObject({
      id: "obj",
      type: "IfcWall",
      propertySetIds: ["ps"],
    }).ok).toBe(true);
    (dataModel as any).propertySets["ps"] = {id: "ps", name: "Props", type: "Pset"};

    expect(propertySetIssues(dataModel)).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "OBJECT_REQUIRED_PROPERTY_SET_MISSING",
        resourceId: "obj",
        context: {type: "IfcWall", requiredPropertySetId: "ps"},
      }),
    ]);
  });
});
