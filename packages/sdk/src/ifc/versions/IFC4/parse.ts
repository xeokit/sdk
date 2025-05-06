import * as WebIFC from "web-ifc";
import {createVec3, identityMat4} from "../../../matrix";
import {IfcElement, IfcRelAggregates, ifcTypeCodes} from "../../../ifctypes";
import type {DataModel} from "../../../data";
import type {ModelParseParams} from "../../../io";
import type {SceneModel} from "../../../scene";
import {TrianglesPrimitive} from "../../../constants";

/**
 * @private
 */
export function parse(ifcAPI: WebIFC.IfcAPI, params: ModelParseParams, options: any): Promise<void> {
  return new Promise<void>(function (resolve, reject) {
    parseWebIFC(ifcAPI, params).then(() => {
      resolve();
    });
  });
}

interface ParsingContext {
  fileData: ArrayBuffer;
  ifcAPI: WebIFC.IfcAPI;
  sceneModel: SceneModel;
  dataModel?: DataModel;
  nextId: number;
  modelId: number;
  lines: WebIFC.Vector<number>;
  ifcProjectId: number;
}

function parseWebIFC(ifcAPI: WebIFC.IfcAPI, params: ModelParseParams): Promise<any> {
  return new Promise<void>(function (resolve, reject) {
    const {sceneModel, dataModel, fileData} = params;
    const dataArray = new Uint8Array(fileData);
    const modelId = ifcAPI.OpenModel(dataArray);
    const lines = ifcAPI.GetLineIDsWithType(modelId, WebIFC.IFCPROJECT);
    const ifcProjectId = lines.get(0);
    const ctx: ParsingContext = {
      fileData,
      modelId,
      lines,
      ifcProjectId,
      ifcAPI,
      sceneModel,
      dataModel,
      nextId: 0
    };
    parseIFC(ctx);
    return resolve();
  });
}

