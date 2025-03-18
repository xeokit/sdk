import { LinesPrimitive, PointsPrimitive, SolidPrimitive, SurfacePrimitive, TrianglesPrimitive } from "../../../constants";
import { isIdentityMat4 } from "../../../matrix";
const NUM_MATERIAL_ATTRIBUTES = 4;
/**
 * @private
 */
export function modelToXGF(params) {
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
    const geometryIndices = {};
    for (let geometryIdx = 0; geometryIdx < numGeometries; geometryIdx++) {
        const geometry = geometriesList[geometryIdx];
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
    const xgfData = {
        positions: new Uint16Array(sizePositions),
        colors: new Uint8Array(sizeColors),
        indices: new Uint32Array(sizeIndices),
        edgeIndices: new Uint32Array(sizeEdgeIndices),
        aabbs: null,
        eachGeometryPositionsBase: new Uint32Array(numGeometries),
        eachGeometryColorsBase: new Uint32Array(numGeometries),
        eachGeometryIndicesBase: new Uint32Array(numGeometries),
        eachGeometryEdgeIndicesBase: new Uint32Array(numGeometries),
        eachGeometryPrimitiveType: new Uint8Array(numGeometries),
        eachGeometryAABBBase: new Uint32Array(numGeometries),
        matrices: null,
        eachMeshGeometriesBase: new Uint32Array(numMeshes),
        eachMeshMatricesBase: new Uint32Array(numMeshes),
        eachMeshMaterialAttributes: new Uint8Array(numMeshes * NUM_MATERIAL_ATTRIBUTES),
        eachObjectId: [],
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
        xgfData.eachGeometryPrimitiveType[geometryIdx] = primitiveType;
        const aabb = geometry.aabb;
        const aabbHash = `${aabb[0]}-${aabb[1]}-${aabb[2]}-${aabb[3]}-${aabb[4]}-${aabb[5]}`;
        let aabbIdx = aabbIdxMap[aabbHash];
        if (aabbIdx === undefined) {
            aabbIdx = aabbsBase;
            aabbIdxMap[aabbHash] = aabbIdx;
            aabbs.push(...aabb);
            aabbsBase += 6;
        }
        xgfData.eachGeometryAABBBase[geometryIdx] = aabbIdx;
        xgfData.eachGeometryPositionsBase[geometryIdx] = positionsBase;
        xgfData.eachGeometryColorsBase[geometryIdx] = colorsBase;
        xgfData.positions.set(geometry.positionsCompressed, positionsBase);
        positionsBase += geometry.positionsCompressed.length;
        if (geometry.indices) {
            xgfData.indices.set(geometry.indices, indicesBase);
            xgfData.eachGeometryIndicesBase[geometryIdx] = indicesBase;
            indicesBase += geometry.indices.length;
        }
        if (geometry.edgeIndices) {
            xgfData.edgeIndices.set(geometry.edgeIndices, edgeIndicesBase);
            xgfData.eachGeometryEdgeIndicesBase[geometryIdx] = edgeIndicesBase;
            edgeIndicesBase += geometry.edgeIndices.length;
        }
        if (geometry.colorsCompressed) {
            xgfData.colors.set(geometry.colorsCompressed, colorsBase);
            xgfData.eachGeometryColorsBase[geometryIdx] = colorsBase;
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
        xgfData.eachObjectId[objectIdx] = object.id;
        xgfData.eachObjectMeshesBase[objectIdx] = meshesBase;
        for (let objectMeshIdx = 0; objectMeshIdx < object.meshes.length; objectMeshIdx++) {
            const mesh = object.meshes[objectMeshIdx];
            xgfData.eachMeshGeometriesBase[meshesBase] = geometryIndices[mesh.geometry.id];
            if (isIdentityMat4(mesh.matrix)) {
                if (!identityMatrixAdded) {
                    matrices.push(...mesh.matrix);
                    xgfData.eachMeshMatricesBase[meshesBase] = matricesBase;
                    identityMatrixBase = matricesBase;
                    matricesBase += 16;
                    identityMatrixAdded = true;
                }
                else {
                    xgfData.eachMeshMatricesBase[meshesBase] = identityMatrixBase;
                }
            }
            else {
                matrices.push(...mesh.matrix);
                xgfData.eachMeshMatricesBase[meshesBase] = matricesBase;
                matricesBase += 16;
            }
            xgfData.eachMeshMaterialAttributes[eachMeshMaterialAttributesBase++] = (mesh.color[0] * 255); // Color RGB
            xgfData.eachMeshMaterialAttributes[eachMeshMaterialAttributesBase++] = (mesh.color[1] * 255);
            xgfData.eachMeshMaterialAttributes[eachMeshMaterialAttributesBase++] = (mesh.color[2] * 255);
            xgfData.eachMeshMaterialAttributes[eachMeshMaterialAttributesBase++] = (mesh.opacity * 255); // Opacity
            meshesBase++;
        }
    }
    xgfData.aabbs = new Float32Array(aabbs);
    xgfData.matrices = new Float64Array(matrices);
    return xgfData;
}
//# sourceMappingURL=modelToXGF.js.map