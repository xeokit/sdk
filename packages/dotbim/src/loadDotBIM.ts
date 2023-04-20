import {SceneModel} from "@xeokit/scene";
import {DataModel} from "@xeokit/data";
import {SDKError} from "@xeokit/core/components";


/**
 * Loads .BIM into a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link "@xeokit/dotbim"} for usage.
 *
 * @param params - Loading parameters.
 * @param params.data - .BIM file data.
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @param options - .BIM loading options
 * @returns {@link @xeokit/core/components!SDKError} If the SceneModel has already been destroyed.
 * @returns {@link @xeokit/core/components!SDKError} If the SceneModel has already been built.
 * @returns {@link @xeokit/core/components!SDKError} If the DataModel has already been destroyed.
 * @returns {@link @xeokit/core/components!SDKError} If the DataModel has already been built.
 * @returns {Promise} Resolves when .BIM has been loaded into the SceneModel and/or DataModel.
 */
export function loadDotBIM(params: {
                               data: any,
                               sceneModel: SceneModel,
                               dataModel?: DataModel
                           },
                           options: {
                               rotateX?: boolean;
                           } = {
                               rotateX: false
                           }): Promise<any> {
    if (params.sceneModel.destroyed) {
        throw new Error("SceneModel already destroyed");
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
    return new Promise<void>(function (resolve, reject) {
        const data = params.data;
        const ctx = {
            data,
            sceneModel: params.sceneModel,
            dataModel: params.dataModel,
            nextId: 0
        };
        parseDotBIM(ctx);
        resolve();
    });
}

function parseDotBIM(ctx) {
    const data = ctx.data;
    const meshes = data.meshes;
    for (let i = 0, len = meshes.length; i < len; i++) {
        const mesh = meshes[i];
        ctx.sceneModel.createGeometry({
            id: mesh.mesh_id,
            positions: mesh.coordinates,
            indices: mesh.indices
        });
    }
    const elements = data.elements;
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
