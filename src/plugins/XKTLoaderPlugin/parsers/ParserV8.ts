/*

 Parser for .XKT Format V8

 */

import * as utils from "../../../viewer/utils/index";
import {globalizeObjectId} from "../../../viewer/utils/index";
// @ts-ignore
import * as p from "./lib/pako.js";
import * as math from "../../../viewer/math/";
import {createPositionsDecompressMatrix} from "../../../viewer/index";
import {SceneModel, Viewer} from "../../../viewer/index";

// @ts-ignore
let pako = window.pako || p;
if (!pako.inflate) {  // See https://github.com/nodeca/pako/issues/97
    pako = pako.default;
}

function extract(elements: any[]): { [key: string]: any } {

    return {

        // Vertex attributes

        types: elements[0],
        eachObjectDataId: elements[1],
        eachObjectDataType: elements[2],
        eachObjectDataName: elements[3],
        eachObjectDataParent: elements[4],

        positions: elements[5],
        normals: elements[6],
        colors: elements[7],
        indices: elements[8],
        edgeIndices: elements[9],

        // Transform matrices

        matrices: elements[10],
        reusedGeometriesDecodeMatrix: elements[11],

        // Geometries

        eachGeometryPrimitiveType: elements[12],
        eachGeometryPositionsPortion: elements[13],
        eachGeometryNormalsPortion: elements[14],
        eachGeometryColorsPortion: elements[15],
        eachGeometryIndicesPortion: elements[16],
        eachGeometryEdgeIndicesPortion: elements[17],

        // Meshes are grouped in runs that are shared by the same entities

        eachMeshGeometriesPortion: elements[18],
        eachMeshMatricesPortion: elements[19],
        eachMeshMaterial: elements[20],

        // Entity elements in the following arrays are grouped in runs that are shared by the same tiles

        eachEntityObjectData: elements[21],
        eachEntityMeshesPortion: elements[22],

        eachTileAABB: elements[23],
        eachTileEntitiesPortion: elements[24]
    };
}

function inflate(deflatedData: { [key: string]: any }): { [key: string]: any } {

    function inflate(array: any, options?: any) {
        return (array.length === 0) ? [] : pako.inflate(array, options).buffer;
    }

    return {

        types: pako.inflate(deflatedData.types, {to: 'string'}),
        eachObjectDataId: pako.inflate(deflatedData.eachObjectDataId, {to: 'string'}),
        eachObjectDataType: new Uint32Array(inflate(deflatedData.eachObjectDataType)),
        eachObjectDataName: pako.inflate(deflatedData.eachObjectDataName, {to: 'string'}),
        eachObjectDataParent: new Uint32Array(inflate(deflatedData.eachObjectDataParent)),

        positions: new Uint16Array(inflate(deflatedData.positions)),
        normals: new Int8Array(inflate(deflatedData.normals)),
        colors: new Uint8Array(inflate(deflatedData.colors)),
        indices: new Uint32Array(inflate(deflatedData.indices)),
        edgeIndices: new Uint32Array(inflate(deflatedData.edgeIndices)),

        matrices: new Float32Array(inflate(deflatedData.matrices)),
        reusedGeometriesDecodeMatrix: new Float32Array(inflate(deflatedData.reusedGeometriesDecodeMatrix)),

        eachGeometryPrimitiveType: new Uint8Array(inflate(deflatedData.eachGeometryPrimitiveType)),
        eachGeometryPositionsPortion: new Uint32Array(inflate(deflatedData.eachGeometryPositionsPortion)),
        eachGeometryNormalsPortion: new Uint32Array(inflate(deflatedData.eachGeometryNormalsPortion)),
        eachGeometryColorsPortion: new Uint32Array(inflate(deflatedData.eachGeometryColorsPortion)),
        eachGeometryIndicesPortion: new Uint32Array(inflate(deflatedData.eachGeometryIndicesPortion)),
        eachGeometryEdgeIndicesPortion: new Uint32Array(inflate(deflatedData.eachGeometryEdgeIndicesPortion)),

        eachMeshGeometriesPortion: new Uint32Array(inflate(deflatedData.eachMeshGeometriesPortion)),
        eachMeshMatricesPortion: new Uint32Array(inflate(deflatedData.eachMeshMatricesPortion)),
        eachMeshMaterial: new Uint8Array(inflate(deflatedData.eachMeshMaterial)),

        eachEntityObjectData: new Uint32Array(inflate(deflatedData.eachEntityObjectData)),
        eachEntityMeshesPortion: new Uint32Array(inflate(deflatedData.eachEntityMeshesPortion)),

        eachTileAABB: new Float64Array(inflate(deflatedData.eachTileAABB)),
        eachTileEntitiesPortion: new Uint32Array(inflate(deflatedData.eachTileEntitiesPortion)),
    };
}

