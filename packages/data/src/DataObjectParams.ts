/**
 * Parameters to create a {@link @xeokit/data!DataObject | DataObject} with {@link @xeokit/data!DataModel.createObject | DataModel.createObject}.
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export interface DataObjectParams {

    /**
     * Globally-unique ID for the {@link @xeokit/data!DataObject | DataObject}.
     *
     * DataObjects are stored by ID in {@link @xeokit/data!Data.objects | Data.objects}, {@link @xeokit/data!Data.rootObjects | Data.rootObjects}, {@link @xeokit/data!Data.objectsByType | Data.objectsByType}, {@link @xeokit/data!DataModel.objects | Data.objects}, {@link @xeokit/data!DataModel.rootObjects | Data.rootObjects}.
     *
     * See {@link @xeokit/data!Data | Data} for usage examples.
     */
    id: string;

    /**
     * ID of this DataObject within the originating system, is any. Defaults to the value of
     * {@link @xeokit/data!DataObject.id | DataObject.id}.
     */
    originalSystemId?: string;

    /**
     * The {@link @xeokit/data!DataObject | DataObject} type.
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
