import {TrianglesPrimitive} from "../../../constants";
import {SDKError} from "../../../core";
import {ModelParser} from "../../../io";
import {ifcTypeCodes} from "../../../ifctypes";

/**
 * @private
 */
export const parse: ModelParser = async (params, options = {
    translate: undefined
}) => {
    return new Promise<void>((resolve, reject) => {
        const fileData = params.fileData;

        if (params.sceneModel) {
            const meshes = fileData.meshes;
            for (let i = 0, len = meshes.length; i < len; i++) {
                const mesh = meshes[i];
                const geometry = params.sceneModel.createGeometry({
                    id: mesh.mesh_id,
                    primitive: TrianglesPrimitive,
                    positions: mesh.coordinates,
                    indices: mesh.indices
                });
                if (geometry instanceof SDKError) {
                    // params.error(`[SceneModel.createGeometry]: ${geometry.message}`);
                }
            }
        }

        const elements = fileData.elements;
        for (let i = 0, len = elements.length; i < len; i++) {
            const element = elements[i];
            const info = element.info;
            const objectId =
                element.guid !== undefined
                    ? `${element.guid}`
                    : (info !== undefined && info.id !== undefined
                        ? info.id
                        : i);

            if (params.sceneModel) {
                const geometryId = element.mesh_id;
                const meshId = `${objectId}-mesh`;
                const vector = element.vector;
                const rotation = element.rotation;
                const color = element.color;
                const mesh = params.sceneModel.createMesh({
                    id: meshId,
                    geometryId,
                    color: color ? [color.r, color.g, color.b] : undefined,
                    opacity: color ? color.a : 1.0,
                    quaternion: rotation ? [rotation.qx, rotation.qy, rotation.qz, rotation.qw] : undefined,
                    position: vector
                        ? (options.translate
                            ? [vector.x + options.translate[0], vector.y + options.translate[1], vector.z + options.translate[2]]
                            : [vector.x, vector.y, vector.z])
                        : (options.translate ? options.translate : undefined)
                });
                if (mesh instanceof SDKError) {
                    // params.error(`[SceneModel.createMesh]: ${mesh.message}`);
                    continue;
                }

                const sceneObject = params.sceneModel.createObject({
                    id: objectId,
                    meshIds: [meshId]
                });
                if (sceneObject instanceof SDKError) {
                    // params.error(`[SceneModel.createObject]: ${sceneObject.message}`);
                    continue;
                }
            }

            if (params.dataModel) {
                if (!params.dataModel.objects[element.guid]) {
                    const dataObject = params.dataModel.createObject({
                        id: objectId,
                        type: ifcTypeCodes[element.type],
                        name: info.Name,
                        description: info.Description
                    });
                    if (dataObject instanceof SDKError) {
                        // params.error(`[SceneModel.createObject]: ${dataObject.message}`);
                    }
                }
            }
        }

        resolve();
    });
};
