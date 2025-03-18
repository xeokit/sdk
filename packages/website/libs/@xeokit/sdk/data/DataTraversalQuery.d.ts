import type { Data } from "./Data";
import { SDKError } from "../core";
/**
 * Traverses a {@link data!Data | Data} to collect {@link data!DataObject | DataObjects} that matching given search criteria.
 *
 * See {@link data | @xeokit/sdk/data} for usage.
 */
export declare class DataTraversalQuery {
    private data;
    private startObjectId;
    private includeObjects;
    private excludeObjects;
    private includeRelating;
    private excludeRelating;
    private resultObjectIds;
    constructor(params: {
        data: Data;
    });
    /**
     * TODO
     */
    query(): void | SDKError;
}
//# sourceMappingURL=DataTraversalQuery.d.ts.map