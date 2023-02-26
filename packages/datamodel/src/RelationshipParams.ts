
/**
 * Parameters for creating a {@link Relationship} with {@link @xeokit/datamodel/DataModel.createRelationship}.
 *
 * See {@link "@xeokit/datamodel"} for usage.
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