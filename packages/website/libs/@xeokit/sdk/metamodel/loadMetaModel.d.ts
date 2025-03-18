import type { DataModel } from "../data";
import { MetaModelParams } from "./MetaModelParams";
/**
 * Loads a legacy xeokit metamodel JSON representation into a {@link data!DataModel | DataModel}.
 *
 * Expects {@link data!DataModel.built | DataModel.built} and
 * {@link data!DataModel.destroyed | DataModel.destroyed} to be ````false````.
 *
 * See {@link "metamodel" | @xeokit/sdk/metamodel} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file data
 * @param params.dataModel - DataModel to load into.
 * @returns {Promise} Resolves when metadata has been loaded.
 * @throws *{@link core!SDKError | SDKError}*
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export declare function loadMetaModel(params: {
    fileData: MetaModelParams;
    dataModel: DataModel;
}): Promise<void>;
//# sourceMappingURL=loadMetaModel.d.ts.map