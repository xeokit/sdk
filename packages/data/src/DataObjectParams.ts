/**
 * Parameters to create a {@link @xeokit/data!DataObject} with {@link @xeokit/data!DataModel.createObject | DataModel.createObject}.
 *
 * See {@link "@xeokit/data"} for usage.
 */
export interface DataObjectParams {

    /**
     * Globally-unique ID for the {@link @xeokit/data!DataObject}.
     *
     * DataObjects are stored by ID in {@link @xeokit/data!Data.objects | Data.objects}, {@link @xeokit/data!Data.rootObjects | Data.rootObjects}, {@link @xeokit/data!Data.objectsByType | Data.objectsByType}, {@link @xeokit/data!DataModel.objects | Data.objects}, {@link @xeokit/data!DataModel.rootObjects | Data.rootObjects}.
     *
     * See {@link @xeokit/data!Data} for usage examples.
     */
    id: string;

    /**
     * The {@link @xeokit/data!DataObject} type.
     */
    type: number;

    /**
     * Human-readable name for the DataObject.
     */
    name: string;

    /**
     * Human-readable description for the DataObject.
     */
    description?: string;

    /**
     * IDs of associated{@link @xeokit/data!PropertySet | PropertySets}, if any.
     */
    propertySetIds?: string[];
}