import  {SceneModel} from "@xeokit/scene";
import  {DataModel} from "@xeokit/data";
import {SDKError} from "@xeokit/core";
import {TrianglesPrimitive} from "@xeokit/constants";
import {ifcTypeCodes} from "@xeokit/ifctypes";
import {FloatArrayParam} from "@xeokit/math";
import {isJSONObject} from "@xeokit/utils";

/**
 * Loads .BIM into a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link "@xeokit/dotbim" | @xeokit/dotbim} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - JSON .BIM file data.
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @param options - .BIM loading options
 * @param options.error - Callback to log any non-fatal errors that occur while loading.
 * @returns {Promise} Resolves when .BIM has been loaded into the SceneModel and/or DataModel.
 * @throws *{@link @xeokit/core!SDKError | SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export function loadDotBIM(params: {
                               fileData: any,
                               sceneModel?: SceneModel,
                               dataModel?: DataModel
                           },
                           options: {
                               translate?: FloatArrayParam,
                               error?: (errMsg: string) => void;
                           } = {}): Promise<any> {
    return new Promise<void>(function (resolve, reject) {
        if (!params) {
            return reject("Argument expected: params");
        }
        const {fileData, sceneModel, dataModel} = params;
        if (!fileData) {
            return reject("Argument expected: fileData");
        }
        if (!isJSONObject(fileData)) {
            return reject("Argument type mismatch: params.fileData should be a JSON object");
        }
        if (sceneModel) {
            if (!(sceneModel instanceof SceneModel)) {
                return reject("Argument type mismatch: params.sceneModel should be a SceneModel");
            }
            if (sceneModel.destroyed) {
                return reject("SceneModel already destroyed");
            }
            if (sceneModel.built) {
                return reject("SceneModel already built");
            }
        }
        if (dataModel) {
            if (!(dataModel instanceof DataModel)) {
                return reject("Argument type mismatch: params.dataModel should be a DataModel");
            }
            if (dataModel.destroyed) {
                return reject("DataModel already destroyed");
            }
            if (dataModel.built) {
                return reject("DataModel already built");
            }
        }
        if (sceneModel || dataModel) {
            const ctx = {
                fileData,
                sceneModel,
                dataModel,
                nextId: 0,
                error: options.error || function (errMsg: string) {
                },
                translate: options.translate
            };
            parseDotBIM(ctx);
        }
        return resolve();
    });
}

function parseDotBIM(ctx: any) {
    const fileData = ctx.fileData;
    if (ctx.sceneModel) {
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
                color: color ? [color.r, color.g, color.b] : undefined,
                opacity: color ? color.a : 1.0,
                quaternion: rotation ? [rotation.qx, rotation.qy, rotation.qz, rotation.qw] : undefined,
                position: vector
                    ? (ctx.translate
                        ? [vector.x + ctx.translate[0], vector.y + ctx.translate[1], vector.z + ctx.translate[2]]
                        : [vector.x, vector.y, vector.z])
                    : (ctx.translate ? ctx.translate : undefined)
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
                    type: ifcTypeCodes[element.type],
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
