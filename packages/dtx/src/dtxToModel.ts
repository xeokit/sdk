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
import type {SceneGeometryBucketParams, SceneGeometryCompressedParams, SceneModel} from "@xeokit/scene";
import type {DTXData} from "./DTXData";
import type {FloatArrayParam} from "@xeokit/math";

const NUM_TEXTURE_ATTRIBUTES = 9;

/**
 * @private
 */
export function dtxToModel(params: {
    dtxData: DTXData,
    sceneModel: SceneModel,
    dataModel?: DataModel
}): void {

    const dtxData = params.dtxData;
    const sceneModel = params.sceneModel;
    const dataModel = params.dataModel;

    if (dataModel) {
        if (dtxData.metadata) {
            dataModel.fromJSON(<DataModelParams>dtxData.metadata);
        }
    }

    const numTextures = dtxData.eachTextureDataPortion.length;
    const numTextureSets = dtxData.eachTextureSetTextures.length / 5;
    const numBuckets = dtxData.eachBucketPositionsPortion.length;
    const numMeshes = dtxData.eachMeshGeometriesPortion.length;
    const numObjects = dtxData.eachObjectMeshesPortion.length;
    const numGeometries = dtxData.eachGeometryDecodeMatricesPortion.length;

    let nextMeshId = 0;

    const geometryCreated: {
        [key: string]: boolean
    } = {};

    // Create textures

    for (let textureIndex = 0; textureIndex < numTextures; textureIndex++) {

        const atLastTexture = (textureIndex === (numTextures - 1));
        const textureDataPortionStart = dtxData.eachTextureDataPortion[textureIndex];
        const textureDataPortionEnd = atLastTexture ? dtxData.textureData.length : (dtxData.eachTextureDataPortion[textureIndex + 1]);
        const textureDataPortionSize = textureDataPortionEnd - textureDataPortionStart;
        const textureDataPortionExists = (textureDataPortionSize > 0);
        const textureAttrBaseIdx = (textureIndex * NUM_TEXTURE_ATTRIBUTES);

        const compressed = (dtxData.eachTextureAttributes[textureAttrBaseIdx] === 1);
        const mediaType = dtxData.eachTextureAttributes[textureAttrBaseIdx + 1];
        const width = dtxData.eachTextureAttributes[textureAttrBaseIdx + 2];
        const height = dtxData.eachTextureAttributes[textureAttrBaseIdx + 3];
        const minFilter = dtxData.eachTextureAttributes[textureAttrBaseIdx + 4];
        const magFilter = dtxData.eachTextureAttributes[textureAttrBaseIdx + 5]; // LinearFilter | NearestFilter
        const wrapS = dtxData.eachTextureAttributes[textureAttrBaseIdx + 6]; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
        const wrapT = dtxData.eachTextureAttributes[textureAttrBaseIdx + 7]; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
        const wrapR = dtxData.eachTextureAttributes[textureAttrBaseIdx + 8]; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping

        if (textureDataPortionExists) {

            const imageDataSubarray = new Uint8Array(dtxData.textureData.subarray(textureDataPortionStart, textureDataPortionEnd));
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
        const colorTextureIndex = dtxData.eachTextureSetTextures[eachTextureSetTexturesIndex];
        const metallicRoughnessTextureIndex = dtxData.eachTextureSetTextures[eachTextureSetTexturesIndex + 1];
        const normalsTextureIndex = dtxData.eachTextureSetTextures[eachTextureSetTexturesIndex + 2];
        const emissiveTextureIndex = dtxData.eachTextureSetTextures[eachTextureSetTexturesIndex + 3];
        const occlusionTextureIndex = dtxData.eachTextureSetTextures[eachTextureSetTexturesIndex + 4];

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

        const objectId = dtxData.eachObjectId[objectIndex];
        const finalObjectIndex = (numObjects - 1);
        const atLastObject = (objectIndex === finalObjectIndex);
        const firstMeshIndex = dtxData.eachObjectMeshesPortion [objectIndex];
        const lastMeshIndex = atLastObject ? (dtxData.eachMeshGeometriesPortion.length - 1) : (dtxData.eachObjectMeshesPortion[objectIndex + 1] - 1);

        const meshIds = [];

        // Iterate each object's meshes

        for (let meshIndex = firstMeshIndex; meshIndex <= lastMeshIndex; meshIndex++) {

            const geometryIndex = dtxData.eachMeshGeometriesPortion[meshIndex];
            const atLastGeometry = (geometryIndex === (numGeometries - 1));
            const textureSetIndex = dtxData.eachMeshTextureSet[meshIndex];
            const textureSetId = (textureSetIndex >= 0) ? `textureSet-${textureSetIndex}` : undefined;

            const meshColor = decompressColor(dtxData.eachMeshMaterialAttributes.subarray((meshIndex * 6), (meshIndex * 6) + 3));
            const meshOpacity = dtxData.eachMeshMaterialAttributes[(meshIndex * 6) + 3] / 255.0;
            const meshMetallic = dtxData.eachMeshMaterialAttributes[(meshIndex * 6) + 4] / 255.0;
            const meshRoughness = dtxData.eachMeshMaterialAttributes[(meshIndex * 6) + 5] / 255.0;

            const meshId = dtxData.eachMeshId[meshIndex];
            const meshMatrixIndex = dtxData.eachMeshMatricesPortion[meshIndex];
            const meshMatrix = dtxData.matrices.slice(meshMatrixIndex, meshMatrixIndex + 16);

            const meshOriginsIndex = dtxData.eachMeshOriginsPortion[meshIndex];
            const meshOrigin = dtxData.origins.slice(meshOriginsIndex, meshOriginsIndex + 3);

            const geometryId = dtxData.eachGeometryId[geometryIndex];

            if (!geometryCreated[geometryId]) {

                const geometryCompressedParams = <any>{
                    id: geometryId,
                    geometryBuckets: []
                };

                const primitiveType = dtxData.eachGeometryPrimitiveType[geometryIndex];
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

                const geometryDecodeMatrixIndex = dtxData.eachGeometryDecodeMatricesPortion[geometryIndex];
                geometryCompressedParams.positionsDecompressMatrix = dtxData.decodeMatrices.slice(geometryDecodeMatrixIndex, geometryDecodeMatrixIndex + 16);

                let geometryValid = false;

                // Iterate each geometry's buckets

                const firstBucketIndex = dtxData.eachGeometryBucketPortion[geometryIndex];
                const atLastGeometry = (geometryIndex === (numGeometries - 1));
                const lastBucketIndex = atLastGeometry ? (dtxData.eachBucketPositionsPortion.length - 1) : (dtxData.eachGeometryBucketPortion[geometryIndex + 1] - 1);

                for (let bucketIndex = firstBucketIndex; bucketIndex <= lastBucketIndex; bucketIndex++) {

                    const geometryBucketParams = <SceneGeometryBucketParams>{
                        positionsCompressed: [],
                        indices: []
                    };

                    const atLastBucketIndex = bucketIndex === lastBucketIndex;

                    const geometryIndicesBitness = dtxData.eachBucketIndicesBitness[bucketIndex];
                    const indices = geometryIndicesBitness === 0 ? dtxData.indices8Bit : (geometryIndicesBitness === 1 ? dtxData.indices16Bit : dtxData.indices32Bit);
                    const edgeIndices = geometryIndicesBitness === 8 ? dtxData.edgeIndices8Bit : (geometryIndicesBitness === 16 ? dtxData.edgeIndices16Bit : dtxData.edgeIndices32Bit);

                    let bucketValid = false;

                    switch (geometryCompressedParams.primitive) {

                        case TrianglesPrimitive:
                            geometryBucketParams.positionsCompressed = dtxData.positions.subarray(dtxData.eachBucketPositionsPortion [bucketIndex], atLastBucketIndex ? dtxData.positions.length : dtxData.eachBucketPositionsPortion [bucketIndex + 1]);
                            //   geometryBucketParams.uvsCompressed = dtxData.uvs.subarray(dtxData.eachBucketUVsPortion [bucketIndex], atLastBucket ? dtxData.uvs.length : dtxData.eachBucketUVsPortion [bucketIndex + 1]);
                            geometryBucketParams.indices = indices.subarray(dtxData.eachBucketIndicesPortion [bucketIndex], atLastBucketIndex ? indices.length : dtxData.eachBucketIndicesPortion [bucketIndex + 1]);
                            geometryBucketParams.edgeIndices = edgeIndices.subarray(dtxData.eachBucketEdgeIndicesPortion [bucketIndex], atLastBucketIndex ? edgeIndices.length : dtxData.eachBucketEdgeIndicesPortion [bucketIndex + 1]);
                            bucketValid = (geometryBucketParams.positionsCompressed.length > 0 && geometryBucketParams.indices.length > 0);
                            break;

                        case PointsPrimitive:
                            geometryBucketParams.positionsCompressed = dtxData.positions.subarray(dtxData.eachBucketPositionsPortion [bucketIndex], atLastBucketIndex ? dtxData.positions.length : dtxData.eachBucketPositionsPortion [bucketIndex + 1]);
                            // geometryBucketParams.colorsCompressed = dtxData.positions.subarray(dtxData.eachBucketPositionsPortion [bucketIndex], atLastBucket ? dtxData.positions.length : dtxData.eachBucketPositionsPortion [bucketIndex + 1]);
                            bucketValid = (geometryBucketParams.positionsCompressed.length > 0);
                            break;

                        case LinesPrimitive:
                            geometryBucketParams.positionsCompressed = dtxData.positions.subarray(dtxData.eachBucketPositionsPortion [bucketIndex], atLastBucketIndex ? dtxData.positions.length : dtxData.eachBucketPositionsPortion [bucketIndex + 1]);
                            geometryBucketParams.indices = indices.subarray(dtxData.eachBucketIndicesPortion [bucketIndex], atLastBucketIndex ? indices.length : dtxData.eachBucketIndicesPortion [bucketIndex + 1]);
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
                    sceneModel.createGeometryCompressed(<SceneGeometryCompressedParams>geometryCompressedParams);
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
                opacity: meshOpacity,
                origin: meshOrigin
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

