import { DataModel } from "../data";
import { SceneModel } from "../scene";
/**
 * Exports a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel} to a JSON object
 * containing the corresponding .BIM file data.
 *
 * This function allows you to export the data from both a SceneModel and a DataModel into a unified .BIM file format,
 * represented as a JSON object, for further usage or storage.
 *
 * For further usage, refer to {@link dotbim | @xeokit/sdk/dotbim}.
 *
 * @param params - The parameters required for exporting the models to .BIM format.
 * @param params.model - The {@link scene!SceneModel | SceneModel} to export to .BIM format.
 * @param params.dataModel - The {@link data!DataModel | DataModel} to export to .BIM format.
 *
 * @returns A JSON object representing the exported .BIM file data.
 *
 * @throws {@link core!SDKError | SDKError}
 * - If the {@link scene!SceneModel | SceneModel} has already been destroyed.
 * - If the {@link scene!SceneModel | SceneModel} has not yet been built.
 * - If the {@link data!DataModel | DataModel} has already been destroyed.
 * - If the {@link data!DataModel | DataModel} has not yet been built.
 */
export declare function DotBIMWriter(params: {
    sceneModel: SceneModel;
    dataModel?: DataModel;
}): Object;
//# sourceMappingURL=DotBIMExporter.d.ts.map
