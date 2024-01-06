import {
    JPEGMediaType,
    LinesPrimitive,
    PNGMediaType,
    PointsPrimitive,
    SolidPrimitive,
    SurfacePrimitive,
    TrianglesPrimitive
} from "@xeokit/constants";
import type {DataModel, DataModelParams} from "@xeokit/data";
import type {GeometryBucketParams, GeometryCompressedParams, SceneModel} from "@xeokit/scene";
import type {XKTData} from "./XKTData";
import type {FloatArrayParam} from "@xeokit/math";

const NUM_TEXTURE_ATTRIBUTES = 9;

/**
 * @private
 */
export function xktToModel(params: {
    xktData: XKTData,
    sceneModel: SceneModel,
    dataModel?: DataModel
}): void {

    const xktData = params.xktData;
    const sceneModel = params.sceneModel;
    const dataModel = params.dataModel;

    if (dataModel) {
        if (xktData.metadata && xktData.metadata.length > 0) {
            dataModel.fromJSON(<DataModelParams>xktData.metadata[0]);
        }
    }

    const numTextures = xktData.eachTextureDataPortion.length;
    const numTextureSets = xktData.eachTextureSetTextures.length / 5;
    const numBuckets = xktData.eachBucketPositionsPortion.length;
    const numMeshes = xktData.eachMeshGeometriesPortion.length;
    const numObjects = xktData.eachObjectMeshesPortion.length;
    const numGeometries = xktData.eachGeometryDecodeMatricesPortion.length;

    let nextMeshId = 0;

    const geometryCreated: {
        [key: string]: boolean
    } = {};

    // Create textures

    for (let textureIndex = 0; textureIndex < numTextures; textureIndex++) {

        const atLastTexture = (textureIndex === (numTextures - 1));
        const textureDataPortionStart = xktData.eachTextureDataPortion[textureIndex];
        const textureDataPortionEnd = atLastTexture ? xktData.textureData.length : (xktData.eachTextureDataPortion[textureIndex + 1]);
        const textureDataPortionSize = textureDataPortionEnd - textureDataPortionStart;
        const textureDataPortionExists = (textureDataPortionSize > 0);
        const textureAttrBaseIdx = (textureIndex * NUM_TEXTURE_ATTRIBUTES);

        const compressed = (xktData.eachTextureAttributes[textureAttrBaseIdx] === 1);
        const mediaType = xktData.eachTextureAttributes[textureAttrBaseIdx + 1];
        const width = xktData.eachTextureAttributes[textureAttrBaseIdx + 2];
        const height = xktData.eachTextureAttributes[textureAttrBaseIdx + 3];
        const minFilter = xktData.eachTextureAttributes[textureAttrBaseIdx + 4];
        const magFilter = xktData.eachTextureAttributes[textureAttrBaseIdx + 5]; // LinearFilter | NearestFilter
        const wrapS = xktData.eachTextureAttributes[textureAttrBaseIdx + 6]; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
        const wrapT = xktData.eachTextureAttributes[textureAttrBaseIdx + 7]; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
        const wrapR = xktData.eachTextureAttributes[textureAttrBaseIdx + 8]; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping

        if (textureDataPortionExists) {

            const imageDataSubarray = new Uint8Array(xktData.textureData.subarray(textureDataPortionStart, textureDataPortionEnd));
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
        const colorTextureIndex = xktData.eachTextureSetTextures[eachTextureSetTexturesIndex];
        const metallicRoughnessTextureIndex = xktData.eachTextureSetTextures[eachTextureSetTexturesIndex + 1];
        const normalsTextureIndex = xktData.eachTextureSetTextures[eachTextureSetTexturesIndex + 2];
        const emissiveTextureIndex = xktData.eachTextureSetTextures[eachTextureSetTexturesIndex + 3];
        const occlusionTextureIndex = xktData.eachTextureSetTextures[eachTextureSetTexturesIndex + 4];

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

        const objectId = xktData.eachObjectId[objectIndex];
        const finalObjectIndex = (numObjects - 1);
        const atLastObject = (objectIndex === finalObjectIndex);
        const firstMeshIndex = xktData.eachObjectMeshesPortion [objectIndex];
        const lastMeshIndex = atLastObject ? (xktData.eachMeshGeometriesPortion.length - 1) : (xktData.eachObjectMeshesPortion[objectIndex + 1] - 1);

        const meshIds = [];

        // Iterate each object's meshes

        for (let meshIndex = firstMeshIndex; meshIndex <= lastMeshIndex; meshIndex++) {

            const geometryIndex = xktData.eachMeshGeometriesPortion[meshIndex];
            const atLastGeometry = (geometryIndex === (numGeometries - 1));
            const textureSetIndex = xktData.eachMeshTextureSet[meshIndex];
            const textureSetId = (textureSetIndex >= 0) ? `textureSet-${textureSetIndex}` : undefined;

            const meshColor = decompressColor(xktData.eachMeshMaterialAttributes.subarray((meshIndex * 6), (meshIndex * 6) + 3));
            const meshOpacity = xktData.eachMeshMaterialAttributes[(meshIndex * 6) + 3] / 255.0;
            const meshMetallic = xktData.eachMeshMaterialAttributes[(meshIndex * 6) + 4] / 255.0;
            const meshRoughness = xktData.eachMeshMaterialAttributes[(meshIndex * 6) + 5] / 255.0;

            const meshId = xktData.eachMeshId[meshIndex];
            const meshMatrixIndex = xktData.eachMeshMatricesPortion[meshIndex];
            const meshMatrix = xktData.matrices.slice(meshMatrixIndex, meshMatrixIndex + 16);

            const geometryId = xktData.eachGeometryId[geometryIndex];

            if (!geometryCreated[geometryId]) {

                const geometryCompressedParams = <any>{
                    id: geometryId,
                    geometryBuckets: []
                };

                const primitiveType = xktData.eachGeometryPrimitiveType[geometryIndex];
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

                const geometryDecodeMatrixIndex = xktData.eachGeometryDecodeMatricesPortion[geometryIndex];
                geometryCompressedParams.positionsDecompressMatrix = xktData.decodeMatrices.slice(geometryDecodeMatrixIndex, geometryDecodeMatrixIndex + 16);

                let geometryValid = false;

                // Iterate each geometry's buckets

                const firstBucketIndex = xktData.eachGeometryBucketPortion[geometryIndex];
                const atLastGeometry = (geometryIndex === (numGeometries - 1));
                const lastBucketIndex = atLastGeometry ? (xktData.eachBucketPositionsPortion.length - 1) : (xktData.eachGeometryBucketPortion[geometryIndex + 1] - 1);

                for (let bucketIndex = firstBucketIndex; bucketIndex <= lastBucketIndex; bucketIndex++) {

                    const geometryBucketParams = <GeometryBucketParams>{
                        positionsCompressed: [],
                        indices: []
                    };

                    const atLastBucketIndex = bucketIndex === lastBucketIndex;

                    const geometryIndicesBitness = xktData.eachBucketIndicesBitness[bucketIndex];
                    const indices = geometryIndicesBitness === 0 ? xktData.indices8Bit : (geometryIndicesBitness === 1 ? xktData.indices16Bit : xktData.indices32Bit);
                    const edgeIndices = geometryIndicesBitness === 8 ? xktData.edgeIndices8Bit : (geometryIndicesBitness === 16 ? xktData.edgeIndices16Bit : xktData.edgeIndices32Bit);

                    let bucketValid = false;

                    switch (geometryCompressedParams.primitive) {

                        case TrianglesPrimitive:
                            geometryBucketParams.positionsCompressed = xktData.positions.subarray(xktData.eachBucketPositionsPortion [bucketIndex], atLastBucketIndex ? xktData.positions.length : xktData.eachBucketPositionsPortion [bucketIndex + 1]);
                            //   geometryBucketParams.uvsCompressed = xktData.uvs.subarray(xktData.eachBucketUVsPortion [bucketIndex], atLastBucket ? xktData.uvs.length : xktData.eachBucketUVsPortion [bucketIndex + 1]);
                            geometryBucketParams.indices = indices.subarray(xktData.eachBucketIndicesPortion [bucketIndex], atLastBucketIndex ? indices.length : xktData.eachBucketIndicesPortion [bucketIndex + 1]);
                            geometryBucketParams.edgeIndices = edgeIndices.subarray(xktData.eachBucketEdgeIndicesPortion [bucketIndex], atLastBucketIndex ? edgeIndices.length : xktData.eachBucketEdgeIndicesPortion [bucketIndex + 1]);
                            bucketValid = (geometryBucketParams.positionsCompressed.length > 0 && geometryBucketParams.indices.length > 0);
                            break;

                        case PointsPrimitive:
                            geometryBucketParams.positionsCompressed = xktData.positions.subarray(xktData.eachBucketPositionsPortion [bucketIndex], atLastBucketIndex ? xktData.positions.length : xktData.eachBucketPositionsPortion [bucketIndex + 1]);
                            // geometryBucketParams.colorsCompressed = xktData.positions.subarray(xktData.eachBucketPositionsPortion [bucketIndex], atLastBucket ? xktData.positions.length : xktData.eachBucketPositionsPortion [bucketIndex + 1]);
                            bucketValid = (geometryBucketParams.positionsCompressed.length > 0);
                            break;

                        case LinesPrimitive:
                            geometryBucketParams.positionsCompressed = xktData.positions.subarray(xktData.eachBucketPositionsPortion [bucketIndex], atLastBucketIndex ? xktData.positions.length : xktData.eachBucketPositionsPortion [bucketIndex + 1]);
                            geometryBucketParams.indices = indices.subarray(xktData.eachBucketIndicesPortion [bucketIndex], atLastBucketIndex ? indices.length : xktData.eachBucketIndicesPortion [bucketIndex + 1]);
                            bucketValid = (geometryBucketParams.positionsCompressed.length > 0 && geometryBucketParams.indices.length > 0);
                            break;
                        default:
                            continue;
                    }
                    if (bucketValid) {
                        geometryCompressedParams.geometryBuckets.push(geometryBucketParams);
                    }
                }

                if (geometryCompressedParams.geometryBuckets.length > 0) {
                    sceneModel.createGeometryCompressed(<GeometryCompressedParams>geometryCompressedParams);
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
        floatColor[0] = intColor[0] / 255;
        floatColor[1] = intColor[1] / 255;
        floatColor[2] = intColor[2] / 255;
        return floatColor;
    };
})();

