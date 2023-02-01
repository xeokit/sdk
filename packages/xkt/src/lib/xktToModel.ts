import type {BuildableModel} from "@xeokit/core/components";
import {XKTData} from "./XKTData";
import {createVec4} from "@xeokit/math/matrix";

const tempVec4a = createVec4();
const tempVec4b = createVec4();
const NUM_TEXTURE_ATTRIBUTES = 9;

/**
 * @private
 */
export function xktToModel(xktData: XKTData, buildableModel: BuildableModel, options?: {}): void {
    /*
        const metadata = xktData.metadata;
        const textureData = xktData.textureData;
        const eachTextureDataPortion = xktData.eachTextureDataPortion;
        const eachTextureAttributes = xktData.eachTextureAttributes;
        const positions = xktData.positions;
        const colors = xktData.colors;
        const uvs = xktData.uvs;

        const indices8Bit = xktData.indices8Bit;
        const indices16Bit = xktData.indices16Bit;
        const indices32Bit = xktData.indices32Bit;

        const edgeIndices8Bit = xktData.edgeIndices8Bit;
        const edgeIndices16Bit = xktData.edgeIndices16Bit;
        const edgeIndices32Bit = xktData.edgeIndices32Bit;

        const eachTextureSetTextures = xktData.eachTextureSetTextures;
        const matrices = xktData.matrices;
        const eachBucketPositionsPortion = xktData.eachBucketPositionsPortion;
        const eachBucketColorsPortion = xktData.eachBucketColorsPortion;
        const eachBucketUVsPortion = xktData.eachBucketUVsPortion;
        const eachBucketIndicesPortion = xktData.eachBucketIndicesPortion;
        const eachBucketEdgeIndicesPortion = xktData.eachBucketEdgeIndicesPortion;

        const eachGeometryPrimitiveType = xktData.eachGeometryPrimitiveType;
        const eachGeometryBucketPortion = xktData.eachGeometryBucketPortion;


        const eachMeshGeometriesPortion = xktData.eachMeshGeometriesPortion;
        const eachMeshMatricesPortion = xktData.eachMeshMatricesPortion;
        const eachMeshTextureSet = xktData.eachMeshTextureSet;
        const eachMeshMaterialAttributes = xktData.eachMeshMaterialAttributes;
        const eachObjectId = xktData.eachObjectId;
        const eachObjectMeshesPortion = xktData.eachObjectMeshesPortion;
        const eachTileAABB = xktData.eachTileAABB;
        const eachTileEntitiesPortion = xktData.eachTileEntitiesPortion;

        const numTextures = eachTextureDataPortion.length;
        const numTextureSets = eachTextureSetTextures.length / 5;
        const numBuckets = eachBucketPositionsPortion.length;
        const numMeshes = eachMeshGeometriesPortion.length;
        const numEntities = eachObjectMeshesPortion.length;
        const numTiles = eachTileEntitiesPortion.length;

        let nextMeshId = 0;


        // Create textures

        for (let textureIndex = 0; textureIndex < numTextures; textureIndex++) {

            const atLastTexture = (textureIndex === (numTextures - 1));
            const textureDataPortionStart = eachTextureDataPortion[textureIndex];
            const textureDataPortionEnd = atLastTexture ? textureData.length : (eachTextureDataPortion[textureIndex + 1]);

            const textureDataPortionSize = textureDataPortionEnd - textureDataPortionStart;
            const textureDataPortionExists = (textureDataPortionSize > 0);

            const textureAttrBaseIdx = (textureIndex * NUM_TEXTURE_ATTRIBUTES);

            const compressed = (eachTextureAttributes[textureAttrBaseIdx + 0] === 1);
            const mediaType = eachTextureAttributes[textureAttrBaseIdx + 1];
            const width = eachTextureAttributes[textureAttrBaseIdx + 2];
            const height = eachTextureAttributes[textureAttrBaseIdx + 3];
            const minFilter = eachTextureAttributes[textureAttrBaseIdx + 4];
            const magFilter = eachTextureAttributes[textureAttrBaseIdx + 5]; // LinearFilter | NearestFilter
            const wrapS = eachTextureAttributes[textureAttrBaseIdx + 6]; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
            const wrapT = eachTextureAttributes[textureAttrBaseIdx + 7]; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
            const wrapR = eachTextureAttributes[textureAttrBaseIdx + 8]; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping

            if (textureDataPortionExists) {

                const imageDataSubarray = new Uint8Array(textureData.subarray(textureDataPortionStart, textureDataPortionEnd));
                const arrayBuffer = imageDataSubarray.buffer;
                const textureId = `texture-${textureIndex}`;

                if (compressed) {

                    buildableModel.createTexture({
                        id: textureId,
                        buffers: [arrayBuffer],
                        minFilter,
                        magFilter,
                        wrapS,
                        wrapT,
                        wrapR
                    });

                } else {

                    const mimeType = mediaType === JPEGMediaType ? "image/jpeg" : (mediaType === PNGMediaType ? "image/png" : "image/gif");
                    const blob = new Blob([arrayBuffer], {type: mimeType});
                    const urlCreator = window.URL || window.webkitURL;
                    const imageUrl = urlCreator.createObjectURL(blob);
                    const img = document.createElement('img');
                    img.src = imageUrl;

                    buildableModel.createTexture({
                        id: textureId,
                        image: img,
                        //mediaType,
                        minFilter,
                        magFilter,
                        wrapS,
                        wrapT,
                        wrapR
                    });
                }
            }
        }

        // Create texture sets

        for (let textureSetIndex = 0; textureSetIndex < numTextureSets; textureSetIndex++) {
            const eachTextureSetTexturesIndex = textureSetIndex * 5;
            const textureSetId = `textureSet-${textureSetIndex}`;
            const colorTextureIndex = eachTextureSetTextures[eachTextureSetTexturesIndex + 0];
            const metallicRoughnessTextureIndex = eachTextureSetTextures[eachTextureSetTexturesIndex + 1];
            const normalsTextureIndex = eachTextureSetTextures[eachTextureSetTexturesIndex + 2];
            const emissiveTextureIndex = eachTextureSetTextures[eachTextureSetTexturesIndex + 3];
            const occlusionTextureIndex = eachTextureSetTextures[eachTextureSetTexturesIndex + 4];

            buildableModel.createTextureSet({
                id: textureSetId,
                colorTextureId: colorTextureIndex >= 0 ? `texture-${colorTextureIndex}` : null,
                normalsTextureId: normalsTextureIndex >= 0 ? `texture-${normalsTextureIndex}` : null,
                metallicRoughnessTextureId: metallicRoughnessTextureIndex >= 0 ? `texture-${metallicRoughnessTextureIndex}` : null,
                emissiveTextureId: emissiveTextureIndex >= 0 ? `texture-${emissiveTextureIndex}` : null,
                occlusionTextureId: occlusionTextureIndex >= 0 ? `texture-${occlusionTextureIndex}` : null
            });
        }

        for (let bucketIndex = 0; bucketIndex < numBuckets; bucketIndex++) {
            const atLastTexture = (textureIndex === (numTextures - 1));

        }

        for (let geometryIndex = 0; geometryIndex < numGeometries; geometryIndex++) {
            const atLastGeometry = (geometryIndex === (numGeometries - 1));

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

        for (let objectIndex = 0; objectIndex <= numObjects; objectIndex++) {

            const objectId = eachObjectId[objectIndex];

            const finalObjectIndex = (numEntities - 1);
            const atLastObject = (objectIndex === finalObjectIndex);
            const firstMeshIndex = eachObjectMeshesPortion [objectIndex];
            const lastMeshIndex = atLastObject ? (eachMeshGeometriesPortion.length - 1) : (eachObjectMeshesPortion[objectIndex + 1] - 1);

            const meshIds = [];

            // Iterate each object's meshes

            for (let meshIndex = firstMeshIndex; meshIndex <= lastMeshIndex; meshIndex++) {

                const geometryIndex = eachMeshGeometriesPortion[meshIndex];

                const atLastGeometry = (geometryIndex === (numGeometries - 1));

                const textureSetIndex = eachMeshTextureSet[meshIndex];

                const textureSetId = (textureSetIndex >= 0) ? `textureSet-${textureSetIndex}` : null;

                const meshColor = decompressColor(eachMeshMaterialAttributes.subarray((meshIndex * 6), (meshIndex * 6) + 3));
                const meshOpacity = eachMeshMaterialAttributes[(meshIndex * 6) + 3] / 255.0;
                const meshMetallic = eachMeshMaterialAttributes[(meshIndex * 6) + 4] / 255.0;
                const meshRoughness = eachMeshMaterialAttributes[(meshIndex * 6) + 5] / 255.0;

                const meshId = nextMeshId++;


                // Create mesh for multi-use geometry - create (or reuse) geometry, create mesh using that geometry

                const meshMatrixIndex = eachMeshMatricesPortion[meshIndex];
                const meshMatrix = matrices.slice(meshMatrixIndex, meshMatrixIndex + 16);

                const geometryId = "geometry." + tileIndex + "." + geometryIndex; // These IDs are local to the VBObuildableModel

                let geometryArrays = geometryArraysCache[geometryId];

                if (!geometryArrays) {
                    geometryArrays = {
                        batchThisMesh: (!options.reuseGeometries)
                    };
                    const primitiveType = eachGeometryPrimitiveType[geometryIndex];
                    let geometryValid = false;
                    switch (primitiveType) {
                        case 0:
                            geometryArrays.primitiveName = "solid";
                            geometryArrays.geometryPositions = positions.subarray(eachGeometryPositionsPortion [geometryIndex], atLastGeometry ? positions.length : eachGeometryPositionsPortion [geometryIndex + 1]);
                            geometryArrays.geometryNormals = normals.subarray(eachGeometryNormalsPortion [geometryIndex], atLastGeometry ? normals.length : eachGeometryNormalsPortion [geometryIndex + 1]);
                            geometryArrays.geometryUVs = uvs.subarray(eachGeometryUVsPortion [geometryIndex], atLastGeometry ? uvs.length : eachGeometryUVsPortion [geometryIndex + 1]);
                            geometryArrays.geometryIndices = indices.subarray(eachGeometryIndicesPortion [geometryIndex], atLastGeometry ? indices.length : eachGeometryIndicesPortion [geometryIndex + 1]);
                            geometryArrays.geometryEdgeIndices = edgeIndices.subarray(eachGeometryEdgeIndicesPortion [geometryIndex], atLastGeometry ? edgeIndices.length : eachGeometryEdgeIndicesPortion [geometryIndex + 1]);
                            geometryValid = (geometryArrays.geometryPositions.length > 0 && geometryArrays.geometryIndices.length > 0);
                            break;
                        case 1:
                            geometryArrays.primitiveName = "surface";
                            geometryArrays.geometryPositions = positions.subarray(eachGeometryPositionsPortion [geometryIndex], atLastGeometry ? positions.length : eachGeometryPositionsPortion [geometryIndex + 1]);
                            geometryArrays.geometryNormals = normals.subarray(eachGeometryNormalsPortion [geometryIndex], atLastGeometry ? normals.length : eachGeometryNormalsPortion [geometryIndex + 1]);
                            geometryArrays.geometryUVs = uvs.subarray(eachGeometryUVsPortion [geometryIndex], atLastGeometry ? uvs.length : eachGeometryUVsPortion [geometryIndex + 1]);
                            geometryArrays.geometryIndices = indices.subarray(eachGeometryIndicesPortion [geometryIndex], atLastGeometry ? indices.length : eachGeometryIndicesPortion [geometryIndex + 1]);
                            geometryArrays.geometryEdgeIndices = edgeIndices.subarray(eachGeometryEdgeIndicesPortion [geometryIndex], atLastGeometry ? edgeIndices.length : eachGeometryEdgeIndicesPortion [geometryIndex + 1]);
                            geometryValid = (geometryArrays.geometryPositions.length > 0 && geometryArrays.geometryIndices.length > 0);
                            break;
                        case 2:
                            geometryArrays.primitiveName = "points";
                            geometryArrays.geometryPositions = positions.subarray(eachGeometryPositionsPortion [geometryIndex], atLastGeometry ? positions.length : eachGeometryPositionsPortion [geometryIndex + 1]);
                            geometryArrays.geometryColors = colors.subarray(eachGeometryColorsPortion [geometryIndex], atLastGeometry ? colors.length : eachGeometryColorsPortion [geometryIndex + 1]);
                            geometryValid = (geometryArrays.geometryPositions.length > 0);
                            break;
                        case 3:
                            geometryArrays.primitiveName = "lines";
                            geometryArrays.geometryPositions = positions.subarray(eachGeometryPositionsPortion [geometryIndex], atLastGeometry ? positions.length : eachGeometryPositionsPortion [geometryIndex + 1]);
                            geometryArrays.geometryIndices = indices.subarray(eachGeometryIndicesPortion [geometryIndex], atLastGeometry ? indices.length : eachGeometryIndicesPortion [geometryIndex + 1]);
                            geometryValid = (geometryArrays.geometryPositions.length > 0 && geometryArrays.geometryIndices.length > 0);
                            break;
                        default:
                            continue;
                    }

                    if (!geometryValid) {
                        geometryArrays = null;
                    }

                    if (geometryArrays) {
                        if (geometryReuseCount > 1000) { // TODO: Heuristic to force batching of instanced geometry beyond a certain reuse count (or budget)?
                            // geometryArrays.batchThisMesh = true;
                        }
                        if (geometryArrays.geometryPositions.length > 1000) { // TODO: Heuristic to force batching on instanced geometry above certain vertex size?
                            // geometryArrays.batchThisMesh = true;
                        }
                        if (geometryArrays.batchThisMesh) {
                            geometryArrays.decompressedPositions = new Float32Array(geometryArrays.geometryPositions.length);
                            geometryArrays.transformedAndRecompressedPositions = new Uint16Array(geometryArrays.geometryPositions.length)
                            const geometryPositions = geometryArrays.geometryPositions;
                            const decompressedPositions = geometryArrays.decompressedPositions;
                            for (let i = 0, len = geometryPositions.length; i < len; i += 3) {
                                decompressedPositions[i + 0] = geometryPositions[i + 0] * reusedGeometriesDecodeMatrix[0] + reusedGeometriesDecodeMatrix[12];
                                decompressedPositions[i + 1] = geometryPositions[i + 1] * reusedGeometriesDecodeMatrix[5] + reusedGeometriesDecodeMatrix[13];
                                decompressedPositions[i + 2] = geometryPositions[i + 2] * reusedGeometriesDecodeMatrix[10] + reusedGeometriesDecodeMatrix[14];
                            }
                            geometryArrays.geometryPositions = null;
                            geometryArraysCache[geometryId] = geometryArrays;
                        }
                    }
                }

                if (geometryArrays) {


                    if (!geometryCreatedInTile[geometryId]) {

                        buildableModel.createGeometry({
                            id: geometryId,
                            primitive: geometryArrays.primitiveName,
                            positionsCompressed: geometryArrays.geometryPositions,
                            normalsCompressed: geometryArrays.geometryNormals,
                            uv: geometryArrays.geometryUVs,
                            colorsCompressed: geometryArrays.geometryColors,
                            indices: geometryArrays.geometryIndices,
                            edgeIndices: geometryArrays.geometryEdgeIndices,
                            positionsDecodeMatrix: reusedGeometriesDecodeMatrix
                        });

                        geometryCreatedInTile[geometryId] = true;
                    }

                    buildableModel.createMesh(utils.apply(meshDefaults, {
                        id: meshId,
                        geometryId: geometryId,
                        textureSetId: textureSetId,
                        matrix: meshMatrix,
                        color: meshColor,
                        metallic: meshMetallic,
                        roughness: meshRoughness,
                        opacity: meshOpacity,
                        origin: tileCenter
                    }));

                    meshIds.push(meshId);
                }
            }

            if (meshIds.length > 0) {
                buildableModel.createObject(apply(objectDefaults, {
                    id: objectId,
                    meshIds: meshIds
                }));
            }
        }
    */
}

const decompressColor = (function () {
    const floatColor = new Float32Array(3);
    return function (intColor) {
        floatColor[0] = intColor[0] / 255.0;
        floatColor[1] = intColor[1] / 255.0;
        floatColor[2] = intColor[2] / 255.0;
        return floatColor;
    };
})();

const imagDataToImage = (function () {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    return function (imagedata) {
        canvas.width = imagedata.width;
        canvas.height = imagedata.height;
        context.putImageData(imagedata, 0, 0);
        return canvas.toDataURL();
    };
})();
