import type {SceneModel} from "@xeokit/scene";
import {
    LinesPrimitive,
    PointsPrimitive,
    SolidPrimitive,
    SurfacePrimitive,
    TrianglesPrimitive
} from "@xeokit/constants";
import {DTX_INFO} from "./DTX_INFO";
import type {DTXData_v1} from "./DTXData_v1";
import {isIdentityMat4} from "@xeokit/matrix";

const DTX_VERSION = DTX_INFO.dtxVersion;
const NUM_MATERIAL_ATTRIBUTES = 4;

/**
 * @private
 */
export function modelToDTX(params: {
    sceneModel: SceneModel
}): DTXData_v1 {

    const sceneModel = params.sceneModel;

    const geometriesList = Object.values(sceneModel.geometries);
    const meshesList = Object.values(sceneModel.meshes);
    const objectsList = Object.values(sceneModel.objects);

    const numGeometries = geometriesList.length;
    const numMeshes = meshesList.length;
    const numObjects = objectsList.length;

    let identityMatrixAdded = false;
    let identityMatrixBase = 0;

    let sizePositions = 0;
    let sizeColors = 0;
    let sizeIndices = 0;
    let sizeEdgeIndices = 0;

    const geometryIndices: { [key: string]: number } = {};

    for (let geometryIdx = 0; geometryIdx < numGeometries; geometryIdx++) {
        const geometry = geometriesList [geometryIdx];
        if (geometry) {
            if (geometry.positionsCompressed) {
                sizePositions += geometry.positionsCompressed.length;
                if (geometry.indices) {
                    sizeIndices += geometry.indices.length;
                }
                if (geometry.edgeIndices) {
                    sizeEdgeIndices += geometry.edgeIndices.length;
                }
                if (geometry.colorsCompressed) {
                    sizeColors += geometry.colorsCompressed.length;
                }
            }
        }
    }

    const dtxData = {
        positions: new Uint16Array(sizePositions),
        colors: new Uint8Array(sizeColors),
        indices: new Uint32Array(sizeIndices),
        edgeIndices: new Uint32Array(sizeEdgeIndices),
        aabbs: null,
        eachGeometryPositionsBase: new Uint32Array(numGeometries), // For each geometry, an index to its first element in dtxData.positions. Every primitive type has positions.
        eachGeometryColorsBase: new Uint32Array(numGeometries), // For each geometry, an index to its first element in dtxData.colors. If the next geometry has the same index, then this geometry has no colors.
        eachGeometryIndicesBase: new Uint32Array(numGeometries), // For each geometry, an index to its first element in dtxData.indices. If the next geometry has the same index, then this geometry has no indices.
        eachGeometryEdgeIndicesBase: new Uint32Array(numGeometries), // For each geometry, an index to its first element in dtxData.edgeIndices. If the next geometry has the same index, then this geometry has no edge indices.
        eachGeometryPrimitiveType: new Uint8Array(numGeometries), // Primitive type for each geometry (0=solid triangles, 1=surface triangles, 2=lines, 3=points)
        eachGeometryAABBBase: new Uint32Array(numGeometries), // Positions dequantization matrices
        matrices: null, // Modeling matrices
        eachMeshGeometriesBase: new Uint32Array(numMeshes), // For each mesh, an index into the eachGeometry* arrays
        eachMeshMatricesBase: new Uint32Array(numMeshes), // For each mesh that shares its geometry, an index to its first element in dtxData.matrices, to indicate the modeling matrix that transforms the shared geometry Local-space vertex positions. This is ignored for meshes that don't share geometries, because the vertex positions of non-shared geometries are pre-transformed into World-space.
        eachMeshMaterialAttributes: new Uint8Array(numMeshes * NUM_MATERIAL_ATTRIBUTES), // For each mesh, an RGBA integer color of format [0..255, 0..255, 0..255, 0..255], and PBR metallic and roughness factors, of format [0..255, 0..255]
        eachObjectId: [], // For each object, an ID string
        eachObjectMeshesBase: new Uint32Array(numObjects) // For each object, the index of the first element of meshes used by the object
    };

    let positionsBase = 0;
    let colorsBase = 0;
    let indicesBase = 0;
    let edgeIndicesBase = 0;
    let aabbsBase = 0;

    const aabbIdxMap = {};

    const aabbs = [];
    const matrices = [];

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
        const aabb = geometry.aabb;
        const aabbHash = `${aabb[0]}-${aabb[1]}-${aabb[2]}-${aabb[3]}-${aabb[4]}-${aabb[5]}`;
        let aabbIdx = aabbIdxMap[aabbHash];
        if (aabbIdx === undefined) {
            aabbIdx = aabbsBase;
            aabbIdxMap[aabbHash] = aabbIdx;
            aabbs.push(...aabb);
            aabbsBase += 6;
        }
        dtxData.eachGeometryAABBBase [geometryIdx] = aabbIdx;
        dtxData.eachGeometryPositionsBase [geometryIdx] = positionsBase;
        dtxData.eachGeometryColorsBase [geometryIdx] = colorsBase;
        dtxData.positions.set(geometry.positionsCompressed, positionsBase);
        positionsBase += geometry.positionsCompressed.length;
        if (geometry.indices) {
            dtxData.indices.set(geometry.indices, indicesBase);
            dtxData.eachGeometryIndicesBase [geometryIdx] = indicesBase;
            indicesBase += geometry.indices.length;
        }
        if (geometry.edgeIndices) {
            dtxData.edgeIndices.set(geometry.edgeIndices, edgeIndicesBase);
            dtxData.eachGeometryEdgeIndicesBase [geometryIdx] = edgeIndicesBase;
            edgeIndicesBase += geometry.edgeIndices.length;
        }
        if (geometry.colorsCompressed) {
            dtxData.colors.set(geometry.colorsCompressed, colorsBase);
            dtxData.eachGeometryColorsBase [geometryIdx] = colorsBase;
            colorsBase += geometry.colorsCompressed.length;
        }
        geometryIndices[geometry.id] = geometryIdx;
    }

    // Meshes and objects

    let eachMeshMaterialAttributesBase = 0;
    let matricesBase = 0;
    let meshesBase = 0;
    for (let objectIdx = 0; objectIdx < numObjects; objectIdx++) {
        const object = objectsList[objectIdx];
        dtxData.eachObjectId[objectIdx] = object.id;
        dtxData.eachObjectMeshesBase[objectIdx] = meshesBase;
        for (let objectMeshIdx = 0; objectMeshIdx < object.meshes.length; objectMeshIdx++) {
            const mesh = object.meshes[objectMeshIdx];
            dtxData.eachMeshGeometriesBase [meshesBase] = geometryIndices[mesh.geometry.id];
            if (isIdentityMat4(mesh.matrix)) {
                if (!identityMatrixAdded) {
                    matrices.push(...mesh.rtcMatrix);
                    dtxData.eachMeshMatricesBase [meshesBase] = matricesBase;
                    identityMatrixBase = matricesBase;
                    matricesBase += 16;
                    identityMatrixAdded = true;
                } else {
                    dtxData.eachMeshMatricesBase [meshesBase] = identityMatrixBase;
                }
            } else {
                matrices.push(...mesh.matrix);
                dtxData.eachMeshMatricesBase [meshesBase] = matricesBase;
                matricesBase += 16;
            }
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesBase++] = (mesh.color[0] * 255); // Color RGB
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesBase++] = (mesh.color[1] * 255);
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesBase++] = (mesh.color[2] * 255);
            dtxData.eachMeshMaterialAttributes[eachMeshMaterialAttributesBase++] = (mesh.opacity * 255); // Opacity
            meshesBase++;
        }
    }

    dtxData.aabbs = new Float32Array(aabbs);
    dtxData.matrices = new Float64Array(matrices);

    return <DTXData_v1>dtxData;
}
