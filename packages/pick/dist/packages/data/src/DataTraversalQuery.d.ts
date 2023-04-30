import type { Data } from "./Data";
import { SDKError } from "@xeokit/core";
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
