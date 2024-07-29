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
const NUM_MATERIAL_ATTRIBUTES = 4;

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

    let sizePositions = 0;
    let sizeColors = 0;
    let sizeIndices = 0;
    let sizeEdgeIndices = 0;
    let sizeMatrices = numMeshes * 16;
    let sizeAABBs = 0;
    let sizeOrigins = 0;

    const geometryIndices: { [key: string]: number } = {};

    for (let geometryIdx = 0; geometryIdx < numGeometries; geometryIdx++) {
        const geometry = geometriesList [geometryIdx];
        const geometryBucket = geometry.geometryBuckets[0];
        if (geometryBucket) {
            if (geometryBucket.positionsCompressed) {
                sizePositions += geometryBucket.positionsCompressed.length;
                if (geometryBucket.indices) {
                    sizeIndices += geometryBucket.indices.length;
                }
                if (geometryBucket.edgeIndices) {
                    sizeEdgeIndices += geometryBucket.edgeIndices.length;
                }
                if (geometryBucket.colorsCompressed) {
                    sizeColors += geometryBucket.colorsCompressed.length;
                }
            }
        }
    }

    const originExists = {};
    for (let meshIndex = 0; meshIndex < numMeshes; meshIndex++) {
        const mesh = meshesList [meshIndex];
        const origin = mesh.tile.origin;
        const originHash = `${origin[0]}-${origin[1]}-${origin[2]}`;
        if (!originExists[originHash]) {
            originExists[originHash] = true;
            sizeOrigins += 3;
        }
    }

    sizeAABBs = numGeometries * 6;

    const dtxData: DTXData = {
        positions: new Uint16Array(sizePositions),
        colors: new Uint8Array(sizeColors),
        indices: new Uint32Array(sizeIndices),
        edgeIndices: new Uint32Array(sizeEdgeIndices),
        aabbs: new Float32Array(sizeAABBs),
        eachGeometryPositionsBase: new Uint32Array(numGeometries), // For each geometry, an index to its first element in dtxData.positions. Every primitive type has positions.
        eachGeometryColorsBase: new Uint32Array(numGeometries), // For each geometry, an index to its first element in dtxData.colors. If the next geometry has the same index, then this geometry has no colors.
        eachGeometryIndicesBase: new Uint32Array(numGeometries), // For each geometry, an index to its first element in dtxData.indices. If the next geometry has the same index, then this geometry has no indices.
        eachGeometryEdgeIndicesBase: new Uint32Array(numGeometries), // For each geometry, an index to its first element in dtxData.edgeIndices. If the next geometry has the same index, then this geometry has no edge indices.
        eachGeometryPrimitiveType: new Uint8Array(numGeometries), // Primitive type for each geometry (0=solid triangles, 1=surface triangles, 2=lines, 3=points)
        eachGeometryAABBBase: new Uint32Array(numGeometries), // Positions dequantization matrices
        matrices: new Float32Array(sizeMatrices), // Modeling matrices
        origins: new Float64Array(sizeOrigins), // Origins
        eachMeshGeometriesBase: new Uint32Array(numMeshes), // For each mesh, an index into the eachGeometry* arrays
        eachMeshMatricesBase: new Uint32Array(numMeshes), // For each mesh that shares its geometry, an index to its first element in dtxData.matrices, to indicate the modeling matrix that transforms the shared geometry Local-space vertex positions. This is ignored for meshes that don't share geometries, because the vertex positions of non-shared geometries are pre-transformed into World-space.
        eachMeshOriginsBase: new Uint32Array(numMeshes), // For each mesh that shares its geometry, an index to its first element in dtxData.matrices, to indicate the modeling matrix that transforms the shared geometry Local-space vertex positions. This is ignored for meshes that don't share geometries, because the vertex positions of non-shared geometries are pre-transformed into World-space.
        eachMeshMaterialAttributes: new Uint8Array(numMeshes * NUM_MATERIAL_ATTRIBUTES), // For each mesh, an RGBA integer color of format [0..255, 0..255, 0..255, 0..255], and PBR metallic and roughness factors, of format [0..255, 0..255]
        eachObjectId: [], // For each object, an ID string
        eachObjectMeshesBase: new Uint32Array(numObjects) // For each object, the index of the first element of meshes used by the object
    };

    let positionsBase = 0;
    let colorsBase = 0;
    let indicesBase = 0;
    let edgeIndicesBase = 0;
    let aabbsBase = 0;

    for (let geometryIdx = 0; geometryIdx < numGeometries; geometryIdx++) {
        const geometry = geometriesList[geometryIdx];
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
        dtxData.eachGeometryPrimitiveType [geometryIdx] = primitiveType;
        dtxData.eachGeometryAABBBase [geometryIdx] = aabbsBase;
        dtxData.aabbs.set(geometry.aabb, aabbsBase); // TODO: only add decode matrix if different from what's already added
        aabbsBase += 6;
        const geometryBucket = geometry.geometryBuckets[0];
        dtxData.eachGeometryPositionsBase [geometryIdx] = positionsBase;
        dtxData.eachGeometryColorsBase [geometryIdx] = colorsBase;
        dtxData.positions.set(geometryBucket.positionsCompressed, positionsBase);
        positionsBase += geometryBucket.positionsCompressed.length;
        if (geometryBucket.indices) {
            dtxData.indices.set(geometryBucket.indices, indicesBase);
            dtxData.eachGeometryIndicesBase [geometryIdx] = indicesBase;
            indicesBase += geometryBucket.indices.length;
        }
        if (geometryBucket.edgeIndices) {
            dtxData.edgeIndices.set(geometryBucket.edgeIndices, edgeIndicesBase);
            dtxData.eachGeometryEdgeIndicesBase [geometryIdx] = edgeIndicesBase;
            edgeIndicesBase += geometryBucket.edgeIndices.length;
        }
        if (geometryBucket.colorsCompressed) {
            dtxData.colors.set(geometryBucket.colorsCompressed, colorsBase);
            dtxData.eachGeometryColorsBase [geometryIdx] = colorsBase;
            colorsBase += geometryBucket.colorsCompressed.length;
        }
        geometryIndices[geometry.id] = geometryIdx;
    }

    // Meshes and objects

    let eachMeshMaterialAttributesBase = 0;
    let matricesBase = 0;
    let originsBase = 0;
    let meshesBase = 0;
    const originIdxMap = {};
    for (let objectIdx = 0; objectIdx < numObjects; objectIdx++) {
        const object = objectsList[objectIdx];
        dtxData.eachObjectId[objectIdx] = object.id;
        dtxData.eachObjectMeshesBase[objectIdx] = meshesBase;
        for (let objectMeshIdx = 0; objectMeshIdx < object.meshes.length; objectMeshIdx++) {
            const mesh = object.meshes[objectMeshIdx];
            dtxData.eachMeshGeometriesBase [meshesBase] = geometryIndices[mesh.geometry.id];
            dtxData.eachMeshMatricesBase [meshesBase] = matricesBase;
            dtxData.matrices.set(mesh.matrix, matricesBase); // TODO: only add matrix if different from what's already added
            matricesBase += 16;
            const origin = mesh.tile.origin;
            const originHash = `${origin[0]}-${origin[1]}-${origin[2]}`;
            let originIdx = originIdxMap[originHash];
            if (originIdx === undefined) {
                originIdx = originsBase;
                originIdxMap[originHash] = originIdx;
                dtxData.origins[originsBase++] = origin[0];
                dtxData.origins[originsBase++] = origin[1];
                dtxData.origins[originsBase++] = origin[2];
            }
            dtxData.eachMeshOriginsBase [meshesBase] = originIdx;
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesBase++] = (mesh.color[0] * 255); // Color RGB
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesBase++] = (mesh.color[1] * 255);
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesBase++] = (mesh.color[2] * 255);
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesBase++] = (mesh.opacity * 255); // Opacity
            meshesBase++;
        }
    }

    return dtxData;
}
