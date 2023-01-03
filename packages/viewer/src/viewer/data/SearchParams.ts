import type {DataObject} from "./DataObject";

// const foo = {
//     startAt: "myObject",
//     include: {
//         relations: {
//             relating: [0, 2],
//             related: [1]
//         },
//         objectTypes: [4]
//     },
//     exclude: {
//         relations: {
//             relating: [3],
//             related: [2]
//         },
//         objectTypes: [4]
//     }
// }

/**
 * Parameters for finding {@link DataObject|DataObjects} with {@link Data.searchDataObjects}.
 *
 * These parameters configure the way that {@link Data.searchDataObjects} performs its depth-first
 * search to find our {@link DataObject|DataObjects}.
 *
 * See {@link Data} for usage.
 */
export interface SearchParams {

    /**
     * ID of the DataObject to start traversal at.
     *
     * Overridden by {@link SearchParams.startObject}.
     * */
    startObjectId?: string;

    /**
     * The {@link DataObject} to start traversal at.
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
     * Which {@link DataObject} types to exclusively include in search results.
     */
    includeObjects?: number[];

    /**
     * Which {@link DataObject} types to never include in search results.
     */
    excludeObjects?: number[];

    /**
     * Which {@link Relationship} types to exclusively follow in each {@link DataObject.relating}.
     */
    includeRelating?: number[];

    /**
     * Which {@link Relationship} types to never follow in each {@link DataObject.related}.
     */
    excludeRelating?: number[];

    /**
     * Which {@link Relationship} types to exclusively follow in each {@link DataObject.related}.
     */
    includeRelated?: number[];

    /**
     * Which {@link Relationship} types to never follow in each {@link DataObject.relating}.
     */
    excludeRelated?: number[];

    /**
     * Collects the search results in a list of {@link DataObject} IDs.
     *
     * This is mutually exclusive with {@link SearchParams.resultObjects} and {@link SearchParams.resultCallback}.
     */
    resultObjectIds?: string[];

    /**
     * Collects the search results in a list of {@link DataObject|DataObjects}.
     *
     * This is mutually exclusive with {@link SearchParams.resultObjectIds} and {@link SearchParams.resultCallback}.
     */
    resultObjects?: DataObject[];

    /**
     * Collects the search results via a callback that's executed on each matching {@link DataObject}.
     *
     * This is mutually exclusive with {@link SearchParams.resultObjects} and {@link SearchParams.resultObjectIds}.
     */
    resultCallback?: (dataObject: DataObject) => boolean;
}