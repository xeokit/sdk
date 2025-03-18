import { SearchParams } from "./SearchParams";
import { SDKError } from "../core";
import { Data } from "./Data";
/**
 * Finds {@link DataObject | DataObjects} in a {@link Data | Data} using a customized depth-first traversal.
 *
 * Usually we use data method to recursively find DataObjects of specific {@link DataObject.type | types} within
 * a hierarchy.
 *
 * See {@link data | @xeokit/sdk/data}   for usage.
 *
 * @param data The Data to search.
 * @param searchParams Search parameters.
 * @returns *void*
 * * On success.
 * @returns *{@link core!SDKError | SDKError}*
 * * data Data has already been destroyed.
 * * The specified starting DataObject was not found in data Data.
 * * The specified starting DataObject is contained in a different Data than data one.
 */
export declare function searchObjects(data: Data, searchParams: SearchParams): void | SDKError;
//# sourceMappingURL=searchObjects.d.ts.map