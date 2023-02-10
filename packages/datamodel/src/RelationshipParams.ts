
/**
 * Parameters for creating a {@link Relationship} with {@link @xeokit/datamodel/DataModel.createRelationship}.
 *
 * Also the array element type in {@link @xeokit/datamodel/DataModelParams.relationships}.
 *
 * See {@link Data} for usage examples.
 */
export interface RelationshipParams {

    /**
     * The relationship type.
     */
    type: number,

    /**
     * The relating {@link DataObject}.
     */
    relatingObjectId: string,

    /**
     * The related {@link DataObject}.
     */
    relatedObjectId: string
}