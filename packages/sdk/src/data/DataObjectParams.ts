/**
 * Parameters for creating a {@link DataObject | DataObject}.
 *
 * - Passed to {@link DataModel.createObject | DataModel.createObject}.
 * - Located at {@link DataModelParams.objects | DataModelParams.objects}.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
 */
export interface DataObjectParams {

  /**
     * A globally unique ID for the {@link DataObject | DataObject}.
     *
     * DataObjects are stored by ID in several collections, including {@link Data.objects | Data.objects},
     * {@link Data.rootObjects | Data.rootObjects}, {@link Data.objectsByType | Data.objectsByType},
     * {@link DataModel.objects | DataModel.objects}, and {@link DataModel.rootObjects | DataModel.rootObjects}.
     *
     * For further details, see {@link scene | @xeokit/sdk/scene}.
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
  type: number;

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