const decompressColor = (function () {
    const floatColor = new Float32Array(3);
    return function (intColor: any) {
        floatColor[0] = intColor[0] / 255.0;
        floatColor[1] = intColor[1] / 255.0;
        floatColor[2] = intColor[2] / 255.0;
        return floatColor;
    };
})();

function convertColorsRGBToRGBA(colorsRGB: any) {
    const colorsRGBA = [];
    for (let i = 0, len = colorsRGB.length; i < len; i += 3) {
        colorsRGBA.push(colorsRGB[i]);
        colorsRGBA.push(colorsRGB[i + 1]);
        colorsRGBA.push(colorsRGB[i + 2]);
        colorsRGBA.push(1.0);
    }
    return colorsRGBA;
}

function load(viewer: Viewer,
              options: {
                  objectDefaults: any;
                  excludeUnclassifiedObjects: any;
                  includeTypesMap: any;
                  excludeTypesMap: any;
                  includeTypes?: string[];
                  excludeTypes?: string[];
                  globalizeObjectIds?: boolean
              },
              inflatedData: any,
              sceneModel: SceneModel) {

    const types = JSON.parse(inflatedData.types);
    const eachObjectDataId = JSON.parse(inflatedData.eachObjectDataId);
    const eachObjectDataType = inflatedData.eachObjectDataType;
    const eachObjectDataName = JSON.parse(inflatedData.eachObjectDataName);
    const eachObjectDataParent = inflatedData.eachObjectDataParent;

    const positions = inflatedData.positions;
    const normals = inflatedData.normals;
    const colors = inflatedData.colors;
    const indices = inflatedData.indices;
    const edgeIndices = inflatedData.edgeIndices;

    const matrices = inflatedData.matrices;
    const reusedGeometriesDecodeMatrix = inflatedData.reusedGeometriesDecodeMatrix;

    const eachGeometryPrimitiveType = inflatedData.eachGeometryPrimitiveType;
    const eachGeometryPositionsPortion = inflatedData.eachGeometryPositionsPortion;
    const eachGeometryNormalsPortion = inflatedData.eachGeometryNormalsPortion;
    const eachGeometryColorsPortion = inflatedData.eachGeometryColorsPortion;
    const eachGeometryIndicesPortion = inflatedData.eachGeometryIndicesPortion;
    const eachGeometryEdgeIndicesPortion = inflatedData.eachGeometryEdgeIndicesPortion;

    const eachMeshGeometriesPortion = inflatedData.eachMeshGeometriesPortion;
    const eachMeshMatricesPortion = inflatedData.eachMeshMatricesPortion;
    const eachMeshMaterial = inflatedData.eachMeshMaterial;

    const eachEntityObjectData = inflatedData.eachEntityObjectData;
    const eachEntityMeshesPortion = inflatedData.eachEntityMeshesPortion;

    const eachTileAABB = inflatedData.eachTileAABB;
    const eachTileEntitiesPortion = inflatedData.eachTileEntitiesPortion;

    const numObjectDatas = eachObjectDataId.length;
    const numGeometries = eachGeometryPositionsPortion.length;
    const numMeshes = eachMeshGeometriesPortion.length;
    const numEntities = eachEntityObjectData.length;
    const numTiles = eachTileEntitiesPortion.length;

    let nextMeshId = 0;

    // Create metaModel, unless already loaded from JSON by XKTLoaderPlugin

    const modelDataId = sceneModel.id;

    if (!viewer.sceneData.models[modelDataId]) {


        const modelDataData = {
            // @ts-ignore
            objects: []
        };

        for (let objectDataIndex = 0; objectDataIndex < numObjectDatas; objectDataIndex++) {

            const objectDataId = eachObjectDataId[objectDataIndex];
            const typeIndex = eachObjectDataType[objectDataIndex];
            const objectDataType = types[typeIndex] || "default";
            const objectDataName = eachObjectDataName[objectDataIndex];
            const objectDataParentIndex = eachObjectDataParent[objectDataIndex];
            const objectDataParentId = (objectDataParentIndex !== objectDataIndex) ? eachObjectDataId[objectDataParentIndex] : null;

            modelDataData.objects.push({
                id: objectDataId,
                type: objectDataType,
                name: objectDataName,
                parent: objectDataParentId
            });
        }

        const metaModel = viewer.sceneData.createModel(modelDataId, modelDataData, {
            includeTypes: options.includeTypes,
            excludeTypes: options.excludeTypes,
            globalizeObjectIds: options.globalizeObjectIds
        });

        sceneModel.events.once("destroyed", () => {
            metaModel.destroy();
        });
    }

    // Count instances of each geometry

    const geometryReuseCounts = new Uint32Array(numGeometries);

    for (let meshIndex = 0; meshIndex < numMeshes; meshIndex++) {
        const geometryIndex = eachMeshGeometriesPortion[meshIndex];
        if (geometryReuseCounts[geometryIndex] !== undefined) {
            geometryReuseCounts[geometryIndex]++;
        } else {
            geometryReuseCounts[geometryIndex] = 1;
        }
    }

    // Iterate over tiles

    const tileCenter = math.vec3();
    const rtcAABB = math.AABB3();

    for (let tileIndex = 0; tileIndex < numTiles; tileIndex++) {

        const lastTileIndex = (numTiles - 1);

        const atLastTile = (tileIndex === lastTileIndex);

        const firstTileEntityIndex = eachTileEntitiesPortion [tileIndex];
        const lastTileEntityIndex = atLastTile ? numEntities : eachTileEntitiesPortion[tileIndex + 1];

        const tileAABBIndex = tileIndex * 6;
        const tileAABB = eachTileAABB.subarray(tileAABBIndex, tileAABBIndex + 6);

        math.boundaries.getAABB3Center(tileAABB, tileCenter);

        rtcAABB[0] = tileAABB[0] - tileCenter[0];
        rtcAABB[1] = tileAABB[1] - tileCenter[1];
        rtcAABB[2] = tileAABB[2] - tileCenter[2];
        rtcAABB[3] = tileAABB[3] - tileCenter[0];
        rtcAABB[4] = tileAABB[4] - tileCenter[1];
        rtcAABB[5] = tileAABB[5] - tileCenter[2];

        const tileDecodeMatrix = createPositionsDecompressMatrix(rtcAABB, math.mat4());

        const geometryCreated: { [key: string]: boolean } = {};

        // Iterate over each tile's entities

        for (let tileEntityIndex = firstTileEntityIndex; tileEntityIndex < lastTileEntityIndex; tileEntityIndex++) {

            const xktObjectDataIndex = eachEntityObjectData[tileEntityIndex];
            const xktObjectDataId = eachObjectDataId[xktObjectDataIndex];
            const xktEntityId = xktObjectDataId;

            const entityId = options.globalizeObjectIds ? globalizeObjectId(sceneModel.id, xktEntityId) : xktEntityId;

            const lastTileEntityIndex = (numEntities - 1);
            const atLastTileEntity = (tileEntityIndex === lastTileEntityIndex);
            const firstMeshIndex = eachEntityMeshesPortion [tileEntityIndex];
            const lastMeshIndex = atLastTileEntity ? eachMeshGeometriesPortion.length : eachEntityMeshesPortion[tileEntityIndex + 1];

            const meshIds = [];

            const objectData = viewer.sceneData.objects[entityId];
            const entityDefaults: { [key: string]: any } = {};
            const meshDefaults: { [key: string]: any } = {};

            if (objectData) {

                // Mask loading of object types

                if (options.excludeTypesMap && objectData.type && options.excludeTypesMap[objectData.type]) {
                    continue;
                }

                if (options.includeTypesMap && objectData.type && (!options.includeTypesMap[objectData.type])) {
                    continue;
                }

                // Get initial property values for object types

                const props = options.objectDefaults ? options.objectDefaults[objectData.type] || options.objectDefaults["DEFAULT"] : null;

                if (props) {
                    if (props.visible === false) {
                        entityDefaults.visible = false;
                    }
                    if (props.pickable === false) {
                        entityDefaults.pickable = false;
                    }
                    if (props.colorize) {
                        meshDefaults.color = props.colorize;
                    }
                    if (props.opacity !== undefined && props.opacity !== null) {
                        meshDefaults.opacity = props.opacity;
                    }
                    if (props.metallic !== undefined && props.metallic !== null) {
                        meshDefaults.metallic = props.metallic;
                    }
                    if (props.roughness !== undefined && props.roughness !== null) {
                        meshDefaults.roughness = props.roughness;
                    }
                }

            } else {
                if (options.excludeUnclassifiedObjects) {
                    continue;
                }
            }

            // Iterate each entity's meshes

            for (let meshIndex = firstMeshIndex; meshIndex < lastMeshIndex; meshIndex++) {

                const geometryIndex = eachMeshGeometriesPortion[meshIndex];
                const geometryReuseCount = geometryReuseCounts[geometryIndex];
                const isReusedGeometry = (geometryReuseCount > 1);

                const atLastGeometry = (geometryIndex === (numGeometries - 1));

                const meshColor = decompressColor(eachMeshMaterial.subarray((meshIndex * 6), (meshIndex * 6) + 3));
                const meshOpacity = eachMeshMaterial[(meshIndex * 6) + 3] / 255.0;
                const meshMetallic = eachMeshMaterial[(meshIndex * 6) + 4] / 255.0;
                const meshRoughness = eachMeshMaterial[(meshIndex * 6) + 5] / 255.0;

                const meshId = nextMeshId++;

                if (isReusedGeometry) {

                    // Create mesh for multi-use geometry - create (or reuse) geometry, create mesh using that geometry

                    const meshMatrixIndex = eachMeshMatricesPortion[meshIndex];
                    const meshMatrix = matrices.slice(meshMatrixIndex, meshMatrixIndex + 16);

                    const geometryId = "geometry." + tileIndex + "." + geometryIndex; // These IDs are local to the sceneModel

                    if (!geometryCreated[geometryId]) {

                        const primitiveType = eachGeometryPrimitiveType[geometryIndex];

                        let primitiveName;
                        let geometryPositions;
                        let geometryNormals;
                        let geometryColors;
                        let geometryIndices;
                        let geometryEdgeIndices;
                        let geometryValid = false;

                        switch (primitiveType) {
                            case 0:
                                primitiveName = "solid";
                                geometryPositions = positions.subarray(eachGeometryPositionsPortion [geometryIndex], atLastGeometry ? positions.length : eachGeometryPositionsPortion [geometryIndex + 1]);
                                geometryNormals = normals.subarray(eachGeometryNormalsPortion [geometryIndex], atLastGeometry ? normals.length : eachGeometryNormalsPortion [geometryIndex + 1]);
                                geometryIndices = indices.subarray(eachGeometryIndicesPortion [geometryIndex], atLastGeometry ? indices.length : eachGeometryIndicesPortion [geometryIndex + 1]);
                                geometryEdgeIndices = edgeIndices.subarray(eachGeometryEdgeIndicesPortion [geometryIndex], atLastGeometry ? edgeIndices.length : eachGeometryEdgeIndicesPortion [geometryIndex + 1]);
                                geometryValid = (geometryPositions.length > 0 && geometryIndices.length > 0);
                                break;
                            case 1:
                                primitiveName = "surface";
                                geometryPositions = positions.subarray(eachGeometryPositionsPortion [geometryIndex], atLastGeometry ? positions.length : eachGeometryPositionsPortion [geometryIndex + 1]);
                                geometryNormals = normals.subarray(eachGeometryNormalsPortion [geometryIndex], atLastGeometry ? normals.length : eachGeometryNormalsPortion [geometryIndex + 1]);
                                geometryIndices = indices.subarray(eachGeometryIndicesPortion [geometryIndex], atLastGeometry ? indices.length : eachGeometryIndicesPortion [geometryIndex + 1]);
                                geometryEdgeIndices = edgeIndices.subarray(eachGeometryEdgeIndicesPortion [geometryIndex], atLastGeometry ? edgeIndices.length : eachGeometryEdgeIndicesPortion [geometryIndex + 1]);
                                geometryValid = (geometryPositions.length > 0 && geometryIndices.length > 0);
                                break;
                            case 2:
                                primitiveName = PointsPrimitive;
                                geometryPositions = positions.subarray(eachGeometryPositionsPortion [geometryIndex], atLastGeometry ? positions.length : eachGeometryPositionsPortion [geometryIndex + 1]);
                                geometryColors = convertColorsRGBToRGBA(colors.subarray(eachGeometryColorsPortion [geometryIndex], atLastGeometry ? colors.length : eachGeometryColorsPortion [geometryIndex + 1]));
                                geometryValid = (geometryPositions.length > 0);
                                break;
                            case 3:
                                primitiveName = "lines";
                                geometryPositions = positions.subarray(eachGeometryPositionsPortion [geometryIndex], atLastGeometry ? positions.length : eachGeometryPositionsPortion [geometryIndex + 1]);
                                geometryIndices = indices.subarray(eachGeometryIndicesPortion [geometryIndex], atLastGeometry ? indices.length : eachGeometryIndicesPortion [geometryIndex + 1]);
                                geometryValid = (geometryPositions.length > 0 && geometryIndices.length > 0);
                                break;
                            default:
                                continue;
                        }

                        if (geometryValid) {

                            sceneModel.createGeometry({
                                id: geometryId,
                                origin: tileCenter,
                                primitive: primitiveName,
                                positions: geometryPositions,
                                normals: geometryNormals,
                                colorsCompressed: geometryColors,
                                indices: geometryIndices,
                                edgeIndices: geometryEdgeIndices,
                                positionsDecompressMatrix: reusedGeometriesDecodeMatrix
                            });

                            geometryCreated[geometryId] = true;
                        }
                    }

                    if (geometryCreated[geometryId]) {

                        sceneModel.createMesh(utils.apply(meshDefaults, {
                            id: meshId,
                            geometryId: geometryId,
                            matrix: meshMatrix,
                            color: meshColor,
                            metallic: meshMetallic,
                            roughness: meshRoughness,
                            opacity: meshOpacity
                        }));

                        meshIds.push(meshId);
                    }

                } else {

                    const primitiveType = eachGeometryPrimitiveType[geometryIndex];

                    let primitiveName;
                    let geometryPositions;
                    let geometryNormals;
                    let geometryColors;
                    let geometryIndices;
                    let geometryEdgeIndices;
                    let geometryValid = false;

                    switch (primitiveType) {
                        case 0:
                            primitiveName = "solid";
                            geometryPositions = positions.subarray(eachGeometryPositionsPortion [geometryIndex], atLastGeometry ? positions.length : eachGeometryPositionsPortion [geometryIndex + 1]);
                            geometryNormals = normals.subarray(eachGeometryNormalsPortion [geometryIndex], atLastGeometry ? normals.length : eachGeometryNormalsPortion [geometryIndex + 1]);
                            geometryIndices = indices.subarray(eachGeometryIndicesPortion [geometryIndex], atLastGeometry ? indices.length : eachGeometryIndicesPortion [geometryIndex + 1]);
                            geometryEdgeIndices = edgeIndices.subarray(eachGeometryEdgeIndicesPortion [geometryIndex], atLastGeometry ? edgeIndices.length : eachGeometryEdgeIndicesPortion [geometryIndex + 1]);
                            geometryValid = (geometryPositions.length > 0 && geometryIndices.length > 0);
                            break;
                        case 1:
                            primitiveName = "surface";
                            geometryPositions = positions.subarray(eachGeometryPositionsPortion [geometryIndex], atLastGeometry ? positions.length : eachGeometryPositionsPortion [geometryIndex + 1]);
                            geometryNormals = normals.subarray(eachGeometryNormalsPortion [geometryIndex], atLastGeometry ? normals.length : eachGeometryNormalsPortion [geometryIndex + 1]);
                            geometryIndices = indices.subarray(eachGeometryIndicesPortion [geometryIndex], atLastGeometry ? indices.length : eachGeometryIndicesPortion [geometryIndex + 1]);
                            geometryEdgeIndices = edgeIndices.subarray(eachGeometryEdgeIndicesPortion [geometryIndex], atLastGeometry ? edgeIndices.length : eachGeometryEdgeIndicesPortion [geometryIndex + 1]);
                            geometryValid = (geometryPositions.length > 0 && geometryIndices.length > 0);
                            break;
                        case 2:
                            primitiveName = PointsPrimitive;
                            geometryPositions = positions.subarray(eachGeometryPositionsPortion [geometryIndex], atLastGeometry ? positions.length : eachGeometryPositionsPortion [geometryIndex + 1]);
                            geometryColors = convertColorsRGBToRGBA(colors.subarray(eachGeometryColorsPortion [geometryIndex], atLastGeometry ? colors.length : eachGeometryColorsPortion [geometryIndex + 1]));
                            geometryValid = (geometryPositions.length > 0);
                            break;
                        case 3:
                            primitiveName = "lines";
                            geometryPositions = positions.subarray(eachGeometryPositionsPortion [geometryIndex], atLastGeometry ? positions.length : eachGeometryPositionsPortion [geometryIndex + 1]);
                            geometryIndices = indices.subarray(eachGeometryIndicesPortion [geometryIndex], atLastGeometry ? indices.length : eachGeometryIndicesPortion [geometryIndex + 1]);
                            geometryValid = (geometryPositions.length > 0 && geometryIndices.length > 0);
                            break;
                        default:
                            continue;
                    }

                    if (geometryValid) {

                        sceneModel.createMesh(utils.apply(meshDefaults, {
                            id: meshId,
                            origin: tileCenter,
                            primitive: primitiveName,
                            positions: geometryPositions,
                            normals: geometryNormals,
                            colorsCompressed: geometryColors,
                            indices: geometryIndices,
                            edgeIndices: geometryEdgeIndices,
                            positionsDecompressMatrix: tileDecodeMatrix,
                            color: meshColor,
                            metallic: meshMetallic,
                            roughness: meshRoughness,
                            opacity: meshOpacity
                        }));

                        meshIds.push(meshId);
                    }
                }
            }

            if (meshIds.length > 0) {

                sceneModel.createObject(utils.apply(entityDefaults, {
                    id: entityId,
                    meshIds: meshIds
                }));
            }
        }
    }
}

/** @private */
const ParserV8 = {
    version: 8,
    parse: function (viewer: Viewer,
                     options: {
                         objectDefaults: any;
                         excludeUnclassifiedObjects: any;
                         includeTypesMap: any;
                         excludeTypesMap: any;
                         includeTypes?: string[];
                         excludeTypes?: string[];
                         globalizeObjectIds?: boolean
                     },
                     elements: any[],
                     sceneModel: SceneModel) {
        const deflatedData = extract(elements);
        const inflatedData = inflate(deflatedData);
        load(viewer, options, inflatedData, sceneModel);
    }
};

export {ParserV8};