import {createMat4Float64, createVec3Float64, createVec4Float64, decomposeMat4, mulMat4} from "../../../matrix";
import {decompressPoint3WithAABB3} from "../../../compression";
import {ifcTypeNames} from "../../../ifctypes";
import type {ModelEncodeParams} from "../../../io";
import {createCoordinateSystemTransform} from "../../../scene";

const tempVec3a = createVec3Float64();
const tempVec3b = createVec3Float64();

const tempMat4a = createMat4Float64();

/**
 * @private
 */
export function encode(params: ModelEncodeParams, options?: any): Promise<any> {

  return new Promise<any>(function (resolve, reject) {

    const {sceneModel, dataModel} = params;

    const coordinateSystemMatrix = options.coordinateSystem
      ? createCoordinateSystemTransform(sceneModel.scene.coordinateSystem, options.coordinateSystem, createMat4Float64())
      : null;

    const dotBim = {
      meshes: [],
      elements: []
    };

    const geometries = Object.values(sceneModel.geometries);

    const meshLookup = {};

    for (let i = 0, len = geometries.length; i < len; i++) {
      const geometry = geometries[i];
      const aabb = geometry.aabb;
      const coordinates = [];
      const positionsCompressed = geometry.positionsCompressed;
      for (let k = 0, lenk = positionsCompressed.length; k < lenk; k += 3) {
        tempVec3a[0] = positionsCompressed[k];
        tempVec3a[1] = positionsCompressed[k + 1];
        tempVec3a[2] = positionsCompressed[k + 2];
        decompressPoint3WithAABB3(tempVec3a, aabb, tempVec3b);
        coordinates.push(tempVec3b[0]);
        coordinates.push(tempVec3b[1]);
        coordinates.push(tempVec3b[2]);
      }
      meshLookup[geometry.id] = {
        mesh_id: geometry.id,
        coordinates,
        indices: geometry.indices ? Array.from(geometry.indices) : []
      };
    }

    const sceneObjects = Object.values(sceneModel.objects);

    for (let i = 0, len = sceneObjects.length; i < len; i++) {
      const sceneObject = sceneObjects[i];
      const meshes = sceneObject.meshes;
      let meshId;
      let dbMesh;
      if (meshes.length === 1) {
        const mesh = meshes[0];
        const geometry = mesh.geometry;
        dbMesh = meshLookup[geometry.id];
        dotBim.meshes.push(dbMesh);
        meshId = geometry.id;
      } else {
        dbMesh = {
          mesh_id: sceneObject.id,
          coordinates: [],
          indices: []
        };
        let indicesOffset = 0;
        for (let j = 0, lenj = meshes.length; j < lenj; j++) {
          const sceneMesh = meshes[j];
          const geometry = sceneMesh.geometry;
          const lookupGeometry = meshLookup[geometry.id];
          const coordinates = lookupGeometry.coordinates;
          for (let k = 0, lenk = coordinates.length; k < lenk; k++) {
            dbMesh.coordinates.push(coordinates[k]);
          }
          const indices = lookupGeometry.indices;
          for (let k = 0, lenk = indices.length; k < lenk; k++) {
            dbMesh.indices.push(indices[k] + indicesOffset);
          }
          indicesOffset += coordinates.length / 3;
        }
        dotBim.meshes.push(dbMesh);
        meshId = sceneObject.id;
      }
      const firstMesh = meshes[0];
      const color = firstMesh.color;
      const position = createVec3Float64();
      const quaternion = createVec4Float64();
      const scale = createVec3Float64();
      const matrix = coordinateSystemMatrix
        ? mulMat4(firstMesh.matrix, coordinateSystemMatrix, tempMat4a)
        : firstMesh.matrix;
      decomposeMat4(matrix, position, quaternion, scale);
      const info: any = {
        id: sceneObject.id,
        Tag: "None"
      };
      let dataObject;
      if (dataModel) {
        dataObject = dataModel.objects[sceneObject.id];
        if (dataObject) {
          info.type = ifcTypeNames[dataObject.type];
          info.Name = dataObject.name;
          info.Description = dataObject.description;
        }
      }
      if (!dataObject) {
        info.type = "None";
        info.Name = "None";
        info.Description = "None";
      }
      dotBim.elements.push({
        info,
        mesh_id: dbMesh.mesh_id,
        type: info.type,
        color: {
          r: color[0],
          g: color[1],
          b: color[2],
          a: firstMesh.opacity
        },
        vector: {
          x: position[0],
          y: position[1],
          z: position[2]
        },
        rotation: {
          qx: quaternion[0],
          qy: quaternion[0],
          qz: quaternion[0],
          qw: quaternion[0]
        },
        qy: quaternion[1],
        qz: quaternion[2],
        qw: quaternion[3]
      });
    }
    return resolve(dotBim);
  });
}
