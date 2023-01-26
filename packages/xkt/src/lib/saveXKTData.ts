import {XKT_INFO} from "../XKT_INFO";
import {XKTData} from "./XKTData";
import {ReadableModel} from "@xeokit/core/components";


const XKT_VERSION = XKT_INFO.xktVersion;
const NUM_TEXTURE_ATTRIBUTES = 9;
const NUM_MATERIAL_ATTRIBUTES = 6;

// export function saveXKTData(readableModel: ScratchModel, metaModelJSON: any, stats = {
//     texturesSize: 0
// }): ArrayBuffer {
//     const data = getData(readableModel, metaModelJSON, stats);
//     const deflatedData = deflateData(data, metaModelJSON);
//     stats.texturesSize += deflatedData.textureData.byteLength;
//     const arrayBuffer = createArrayBuffer(deflatedData);
//     return arrayBuffer;
// }

/**
 * Saves an {@link ReadableModel} to an {@link XKTData}.
 *
 * @param readableModel
 * @param metaModelDataStr
 * @param stats
 */
export function saveXKTData(readableModel: ReadableModel, metaModelDataStr, stats): XKTData {

    const geometriesList = Object.values(readableModel.geometries);
    const texturesList = Object.values(readableModel.texturesList);
    const textureSetsList = Object.values(readableModel.textureSetsList);
    const meshesList = Object.values(readableModel.meshesList);
    const objectsList = Object.values(readableModel.objectsList);

    const numGeometries = geometriesList.length;
    const numTextures = texturesList.length;
    const numTextureSets = textureSetsList.length;
    const numMeshes = meshesList.length;
    const numObjects = objectsList.length;

    let lenBuckets = 0;
    let lenPositions = 0;
    let lenColors = 0;
    let lenUVs = 0;
    let lenIndices8Bit = 0;
    let lenIndices16Bit = 0;
    let lenIndices32Bit = 0;
    let lenEdgeIndices8Bit = 0;
    let lenEdgeIndices16Bit = 0;
    let lenEdgeIndices32Bit = 0;
    let lenMatrices = 0;
    let lenTextures = 0;
    let lenDecodeMatrices = 0;

    const geometryIndices: { [key: string]: number } = {};
    const textureIndices: { [key: string]: number } = {};
    const textureSetIndices: { [key: string]: number } = {};
    const meshIndices: { [key: string]: number } = {};


    for (let geometryIndex = 0; geometryIndex < numGeometries; geometryIndex++) {
        const geometry = geometriesList [geometryIndex];
        const geometryBuckets = geometry.geometryBuckets;
        lenBuckets += geometryBuckets.length;
        for (let i = 0, len = geometryBuckets.length; i < len; i++) {
            const geometryBucket = geometryBuckets[i];
            if (geometryBucket.positionsCompressed) {
                const numPositions = geometryBucket.positionsCompressed.length / 3;
                lenPositions += geometryBucket.positionsCompressed.length;
                if (geometryBucket.indices) {
                    if (numPositions <= (1 << 8)) {
                        lenIndices8Bit += geometryBucket.indices.length;
                    } else if (numPositions <= (1 << 16)) {
                        lenIndices16Bit += geometryBucket.indices.length;
                    } else {
                        lenIndices32Bit += geometryBucket.indices.length;
                    }
                }
                if (geometryBucket.edgeIndices) {
                    if (numPositions <= (1 << 8)) {
                        lenEdgeIndices8Bit += geometryBucket.edgeIndices.length;
                    } else if (numPositions <= (1 << 16)) {
                        lenEdgeIndices16Bit += geometryBucket.edgeIndices.length;
                    } else {
                        lenEdgeIndices32Bit += geometryBucket.edgeIndices.length;
                    }
                }
                if (geometryBucket.uvsCompressed) {
                    lenUVs += geometryBucket.uvsCompressed.length;
                }
            }
        }
    }

    for (let textureIndex = 0; textureIndex < numTextures; textureIndex++) {
        const texture = texturesList[textureIndex];
        const imageData = texture.imageData;
        lenTextures += imageData.byteLength;
        if (texture.compressed) {
            stats.numCompressedTextures++;
        }
    }

    const dataInflated: XKTData = {
        metadata: {},
        textureData: new Uint8Array(lenTextures), // All textures
        eachTextureDataPortion: new Uint32Array(numTextures), // For each texture, an index to its first element in textureData
        eachTextureAttributes: new Uint16Array(numTextures * NUM_TEXTURE_ATTRIBUTES),
        positions: new Uint16Array(lenPositions), // All geometry arrays
        colors: new Uint8Array(lenColors),
        uvs: new Float32Array(lenUVs),
        indices8Bit: new Uint8Array(lenIndices8Bit),
        indices16Bit: new Uint16Array(lenIndices16Bit),
        indices32Bit: new Uint32Array(lenIndices32Bit),
        edgeIndices8Bit: new Uint8Array(lenEdgeIndices8Bit),
        edgeIndices16Bit: new Uint16Array(lenEdgeIndices16Bit),
        edgeIndices32Bit: new Uint32Array(lenEdgeIndices32Bit),
        eachTextureSetTextures: new Int32Array(numTextureSets * 5), // For each texture set, a set of five Texture indices [color, metal/roughness,normals,emissive,occlusion]; each index has value -1 if no texture
        decodeMatrices: new Float32Array(lenDecodeMatrices), // TODO
        eachBucketPositionsPortion: new Uint32Array(lenBuckets), // For each geometry, an index to its first element in dataInflated.positions. Every primitive type has positions.
        eachBucketColorsPortion: new Uint32Array(lenBuckets), // For each geometry, an index to its first element in dataInflated.colors. If the next geometry has the same index, then this geometry has no colors.
        eachBucketUVsPortion: new Uint32Array(lenBuckets), // For each geometry, an index to its first element in dataInflated.uvs. If the next geometry has the same index, then this geometry has no UVs.
        eachBucketIndicesPortion: new Uint32Array(lenBuckets), // For each geometry, an index to its first element in dataInflated.indices. If the next geometry has the same index, then this geometry has no indices.
        eachBucketEdgeIndicesPortion: new Uint32Array(lenBuckets), // For each geometry, an index to its first element in dataInflated.edgeIndices. If the next geometry has the same index, then this geometry has no edge indices.
        eachBucketIndicesBitness: new Uint8Array(lenBuckets), // TODO
        eachGeometryPrimitiveType: new Uint8Array(numGeometries), // Primitive type for each geometry (0=solid triangles, 1=surface triangles, 2=lines, 3=points)
        eachGeometryBucketPortion: new Uint32Array(numGeometries), // TODO

        // TODO: needs to be the AABB of each geometry
        eachGeometryDecodeMatricesPortion: new Uint32Array(numGeometries), // TODO
        matrices: new Float32Array(lenMatrices), // Modeling matrices for objects that share geometries. Each object either shares all it's geometries, or owns all its geometries exclusively. Exclusively-owned geometries are pre-transformed into World-space, and so their objects don't have modeling matrices in this array.
        eachMeshGeometriesPortion: new Uint32Array(numMeshes), // For each mesh, an index into the eachGeometry* arrays
        eachMeshMatricesPortion: new Uint32Array(numMeshes), // For each mesh that shares its geometry, an index to its first element in dataInflated.matrices, to indicate the modeling matrix that transforms the shared geometry Local-space vertex positions. This is ignored for meshes that don't share geometries, because the vertex positions of non-shared geometries are pre-transformed into World-space.
        eachMeshTextureSet: new Uint32Array(numMeshes), // For each mesh, the index of its texture set in dataInflated.eachTextureSetTextures; this array contains signed integers so that we can use -1 to indicate when a mesh has no texture set
        eachMeshMaterialAttributes: new Uint8Array(numMeshes * NUM_MATERIAL_ATTRIBUTES), // For each mesh, an RGBA integer color of format [0..255, 0..255, 0..255, 0..255], and PBR metallic and roughness factors, of format [0..255, 0..255]
        eachObjectId: [], // For each object, an ID string
        eachObjectMeshesPortion: new Uint32Array(numObjects) // For each object, the index of the first element of meshes used by the object
    };

    let countBuckets = 0;
    let countPositions = 0;
    let countColors = 0;
    let countUVs = 0;
    let countIndices8Bit = 0;
    let countIndices16Bit = 0;
    let countIndices32Bit = 0;
    let countEdgeIndices8Bit = 0;
    let countEdgeIndices16Bit = 0;
    let countEdgeIndices32Bit = 0;
    let countDecodeMatrices = 0;

    // Geometries and buckets

    let geometryIndex = 0;

    for (let geometryId in readableModel.geometries) {

        const geometry = readableModel.geometries[geometryId];
        const geometryBuckets = geometry.geometryBuckets;

        dataInflated.eachGeometryPrimitiveType [geometryIndex] = geometry.primitive;
        dataInflated.eachGeometryBucketPortion [geometryIndex] = countBuckets;
        dataInflated.eachGeometryDecodeMatricesPortion [geometryIndex] = countDecodeMatrices;

        dataInflated.decodeMatrices.set(geometry.positionsDecompressMatrix, countDecodeMatrices); // TODO: only add decode matrix if different from what's already added
        countDecodeMatrices += 16;

        for (let i = 0, len = geometryBuckets.length; i < len; i++) {

            const geometryBucket = geometryBuckets[i];
            const lenBucketPositions = geometryBucket.positionsCompressed.length;
            const numBucketPositions = lenBucketPositions / 3;
            const bucketIndicesBitness: number = (numBucketPositions <= (1 << 8)) ? 0 : ((numBucketPositions <= (1 << 16)) ? 1 : 2);

            dataInflated.eachBucketPositionsPortion [countBuckets] = countPositions;
            dataInflated.eachBucketColorsPortion [countBuckets] = countColors;
            dataInflated.eachBucketUVsPortion [countBuckets] = countUVs;
            dataInflated.eachBucketIndicesBitness [countBuckets] = bucketIndicesBitness;

            dataInflated.positions.set(geometryBucket.positionsCompressed, countPositions);
            countPositions += geometryBucket.positionsCompressed.length;

            if (geometryBucket.indices) {
                switch (bucketIndicesBitness) {
                    case 0:
                        dataInflated.indices8Bit.set(geometryBucket.indices, countIndices8Bit);
                        dataInflated.eachBucketIndicesPortion [geometryIndex] = countIndices8Bit;
                        countIndices8Bit += geometryBucket.indices.length;
                        break;
                    case 1:
                        dataInflated.indices16Bit.set(geometryBucket.indices, countIndices16Bit);
                        dataInflated.eachBucketIndicesPortion [geometryIndex] = countIndices16Bit;
                        countIndices16Bit += geometryBucket.indices.length;
                        break;
                    case 2:
                        dataInflated.indices32Bit.set(geometryBucket.indices, countIndices32Bit);
                        dataInflated.eachBucketIndicesPortion [geometryIndex] = countIndices32Bit;
                        countIndices32Bit += geometryBucket.indices.length;
                        break;
                }
            }

            if (geometryBucket.edgeIndices) {
                switch (bucketIndicesBitness) {
                    case 0:
                        dataInflated.edgeIndices8Bit.set(geometryBucket.edgeIndices, countEdgeIndices8Bit);
                        dataInflated.eachBucketEdgeIndicesPortion [geometryIndex] = countEdgeIndices8Bit;
                        countEdgeIndices8Bit += geometryBucket.edgeIndices.length;
                        break;
                    case 1:
                        dataInflated.edgeIndices16Bit.set(geometryBucket.edgeIndices, countEdgeIndices16Bit);
                        dataInflated.eachBucketEdgeIndicesPortion [geometryIndex] = countEdgeIndices16Bit;
                        countEdgeIndices16Bit += geometryBucket.edgeIndices.length;
                        break;
                    case 2:
                        dataInflated.edgeIndices32Bit.set(geometryBucket.edgeIndices, countEdgeIndices32Bit);
                        dataInflated.eachBucketEdgeIndicesPortion [geometryIndex] = countEdgeIndices32Bit;
                        countEdgeIndices32Bit += geometryBucket.edgeIndices.length;
                        break;
                }
            }

            if (geometryBucket.colorsCompressed) {
                dataInflated.colors.set(geometryBucket.colorsCompressed, countColors);
                countColors += geometryBucket.colorsCompressed.length;
            }

            if (geometryBucket.uvsCompressed) {
                dataInflated.uvs.set(geometryBucket.uvsCompressed, countUVs);
                countUVs += geometryBucket.uvsCompressed.length;
            }

            countBuckets++;
        }

        geometryIndices[geometry.geometryId] = geometryIndex;
        geometryIndex++;
    }

    // Textures

    for (let textureIndex = 0, numTextures = readableModel.texturesList.length, portionIdx = 0; textureIndex < numTextures; textureIndex++) {

        const texture = readableModel.texturesList[textureIndex];
        const imageData = texture.imageData;

        dataInflated.textureData.set(imageData, portionIdx);
        dataInflated.eachTextureDataPortion[textureIndex] = portionIdx;

        portionIdx += imageData.byteLength;

        let textureAttrIdx = textureIndex * NUM_TEXTURE_ATTRIBUTES;
        dataInflated.eachTextureAttributes[textureAttrIdx++] = texture.compressed ? 1 : 0;
        dataInflated.eachTextureAttributes[textureAttrIdx++] = texture.mediaType; // GIFMediaType | PNGMediaType | JPEGMediaType
        dataInflated.eachTextureAttributes[textureAttrIdx++] = texture.width;
        dataInflated.eachTextureAttributes[textureAttrIdx++] = texture.height;
        dataInflated.eachTextureAttributes[textureAttrIdx++] = texture.minFilter; // LinearMipmapLinearFilter | LinearMipMapNearestFilter | NearestMipMapNearestFilter | NearestMipMapLinearFilter | LinearMipMapLinearFilter
        dataInflated.eachTextureAttributes[textureAttrIdx++] = texture.magFilter; // LinearFilter | NearestFilter
        dataInflated.eachTextureAttributes[textureAttrIdx++] = texture.wrapS; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
        dataInflated.eachTextureAttributes[textureAttrIdx++] = texture.wrapT; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
        dataInflated.eachTextureAttributes[textureAttrIdx++] = texture.wrapR; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
    }

    // Texture sets

    for (let textureSetIndex = 0, numTextureSets = readableModel.textureSetsList.length, eachTextureSetTexturesIndex = 0; textureSetIndex < numTextureSets; textureSetIndex++) {
        const textureSet = textureSetsList[textureSetIndex];
        dataInflated.eachTextureSetTextures[eachTextureSetTexturesIndex++] = textureSet.colorTexture ? textureSet.colorTexture.textureIndex : -1; // Color map
        dataInflated.eachTextureSetTextures[eachTextureSetTexturesIndex++] = textureSet.metallicRoughnessTexture ? textureSet.metallicRoughnessTexture.textureIndex : -1; // Metal/rough map
        dataInflated.eachTextureSetTextures[eachTextureSetTexturesIndex++] = textureSet.normalsTexture ? textureSet.normalsTexture.textureIndex : -1; // Normal map
        dataInflated.eachTextureSetTextures[eachTextureSetTexturesIndex++] = textureSet.emissiveTexture ? textureSet.emissiveTexture.textureIndex : -1; // Emissive map
        dataInflated.eachTextureSetTextures[eachTextureSetTexturesIndex++] = textureSet.occlusionTexture ? textureSet.occlusionTexture.textureIndex : -1; // Occlusion map
    }

    // Meshes and objects

    let eachMeshMaterialAttributesIndex = 0;
    let matricesIndex = 0;
    let countMeshes = 0;

    for (let objectIndex = 0; objectIndex < numObjects; objectIndex++) {

        const object = objectsList[objectIndex];
        const numObjectMeshes = object.meshes.length;

        dataInflated.eachObjectId[objectIndex] = object.objectId;
        dataInflated.eachObjectMeshesPortion[objectIndex] = countMeshes;

        for (let meshIndex = 0; meshIndex < numObjectMeshes; meshIndex++) {

            const mesh = object.meshes[meshIndex];

            dataInflated.eachMeshGeometriesPortion [meshIndex] = geometryIndices[mesh.geometry.geometryId];
            ;
            dataInflated.eachMeshMatricesPortion [meshIndex] = matricesIndex;
            dataInflated.matrices.set(mesh.matrix, matricesIndex); // TODO: only add matrix if different from what's already added
            matricesIndex += 16;

            dataInflated.eachMeshTextureSet[meshIndex] = mesh.textureSet ? textureSetIndices[mesh.textureSet.textureSetId] : -1;

            dataInflated.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.color[0] * 255); // Color RGB
            dataInflated.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.color[1] * 255);
            dataInflated.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.color[2] * 255);
            dataInflated.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.opacity * 255); // Opacity
            dataInflated.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.metallic * 255); // Metallic
            dataInflated.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.roughness * 255); // Roughness
        }

        countMeshes += numObjectMeshes;
    }

    return dataInflated;
}

