/**
 * Parameters to create a {@link DataObject} with {@link @xeokit/datamodel/DataModel.createObject}.
 *
 * Also the element type in {@link @xeokit/datamodel/DataModelParams.objects}.
 */
export interface DataObjectParams {

    /**
     * Globally-unique ID for the new {@link DataObject}.
     *
     * DataObject instances are registered by this ID in {@link Data.objects} and {@link @xeokit/datamodel/DataModel.objects}.
     *
     * See {@link Data} for usage examples.
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
}