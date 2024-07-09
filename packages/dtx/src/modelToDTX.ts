import type {SceneModel} from "@xeokit/scene";
import type {DataModel} from "@xeokit/data";
import {
    LinesPrimitive,
    PointsPrimitive,
    SolidPrimitive,
    SurfacePrimitive,
    TrianglesPrimitive
} from "@xeokit/constants";
import {DTX_INFO} from "./DTX_INFO";
import type {DTXData} from "./DTXData";

const DTX_VERSION = DTX_INFO.dtxVersion;
const NUM_TEXTURE_ATTRIBUTES = 9;
const NUM_MATERIAL_ATTRIBUTES = 6;

/**
 * @private
 */
export function modelToDTX(params: {
    sceneModel: SceneModel,
    dataModel?: DataModel
}): DTXData {

    const sceneModel = params.sceneModel;

    const geometriesList = Object.values(sceneModel.geometries);
    const meshesList = Object.values(sceneModel.meshes);
    const objectsList = Object.values(sceneModel.objects);

    const numGeometries = geometriesList.length;
    const numMeshes = meshesList.length;
    const numObjects = objectsList.length;

    let lenBuckets = 0;
    let lenPositions = 0;
    let lenColors = 0;
    let lenIndices8Bit = 0;
    let lenIndices16Bit = 0;
    let lenIndices32Bit = 0;
    let lenEdgeIndices8Bit = 0;
    let lenEdgeIndices16Bit = 0;
    let lenEdgeIndices32Bit = 0;
    let lenMatrices = numMeshes * 16;
    let lenDecodeMatrices = 0;
    let lenOrigins = 0;

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
                if (geometryBucket.colorsCompressed) {
                    lenColors += geometryBucket.colorsCompressed.length;
                }
            }
        }
    }

    const originExists = {};
    for (let meshIndex = 0; meshIndex < numMeshes; meshIndex++) {
        const mesh = meshesList [meshIndex];
        const originHash = `${mesh.origin[0]}-${mesh.origin[1]}-${mesh.origin[2]}`;
       if (!originExists[originHash]) {
            originExists[originHash] = true;
            lenOrigins++;
        }
    }


    lenDecodeMatrices = numGeometries * 16;

    const dtxData: DTXData = {
        positions: new Uint16Array(lenPositions),
        colors: new Uint8Array(lenColors),
        indices8Bit: new Uint8Array(lenIndices8Bit),
        indices16Bit: new Uint16Array(lenIndices16Bit),
        indices32Bit: new Uint32Array(lenIndices32Bit),
        edgeIndices8Bit: new Uint8Array(lenEdgeIndices8Bit),
        edgeIndices16Bit: new Uint16Array(lenEdgeIndices16Bit),
        edgeIndices32Bit: new Uint32Array(lenEdgeIndices32Bit),
        decodeMatrices: new Float32Array(lenDecodeMatrices), // TODO
        eachBucketPositionsPortion: new Uint32Array(lenBuckets), // For each geometry, an index to its first element in dtxData.positions. Every primitive type has positions.
        eachBucketColorsPortion: new Uint32Array(lenBuckets), // For each geometry, an index to its first element in dtxData.colors. If the next geometry has the same index, then this geometry has no colors.
        eachBucketIndicesPortion: new Uint32Array(lenBuckets), // For each geometry, an index to its first element in dtxData.indices. If the next geometry has the same index, then this geometry has no indices.
        eachBucketEdgeIndicesPortion: new Uint32Array(lenBuckets), // For each geometry, an index to its first element in dtxData.edgeIndices. If the next geometry has the same index, then this geometry has no edge indices.
        eachBucketIndicesBitness: new Uint8Array(lenBuckets), // TODO
        eachGeometryPrimitiveType: new Uint8Array(numGeometries), // Primitive type for each geometry (0=solid triangles, 1=surface triangles, 2=lines, 3=points)
        eachGeometryBucketPortion: new Uint32Array(numGeometries), // TODO
        eachGeometryDecodeMatricesPortion: new Uint32Array(numGeometries), // Positions dequantization matrices
        matrices: new Float32Array(numMeshes * 16), // Modeling matrices
        origins: new Float64Array(lenOrigins * 3), // Origins
        eachMeshGeometriesPortion: new Uint32Array(numMeshes), // For each mesh, an index into the eachGeometry* arrays
        eachMeshMatricesPortion: new Uint32Array(numMeshes), // For each mesh that shares its geometry, an index to its first element in dtxData.matrices, to indicate the modeling matrix that transforms the shared geometry Local-space vertex positions. This is ignored for meshes that don't share geometries, because the vertex positions of non-shared geometries are pre-transformed into World-space.
        eachMeshOriginsPortion: new Uint32Array(numMeshes), // For each mesh that shares its geometry, an index to its first element in dtxData.matrices, to indicate the modeling matrix that transforms the shared geometry Local-space vertex positions. This is ignored for meshes that don't share geometries, because the vertex positions of non-shared geometries are pre-transformed into World-space.
        eachMeshMaterialAttributes: new Uint8Array(numMeshes * NUM_MATERIAL_ATTRIBUTES), // For each mesh, an RGBA integer color of format [0..255, 0..255, 0..255, 0..255], and PBR metallic and roughness factors, of format [0..255, 0..255]
        eachGeometryId: [], // For each geometry, an ID string
        eachMeshId: [], // For each mesh, an ID string
        eachObjectId: [], // For each object, an ID string
        eachObjectMeshesPortion: new Uint32Array(numObjects) // For each object, the index of the first element of meshes used by the object
    };

    let countBuckets = 0;
    let countPositions = 0;
    let countColors = 0;
    let countIndices8Bit = 0;
    let countIndices16Bit = 0;
    let countIndices32Bit = 0;
    let countEdgeIndices8Bit = 0;
    let countEdgeIndices16Bit = 0;
    let countEdgeIndices32Bit = 0;
    let countDecodeMatrices = 0;

    // Geometries and buckets

    let geometryIndex = 0;

    for (let geometryId in sceneModel.geometries) {

        const geometry = sceneModel.geometries[geometryId];
        const geometryBuckets = geometry.geometryBuckets;

        let primitiveType;
        switch (geometry.primitive) {
            case TrianglesPrimitive:
                primitiveType = 0;
                break;
            case SolidPrimitive:
                primitiveType = 1;
                break;
            case SurfacePrimitive:
                primitiveType = 2;
                break;
            case LinesPrimitive:
                primitiveType = 3;
                break;
            case PointsPrimitive:
                primitiveType = 4;
                break;
        }
        dtxData.eachGeometryPrimitiveType [geometryIndex] = primitiveType;
        dtxData.eachGeometryBucketPortion [geometryIndex] = countBuckets;
        dtxData.eachGeometryDecodeMatricesPortion [geometryIndex] = countDecodeMatrices;

        dtxData.decodeMatrices.set(geometry.positionsDecompressMatrix, countDecodeMatrices); // TODO: only add decode matrix if different from what's already added
        countDecodeMatrices += 16;

        for (let i = 0, len = geometryBuckets.length; i < len; i++) {

            const geometryBucket = geometryBuckets[i];
            const lenBucketPositions = geometryBucket.positionsCompressed.length;
            const numBucketPositions = lenBucketPositions / 3;
            const bucketIndicesBitness: number = (numBucketPositions <= (1 << 8)) ? 0 : ((numBucketPositions <= (1 << 16)) ? 1 : 2);

            dtxData.eachBucketPositionsPortion [countBuckets] = countPositions;
            dtxData.eachBucketColorsPortion [countBuckets] = countColors;
            dtxData.eachBucketIndicesBitness [countBuckets] = bucketIndicesBitness;

            dtxData.positions.set(geometryBucket.positionsCompressed, countPositions);
            countPositions += geometryBucket.positionsCompressed.length;

            if (geometryBucket.indices) {
                switch (bucketIndicesBitness) {
                    case 0:
                        dtxData.indices8Bit.set(geometryBucket.indices, countIndices8Bit);
                        dtxData.eachBucketIndicesPortion [countBuckets] = countIndices8Bit;
                        countIndices8Bit += geometryBucket.indices.length;
                        break;
                    case 1:
                        dtxData.indices16Bit.set(geometryBucket.indices, countIndices16Bit);
                        dtxData.eachBucketIndicesPortion [countBuckets] = countIndices16Bit;
                        countIndices16Bit += geometryBucket.indices.length;
                        break;
                    case 2:
                        dtxData.indices32Bit.set(geometryBucket.indices, countIndices32Bit);
                        dtxData.eachBucketIndicesPortion [countBuckets] = countIndices32Bit;
                        countIndices32Bit += geometryBucket.indices.length;
                        break;
                }
            }

            if (geometryBucket.edgeIndices) {
                switch (bucketIndicesBitness) {
                    case 0:
                        dtxData.edgeIndices8Bit.set(geometryBucket.edgeIndices, countEdgeIndices8Bit);
                        dtxData.eachBucketEdgeIndicesPortion [countBuckets] = countEdgeIndices8Bit;
                        countEdgeIndices8Bit += geometryBucket.edgeIndices.length;
                        break;
                    case 1:
                        dtxData.edgeIndices16Bit.set(geometryBucket.edgeIndices, countEdgeIndices16Bit);
                        dtxData.eachBucketEdgeIndicesPortion [countBuckets] = countEdgeIndices16Bit;
                        countEdgeIndices16Bit += geometryBucket.edgeIndices.length;
                        break;
                    case 2:
                        dtxData.edgeIndices32Bit.set(geometryBucket.edgeIndices, countEdgeIndices32Bit);
                        dtxData.eachBucketEdgeIndicesPortion [countBuckets] = countEdgeIndices32Bit;
                        countEdgeIndices32Bit += geometryBucket.edgeIndices.length;
                        break;
                }
            }

            if (geometryBucket.colorsCompressed) {
                dtxData.colors.set(geometryBucket.colorsCompressed, countColors);
                countColors += geometryBucket.colorsCompressed.length;
            }

            countBuckets++;
        }

        geometryIndices[geometry.id] = geometryIndex;
        dtxData.eachGeometryId[geometryIndex] = geometry.id;
        geometryIndex++;
    }

    // Meshes and objects

    let eachMeshMaterialAttributesIndex = 0;
    let matricesIndex = 0;
    let originsIndex = 0;
    let countMeshes = 0;

    const matrixLookup = {};
    const originLookup = {};

    for (let objectIndex = 0; objectIndex < numObjects; objectIndex++) {

        const object = objectsList[objectIndex];
        const numObjectMeshes = object.meshes.length;

        dtxData.eachObjectId[objectIndex] = object.id;
        dtxData.eachObjectMeshesPortion[objectIndex] = countMeshes;

        for (let meshIndex = 0; meshIndex < numObjectMeshes; meshIndex++) {

            const mesh = object.meshes[meshIndex];

            dtxData.eachMeshId[countMeshes] = mesh.id;
            dtxData.eachMeshGeometriesPortion [countMeshes] = geometryIndices[mesh.geometry.id];

            dtxData.eachMeshMatricesPortion [countMeshes] = matricesIndex;
            dtxData.matrices.set(mesh.matrix, matricesIndex); // TODO: only add matrix if different from what's already added
            matricesIndex += 16;

            const origin = mesh.origin;
            const originHash = `${mesh.origin[0]}-${mesh.origin[1]}-${mesh.origin[2]}`;
            let originLookupIndex = originLookup[originHash];
            if (originLookupIndex === undefined) {
                originLookupIndex = originsIndex;
                originLookup[originHash] = originLookupIndex;
                dtxData.origins[originsIndex++] = origin[0];
                dtxData.origins[originsIndex++] = origin[1];
                dtxData.origins[originsIndex++] = origin[2];
            }
            dtxData.eachMeshOriginsPortion [countMeshes] = originLookupIndex;

            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.color[0] * 255); // Color RGB
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.color[1] * 255);
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.color[2] * 255);
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.opacity * 255); // Opacity
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.metallic * 255); // Metallic
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.roughness * 255); // Roughness

            countMeshes++;
        }
    }

    return dtxData;
}