function str2ab(str) {
  const buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
  const bufView = new Uint16Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function parseIFC(ctx: ParsingContext) {
  if (ctx.dataModel) {
    parseDataModel(ctx);
  }
  if (ctx.sceneModel) {
    parseSceneModel(ctx);
  }
}

function parseDataModel(ctx: ParsingContext) {
  const lines = ctx.ifcAPI.GetLineIDsWithType(ctx.modelId, WebIFC.IFCPROJECT);
  const ifcProjectId = lines.get(0);
  const ifcProject = ctx.ifcAPI.GetLine(ctx.modelId, ifcProjectId);
  parseDataObjectAggregation(ctx, ifcProject);
  parsePropertySets(ctx);
}

function parsePropertySets(ctx: any) {
  const lines = ctx.ifcAPI.GetLineIDsWithType(ctx.modelId, WebIFC.IFCRELDEFINESBYPROPERTIES);
  for (let i = 0; i < lines.size(); i++) {
    const relID = lines.get(i);
    const rel = ctx.ifcAPI.GetLine(ctx.modelId, relID, true);
    if (rel) {
      const relatingPropertyDefinition = rel.RelatingPropertyDefinition;
      if (!relatingPropertyDefinition) {
        continue;
      }
      const propertySetId = relatingPropertyDefinition.GlobalId.value;
      const props = relatingPropertyDefinition.HasProperties;
      if (props && props.length > 0) {
        const propertySetType = "Default";
        const propertySetName = relatingPropertyDefinition.Name.value;
        const properties = [];
        for (let i = 0, len = props.length; i < len; i++) {
          const prop = props[i];
          const name = prop.Name;
          const nominalValue = prop.NominalValue;
          if (name && nominalValue) {
            properties.push({
              name: name.value,
              type: nominalValue.type,
              value: nominalValue.value,
              valueType: nominalValue.valueType,
              description: prop.Description ? prop.Description.value : (nominalValue.description ? nominalValue.description : "")
            });
          }
        }
        ctx.dataModel.createPropertySet({
          id: propertySetId,
          type: propertySetType,
          name: propertySetName,
          properties: properties
        });
        const relatedObjects = rel.RelatedObjects;
        if (!relatedObjects || relatedObjects.length === 0) {
          return;
        }
        for (let i = 0, len = relatedObjects.length; i < len; i++) {
          const relatedObject = relatedObjects[i];
          const dataObjectId = relatedObject.GlobalId.value;
          const dataObject = ctx.dataModel.objects[dataObjectId];
          if (dataObject) {
            if (!dataObject.propertySetIds) {
              dataObject.propertySetIds = [];
            }
            dataObject.propertySetIds.push(propertySetId);
          }
        }
      }
    }
  }
}

function parseDataObjectAggregation(ctx: ParsingContext, ifcElement: any, parentDataObjectId?: string) {
  const type = ifcElement.__proto__.constructor.name;
  createDataObject(ctx, ifcElement, parentDataObjectId);
  const dataObjectId = ifcElement.GlobalId.value;
  parseRelatedItemsOfType(ctx, ifcElement.expressID, 'RelatingObject', 'RelatedObjects', WebIFC.IFCRELAGGREGATES, dataObjectId);
  parseRelatedItemsOfType(ctx, ifcElement.expressID, 'RelatingStructure', 'RelatedElements', WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE, dataObjectId);
}

function createDataObject(ctx: ParsingContext, ifcElement: any, parentDataObjectId?: string) {
  const id = ifcElement.GlobalId.value;
  const type = ifcElement.__proto__.constructor.name;
  const name = (ifcElement.Name && ifcElement.Name.value !== "") ? ifcElement.Name.value : type;
  let typeCode = ifcTypeCodes[type];
  if (typeCode == undefined) {
    typeCode = IfcElement;
    // TODO: Log this
  }
  ctx.dataModel.createObject({
    id,
    name,
    type: typeCode
  });
  if (parentDataObjectId) {
    ctx.dataModel.createRelationship({
      type: IfcRelAggregates,
      relatingObjectId: parentDataObjectId,
      relatedObjectId: id
    });
  }
}

function parseRelatedItemsOfType(ctx: ParsingContext, id: any, relation: string, related: string, type: number, parentDataObjectId: string) {
  const lines = ctx.ifcAPI.GetLineIDsWithType(ctx.modelId, type);
  for (let i = 0; i < lines.size(); i++) {
    const relID = lines.get(i);
    const rel = ctx.ifcAPI.GetLine(ctx.modelId, relID);
    const relatedItems = rel[relation];
    let foundElement = false;
    if (Array.isArray(relatedItems)) {
      const values = relatedItems.map((item) => item.value);
      foundElement = values.includes(id);
    } else {
      foundElement = (relatedItems.value === id);
    }
    if (foundElement) {
      const element = rel[related];
      if (!Array.isArray(element)) {
        const ifcElement = ctx.ifcAPI.GetLine(ctx.modelId, element.value);
        parseDataObjectAggregation(ctx, ifcElement, parentDataObjectId);
      } else {
        element.forEach((element2) => {
          const ifcElement = ctx.ifcAPI.GetLine(ctx.modelId, element2.value);
          parseDataObjectAggregation(ctx, ifcElement, parentDataObjectId);
        });
      }
    }
  }
}

function parseSceneModel(ctx: ParsingContext) {
  ctx.ifcAPI.StreamAllMeshes(ctx.modelId, (flatMesh) => {
    // TODO: Can we do geometry reuse with web-ifc?
    const flatMeshExpressID = flatMesh.expressID;
    const placedGeometries = flatMesh.geometries;
    const meshIds = [];
    const properties = ctx.ifcAPI.GetLine(ctx.modelId, flatMeshExpressID);
    const objectId = properties.GlobalId.value;
    const origin = createVec3();

    for (let j = 0, lenj = placedGeometries.size(); j < lenj; j++) {
      const placedGeometry = placedGeometries.get(j);
      const geometry = ctx.ifcAPI.GetGeometry(ctx.modelId, placedGeometry.geometryExpressID);
      const vertexData = ctx.ifcAPI.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
      const indices = ctx.ifcAPI.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
      // De-interleave vertex arrays
      const positions = new Float64Array(vertexData.length / 2);
      const matrix = identityMat4();
      (<Float64Array<any>>matrix).set(placedGeometry.flatTransformation);
      for (let k = 0, l = 0, lenk = vertexData.length / 6; k < lenk; k++, l += 3) {
        positions[l + 0] = vertexData[k * 6 + 0];
        positions[l + 1] = vertexData[k * 6 + 1];
        positions[l + 2] = vertexData[k * 6 + 2];
      }
      const geometryId = "" + ctx.nextId++;
      ctx.sceneModel.createGeometry({
        id: geometryId,
        primitive: TrianglesPrimitive,
        positions,
        indices
      });
      const meshId = "" + ctx.nextId++;
      ctx.sceneModel.createMesh({
        id: meshId,
        geometryId,
        matrix,
        color: [
          placedGeometry.color.x,
          placedGeometry.color.y,
          placedGeometry.color.z
        ],
        opacity: placedGeometry.color.w
      });
      meshIds.push(meshId);
    }
    if (meshIds.length > 0) {
      ctx.sceneModel.createObject({
        id: objectId,
        meshIds: meshIds
      });
    }
  });
}
