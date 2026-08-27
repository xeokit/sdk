import type {DataModelContentParams} from "./DataModelContentParams";

/**
 * Parameters used to define a {@link model!data.DataModel | DataModel}.
 *
 * These parameters are:
 * * Returned by {@link DataModel.toParams | DataModel.toParams}.
 * * Passed to {@link DataModel.fromParams | DataModel.fromParams} and {@link Data.createModel | Data.createModel}.
 *
 * For detailed usage, refer to {@link model!data | @xeokit/sdk/model/data}.
 */
export interface DataModelParams extends DataModelContentParams {

  /**
   * The unique identifier for the data model.
   *
   * The DataModel is stored in {@link Data.models | Data.models} under this ID.
   */
  id: string;

  /**
   * The project ID associated with the data model, if available.
   */
  projectId?: string | number;

  /**
   * The revision ID of the data model, if available.
   */
  revisionId?: string | number;

  /**
   * The author of the data model, if available.
   */
  author?: string;

  /**
   * The creation date of the data model, if available.
   */
  createdAt?: string;

  /**
   * The application used to create the data model, if known.
   */
  creatingApplication?: string;

  /**
   * The data format / schema this DataModel conforms to (e.g.
   * `"IFC4"`, `"AP214"`, `"MyApp/v1"`).
   *
   * Set once at creation and immutable thereafter (see
   * {@link DataModel.schema}). Provide this when you want the
   * DataModel to enforce schema homogeneity — every
   * {@link DataObjectParams | DataObject},
   * {@link PropertySetParams | PropertySet}, and
   * {@link RelationshipParams | Relationship} added afterwards must
   * either match this value or omit its own `schema` field (in which
   * case it inherits this one); mismatches are rejected by
   * `DataModel.createObject` / `DataModel.createPropertySet` /
   * `DataModel.createRelationship`.
   *
   * Leave this undefined (or omit it) when the DataModel is free to
   * hold a mix of schemas. No schema checks are performed in that
   * case, and each component keeps whatever `schema` value the caller
   * provided.
   */
  schema?: string;
}
