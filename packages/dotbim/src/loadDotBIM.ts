import type {SceneModel} from "@xeokit/scene";
import type {DataModel} from "@xeokit/data";
import {SDKError} from "@xeokit/core";


/**
 * Loads .BIM into a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link "@xeokit/dotbim"} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - .BIM file data.
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @param options - .BIM loading options
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
                               rotateX?: boolean;
                           } = {
                               rotateX: false
                           }): Promise<any> {
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
            nextId: 0
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
        ctx.sceneModel.createGeometry({
            id: mesh.mesh_id,
            positions: mesh.coordinates,
            indices: mesh.indices
        });
    }
    const elements = fileData.elements;
    for (let i = 0, len = elements.length; i < len; i++) {
        const element = elements[i];
        const objectId = element.guid;
        if (ctx.sceneModel) {
            const geometryId = element.mesh_id;
            const meshId = `${objectId}-mesh-${i}`;
            ctx.sceneModel.createMesh({
                id: meshId,
                geometryId,
                baseColor: element.color
            });
            ctx.sceneModel.createObject({
                id: objectId,
                meshIds: [meshId]
            });
        }
        if (ctx.dataModel) {
            ctx.dataModel.createObject({
                id: element.guid,
                type: element.type
            });
        }
    }
}
