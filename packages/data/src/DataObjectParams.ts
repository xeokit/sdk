/**
 * Parameters to create a {@link DataObject} with {@link DataModel.createObject | DataModel.createObject}.
 *
 * See {@link "@xeokit/data"} for usage.
 */
export interface DataObjectParams {

    /**
     * Globally-unique ID for the {@link DataObject}.
     *
     * DataObjects are stored by ID in {@link Data.objects | Data.objects}, {@link Data.rootObjects | Data.rootObjects}, {@link Data.objectsByType | Data.objectsByType}, {@link DataModel.objects | Data.objects}, {@link DataModel.rootObjects | Data.rootObjects}.
     *
     * See {@link Data} for usage examples.
     */
    id: string;

    /**
     * The {@link DataObject} type.
     */
    type: number;

    /**
     * Human-readable name for the DataObject.
     */
    name: string;

    /**
     * IDs of associated {@link PropertySet | PropertySets}, if any.
     */
    propertySetIds?: string[];
}