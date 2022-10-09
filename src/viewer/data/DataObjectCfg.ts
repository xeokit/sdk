/**
 * Parameters for creating a {@link DataObject} with {@link DataModel.createDataObject}.
 */
export interface DataObjectCfg {

    /**
     * Unique ID for the new {@link DataObject}.
     *
     * DataObject instances are registered by this ID in {@link Data.dataObjects} and {@link DataModel.dataObjects}.
     */
    id: string;

    /**
     * ID of the corresponding object within the originating system, if any.
     */
    originalSystemId?: string;

    /**
     * The {@link DataObject}'s type.
     */
    type: string;

    /**
     * Human-readable name.
     */
    name: string;

    /**
     * ID of the parent {@link DataObject}, if any.
     */
    parentId?: string,

    /**
     * IDs of associated {@link PropertySet}s, if any.
     */
    propertySetIds?: string[]
}