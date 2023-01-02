/**
 * Used to create a {@link DataObject} with {@link DataModel.createObject}.
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
     * IDs of associated {@link PropertySet}s, if any.
     */
    propertySetIds?: string[];

    /**
     * Relationships with other DataObjects.
     */
    relations: { [key: number]: (string[]) }
}