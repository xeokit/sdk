// import {XKT_INFO} from "../XKT_INFO.js";
// import * as pako from 'pako';
//
// import type {DataModel} from "@xeokit/data";
// import type {SceneModel} from "@xeokit/scene";
// import {SDKError} from "@xeokit/core";
// import {decompressPoint3WithAABB3, decompressPoint3WithMat4} from "@xeokit/compression";
// import {createVec3, createVec4, decomposeMat4} from "@xeokit/matrix";
// import {ifcTypeNames} from "@xeokit/ifctypes";
// import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "@xeokit/constants";
//
// const tempVec3a = createVec3();
// const tempVec3b = createVec3();
//
// /**
//  * Exports a {@link @xeokit/scene!SceneModel | SceneModel} XKT file data.
//  *
//  * See {@link "@xeokit/XKT" | @xeokit/XKT} for usage.
//  *
//  * @param params
//  * @param params.model - The SceneModel to export to XKT.
//  * @returns The XKT file data in an JSON object.
//  * @returns {@link @xeokit/core!SDKError | SDKError} If the SceneModel has already been destroyed.
//  * @returns {@link @xeokit/core!SDKError | SDKError} If the SceneModel has not yet been built.
//  */
// export function saveXKT(params: {
//     sceneModel: SceneModel,
//     dataModel?: DataModel
// }): Object {
//     const sceneModel = params.sceneModel
//     const dataModel = params.dataModel;
//     if (sceneModel?.destroyed) {
//         throw new SDKError("SceneModel already destroyed");
//     }
//     if (!sceneModel?.built) {
//         throw new SDKError("SceneModel not yet built");
//     }
//     if (dataModel) {
//         if (dataModel.destroyed) {
//             throw new SDKError("DataModel already destroyed");
//         }
//         if (!dataModel.built) {
//             throw new SDKError("DataModel not yet built");
//         }
//     }
//     return modelToXKT({sceneModel, dataModel});
// }
//
// const XKT_VERSION = XKT_INFO.xktVersion;
// const NUM_TEXTURE_ATTRIBUTES = 9;
// const NUM_MATERIAL_ATTRIBUTES = 6;
//
//
// function modelToXKT(sceneModel: SceneModel) {
//     const data = getModelData(sceneModel);
//     const deflatedData = deflateData(data);
// return createArrayBuffer(deflatedData);
//
// }
//
// function getModelData(sceneModel) {
//
//     //------------------------------------------------------------------------------------------------------------------
//     // Allocate data
//     //------------------------------------------------------------------------------------------------------------------
//     const geometriesList = sceneModel.geometriesList;
//     const texturesList = sceneModel.texturesList;
//     const textureSetsList = sceneModel.textureSetsList;
//     const meshesList = sceneModel.meshesList;
//     const objectsList = sceneModel.objectsList;
//     const tilesList = sceneModel.tilesList;
//
//     const numGeometries = geometriesList.length;
//     const numTextures = texturesList.length;
//     const numTextureSets = textureSetsList.length;
//     const numMeshes = meshesList.length;
//     const numObjects = objectsList.length;
//     const numTiles = tilesList.length;
//
//     let lenPositions = 0;
//     let lenNormals = 0;
//     let lenColors = 0;
//     let lenUVs = 0;
//     let lenIndices = 0;
//     let lenEdgeIndices = 0;
//     let lenMatrices = 0;
//     let lenTextures = 0;
//
//     for (let geometryIndex = 0; geometryIndex < numGeometries; geometryIndex++) {
//         const geometry = geometriesList [geometryIndex];
//         if (geometry.positionsQuantized) {
//             lenPositions += geometry.positionsQuantized.length;
//         }
//         if (geometry.normalsOctEncoded) {
//             lenNormals += geometry.normalsOctEncoded.length;
//         }
//         if (geometry.colorsCompressed) {
//             lenColors += geometry.colorsCompressed.length;
//         }
//         if (geometry.uvs) {
//             lenUVs += geometry.uvs.length;
//         }
//         if (geometry.indices) {
//             lenIndices += geometry.indices.length;
//         }
//         if (geometry.edgeIndices) {
//             lenEdgeIndices += geometry.edgeIndices.length;
//         }
//     }
//
//     for (let textureIndex = 0; textureIndex < numTextures; textureIndex++) {
//         const xktTexture = texturesList[textureIndex];
//         const imageData = xktTexture.imageData;
//         lenTextures += imageData.byteLength;
//     }
//
//     for (let meshIndex = 0; meshIndex < numMeshes; meshIndex++) {
//         const mesh = meshesList[meshIndex];
//         if (mesh.geometry.numInstances > 1) {
//             lenMatrices += 16;
//         }
//     }
//
//     const data = {
//         metadata: {},
//         textureData: new Uint8Array(lenTextures), // All textures
//         eachTextureDataPortion: new Uint32Array(numTextures), // For each texture, an index to its first element in textureData
//         eachTextureAttributes: new Uint16Array(numTextures * NUM_TEXTURE_ATTRIBUTES),
//         positions: new Uint16Array(lenPositions), // All geometry arrays
//         normals: new Int8Array(lenNormals),
//         colors: new Uint8Array(lenColors),
//         uvs: new Float32Array(lenUVs),
//         indices: new Uint32Array(lenIndices),
//         edgeIndices: new Uint32Array(lenEdgeIndices),
//         eachTextureSetTextures: new Int32Array(numTextureSets * 5), // For each texture set, a set of five Texture indices [color, metal/roughness,normals,emissive,occlusion]; each index has value -1 if no texture
//         matrices: new Float32Array(lenMatrices), // Modeling matrices for objects that share geometries. Each entity either shares all it's geometries, or owns all its geometries exclusively. Exclusively-owned geometries are pre-transformed into World-space, and so their objects don't have modeling matrices in this array.
//         reusedGeometriesDecodeMatrix: new Float32Array(sceneModel.reusedGeometriesDecodeMatrix), // A single, global vertex position de-quantization matrix for all reused geometries. Reused geometries are quantized to their collective Local-space AABB, and this matrix is derived from that AABB.
//         eachGeometryPrimitiveType: new Uint8Array(numGeometries), // Primitive type for each geometry (0=solid triangles, 1=surface triangles, 2=lines, 3=points, 4=line-strip)
//         eachGeometryPositionsPortion: new Uint32Array(numGeometries), // For each geometry, an index to its first element in data.positions. Every primitive type has positions.
//         eachGeometryNormalsPortion: new Uint32Array(numGeometries), // For each geometry, an index to its first element in data.normals. If the next geometry has the same index, then this geometry has no normals.
//         eachGeometryColorsPortion: new Uint32Array(numGeometries), // For each geometry, an index to its first element in data.colors. If the next geometry has the same index, then this geometry has no colors.
//         eachGeometryUVsPortion: new Uint32Array(numGeometries), // For each geometry, an index to its first element in data.uvs. If the next geometry has the same index, then this geometry has no UVs.
//         eachGeometryIndicesPortion: new Uint32Array(numGeometries), // For each geometry, an index to its first element in data.indices. If the next geometry has the same index, then this geometry has no indices.
//         eachGeometryEdgeIndicesPortion: new Uint32Array(numGeometries), // For each geometry, an index to its first element in data.edgeIndices. If the next geometry has the same index, then this geometry has no edge indices.
//         eachMeshGeometriesPortion: new Uint32Array(numMeshes), // For each mesh, an index into the eachGeometry* arrays
//         eachMeshMatricesPortion: new Uint32Array(numMeshes), // For each mesh that shares its geometry, an index to its first element in data.matrices, to indicate the modeling matrix that transforms the shared geometry Local-space vertex positions. This is ignored for meshes that don't share geometries, because the vertex positions of non-shared geometries are pre-transformed into World-space.
//         eachMeshTextureSet: new Int32Array(numMeshes), // For each mesh, the index of its texture set in data.eachTextureSetTextures; this array contains signed integers so that we can use -1 to indicate when a mesh has no texture set
//         eachMeshMaterialAttributes: new Uint8Array(numMeshes * NUM_MATERIAL_ATTRIBUTES), // For each mesh, an RGBA integer color of format [0..255, 0..255, 0..255, 0..255], and PBR metallic and roughness factors, of format [0..255, 0..255]
//         eachEntityId: [], // For each entity, an ID string
//         eachEntityMeshesPortion: new Uint32Array(numObjects), // For each entity, the index of the first element of meshes used by the entity
//         eachTileAABB: new Float64Array(numTiles * 6), // For each tile, an axis-aligned bounding box
//         eachTileObjectsPortion: new Uint32Array(numTiles) // For each tile, the index of the first element of eachEntityId, eachEntityMeshesPortion and eachEntityMatricesPortion used by the tile
//     };
//
//     let countPositions = 0;
//     let countNormals = 0;
//     let countColors = 0;
//     let countUVs = 0;
//     let countIndices = 0;
//     let countEdgeIndices = 0;
//
//     // Metadata
//
//     data.metadata = {
//         id: sceneModel.modelId,
//         projectId: sceneModel.projectId,
//         revisionId: sceneModel.revisionId,
//         author: sceneModel.author,
//         createdAt: sceneModel.createdAt,
//         creatingApplication: sceneModel.creatingApplication,
//         schema: sceneModel.schema,
//         propertySets: [],
//         metaObjects: []
//     };
//
//     // Geometries
//
//     for (let geometryIndex = 0; geometryIndex < numGeometries; geometryIndex++) {
//         const geometry = geometriesList [geometryIndex];
//         let primitiveType = 1;
//         switch (geometry.primitiveType) {
//             case TrianglesPrimitive:
//                 primitiveType = geometry.solid ? 0 : 1;
//                 break;
//             case PointsPrimitive:
//                 primitiveType = 2;
//                 break;
//             case LinesPrimitive:
//                 primitiveType = 3;
//                 break;
//             case LinesPrimitive:
//             // case "line-loop":
//             //     primitiveType = 4;
//             //     break;
//             // case "triangle-strip":
//             //     primitiveType = 5;
//             //     break;
//             // case "triangle-fan":
//             //     primitiveType = 6;
//             //     break;
//             default:
//                 primitiveType = 1
//         }
//         data.eachGeometryPrimitiveType [geometryIndex] = primitiveType;
//         data.eachGeometryPositionsPortion [geometryIndex] = countPositions;
//         data.eachGeometryNormalsPortion [geometryIndex] = countNormals;
//         data.eachGeometryColorsPortion [geometryIndex] = countColors;
//         data.eachGeometryUVsPortion [geometryIndex] = countUVs;
//         data.eachGeometryIndicesPortion [geometryIndex] = countIndices;
//         data.eachGeometryEdgeIndicesPortion [geometryIndex] = countEdgeIndices;
//         if (geometry.positionsQuantized) {
//             data.positions.set(geometry.positionsQuantized, countPositions);
//             countPositions += geometry.positionsQuantized.length;
//         }
//         if (geometry.normalsOctEncoded) {
//             data.normals.set(geometry.normalsOctEncoded, countNormals);
//             countNormals += geometry.normalsOctEncoded.length;
//         }
//         if (geometry.colorsCompressed) {
//             data.colors.set(geometry.colorsCompressed, countColors);
//             countColors += geometry.colorsCompressed.length;
//         }
//         if (geometry.uvs) {
//             data.uvs.set(geometry.uvs, countUVs);
//             countUVs += geometry.uvs.length;
//         }
//         if (geometry.indices) {
//             data.indices.set(geometry.indices, countIndices);
//             countIndices += geometry.indices.length;
//         }
//         if (geometry.edgeIndices) {
//             data.edgeIndices.set(geometry.edgeIndices, countEdgeIndices);
//             countEdgeIndices += geometry.edgeIndices.length;
//         }
//     }
//
//     // Textures
//
//     for (let textureIndex = 0, numTextures = sceneModel.texturesList.length, portionIdx = 0; textureIndex < numTextures; textureIndex++) {
//         const xktTexture = sceneModel.texturesList[textureIndex];
//         const imageData = xktTexture.imageData;
//         data.textureData.set(imageData, portionIdx);
//         data.eachTextureDataPortion[textureIndex] = portionIdx;
//
//         portionIdx += imageData.byteLength;
//
//         let textureAttrIdx = textureIndex * NUM_TEXTURE_ATTRIBUTES;
//         data.eachTextureAttributes[textureAttrIdx++] = xktTexture.compressed ? 1 : 0;
//         data.eachTextureAttributes[textureAttrIdx++] = xktTexture.mediaType; // GIFMediaType | PNGMediaType | JPEGMediaType
//         data.eachTextureAttributes[textureAttrIdx++] = xktTexture.width;
//         data.eachTextureAttributes[textureAttrIdx++] = xktTexture.height;
//         data.eachTextureAttributes[textureAttrIdx++] = xktTexture.minFilter; // LinearMipmapLinearFilter | LinearMipMapNearestFilter | NearestMipMapNearestFilter | NearestMipMapLinearFilter | LinearMipMapLinearFilter
//         data.eachTextureAttributes[textureAttrIdx++] = xktTexture.magFilter; // LinearFilter | NearestFilter
//         data.eachTextureAttributes[textureAttrIdx++] = xktTexture.wrapS; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
//         data.eachTextureAttributes[textureAttrIdx++] = xktTexture.wrapT; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
//         data.eachTextureAttributes[textureAttrIdx++] = xktTexture.wrapR; // ClampToEdgeWrapping | MirroredRepeatWrapping | RepeatWrapping
//     }
//
//     // Texture sets
//
//     for (let textureSetIndex = 0, numTextureSets = sceneModel.textureSetsList.length, eachTextureSetTexturesIndex = 0; textureSetIndex < numTextureSets; textureSetIndex++) {
//         const textureSet = textureSetsList[textureSetIndex];
//         data.eachTextureSetTextures[eachTextureSetTexturesIndex++] = textureSet.colorTexture ? textureSet.colorTexture.textureIndex : -1; // Color map
//         data.eachTextureSetTextures[eachTextureSetTexturesIndex++] = textureSet.metallicRoughnessTexture ? textureSet.metallicRoughnessTexture.textureIndex : -1; // Metal/rough map
//         data.eachTextureSetTextures[eachTextureSetTexturesIndex++] = textureSet.normalsTexture ? textureSet.normalsTexture.textureIndex : -1; // Normal map
//         data.eachTextureSetTextures[eachTextureSetTexturesIndex++] = textureSet.emissiveTexture ? textureSet.emissiveTexture.textureIndex : -1; // Emissive map
//         data.eachTextureSetTextures[eachTextureSetTexturesIndex++] = textureSet.occlusionTexture ? textureSet.occlusionTexture.textureIndex : -1; // Occlusion map
//     }
//
//     // Tiles -> Objects -> Meshes
//
//     let entityIndex = 0;
//     let countEntityMeshesPortion = 0;
//     let eachMeshMaterialAttributesIndex = 0;
//     let matricesIndex = 0;
//     let meshIndex = 0;
//
//     for (let tileIndex = 0; tileIndex < numTiles; tileIndex++) {
//
//         const tile = tilesList [tileIndex];
//         const tileObjects = tile.objects;
//         const numTileObjects = tileObjects.length;
//
//         if (numTileObjects === 0) {
//             continue;
//         }
//
//         data.eachTileObjectsPortion[tileIndex] = entityIndex;
//
//         const tileAABB = tile.aabb;
//
//         for (let j = 0; j < numTileObjects; j++) {
//
//             const entity = tileObjects[j];
//             const entityMeshes = entity.meshes;
//             const numEntityMeshes = entityMeshes.length;
//
//             for (let k = 0; k < numEntityMeshes; k++) {
//
//                 const mesh = entityMeshes[k];
//                 const geometry = mesh.geometry;
//                 const geometryIndex = geometry.geometryIndex;
//
//                 data.eachMeshGeometriesPortion [countEntityMeshesPortion + k] = geometryIndex;
//
//                 if (mesh.geometry.numInstances > 1) {
//                     data.matrices.set(mesh.matrix, matricesIndex);
//                     data.eachMeshMatricesPortion [meshIndex] = matricesIndex;
//                     matricesIndex += 16;
//                 }
//
//                 data.eachMeshTextureSet[meshIndex] = mesh.textureSet ? mesh.textureSet.textureSetIndex : -1;
//
//                 data.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.color[0] * 255); // Color RGB
//                 data.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.color[1] * 255);
//                 data.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.color[2] * 255);
//                 data.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = (mesh.opacity * 255); // Opacity
//                 data.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = 0; // Metallic
//                 data.eachMeshMaterialAttributes[eachMeshMaterialAttributesIndex++] = 1; // Roughness
//
//                 meshIndex++;
//             }
//
//             data.eachEntityId [entityIndex] = entity.entityId;
//             data.eachEntityMeshesPortion[entityIndex] = countEntityMeshesPortion;
//
//             entityIndex++;
//             countEntityMeshesPortion += numEntityMeshes;
//         }
//
//         const tileAABBIndex = tileIndex * 6;
//
//         data.eachTileAABB.set(tileAABB, tileAABBIndex);
//     }
//
//     return data;
// }
//
// function deflateData(data, metaModelJSON, options) {
//
//     function deflate(buffer) {
//         return (options.zip !== false) ? pako.deflate(buffer) : buffer;
//     }
//
//     let metaModelBytes;
//     if (metaModelJSON) {
//         const deflatedJSON = deflateJSON(metaModelJSON);
//         metaModelBytes = deflate(deflatedJSON)
//     } else {
//         const deflatedJSON = deflateJSON(data.metadata);
//         metaModelBytes = deflate(deflatedJSON)
//     }
//
//     return {
//         metadata: metaModelBytes,
//         textureData: deflate(data.textureData.buffer),
//         eachTextureDataPortion: deflate(data.eachTextureDataPortion.buffer),
//         eachTextureAttributes: deflate(data.eachTextureAttributes.buffer),
//         positions: deflate(data.positions.buffer),
//         normals: deflate(data.normals.buffer),
//         colors: deflate(data.colors.buffer),
//         uvs: deflate(data.uvs.buffer),
//         indices: deflate(data.indices.buffer),
//         edgeIndices: deflate(data.edgeIndices.buffer),
//         eachTextureSetTextures: deflate(data.eachTextureSetTextures.buffer),
//         matrices: deflate(data.matrices.buffer),
//         reusedGeometriesDecodeMatrix: deflate(data.reusedGeometriesDecodeMatrix.buffer),
//         eachGeometryPrimitiveType: deflate(data.eachGeometryPrimitiveType.buffer),
//         eachGeometryPositionsPortion: deflate(data.eachGeometryPositionsPortion.buffer),
//         eachGeometryNormalsPortion: deflate(data.eachGeometryNormalsPortion.buffer),
//         eachGeometryColorsPortion: deflate(data.eachGeometryColorsPortion.buffer),
//         eachGeometryUVsPortion: deflate(data.eachGeometryUVsPortion.buffer),
//         eachGeometryIndicesPortion: deflate(data.eachGeometryIndicesPortion.buffer),
//         eachGeometryEdgeIndicesPortion: deflate(data.eachGeometryEdgeIndicesPortion.buffer),
//         eachMeshGeometriesPortion: deflate(data.eachMeshGeometriesPortion.buffer),
//         eachMeshMatricesPortion: deflate(data.eachMeshMatricesPortion.buffer),
//         eachMeshTextureSet: deflate(data.eachMeshTextureSet.buffer),
//         eachMeshMaterialAttributes: deflate(data.eachMeshMaterialAttributes.buffer),
//         eachEntityId: deflate(JSON.stringify(data.eachEntityId)
//             .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
//                 return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
//             })),
//         eachEntityMeshesPortion: deflate(data.eachEntityMeshesPortion.buffer),
//         eachTileAABB: deflate(data.eachTileAABB.buffer),
//         eachTileObjectsPortion: deflate(data.eachTileObjectsPortion.buffer)
//     };
// }
//
// function deflateJSON(strings) {
//     return JSON.stringify(strings)
//         .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
//             return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
//         });
// }
//
// function createArrayBuffer(deflatedData) {
//     return toArrayBuffer([
//         deflatedData.metadata,
//         deflatedData.textureData,
//         deflatedData.eachTextureDataPortion,
//         deflatedData.eachTextureAttributes,
//         deflatedData.positions,
//         deflatedData.normals,
//         deflatedData.colors,
//         deflatedData.uvs,
//         deflatedData.indices,
//         deflatedData.edgeIndices,
//         deflatedData.eachTextureSetTextures,
//         deflatedData.matrices,
//         deflatedData.reusedGeometriesDecodeMatrix,
//         deflatedData.eachGeometryPrimitiveType,
//         deflatedData.eachGeometryPositionsPortion,
//         deflatedData.eachGeometryNormalsPortion,
//         deflatedData.eachGeometryColorsPortion,
//         deflatedData.eachGeometryUVsPortion,
//         deflatedData.eachGeometryIndicesPortion,
//         deflatedData.eachGeometryEdgeIndicesPortion,
//         deflatedData.eachMeshGeometriesPortion,
//         deflatedData.eachMeshMatricesPortion,
//         deflatedData.eachMeshTextureSet,
//         deflatedData.eachMeshMaterialAttributes,
//         deflatedData.eachEntityId,
//         deflatedData.eachEntityMeshesPortion,
//         deflatedData.eachTileAABB,
//         deflatedData.eachTileObjectsPortion
//     ]);
// }
//
// function toArrayBuffer(elements) {
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
//
// export {writesceneModelToArrayBuffer};
