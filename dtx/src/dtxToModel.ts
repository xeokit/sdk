import {JPEGMediaType, LinesPrimitive, PNGMediaType, PointsPrimitive, TrianglesPrimitive} from "@xeokit/constants";
import type {DataModel, DataModelParams} from "@xeokit/data";
import type {SceneGeometryBucketParams, SceneGeometryCompressedParams, SceneModel} from "@xeokit/scene";
import type {DTXData} from "./DTXData";
import type {FloatArrayParam} from "@xeokit/math";

const NUM_TEXTURE_ATTRIBUTES = 9;

/**
 * @private
 */
export function DTXToModel(params: {
    DTXData: DTXData,
    sceneModel: SceneModel,
    dataModel?: DataModel
}): void {

    const DTXData = params.DTXData;
    const sceneModel = params.sceneModel;
    const dataModel = params.dataModel;

    if (dataModel) {
        if (DTXData.metadata) {
            dataModel.fromJSON(<DataModelParams>DTXData.metadata);
        }
    }

    const numTextures = DTXData.eachTextureDataPortion.length;
    const numTextureSets = DTXData.eachTextureSetTextures.length / 5;
    const numBuckets = DTXData.eachBucketPositionsPortion.length;
    const numMeshes = DTXData.eachMeshGeometriesPortion.length;
    const numObjects = DTXData.eachObjectMeshesPortion.length;
    const numGeometries = DTXData.eachGeometryDecodeMatricesPortion.length;

    let nextMeshId = 0;

    const geometryCreated: {
        [key: string]: boolean
    } = {};

    // Create textures

    for (let textureIndex = 0; textureIndex < numTextures; textureIndex++) {

        const atLastTexture = (textureIndex === (numTextures - 1));
        const textureDataPortionStart = DTXData.eachTextureDataPortion[textureIndex];
        const textureDataPortionEnd = atLastTexture ? DTXData.textureData.length : (DTXData.eachTextureDataPortion[textureIndex + 1]);
        const textureDataPortionSize = textureDataPortionEnd - textureDataPortionStart;
        const textureDataPortionExists = (textureDataPortionSize > 0);
        const textureAttrBaseIdx = (textureIndex * NUM_TEXTURE_ATTRIBUTES);

        const compressed = (DTXData.eachTextureAttributes[textureAttrBaseIdx] === 1);
        const mediaType = DTXData.eachTextureAttributes[textureAttrBaseIdx + 1];
        const width = DTXData.eachTextureAttributes[textureAttrBaseIdx + 2];
        const height = DTXData.eachTextureAttributes[textureAttrBaseIdx + 3];
        const minFilter = DTXData.eachTextureAttributes[textureAttrBaseIdx + 4];
        const magFilter = DTXData.eachTextureAttributes[textureAttrBaseIdx + 5]; // LinearFilter | NearestFilter
        const wrapS = DTXData.eachTextureAttributes[textureAttrBaseIdx + 6]; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
        const wrapT = DTXData.eachTextureAttributes[textureAttrBaseIdx + 7]; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
        const wrapR = DTXData.eachTextureAttributes[textureAttrBaseIdx + 8]; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping

        if (textureDataPortionExists) {

            const imageDataSubarray = new Uint8Array(DTXData.textureData.subarray(textureDataPortionStart, textureDataPortionEnd));
            const arrayBuffer = imageDataSubarray.buffer;
            const textureId = `texture-${textureIndex}`;

            if (compressed) {

                sceneModel.createTexture({
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

                sceneModel.createTexture({
                    id: textureId,
                    image: img,
                    mediaType,
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

        const eachTextureSetTexturesIndex = textureSetIndex * 5; // Five textures per set
        const textureSetId = `textureSet-${textureSetIndex}`;
        const colorTextureIndex = DTXData.eachTextureSetTextures[eachTextureSetTexturesIndex];
        const metallicRoughnessTextureIndex = DTXData.eachTextureSetTextures[eachTextureSetTexturesIndex + 1];
        const normalsTextureIndex = DTXData.eachTextureSetTextures[eachTextureSetTexturesIndex + 2];
        const emissiveTextureIndex = DTXData.eachTextureSetTextures[eachTextureSetTexturesIndex + 3];
        const occlusionTextureIndex = DTXData.eachTextureSetTextures[eachTextureSetTexturesIndex + 4];

        sceneModel.createTextureSet({
            id: textureSetId,
            colorTextureId: colorTextureIndex >= 0 ? `texture-${colorTextureIndex}` : undefined,
            normalsTextureId: normalsTextureIndex >= 0 ? `texture-${normalsTextureIndex}` : undefined,
            metallicRoughnessTextureId: metallicRoughnessTextureIndex >= 0 ? `texture-${metallicRoughnessTextureIndex}` : undefined,
            emissiveTextureId: emissiveTextureIndex >= 0 ? `texture-${emissiveTextureIndex}` : undefined,
            occlusionTextureId: occlusionTextureIndex >= 0 ? `texture-${occlusionTextureIndex}` : undefined
        });
    }

    // Iterate objects

    for (let objectIndex = 0; objectIndex <= numObjects; objectIndex++) {

        const objectId = DTXData.eachObjectId[objectIndex];
        const finalObjectIndex = (numObjects - 1);
        const atLastObject = (objectIndex === finalObjectIndex);
        const firstMeshIndex = DTXData.eachObjectMeshesPortion [objectIndex];
        const lastMeshIndex = atLastObject ? (DTXData.eachMeshGeometriesPortion.length - 1) : (DTXData.eachObjectMeshesPortion[objectIndex + 1] - 1);

        const meshIds = [];

        // Iterate each object's meshes

        for (let meshIndex = firstMeshIndex; meshIndex <= lastMeshIndex; meshIndex++) {

            const geometryIndex = DTXData.eachMeshGeometriesPortion[meshIndex];
            const atLastGeometry = (geometryIndex === (numGeometries - 1));
            const textureSetIndex = DTXData.eachMeshTextureSet[meshIndex];
            const textureSetId = (textureSetIndex >= 0) ? `textureSet-${textureSetIndex}` : undefined;

            const meshColor = decompressColor(DTXData.eachMeshMaterialAttributes.subarray((meshIndex * 6), (meshIndex * 6) + 3));
            const meshOpacity = DTXData.eachMeshMaterialAttributes[(meshIndex * 6) + 3] / 255.0;
            const meshMetallic = DTXData.eachMeshMaterialAttributes[(meshIndex * 6) + 4] / 255.0;
            const meshRoughness = DTXData.eachMeshMaterialAttributes[(meshIndex * 6) + 5] / 255.0;

            const meshId = `mesh-${nextMeshId++}`;
            const meshMatrixIndex = DTXData.eachMeshMatricesPortion[meshIndex];
            const meshMatrix = DTXData.matrices.slice(meshMatrixIndex, meshMatrixIndex + 16);

            const geometryId = `geometry.${geometryIndex}`;

            if (!geometryCreated[geometryId]) {

                const geometryParams = <any>{
                    geometryBuckets: []
                };

                geometryParams.primitive = DTXData.eachGeometryPrimitiveType[geometryIndex];
                const geometryDecodeMatrixIndex = DTXData.eachGeometryDecodeMatricesPortion[geometryIndex];
                geometryParams.positionsDecompressMatrix = DTXData.eachGeometryDecodeMatricesPortion.slice(geometryDecodeMatrixIndex, geometryDecodeMatrixIndex + 16);

                let geometryValid = false;

                // Iterate each geometry's buckets

                const firstBucketIndex = DTXData.eachGeometryBucketPortion[geometryIndex];
                const atLastBucket = (firstBucketIndex === (numBuckets - 1));
                const lastBucketIndex = atLastBucket ? (DTXData.eachMeshGeometriesPortion.length - 1) : (DTXData.eachObjectMeshesPortion[objectIndex + 1] - 1);

                for (let bucketIndex = firstBucketIndex; bucketIndex <= lastBucketIndex; bucketIndex++) {

                    const geometryBucketParams = <SceneGeometryBucketParams>{
                        positionsCompressed: [],
                        indices: []
                    };

                    const geometryIndicesBitness = DTXData.eachBucketIndicesBitness[bucketIndex];
                    const indices = geometryIndicesBitness === 8 ? DTXData.indices8Bit : (geometryIndicesBitness === 16 ? DTXData.indices16Bit : DTXData.indices32Bit);
                    const edgeIndices = geometryIndicesBitness === 8 ? DTXData.edgeIndices8Bit : (geometryIndicesBitness === 16 ? DTXData.edgeIndices16Bit : DTXData.edgeIndices32Bit);

                    let bucketValid = false;

                    switch (geometryParams.primitive) {

                        case TrianglesPrimitive:
                            geometryBucketParams.positionsCompressed = DTXData.positions.subarray(DTXData.eachBucketPositionsPortion [bucketIndex], atLastBucket ? DTXData.positions.length : DTXData.eachBucketPositionsPortion [bucketIndex + 1]);
                            //   geometryBucketParams.uvsCompressed = DTXData.uvs.subarray(DTXData.eachBucketUVsPortion [bucketIndex], atLastBucket ? DTXData.uvs.length : DTXData.eachBucketUVsPortion [bucketIndex + 1]);
                            geometryBucketParams.indices = indices.subarray(DTXData.eachBucketIndicesPortion [bucketIndex], atLastBucket ? indices.length : DTXData.eachBucketIndicesPortion [bucketIndex + 1]);
                            geometryBucketParams.edgeIndices = edgeIndices.subarray(DTXData.eachBucketEdgeIndicesPortion [bucketIndex], atLastBucket ? edgeIndices.length : DTXData.eachBucketEdgeIndicesPortion [bucketIndex + 1]);
                            bucketValid = (geometryBucketParams.positionsCompressed.length > 0 && geometryBucketParams.indices.length > 0);
                            break;

                        case PointsPrimitive:
                            geometryBucketParams.positionsCompressed = DTXData.positions.subarray(DTXData.eachBucketPositionsPortion [bucketIndex], atLastBucket ? DTXData.positions.length : DTXData.eachBucketPositionsPortion [bucketIndex + 1]);
                            // geometryBucketParams.colorsCompressed = DTXData.positions.subarray(DTXData.eachBucketPositionsPortion [bucketIndex], atLastBucket ? DTXData.positions.length : DTXData.eachBucketPositionsPortion [bucketIndex + 1]);
                            bucketValid = (geometryBucketParams.positionsCompressed.length > 0);
                            break;

                        case LinesPrimitive:
                            geometryBucketParams.positionsCompressed = DTXData.positions.subarray(DTXData.eachBucketPositionsPortion [bucketIndex], atLastBucket ? DTXData.positions.length : DTXData.eachBucketPositionsPortion [bucketIndex + 1]);
                            geometryBucketParams.indices = indices.subarray(DTXData.eachBucketIndicesPortion [bucketIndex], atLastBucket ? indices.length : DTXData.eachBucketIndicesPortion [bucketIndex + 1]);
                            bucketValid = (geometryBucketParams.positionsCompressed.length > 0 && geometryBucketParams.indices.length > 0);
                            break;
                        default:
                            continue;
                    }
                    if (bucketValid) {
                        geometryParams.geometryBuckets.push(geometryBucketParams);
                    }
                }

                if (geometryParams.geometryBuckets.length > 0) {
                    sceneModel.createGeometryCompressed(<SceneGeometryCompressedParams>geometryParams);
                    geometryCreated[geometryId] = true;
                }
            }

            sceneModel.createMesh({
                id: meshId,
                geometryId,
                textureSetId,
                matrix: meshMatrix,
                color: meshColor,
                metallic: meshMetallic,
                roughness: meshRoughness,
                opacity: meshOpacity
            });
            meshIds.push(meshId);
        }

        if (meshIds.length > 0) {
            sceneModel.createObject({
                id: objectId,
                meshIds: meshIds
            });
        }
    }
}

const decompressColor = (function () {
    const floatColor = new Float32Array(3);
    return function (intColor: FloatArrayParam) {
        floatColor[0] = intColor[0] / 255.0;
        floatColor[1] = intColor[1] / 255.0;
        floatColor[2] = intColor[2] / 255.0;
        return floatColor;
    };
})();

