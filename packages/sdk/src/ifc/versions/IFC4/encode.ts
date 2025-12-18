import {createUUID} from "../../../utils";
import {
  IfcBuilding,
  IfcBuildingElementProxy,
  IfcBuildingStorey,
  IfcProject,
  IfcRelAggregates,
  IfcSite,
  ifcTypeNames
} from "../../../ifctypes";
import type {ModelEncodeParams} from "../../../io";
import * as WebIFC from "web-ifc";
import {createCoordinateSystemTransform} from "../../../scene";
import {createMat4Float64} from "../../../matrix";

/** @private
 */
export function encode(ifcAPI: WebIFC.IfcAPI, params: ModelEncodeParams, options?: any): Promise<any> {
  return new Promise<any>(function (resolve, reject) {

    const {sceneModel, dataModel} = params;

    const coordinateSystemMatrix = options.coordinateSystem
      ? createCoordinateSystemTransform(sceneModel.scene.coordinateSystem, options.coordinateSystem, createMat4Float64())
      : null;

    const modelId = ifcAPI.CreateModel({
      schema: WebIFC.Schemas.IFC4,
      name: "Model",
      description: ["Demo"],
      authors: ["xeokit-sdk"],
      organizations: []
    });

    const org = new WebIFC.IFC4.IfcOrganization(null, new WebIFC.IFC4.IfcLabel("xeokit"), null, null, null);

    ifcAPI.WriteLine(modelId, org);

    const app = new WebIFC.IFC4.IfcApplication(
      org,
      new WebIFC.IFC4.IfcLabel("0.0.1"),
      new WebIFC.IFC4.IfcIdentifier("my app"),
      new WebIFC.IFC4.IfcIdentifier("app"));

    ifcAPI.WriteLine(modelId, app);

    const unit_1 = new WebIFC.IFC4.IfcSIUnit(
      WebIFC.IFC4.IfcUnitEnum.VOLUMEUNIT,
      WebIFC.IFC4.IfcSIPrefix.MILLI,
      WebIFC.IFC4.IfcSIUnitName.CUBIC_METRE);

    const unitAssign = new WebIFC.IFC4.IfcUnitAssignment([unit_1]);

    ifcAPI.WriteLine(modelId, unitAssign);

    const origin = [
      new WebIFC.IFC4.IfcLengthMeasure(0),
      new WebIFC.IFC4.IfcLengthMeasure(0),
      new WebIFC.IFC4.IfcLengthMeasure(0)
    ];

    const cartPoint = new WebIFC.IFC4.IfcCartesianPoint(origin);

    ifcAPI.WriteLine(modelId, cartPoint);

    origin[2].value = 1;

    const dir = new WebIFC.IFC4.IfcDirection(origin);

    ifcAPI.WriteLine(modelId, dir);

    const axis = new WebIFC.IFC4.IfcAxis2Placement2D(cartPoint, dir);

    ifcAPI.WriteLine(modelId, axis);

    const geomContext = new WebIFC.IFC4.IfcGeometricRepresentationContext(
      new WebIFC.IFC4.IfcLabel("30 context"),
      new WebIFC.IFC4.IfcLabel("model"),
      new WebIFC.IFC4.IfcDimensionCount("30 context"),
      null,
      axis,
      dir);

    ifcAPI.WriteLine(modelId, geomContext);

    // IfcProject

    const projectDataObjects = dataModel.objectsByType[IfcProject];
    const projectDataObject = projectDataObjects ? Object.values(projectDataObjects)[0] : null;
    const projectId = projectDataObject ? projectDataObject.id : createUUID();

    const proj = new WebIFC.IFC4.IfcProject(
      <any>projectId,
      null,
      new WebIFC.IFC4.IfcLabel("project"),
      new WebIFC.IFC4.IfcText("project desc"),
      null,
      null,
      null,
      [geomContext],
      unitAssign);

    ifcAPI.WriteLine(modelId, proj);

    const ifcElementMap = {};

    for (let objectId in dataModel.objects) {

      const dataObject = dataModel.objects[objectId];

      const dataObjectType =
        (dataObject.type !== undefined && dataObject.type !== null)
          ? dataObject.type
          : IfcBuildingElementProxy;

      const dataObjectTypeName = ifcTypeNames[dataObjectType] || "IfcBuildingElementProxy";
      const ifcElementClass = <any>WebIFC.IFC4[dataObjectTypeName];

      if (ifcElementClass) {
        const ifcElement = new ifcElementClass(
          <any>dataObject.id,
          null,
          new WebIFC.IFC4.IfcLabel(dataObjectTypeName),
          new WebIFC.IFC4.IfcText(dataObjectTypeName + " description"),
          null, null, null, null, null, null, null);
        ifcAPI.WriteLine(modelId, ifcElement);
        ifcElementMap[objectId] = ifcElement;
      }

      const sceneObject = sceneModel.objects[objectId];

      if (sceneObject) {
        const triFaceSet = new WebIFC.IFC4.IfcTriangulatedFaceSet(undefined, undefined, undefined, [], undefined)
      }
    }


    for (let relationshipId in dataModel.relationships) {

      const relationship = dataModel.relationships[relationshipId];
      const relatingDataObject = relationship.relatingObject;
      const relatedDataObject = relationship.relatedObject;
      const relatingIfcElement = ifcElementMap[relatingDataObject.id];
      const relatedIfcElement = ifcElementMap[relatedDataObject.id];

      if (!relatingIfcElement || !relatedIfcElement) {
        continue;
      }

      const relationshipType =
        (relationship.type !== undefined && relationship.type !== null)
          ? relationship.type
          : IfcRelAggregates;

      const relatonshipTypeName = ifcTypeNames[relationshipType] || "IfcRelAggregates";
      const ifcRelationshipClass = <any>WebIFC.IFC4[relatonshipTypeName];

      if (ifcRelationshipClass) {
        const ifcRelationship = new ifcRelationshipClass(
          <any>relationshipId,
          null,
          new WebIFC.IFC4.IfcLabel(relatonshipTypeName),
          new WebIFC.IFC4.IfcText(relatonshipTypeName + " description"),
          null, null, null, null, null, null, null);
        ifcAPI.WriteLine(modelId, ifcRelationship);
      }
    }

    resolve(ifcAPI.SaveModel(modelId));
  });
}

