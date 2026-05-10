import type {DataModelContentParams} from "./DataModelContentParams";

/**
 * Parameters used to define a {@link DataModel}.
 *
 * These parameters are:
 * * Returned by {@link DataModel.toParams | DataModel.toParams}.
 * * Passed to {@link DataModel.fromParams | DataModel.fromParams} and {@link Data.createModel | Data.createModel}.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
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
   * `"IFC4"`, `"AP214"`, `"MyApp/v1"`). Mirrors
   * {@link DataObjectParams.schema} at the model level — handy for
   * tooling that wants the schema id without having to inspect a
   * sample DataObject. Loaders typically stamp this and the
   * per-DataObject `schema` field with the same value.
   */
  schema?: string;
}
