/**
 * Parameters for a {@link Relationship}.
 *
 * * Passed to  {@link DataModel.createRelationship | DataModel.createRelationship}
 * * Located at {@link DataModelParams.relationships | DataModelParams.relationships}
 *
 * See {@link data | @xeokit/sdk/model/data}   for usage.
 */
export interface RelationshipParams {

  /**
   * The relationship type.
   */
  type: string,

  /**
   * The schema this Relationship belongs to. Optional.
   *
   * - If the owning DataModel's {@link DataModelParams.schema | schema}
   *   is **defined** (enforced mode), this value must match it or be
   *   omitted, and both the relating and related DataObjects must
   *   carry the same schema. {@link DataModel.createRelationship}
   *   rejects on any mismatch.
   *
   * - If the owning DataModel's schema is **undefined** (free mode),
   *   no schema checks are performed. The Relationship may freely
   *   connect DataObjects with different schemas, and is stored with
   *   whatever schema value the caller provided (falling back to the
   *   relating DataObject's schema when omitted).
   */
  schema?: string,

  /**
   * The relating {@link DataObject | DataObject}.
   */
  relatingObjectId: string,

  /**
   * The related {@link DataObject | DataObject}.
   */
  relatedObjectId: string
}
