// import type {SceneModel} from "@xeokit/scene";
// import type {DataModel} from "@xeokit/data";
// import {
//     LinesPrimitive,
//     PointsPrimitive,
//     SolidPrimitive,
//     SurfacePrimitive,
//     TrianglesPrimitive
// } from "@xeokit/constants";
// import {XKT_INFO} from "./XKT_INFO";
// import type {xktData} from "./xktData";
// import {isIdentityMat4} from "@xeokit/matrix";
// import {XKTData} from "./XKTData";
//
// const XKT_VERSION = XKT_INFO.xktVersion;
// const NUM_TEXTURE_ATTRIBUTES = 9;
// const NUM_MATERIAL_ATTRIBUTES = 6;
//
// /**
//  * @private
//  */
// export function modelToXKT(params: {
//     sceneModel: SceneModel
// }): xktData {
//
//     const sceneModel = params.sceneModel;
//
//     const geometriesList = Object.values(sceneModel.geometries);
//     const meshesList = Object.values(sceneModel.meshes);
//     const objectsList = Object.values(sceneModel.objects);
//     const textureSetLists = Object.values(sceneModel.textureSets);
//     const tilesList = Object.values(sceneModel.tiles);
//
//     const numTextures = 0;
//     const numTextureSets = 0;
//     const numGeometries = geometriesList.length;
//     const numMeshes = meshesList.length;
//     const numObjects = objectsList.length;
//     const numTiles = tilesList.length;
//
//     let identityMatrixAdded = false;
//     let identityMatrixBase = 0;
//
//     let sizePositions = 0;
//     let sizeColors = 0;
//     let sizeIndices = 0;
//     let sizeEdgeIndices = 0;
//     let sizeUVs = 0;
//     let sizeNormals = 0;
//
//     const lenTextures = 0;
//
//     const geometryIndices: { [key: string]: number } = {};
//
//     for (let geometryIdx = 0; geometryIdx < numGeometries; geometryIdx++) {
//         const geometry = geometriesList [geometryIdx];
//         if (geometry) {
//             if (geometry.positionsCompressed) {
//                 sizePositions += geometry.positionsCompressed.length;
//                 if (geometry.indices) {
//                     sizeIndices += geometry.indices.length;
//                 }
//                 if (geometry.edgeIndices) {
//                     sizeEdgeIndices += geometry.edgeIndices.length;
//                 }
//                 if (geometry.colorsCompressed) {
//                     sizeColors += geometry.colorsCompressed.length;
//                 }
//             }
//         }
//     }
//
//     const xktData: XKTData = {
//         metadata: {},
//         textureData: new Uint8Array(lenTextures), // All textures
//         eachTextureDataPortion: new Uint32Array(numTextures), // For each texture, an index to its first element in textureData
//         eachTextureAttributes: new Uint16Array(numTextures * NUM_TEXTURE_ATTRIBUTES),
//         positions: new Uint16Array(sizePositions), // All geometry arrays
//         normals: new Int8Array(sizeNormals),
//         colors: new Uint8Array(sizeColors),
//         uvs: new Float32Array(sizeUVs),
//         indices: new Uint32Array(sizeIndices),
//         edgeIndices: new Uint32Array(sizeEdgeIndices),
//         eachTextureSetTextures: new Int32Array(numTextureSets * 5), // For each texture set, a set of five Texture indices [color, metal/roughness,normals,emissive,occlusion]; each index has value -1 if no texture
//         matrices: new Float32Array(lenMatrices), // Modeling matrices for entities that share geometries. Each entity either shares all it's geometries, or owns all its geometries exclusively. Exclusively-owned geometries are pre-transformed into World-space, and so their entities don't have modeling matrices in this array.
//         reusedGeometriesDecodeMatrix: new Float32Array(xktModel.reusedGeometriesDecodeMatrix), // A single, global vertex position de-quantization matrix for all reused geometries. Reused geometries are quantized to their collective Local-space AABB, and this matrix is derived from that AABB.
//         eachGeometryPrimitiveType: new Uint8Array(numGeometries), // Primitive type for each geometry (0=solid triangles, 1=surface triangles, 2=lines, 3=points, 4=line-strip)
//         eachGeometryPositionsPortion: new Uint32Array(numGeometries), // For each geometry, an index to its first element in xktData.positions. Every primitive type has positions.
//         eachGeometryNormalsPortion: new Uint32Array(numGeometries), // For each geometry, an index to its first element in xktData.normals. If the next geometry has the same index, then this geometry has no normals.
//         eachGeometryColorsPortion: new Uint32Array(numGeometries), // For each geometry, an index to its first element in xktData.colors. If the next geometry has the same index, then this geometry has no colors.
//         eachGeometryUVsPortion: new Uint32Array(numGeometries), // For each geometry, an index to its first element in xktData.uvs. If the next geometry has the same index, then this geometry has no UVs.
//         eachGeometryIndicesPortion: new Uint32Array(numGeometries), // For each geometry, an index to its first element in xktData.indices. If the next geometry has the same index, then this geometry has no indices.
//         eachGeometryEdgeIndicesPortion: new Uint32Array(numGeometries), // For each geometry, an index to its first element in xktData.edgeIndices. If the next geometry has the same index, then this geometry has no edge indices.
//         eachMeshGeometriesPortion: new Uint32Array(numMeshes), // For each mesh, an index into the eachGeometry* arrays
//         eachMeshMatricesPortion: new Uint32Array(numMeshes), // For each mesh that shares its geometry, an index to its first element in xktData.matrices, to indicate the modeling matrix that transforms the shared geometry Local-space vertex positions. This is ignored for meshes that don't share geometries, because the vertex positions of non-shared geometries are pre-transformed into World-space.
//         eachMeshTextureSet: new Int32Array(numMeshes), // For each mesh, the index of its texture set in xktData.eachTextureSetTextures; this array contains signed integers so that we can use -1 to indicate when a mesh has no texture set
//         eachMeshMaterialAttributes: new Uint8Array(numMeshes * NUM_MATERIAL_ATTRIBUTES), // For each mesh, an RGBA integer color of format [0..255, 0..255, 0..255, 0..255], and PBR metallic and roughness factors, of format [0..255, 0..255]
//         eachEntityId: [], // For each entity, an ID string
//         eachEntityMeshesPortion: new Uint32Array(numObjects), // For each entity, the index of the first element of meshes used by the entity
//         eachTileAABB: new Float64Array(numTiles * 6), // For each tile, an axis-aligned bounding box
//         eachTileEntitiesPortion: new Uint32Array(numTiles) // For each tile, the index of the first element of eachEntityId, eachEntityMeshesPortion and eachEntityMatricesPortion used by the tile
//     };
//
//     let countPositions = 0;
//     let countNormals = 0;
//     let countColors = 0;
//     let countUVs = 0;
//     let countIndices = 0;
//     let countEdgeIndices = 0;
//
//     // Geometries
//
//     for (let geometryIndex = 0; geometryIndex < numGeometries; geometryIndex++) {
//         const geometry = geometriesList [geometryIndex];
//         let primitiveType;
//         switch (geometry.primitive) {
//             case TrianglesPrimitive:
//                 primitiveType = 0;
//                 break;
//             case SolidPrimitive:
//                 primitiveType = 1;
//                 break;
//             case SurfacePrimitive:
//                 primitiveType = 2;
//                 break;
//             case LinesPrimitive:
//                 primitiveType = 3;
//                 break;
//             case PointsPrimitive:
//                 primitiveType = 4;
//                 break;
//         }
//         xktData.eachGeometryPrimitiveType [geometryIndex] = primitiveType;
//         xktData.eachGeometryPositionsPortion [geometryIndex] = countPositions;
//         xktData.eachGeometryNormalsPortion [geometryIndex] = countNormals;
//         xktData.eachGeometryColorsPortion [geometryIndex] = countColors;
//         xktData.eachGeometryUVsPortion [geometryIndex] = countUVs;
//         xktData.eachGeometryIndicesPortion [geometryIndex] = countIndices;
//         xktData.eachGeometryEdgeIndicesPortion [geometryIndex] = countEdgeIndices;
//         if (geometry.positionsCompressed) {
//             xktData.positions.set(geometry.positionsCompressed, countPositions);
//             countPositions += geometry.positionsCompressed.length;
//         }
//         if (geometry.colorsCompressed) {
//             xktData.colors.set(geometry.colorsCompressed, countColors);
//             countColors += geometry.colorsCompressed.length;
//         }
//         if (geometry.uvsCompressed) {
//             xktData.uvs.set(geometry.uvsCompressed, countUVs);
//             countUVs += geometry.uvsCompressed.length;
//         }
//         if (geometry.indices) {
//             xktData.indices.set(geometry.indices, countIndices);
//             countIndices += geometry.indices.length;
//         }
//         if (geometry.edgeIndices) {
//             xktData.edgeIndices.set(geometry.edgeIndices, countEdgeIndices);
//             countEdgeIndices += geometry.edgeIndices.length;
//         }
//     }
//
//
//     // Tiles -> Entities -> Meshes
//
//     let entityIndex = 0;
//     let countEntityMeshesPortion = 0;
//     let eachMeshMaterialAttributesIndex = 0;
//     let matricesIndex = 0;
//     let meshIndex = 0;
//
//     const metallic = 1;
//     const roughness = 1;0
//
//     for (let tileIndex = 0; tileIndex < numTiles; tileIndex++) {
//
//         const tile = tilesList [tileIndex];
//         const tileEntities = tile.entities;
//         const numTileEntities = tileEntities.length;
//
//         if (numTileEntities === 0) {
//             continue;
//         }
//
//         xktData.eachTileEntitiesPortion[tileIndex] = entityIndex;
//
//         const tileAABB = tile.aabb;
//
//         for (let j = 0; j < numTileEntities; j++) {
//
//             const entity = tileEntities[j];
//             const entityMeshes = entity.meshes;
//             const numEntityMeshes = entityMeshes.length;
//
//             for (let k = 0; k < numEntityMeshes; k++) {
//
//                 const mesh = entityMeshes[k];
//                 const geometry = mesh.geometry;
//                 const geometryIndex = geometry.geometryIndex;
//
//                 xktData.eachMeshGeometriesPortion [countEntityMeshesPortion + k] = geometryIndex;
//
//                 if (mesh.geometry.numMeshes > 1) {
//                     xktData.matrices.set(mesh.matrix, matricesIndex);
//                     xktData.eachMeshMatricesPortion [meshIndex] = matricesIndex;
//                     matricesIndex += 16;
//                 }
//
//                 xktData.eachMeshTextureSet[meshIndex] = mesh.textureSet ? mesh.textureSet.textureSetIndex : -1;
//
//                 xktData.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.color[0] * 255); // Color RGB
//                 xktData.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.color[1] * 255);
//                 xktData.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.color[2] * 255);
//                 xktData.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.opacity * 255); // Opacity
//                 xktData.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (metallic * 255); // Metallic
//                 xktData.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (roughness * 255); // Roughness
//
//                 meshIndex++;
//             }
//
//             xktData.eachEntityId [entityIndex] = entity.entityId;
//             xktData.eachEntityMeshesPortion[entityIndex] = countEntityMeshesPortion;
//
//             entityIndex++;
//             countEntityMeshesPortion += numEntityMeshes;
//         }
//
//         const tileAABBIndex = tileIndex * 6;
//
//         xktData.eachTileAABB.set(tileAABB, tileAABBIndex);
//     }
//
//
//     return <xktData>xktData;
// }
