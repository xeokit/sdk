import type {SceneModel} from "@xeokit/scene";
import type {DataModel} from "@xeokit/data";
import {SDKError} from "@xeokit/core";
import {TrianglesPrimitive} from "@xeokit/constants";
import {typeCodes} from "@xeokit/ifctypes";


/**
 * Loads .BIM into a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link "@xeokit/dotbim" | @xeokit/dotbim} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - .BIM file data.
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @param options - .BIM loading options
 * @param options.error - Callback to log any non-fatal errors that occur while loading.
 * @returns {Promise} Resolves when .BIM has been loaded into the SceneModel and/or DataModel.
 * @throws *{@link @xeokit/core!SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export function loadDotBIM(params: {
                               fileData: any,
                               sceneModel: SceneModel,
                               dataModel?: DataModel
                           },
                           options: {
                               error?: (errMsg: string) => void;
                           } = {}): Promise<any> {
    return new Promise<void>(function (resolve, reject) {
        if (params.sceneModel.destroyed) {
            throw new SDKError("SceneModel already destroyed");
        }
        if (params.sceneModel.built) {
            throw new SDKError("SceneModel already built");
        }
        if (params.dataModel) {
            if (params.dataModel.destroyed) {
                throw new SDKError("DataModel already destroyed");
            }
            if (params.dataModel.built) {
                throw new SDKError("DataModel already built");
            }
        }
        const fileData = params.fileData;
        const ctx = {
            fileData,
            sceneModel: params.sceneModel,
            dataModel: params.dataModel,
            nextId: 0,
            error: options.error || function (errMsg: string) {
            }
        };
        parseDotBIM(ctx);
        resolve();
    });
}

function parseDotBIM(ctx: any) {
    const fileData = ctx.fileData;
    const meshes = fileData.meshes;
    for (let i = 0, len = meshes.length; i < len; i++) {
        const mesh = meshes[i];
        const geometry = ctx.sceneModel.createGeometry({
            id: mesh.mesh_id,
            primitive: TrianglesPrimitive,
            positions: mesh.coordinates,
            indices: mesh.indices
        });
        if (geometry instanceof SDKError) {
            ctx.error(`[SceneModel.createGeometry]: ${geometry.message}`);
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
        if (ctx.sceneModel) {
            const geometryId = element.mesh_id;
            const meshId = `${objectId}-mesh`;
            const vector = element.vector;
            const rotation = element.rotation;
            const color = element.color;
            const mesh = ctx.sceneModel.createMesh({
                id: meshId,
                geometryId,
                color: color ? [color.r / 255.0, color.g / 255.0, color.b / 255.0] : undefined,
                opacity: color? color.a / 255.0 : 1.0,
                quaternion: rotation ? [rotation.qx, rotation.qy, rotation.qz, rotation.qw] : undefined,
                position: vector ? [vector.x, vector.y, vector.z] : undefined
            });
            if (mesh instanceof SDKError) {
                ctx.error(`[SceneModel.createMesh]: ${mesh.message}`);
                continue;
            }
            const sceneObject = ctx.sceneModel.createObject({
                id: objectId,
                meshIds: [meshId]
            });
            if (sceneObject instanceof SDKError) {
                ctx.error(`[SceneModel.createObject]: ${sceneObject.message}`);
                continue;
            }
        }
        if (ctx.dataModel) {
            if (!ctx.dataModel.objects[element.guid]) {
                const dataObject = ctx.dataModel.createObject({
                    id: objectId,
                    type: typeCodes[element.type],
                    name: info.Name,
                    description: info.Description
                });
                if (dataObject instanceof SDKError) {
                    ctx.error(`[SceneModel.createObject]: ${dataObject.message}`);
                }
            }
        }
    }
}
