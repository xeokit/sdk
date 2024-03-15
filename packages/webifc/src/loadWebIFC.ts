import {createMat4, createVec3, transformPositions3} from "@xeokit/matrix";
import type {SceneModel} from "@xeokit/scene";
import type {DataModel} from "@xeokit/data";
//import * as WebIFC from "web-ifc/web-ifc-api-node";
import * as WebIFC from "web-ifc";
import {IfcElement, IfcRelAggregates, typeCodes} from "@xeokit/ifctypes";
import {worldToRTCPositions} from "@xeokit/rtc";
import {TrianglesPrimitive} from "@xeokit/constants";
import {SDKError} from "@xeokit/core";

/**
 * @private
 */
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

/**
 * Loads IFC into a {@link @xeokit/scene!SceneModel | SceneModel} and/or {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link "@xeokit/webifc" | @xeokit/webifc} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - IFC file contents.
 * @param params.ifcAPI - WebIFC API.
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @returns {Promise} Resolves when IFC has been loaded into the SceneModel and/or DataModel.
 * @throws *{@link @xeokit/core!SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export function loadWebIFC(params: {
    fileData: ArrayBuffer,
    ifcAPI: WebIFC.IfcAPI,
    sceneModel: SceneModel,
    dataModel?: DataModel
}): Promise<any> {
    return new Promise<void>(function (resolve, reject) {
        if (params.sceneModel.destroyed) {
            throw new SDKError("SceneModel already destroyed");
        }
        if (params.sceneModel.built) {
            throw new SDKError("SceneModel already built");
        }
        if (params.dataModel) {
            if (params.dataModel.destroyed) {
                throw new SDKError("DataModel already destroyed");
            }
            if (params.dataModel.built) {
                throw new SDKError("DataModel already built");
            }
        }
        const dataArray = new Uint8Array(params.fileData);
        const modelId = params.ifcAPI.OpenModel(dataArray);
        const lines = params.ifcAPI.GetLineIDsWithType(modelId, WebIFC.IFCPROJECT);
        const ifcProjectId = lines.get(0);
        const ctx: ParsingContext = {
            fileData: params.fileData,
            modelId,
            lines,
            ifcProjectId,
            ifcAPI: params.ifcAPI,
            sceneModel: params.sceneModel,
            dataModel: params.dataModel,
            nextId: 0
        };
        parseIFC(ctx);
        resolve();
    });
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
    parsePropertySets(ctx);
    parseDataObjectAggregation(ctx, ifcProject);
}

function parsePropertySets(ctx: any) {
    const lines = ctx.ifcAPI.GetLineIDsWithType(ctx.modelId, WebIFC.IFCRELDEFINESBYPROPERTIES);
    for (let i = 0; i < lines.size(); i++) {
        let relID = lines.get(i);
        let rel = ctx.ifcAPI.GetLine(ctx.modelId, relID, true);
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
                    const dataObject = ctx.dataObjects[dataObjectId];
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
    let typeCode = typeCodes[type];
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
        const matrix = createMat4();
        const origin = createVec3();
        for (let j = 0, lenj = placedGeometries.size(); j < lenj; j++) {
            const placedGeometry = placedGeometries.get(j);
            const geometry = ctx.ifcAPI.GetGeometry(ctx.modelId, placedGeometry.geometryExpressID);
            const vertexData = ctx.ifcAPI.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
            const indices = ctx.ifcAPI.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
            // De-interleave vertex arrays
            const positions = new Float64Array(vertexData.length / 2);
            const normals = new Float32Array(vertexData.length / 2);
            for (let k = 0, l = 0, lenk = vertexData.length / 6; k < lenk; k++, l += 3) {
                positions[l + 0] = vertexData[k * 6 + 0];
                positions[l + 1] = vertexData[k * 6 + 1];
                positions[l + 2] = vertexData[k * 6 + 2];
            }
            (<Float64Array>matrix).set(placedGeometry.flatTransformation);
            transformPositions3(matrix, positions);
            const rtcNeeded = worldToRTCPositions(positions, positions, origin);
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
                // TODO: matrix with translation if rtcNeeded
                color: [placedGeometry.color.x, placedGeometry.color.y, placedGeometry.color.z],
                opacity: placedGeometry.color.w
            });
            meshIds.push(meshId);
        }
        ctx.sceneModel.createObject({
            id: objectId,
            meshIds: meshIds
        });
    });
}
