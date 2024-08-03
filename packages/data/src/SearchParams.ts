import type {DataObject} from "./DataObject";

/**
 * Parameters for finding {@link @xeokit/data!DataObject | DataObjects} with {@link @xeokit/data!Data.searchObjects | Data.searchObjects}.
 *
 * These parameters configure the way that {@link @xeokit/data!Data.searchObjects | Data.searchObjects} performs its depth-first
 * search to find our {@link @xeokit/data!DataObject | DataObjects}.
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export interface SearchParams {

    /**
     * ID of the DataObject to start traversal at.
     *
     * Overridden by {@link SearchParams.startObject}.
     * */
    startObjectId?: string;

    /**
     * The {@link @xeokit/data!DataObject | DataObject} to start traversal at.
     *
     * Overrides {@link SearchParams.startObjectId}.
     */
    startObject?:DataObject;

    /**
     * Indicates whether to include the {@link SearchParams.startObjectId} or {@link SearchParams.startObject} in search results.
     *
     * Default is true.
     */
    includeStart?:boolean;

    /**
     * Which {@link @xeokit/data!DataObject | DataObject} types to exclusively include in search results.
     */
    includeObjects?: number[];

    /**
     * Which {@link @xeokit/data!DataObject | DataObject} types to never include in search results.
     */
    excludeObjects?: number[];

    /**
     * Which {@link @xeokit/data!Relationship | Relationship} types to exclusively follow in each {@link @xeokit/data!DataObject.relating | DataObject.relating}.
     */
    includeRelating?: number[];

    /**
     * Which {@link @xeokit/data!Relationship | Relationship} types to never follow in each {@link @xeokit/data!DataObject.related | DataObject.related}.
     */
    excludeRelating?: number[];

    /**
     * Which {@link @xeokit/data!Relationship | Relationship} types to exclusively follow in each {@link @xeokit/data!DataObject.related | DataObject.related}.
     */
    includeRelated?: number[];

    /**
     * Which {@link @xeokit/data!Relationship | Relationship} types to never follow in each {@link @xeokit/data!DataObject.relating | DataObject.relating}.
     */
    excludeRelated?: number[];

    /**
     * Collects the search results in a list of {@link @xeokit/data!DataObject | DataObject} IDs.
     *
     * This is mutually exclusive with {@link SearchParams.resultObjects} and {@link SearchParams.resultCallback}.
     */
    resultObjectIds?: string[];

    /**
     * Collects the search results in a list of {@link @xeokit/data!DataObject | DataObjects}.
     *
     * This is mutually exclusive with {@link SearchParams.resultObjectIds} and {@link SearchParams.resultCallback}.
     */
    resultObjects?: DataObject[];

    /**
     * Collects the search results via a callback that's executed on each matching {@link @xeokit/data!DataObject | DataObject}.
     *
     * This is mutually exclusive with {@link SearchParams.resultObjects} and {@link SearchParams.resultObjectIds}.
     */
    resultCallback?: (dataObject: DataObject) => boolean;
}
