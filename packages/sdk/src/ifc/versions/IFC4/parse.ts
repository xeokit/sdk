import * as WebIFC from "web-ifc";
import { createVec3, identityMat4 } from "../../../matrix";
import { IfcElement, IfcRelAggregates, ifcTypeCodes } from "../../../ifctypes";
import type { DataModel } from "../../../data";
import type { ModelParseParams } from "../../../io";
import type { SceneModel } from "../../../scene";
import { TrianglesPrimitive } from "../../../constants";

/**
 * Parses an IFC model into scene and data models.
 */
export async function parse(ifcAPI: WebIFC.IfcAPI, params: ModelParseParams, options: any): Promise<void> {
  await parseWebIFC(ifcAPI, params);
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

async function parseWebIFC(ifcAPI: WebIFC.IfcAPI, params: ModelParseParams): Promise<void> {
  const { sceneModel, dataModel, fileData } = params;
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
    nextId: 0,
  };

  parseIFC(ctx);
}

function parseIFC(ctx: ParsingContext): void {
  ctx.dataModel && parseDataModel(ctx);
  ctx.sceneModel && parseSceneModel(ctx);
}

function parseDataModel(ctx: ParsingContext): void {
  const lines = ctx.ifcAPI.GetLineIDsWithType(ctx.modelId, WebIFC.IFCPROJECT);
  const ifcProjectId = lines.get(0);
  const ifcProject = ctx.ifcAPI.GetLine(ctx.modelId, ifcProjectId);

  parseDataObjectAggregation(ctx, ifcProject);
  parsePropertySets(ctx);
}

function parsePropertySets(ctx: ParsingContext): void {
  const lines = ctx.ifcAPI.GetLineIDsWithType(ctx.modelId, WebIFC.IFCRELDEFINESBYPROPERTIES);

  for (let i = 0; i < lines.size(); i++) {
    const relID = lines.get(i);
    const rel = ctx.ifcAPI.GetLine(ctx.modelId, relID, true);
    if (!rel || !rel.RelatingPropertyDefinition) continue;

    const def = rel.RelatingPropertyDefinition;
    const propertySetId = def.GlobalId.value;
    const properties = (def.HasProperties || []).map((prop) => ({
      name: prop.Name?.value,
      type: prop.NominalValue?.type,
      value: prop.NominalValue?.value,
      valueType: prop.NominalValue?.valueType,
      description: prop.Description?.value || prop.NominalValue?.description || "",
    }));

    ctx.dataModel!.createPropertySet({
      id: propertySetId,
      type: "Default",
      name: def.Name?.value,
      properties,
    });

    // for (const relatedObject of rel.RelatedObjects || []) {
    //   const dataObject = ctx.dataModel!.objects[relatedObject.GlobalId.value];
    //   if (dataObject) {
    //     dataObject.propertySetIds ??= [];
    //     dataObject.propertySetIds.push(propertySetId);
    //   }
    // }
  }
}

function parseDataObjectAggregation(ctx: ParsingContext, element: any, parentId?: string): void {
  createDataObject(ctx, element, parentId);
  const elementId = element.GlobalId.value;

  parseRelatedItemsOfType(ctx, element.expressID, "RelatingObject", "RelatedObjects", WebIFC.IFCRELAGGREGATES, elementId);
  parseRelatedItemsOfType(ctx, element.expressID, "RelatingStructure", "RelatedElements", WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE, elementId);
}

function createDataObject(ctx: ParsingContext, element: any, parentId?: string): void {
  const id = element.GlobalId.value;
  const typeName = element.__proto__.constructor.name;
  const name = element.Name?.value || typeName;
  const typeCode = ifcTypeCodes[typeName] ?? IfcElement;

  ctx.dataModel!.createObject({ id, name, type: typeCode });

  if (parentId) {
    ctx.dataModel!.createRelationship({
      type: IfcRelAggregates,
      relatingObjectId: parentId,
      relatedObjectId: id,
    });
  }
}

function parseRelatedItemsOfType(
  ctx: ParsingContext,
  id: number,
  relationKey: string,
  relatedKey: string,
  type: number,
  parentId: string
): void {
  const lines = ctx.ifcAPI.GetLineIDsWithType(ctx.modelId, type);

  for (let i = 0; i < lines.size(); i++) {
    const rel = ctx.ifcAPI.GetLine(ctx.modelId, lines.get(i));
    const relatedItems = rel[relationKey];

    const isMatch = Array.isArray(relatedItems)
      ? relatedItems.some((item) => item.value === id)
      : relatedItems?.value === id;

    if (!isMatch) continue;

    const targets = rel[relatedKey];
    const relatedElements = Array.isArray(targets) ? targets : [targets];

    for (const target of relatedElements) {
      const element = ctx.ifcAPI.GetLine(ctx.modelId, target.value);
      parseDataObjectAggregation(ctx, element, parentId);
    }
  }
}

function parseSceneModel(ctx: ParsingContext): void {
  ctx.ifcAPI.StreamAllMeshes(ctx.modelId, (flatMesh) => {
    const objectId = ctx.ifcAPI.GetLine(ctx.modelId, flatMesh.expressID).GlobalId.value;
    const meshIds: string[] = [];

    for (let j = 0; j < flatMesh.geometries.size(); j++) {
      const placedGeometry = flatMesh.geometries.get(j);
      const geometry = ctx.ifcAPI.GetGeometry(ctx.modelId, placedGeometry.geometryExpressID);
      const vertexData = ctx.ifcAPI.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
      const indices = ctx.ifcAPI.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());

      const positions = new Float64Array(vertexData.length / 2);
      for (let k = 0, l = 0; k < vertexData.length / 6; k++, l += 3) {
        positions[l] = vertexData[k * 6];
        positions[l + 1] = vertexData[k * 6 + 1];
        positions[l + 2] = vertexData[k * 6 + 2];
      }

      const matrix = identityMat4();
      (matrix as Float64Array).set(placedGeometry.flatTransformation);

      const geometryId = `${ctx.nextId++}`;
      const meshId = `${ctx.nextId++}`;

      ctx.sceneModel.createGeometry({
        id: geometryId,
        primitive: TrianglesPrimitive,
        positions,
        indices,
      });

      ctx.sceneModel.createMesh({
        id: meshId,
        geometryId,
        matrix,
        color: [
          placedGeometry.color.x,
          placedGeometry.color.y,
          placedGeometry.color.z,
        ],
        opacity: placedGeometry.color.w,
      });

      meshIds.push(meshId);
    }

    if (meshIds.length > 0) {
      ctx.sceneModel.createObject({
        id: objectId,
        meshIds,
      });
    }
  });
}
