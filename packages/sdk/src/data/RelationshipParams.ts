/**
 * Parameters for a {@link Relationship}.
 *
 * * Passed to  {@link DataModel.createRelationship | DataModel.createRelationship}
 * * Located at {@link DataModelParams.relationships | DataModelParams.relationships}
 *
 * See {@link data | @xeokit/sdk/data}   for usage.
 */
export interface RelationshipParams {

  /**
   * The relationship type.
   */
  type: string,

  /**
   * The relating {@link DataObject | DataObject}.
   */
  relatingObjectId: string,

  /**
   * The related {@link DataObject | DataObject}.
   */
  relatedObjectId: string
}
