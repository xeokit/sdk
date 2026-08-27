/**
 * Parameters for creating a {@link DataObject | DataObject}.
 *
 * - Passed to {@link DataModel.createObject | DataModel.createObject}.
 * - Located at {@link DataModelParams.objects | DataModelParams.objects}.
 *
 * For detailed usage, refer to {@link model!data | @xeokit/sdk/model/data}.
 */
export interface DataObjectParams {

  /**
   * A globally unique ID for the {@link DataObject | DataObject}.
   *
   * DataObjects are stored by ID in several collections, including {@link Data.objects | Data.objects},
   * {@link Data.rootObjects | Data.rootObjects}, {@link Data.objectsByType | Data.objectsByType},
   * {@link DataModel.objects | DataModel.objects}, and {@link DataModel.rootObjects | DataModel.rootObjects}.
   *
   * For further details, see {@link model!scene | @xeokit/sdk/model/scene}.
   */
  id: string;

  /**
   * The ID of this DataObject in the originating system, if available.
   *
   * Defaults to the value of {@link DataObject.id | DataObject.id} if not provided.
   */
  originalSystemId?: string;

  /**
   * The type of the {@link DataObject | DataObject}.
   */
  type: string;

  /**
   * The schema this DataObject conforms to. Optional.
   *
   * - If the owning DataModel's {@link DataModelParams.schema | schema}
   *   is **defined** (enforced mode), this value must match it or be
   *   omitted. {@link DataModel.createObject} rejects a mismatching
   *   value, and the DataObject inherits the DataModel's schema if
   *   left out.
   *
   * - If the owning DataModel's schema is **undefined** (free mode),
   *   no check is performed and this value is stored as-is — the
   *   DataObject may carry any schema or none.
   */
  schema?: string;

  /**
   * A human-readable name for the DataObject.
   */
  name: string;

  /**
   * A human-readable description of the DataObject.
   */
  description?: string;

  /**
   * A list of IDs for associated {@link PropertySet | PropertySets}, if applicable.
   */
  propertySetIds?: string[];
}
