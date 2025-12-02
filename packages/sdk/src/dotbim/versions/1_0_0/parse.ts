import { ifcTypeCodes } from "../../../ifctypes";
import type { ModelParser } from "../../../io";
import { TrianglesPrimitive } from "../../../constants";

/**
 * @private
 */
export const parse: ModelParser = async (params, options) => {
  return new Promise<void>((resolve, reject) => {
    const fileData = params.fileData;

    if (params.sceneModel) {
      const meshes = fileData.meshes;
      if (meshes) {
        for (let i = 0, len = meshes.length; i < len; i++) {
          const mesh = meshes[i];
          const geometryRes = params.sceneModel.createGeometry({
            id: mesh.mesh_id,
            primitive: TrianglesPrimitive,
            positions: mesh.coordinates,
            indices: mesh.indices,
          });

          if (!geometryRes.ok) {
           // Error is logged via Scene.events.onError
          }
        }
      }
    }

    const elements = fileData.elements;
    if (elements) {
      for (let i = 0, len = elements.length; i < len; i++) {
        const element = elements[i];
        const info = element.info;
        const objectId =
            element.guid !== undefined
                ? `${element.guid}`
                : info !== undefined && info.id !== undefined
                    ? info.id
                    : i;

        if (params.sceneModel) {
          const geometryId = element.mesh_id;
          const meshId = `${objectId}-mesh`;
          const vector = element.vector;
          const rotation = element.rotation;
          const color = element.color;

          const meshRes = params.sceneModel.createMesh({
            id: meshId,
            geometryId,
            color: color
                ? [color.r / 255.0, color.g / 255.0, color.b / 255.0]
                : undefined,
            opacity: color ? color.a / 255.0 : 1.0,
            quaternion: rotation
                ? [rotation.qx, rotation.qy, rotation.qz, rotation.qw]
                : undefined,
            position: [vector.x, vector.y, vector.z],
          });

          if (!meshRes.ok) {
            // Error is logged via Scene.events.onError
            continue;
          }

          const sceneObjectRes= params.sceneModel.createObject({
            id: objectId,
            meshIds: [meshId],
          });

          if (!sceneObjectRes.ok) {
            // Error is logged via Scene.events.onError
            continue;
          }
        }

        if (params.dataModel) {
          if (!params.dataModel.objects[element.guid]) {
            const dataObjectRes= params.dataModel.createObject({
              id: objectId,
              type: ifcTypeCodes[element.type],
              name: info?.Name,
              description: info?.Description,
            });

            if (!dataObjectRes.ok) {
             // Error is logged via Data.events.onError
            }
          }
        }
      }
    }

    resolve();
  });
};
