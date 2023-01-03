/**
 * Parameters to create a {@link DataObject} with {@link DataModel.createObject}.
 *
 * Also the element type in {@link DataModelParams.objects}.
 */
export interface DataObjectParams {

    /**
     * Globally-unique ID for the new {@link DataObject}.
     *
     * DataObject instances are registered by this ID in {@link Data.objects} and {@link DataModel.objects}.
     */
    id: string;

    /**
     * The {@link DataObject}'s type.
     */
    type: number;

    /**
     * Human-readable name.
     */
    name: string;

    /**
     * IDs of associated {@link PropertySet|PropertySets}, if any.
     */
    propertySetIds?: string[];

    /**
     * Relationships with other DataObjects.
     */
    relations: { [key: number]: (string[]) }
}