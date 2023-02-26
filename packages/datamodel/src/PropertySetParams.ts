import type {PropertyParams} from "./PropertyParams";

/**
 * Parameters for creating a {@link PropertySet}.
 *
 * See {@link "@xeokit/datamodel"} for usage.
 */
export interface PropertySetParams {

    /**
     * Unique ID of each PropertySet.
     *
     * PropertySets are stored by ID in {@link Data.propertySets} and {@link DataModel.propertySets}.
     */
    id: string;

    /**
     * ID of each PropertySet's corresponding object within the originating system, if any.
     */
    originalSystemId?: string;

    /**
     * Human-readable name of each PropertySet.
     */
    name: string;

    /**
     * Type of each PropertySet.
     */
    type: string;

    /**
     * The {@link Property | Properties} with each PropertySet.
     */
    properties?: PropertyParams[]
}