//
// function createArrayBuffer(deflatedData: XKTDataDeflated): ArrayBuffer {
//     return toArrayBuffer(<Buffer[]>[
//         deflatedData.metadata,
//         deflatedData.textureData,
//         deflatedData.eachTextureDataPortion,
//         deflatedData.eachTextureAttributes,
//         deflatedData.positions,
//         deflatedData.colors,
//         deflatedData.uvs,
//         deflatedData.indices8Bit,
//         deflatedData.indices16Bit,
//         deflatedData.indices32Bit,
//         deflatedData.edgeIndices8Bit,
//         deflatedData.edgeIndices16Bit,
//         deflatedData.edgeIndices32Bit,
//         deflatedData.eachTextureSetTextures,
//         deflatedData.decodeMatrices,
//         deflatedData.eachBucketPositionsPortion,
//         deflatedData.eachBucketColorsPortion,
//         deflatedData.eachBucketUVsPortion,
//         deflatedData.eachBucketIndicesPortion,
//         deflatedData.eachBucketEdgeIndicesPortion,
//         deflatedData.eachBucketIndicesBitness,
//         deflatedData.eachGeometryPrimitiveType,
//         deflatedData.eachGeometryBucketPortion,
//         deflatedData.eachGeometryDecodeMatricesPortion,
//         deflatedData.matrices,
//         deflatedData.eachMeshGeometriesPortion,
//         deflatedData.eachMeshMatricesPortion,
//         deflatedData.eachMeshTextureSet,
//         deflatedData.eachMeshMaterialAttributes,
//         deflatedData.eachObjectId,
//         deflatedData.eachObjectMeshesPortion
//     ]);
// }
//
// function toArrayBuffer(elements: Buffer[]): ArrayBuffer {
//     const indexData = new Uint32Array(elements.length + 2);
//     indexData[0] = XKT_VERSION;
//     indexData [1] = elements.length;  // Stored Data 1.1: number of stored elements
//     let dataLen = 0;    // Stored Data 1.2: length of stored elements
//     for (let i = 0, len = elements.length; i < len; i++) {
//         const element = elements[i];
//         const elementsize = element.length;
//         indexData[i + 2] = elementsize;
//         dataLen += elementsize;
//     }
//     const indexBuf = new Uint8Array(indexData.buffer);
//     const dataArray = new Uint8Array(indexBuf.length + dataLen);
//     dataArray.set(indexBuf);
//     let offset = indexBuf.length;
//     for (let i = 0, len = elements.length; i < len; i++) {     // Stored Data 2: the elements themselves
//         const element = elements[i];
//         dataArray.set(element, offset);
//         offset += element.length;
//     }
//     return dataArray.buffer;
// }

