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
 * Parameters for making a query with {@link Data.query}.
 */
export interface SearchParams {

    /**
     * DataObject to begin traversal at.
     */
    startObjectId?: string;

    /**
     *
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
     * Which {@link Relation} types to exclusively follow in each {@link DataObject.relating}.
     */
    includeRelating?: number[];

    /**
     * Which {@link Relation} types to never follow in each {@link DataObject.related}.
     */
    excludeRelating?: number[];

    /**
     * Which {@link Relation} types to exclusively follow in each {@link DataObject.related}.
     */
    includeRelated?: number[];

    /**
     * Which {@link Relation} types to never follow in each {@link DataObject.relating}.
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