import type {PropertyParams} from "./PropertyParams";

/**
 * Parameters for creating a {@link PropertySet} with {@link DataModel.createPropertySet}.
 */
export interface PropertySetParams {

    /**
     * Unique ID of each PropertySet.
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
     * The {@link Property}'s with each PropertySet.
     */
    properties?: PropertyParams[]
}