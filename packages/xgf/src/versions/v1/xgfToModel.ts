import {
    LinesPrimitive,
    PointsPrimitive,
    SolidPrimitive,
    SurfacePrimitive,
    TrianglesPrimitive
} from "@xeokit/constants";
import type {SceneGeometryCompressedParams, SceneModel} from "@xeokit/scene";
import type {XGFData_v1} from "./XGFData_v1";
import type {FloatArrayParam} from "@xeokit/math";
import {DataModel} from "@xeokit/data";
import {BasicAggregation, BasicEntity} from "@xeokit/basictypes";
import {createUUID} from "@xeokit/utils";

/**
 * @private
 */
export function xgfToModel(params: {
    xgfData: XGFData_v1,
    sceneModel?: SceneModel,
    dataModel?: DataModel
}): void {

    const {xgfData, sceneModel, dataModel} = params;
    const defaultId = sceneModel ? sceneModel.id : createUUID();

    if (dataModel) {
        dataModel.createObject({
            id: defaultId,
            name: defaultId,
            type: BasicEntity
        });
    }

    const numGeometries = xgfData.eachGeometryPositionsBase.length;
    const numMeshes = xgfData.eachMeshGeometriesBase.length;
    const numObjects = xgfData.eachObjectMeshesBase.length;

    let nextMeshId = 0;

    const geometryCreated: { [key: string]: boolean } = {};

    for (let objectIdx = 0; objectIdx < numObjects; objectIdx++) {
        const objectId = xgfData.eachObjectId[objectIdx];
        const lastObjectIdx = (numObjects - 1);
        const atLastObject = (objectIdx === lastObjectIdx);
        const firstMeshIdx = xgfData.eachObjectMeshesBase [objectIdx];
        const lastMeshIdx = atLastObject ? (numMeshes - 1) : (xgfData.eachObjectMeshesBase[objectIdx + 1] - 1);
        const meshIds = [];
        for (let meshIdx = firstMeshIdx; meshIdx <= lastMeshIdx; meshIdx++) {
            const meshId = `${nextMeshId++}`;
            if (sceneModel) {
                const geometryIdx = xgfData.eachMeshGeometriesBase[meshIdx];
                const color = decompressColor(xgfData.eachMeshMaterialAttributes.subarray((meshIdx * 4), (meshIdx * 4) + 3));
                const opacity = xgfData.eachMeshMaterialAttributes[(meshIdx * 4) + 3] / 255.0;
                const matricesBase = xgfData.eachMeshMatricesBase[meshIdx];
                const matrix = xgfData.matrices.subarray(matricesBase, matricesBase + 16);
                const geometryId = `${geometryIdx}`;
                if (!geometryCreated[geometryId]) {
                    const geometryCompressedParams = <any>{
                        id: geometryId
                    };
                    const primitiveType = xgfData.eachGeometryPrimitiveType[geometryIdx];
                    switch (primitiveType) {
                        case 0:
                            geometryCompressedParams.primitive = TrianglesPrimitive;
                            break;
                        case 1:
                            geometryCompressedParams.primitive = SolidPrimitive;
                            break;
                        case 2:
                            geometryCompressedParams.primitive = SurfacePrimitive;
                            break;
                        case 3:
                            geometryCompressedParams.primitive = LinesPrimitive;
                            break;
                        case 5:
                            geometryCompressedParams.primitive = PointsPrimitive;
                            break;
                    }
                    const aabbsBase = xgfData.eachGeometryAABBBase[geometryIdx];
                    geometryCompressedParams.aabb = xgfData.aabbs.subarray(aabbsBase, aabbsBase + 6);
                    let geometryValid = false;
                    const atLastGeometry = (geometryIdx === (numGeometries - 1));
                    switch (geometryCompressedParams.primitive) {
                        case TrianglesPrimitive:
                        case SurfacePrimitive:
                        case SolidPrimitive:
                            geometryCompressedParams.positionsCompressed = xgfData.positions.subarray(xgfData.eachGeometryPositionsBase [geometryIdx], atLastGeometry ? xgfData.positions.length : xgfData.eachGeometryPositionsBase [geometryIdx + 1]);
                            geometryCompressedParams.indices = xgfData.indices.subarray(xgfData.eachGeometryIndicesBase [geometryIdx], atLastGeometry ? xgfData.indices.length : xgfData.eachGeometryIndicesBase [geometryIdx + 1]);
                            geometryCompressedParams.edgeIndices = xgfData.edgeIndices.subarray(xgfData.eachGeometryEdgeIndicesBase [geometryIdx], atLastGeometry ? xgfData.edgeIndices.length : xgfData.eachGeometryEdgeIndicesBase [geometryIdx + 1]);
                            geometryValid = (geometryCompressedParams.positionsCompressed.length > 0 && geometryCompressedParams.indices.length > 0);
                            break;
                        case PointsPrimitive:
                            geometryCompressedParams.positionsCompressed = xgfData.positions.subarray(xgfData.eachGeometryPositionsBase [geometryIdx], atLastGeometry ? xgfData.positions.length : xgfData.eachGeometryPositionsBase [geometryIdx + 1]);
                            geometryValid = (geometryCompressedParams.positionsCompressed.length > 0);
                            break;
                        case LinesPrimitive:
                            geometryCompressedParams.positionsCompressed = xgfData.positions.subarray(xgfData.eachGeometryPositionsBase [geometryIdx], atLastGeometry ? xgfData.positions.length : xgfData.eachGeometryPositionsBase [geometryIdx + 1]);
                            geometryCompressedParams.indices = xgfData.indices.subarray(xgfData.eachGeometryIndicesBase [geometryIdx], atLastGeometry ? xgfData.indices.length : xgfData.eachGeometryIndicesBase [geometryIdx + 1]);
                            geometryValid = (geometryCompressedParams.positionsCompressed.length > 0 && geometryCompressedParams.indices.length > 0);
                            break;
                        default:
                            continue;
                    }
                    if (geometryValid) {
                        sceneModel.createGeometryCompressed(<SceneGeometryCompressedParams>geometryCompressedParams);
                        geometryCreated[geometryId] = true;
                    }
                }
                sceneModel.createMesh({
                    id: meshId,
                    geometryId,
                    matrix,
                    color,
                    opacity
                });
            }
            meshIds.push(meshId);
        }
        if (meshIds.length > 0) {
            if (sceneModel) {
                sceneModel.createObject({
                    id: objectId,
                    meshIds
                });
            }
            if (dataModel) {
                dataModel.createObject({
                    id: objectId,
                    name: objectId,
                    type: BasicEntity
                });
                dataModel.createRelationship({
                    type: BasicAggregation,
                    relatingObjectId: defaultId,
                    relatedObjectId: objectId
                });
            }
        }
    }
}

const decompressColor = (function () {
    const floatColor = new Float32Array(3);
    return function (intColor: FloatArrayParam) {
        floatColor[0] = intColor[0] / 255;
        floatColor[1] = intColor[1] / 255;
        floatColor[2] = intColor[2] / 255;
        return floatColor;
    };
})();

