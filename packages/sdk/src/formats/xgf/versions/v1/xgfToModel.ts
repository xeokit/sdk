import {
  LinesPrimitive,
  PointsPrimitive,
  SolidPrimitive,
  SurfacePrimitive,
  TrianglesPrimitive
} from "../../../../constants";
import type {SceneGeometryCompressedParams, SceneModel} from "../../../../scene";
import {createUUID} from "../../../../utils";
import type {DataModel} from "../../../../data";
import type { Vec3} from "../../../../math/vector";
import type {XGFData_v1} from "./XGFData_v1";
import {createVec3Float32} from "../../../../math/vector";

/**
 * @private
 */
export function xgfToModel(params: {
  xgfData: XGFData_v1,
  sceneModel?: SceneModel,
  dataModel?: DataModel
}): void {

  const {xgfData, sceneModel, dataModel} = params;
  const defaultId = sceneModel ? sceneModel.id : createUUID();

  if (dataModel) {
    dataModel.createObject({
      id: defaultId,
      name: defaultId,
      type: "BasicEntity"
    });
  }

  const {
    eachGeometryPositionsBase,
    eachGeometryIndicesBase,
    eachGeometryEdgeIndicesBase,
    eachGeometryAABBBase,
    eachGeometryPrimitiveType,
    eachMeshGeometriesBase,
    eachMeshMaterialAttributes,
    eachMeshMatricesBase,
    eachObjectMeshesBase,
    eachObjectId,
    positions,
    indices,
    edgeIndices,
    aabbs,
    matrices
  } = xgfData;

  const numGeometries = eachGeometryPositionsBase.length;
  const numMeshes = eachMeshGeometriesBase.length;
  const numObjects = eachObjectMeshesBase.length;

  let nextMeshId = 0;

  // Preallocate color array for reuse
  const floatColor = createVec3Float32();

  for (let objectIdx = 0; objectIdx < numObjects; objectIdx++) {
    const objectId = eachObjectId[objectIdx];
    const lastObjectIdx = (numObjects - 1);
    const atLastObject = (objectIdx === lastObjectIdx);
    const firstMeshIdx = eachObjectMeshesBase[objectIdx];
    const lastMeshIdx = atLastObject ? (numMeshes - 1) : (eachObjectMeshesBase[objectIdx + 1] - 1);
    const meshIds = [];

    for (let meshIdx = firstMeshIdx; meshIdx <= lastMeshIdx; meshIdx++) {
      const meshId = `${nextMeshId++}`;
      if (sceneModel) {
        const geometryIdx = eachMeshGeometriesBase[meshIdx];
        // Inline color decompression for speed
        const colorBase = meshIdx * 4;
        floatColor[0] = eachMeshMaterialAttributes[colorBase] / 255;
        floatColor[1] = eachMeshMaterialAttributes[colorBase + 1] / 255;
        floatColor[2] = eachMeshMaterialAttributes[colorBase + 2] / 255;
        const opacity = eachMeshMaterialAttributes[colorBase + 3] / 255.0;
        const matricesBase = eachMeshMatricesBase[meshIdx];
        const matrix = matrices.subarray(matricesBase, matricesBase + 16);
        const geometryId = `${geometryIdx}`;
        if (!sceneModel.geometries[geometryId]) {
          const geometryCompressedParams: any = { id: geometryId };
          // Primitive type switch
          switch (eachGeometryPrimitiveType[geometryIdx]) {
            case 0: geometryCompressedParams.primitive = TrianglesPrimitive; break;
            case 1: geometryCompressedParams.primitive = SolidPrimitive; break;
            case 2: geometryCompressedParams.primitive = SurfacePrimitive; break;
            case 3: geometryCompressedParams.primitive = LinesPrimitive; break;
            case 5: geometryCompressedParams.primitive = PointsPrimitive; break;
          }
          const aabbsBase = eachGeometryAABBBase[geometryIdx];
          geometryCompressedParams.aabb = aabbs.subarray(aabbsBase, aabbsBase + 6);
          let geometryValid = false;
          const atLastGeometry = (geometryIdx === (numGeometries - 1));
          const posStart = eachGeometryPositionsBase[geometryIdx];
          const posEnd = atLastGeometry ? positions.length : eachGeometryPositionsBase[geometryIdx + 1];
          const indStart = eachGeometryIndicesBase[geometryIdx];
          const indEnd = atLastGeometry ? indices.length : eachGeometryIndicesBase[geometryIdx + 1];
          const edgeStart = eachGeometryEdgeIndicesBase[geometryIdx];
          const edgeEnd = atLastGeometry ? edgeIndices.length : eachGeometryEdgeIndicesBase[geometryIdx + 1];
          switch (geometryCompressedParams.primitive) {
            case TrianglesPrimitive:
            case SurfacePrimitive:
            case SolidPrimitive:
              geometryCompressedParams.positionsCompressed = positions.subarray(posStart, posEnd);
              geometryCompressedParams.indices = indices.subarray(indStart, indEnd);
              const edgeIndicesSubArray = edgeIndices.subarray(edgeStart, edgeEnd);
              if (edgeIndicesSubArray.length > 0) {
                geometryCompressedParams.edgeIndices = edgeIndicesSubArray;

                geometryValid = (geometryCompressedParams.positionsCompressed.length > 0 && geometryCompressedParams.indices.length > 0);
              } else {
                geometryValid = false;
              }
              break;
            case PointsPrimitive:
              geometryCompressedParams.positionsCompressed = positions.subarray(posStart, posEnd);
              geometryValid = (geometryCompressedParams.positionsCompressed.length > 0);
              break;
            case LinesPrimitive:
              geometryCompressedParams.positionsCompressed = positions.subarray(posStart, posEnd);
              geometryCompressedParams.indices = indices.subarray(indStart, indEnd);
              geometryValid = (geometryCompressedParams.positionsCompressed.length > 0 && geometryCompressedParams.indices.length > 0);
              break;
            default:
              continue;
          }
          if (geometryValid) {
            sceneModel.createGeometryCompressed(<SceneGeometryCompressedParams>geometryCompressedParams);
          }
        }
        sceneModel.createMesh({
          id: meshId,
          geometryId,
          matrix,
          color: <Vec3>floatColor.slice(0, 3), // Copy to avoid mutation
          opacity
        });
      }
      meshIds.push(meshId);
    }
    if (meshIds.length > 0) {
      if (sceneModel) {
        sceneModel.createObject({
          id: objectId,
          meshIds
        });
      }
      if (dataModel) {
        dataModel.createObject({
          id: objectId,
          name: objectId,
          type: "BasicEntity"
        });
        dataModel.createRelationship({
          type: "BasicAggregation",
          relatingObjectId: defaultId,
          relatedObjectId: objectId
        });
      }
    }
  }
}


