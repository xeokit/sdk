import type {DataModel} from "@xeokit/data";
import type {SceneModel} from "@xeokit/scene";
import {SDKError} from "@xeokit/core";
import {decompressPoint3} from "@xeokit/compression";
import {createVec3} from "@xeokit/matrix";

const tempVec3a = createVec3();
const tempVec3b = createVec3();

/**
 * Exports a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel} to a JSON object
 * containing .BIM file data.
 *
 * See {@link @xeokit/dotbim} for usage.
 *
 * @param params
 * @param params.model - The SceneModel to export to .BIM.
 * @param params.dataModel - The DataModel to export to .BIM.
 * @returns The .BIM file data in an JSON object.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has not yet been built.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has not yet been built.
 */
export function saveDotBIM(params: {
    sceneModel: SceneModel,
    dataModel: DataModel
}): Object {
    const sceneModel = params.sceneModel
    const dataModel = params.dataModel;
    if (sceneModel?.destroyed) {
        throw new SDKError("SceneModel already destroyed");
    }
    if (!sceneModel?.built) {
        throw new SDKError("SceneModel not yet built");
    }
    if (dataModel) {
        if (dataModel.destroyed) {
            throw new SDKError("DataModel already destroyed");
        }
        if (!dataModel.built) {
            throw new SDKError("DataModel not yet built");
        }
    }
    return modelToDotBIM({sceneModel, dataModel});
}


function modelToDotBIM(params: { dataModel: DataModel; sceneModel: SceneModel }): Object {
    const geometries = Object.values(params.sceneModel.geometries);
    const meshes = [];
    for (let i = 0, len = geometries.length; i < len; i++) {
        const geometry = geometries[i];
        const positionsDecompressMatrix = geometry.positionsDecompressMatrix;
        const geometryBuckets = geometry.geometryBuckets;
        const coordinates = [];
        const indices = [];
        for (let j = 0, lenj = geometryBuckets.length; j < lenj; j++) {
            // @ts-ignore
            const offset = indices.length;
            const geometryBucket = geometryBuckets[j];
            const positionsCompressed = geometryBucket.positionsCompressed;
            const bucketIndices = geometryBucket.indices;
            if (bucketIndices) {
                for (let k = 0, lenk = positionsCompressed.length; k < lenk; k += 3) {
                    tempVec3a[0] = positionsCompressed[k];
                    tempVec3a[1] = positionsCompressed[k + 1];
                    tempVec3a[2] = positionsCompressed[k + 2];
                    decompressPoint3(tempVec3a, positionsDecompressMatrix, tempVec3b);
                    coordinates.push(tempVec3b[0]);
                    coordinates.push(tempVec3b[1]);
                    coordinates.push(tempVec3b[2]);
                }
                for (let k = 0, lenk = bucketIndices.length; k < lenj; k++) {
                    indices.push(offset + bucketIndices[k]);
                }
            }
        }
        meshes.push({
            mesh_id: geometry.id,
            coordinates,
            indices
        });
    }

    const sceneObjects = Object.values(params.sceneModel.objects);


    const elements: never[] = [];
    for (let i = 0, len = sceneObjects.length; i < len; i++) {
        const sceneObject = sceneObjects[i];


    }

    return {
        meshes,
        elements
    }
}