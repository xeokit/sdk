import type { DataModel } from "@xeokit/data";
import type { SceneModel } from "@xeokit/scene";
/**
 * Exports a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel} to an ArrayBuffer
 * containing XKT file data.
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * See {@link XKTData} for insights into the structure of an XKT file.
 *
 * @param params
 * @param params.sceneModel - The SceneModel to export to XKT.
 * @param params.dataModel - Optional DataModel to export to XKT.
 * @returns The XKT file data in an ArrayBuffer.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has not yet been built.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has not yet been built.
 */
export declare function saveXKT(params: {
    sceneModel: SceneModel;
    dataModel?: DataModel;
}): ArrayBuffer;
