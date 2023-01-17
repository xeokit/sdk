
/**
 * Parameters for creating a {@link Relationship} with {@link DataModel.createRelationship}.
 *
 * Also the array element type in {@link DataModelParams.relationships}.
 *
 * See {@link Data} for usage examples.
 */
export interface RelationshipParams {

    /**
     * The relationship type.
     */
    relationType: number,

    /**
     * The relating {@link DataObject}.
     */
    relatingObjectId: string,

    /**
     * The related {@link DataObject}.
     */
    relatedObjectId: string
};