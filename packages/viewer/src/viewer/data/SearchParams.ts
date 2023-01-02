import type {DataObject} from "./DataObject";

const foo = {
    startAt: "myObject",
    include: {
        relations: {
            relating: [0, 2],
            related: [1]
        },
        objectTypes: [4]
    },
    exclude: {
        relations: {
            relating: [3],
            related: [2]
        },
        objectTypes: [4]
    }
}

/**
 * Parameters for finding {@link DataObject|DataObjects} with {@link Data.searchDataObjects}.
 *
 * These are parameters configure the depth-first-search that {@link Data.searchDataObjects} will perform
 * to find the DataObjects.
 */
export interface SearchParams {

    /**
     * ID of the DataObject to begin traversal at.
     *
     * Overridden by {@link SearchParams.startObject}.
     * */
    startObjectId?: string;

    /**
     * The {@link DataObject} to begin traversal at.
     *
     * Overrides {@link SearchParams.startObjectId}.
     */
    startObject?:DataObject;

    /**
     * Include {@link SearchParams.startObjectId} in results?
     *
     * Default is true.
     */
    includeStart?:boolean;

    /**
     * Which {@link DataObject} types to exclusively include in results.
     */
    includeObjects?: number[];

    /**
     * Which {@link DataObject} types to never include in results.
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
     * Collects the query results as a list of {@link DataObject} IDs.
     *
     * This is mutually exclusive with {@link SearchParams.objects} and {@link SearchParams.withObjects}.
     */
    resultObjectIds?: string[];

    /**
     * Collects the query results as a list of {@link DataObject|DataObjects}.
     *
     * This is mutually exclusive with {@link SearchParams.objectIds} and {@link SearchParams.withObjects}.
     */
    resultObjects?: DataObject[];

    /**
     * Collects the query results via a callback that's executed on each matching {@link DataObject}.
     *
     * This is mutually exclusive with {@link SearchParams.objects} and {@link SearchParams.objectIds}.
     */
    resultCallback?: (dataObject: DataObject) => boolean;
}