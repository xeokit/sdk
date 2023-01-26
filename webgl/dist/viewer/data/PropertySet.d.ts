import { Property } from "./Property";
import type { DataModel } from "./DataModel";
import type { PropertyParams } from "./PropertyParams";
import type { PropertySetParams } from "./PropertySetParams";
/**
 * A set of {@link Property|Properties} in a {@link DataModel}.
 *
 * See {@link Data} for usage examples.
 *
 * ## Summary
 *
 * * Belongs to a {@link DataModel}
 * * Registered by {@link PropertySet.id} in {@link DataModel.propertySets}
 * * Created with {@link Data.createPropertySet} or {@link DataModel.createPropertySet}
 * * Has {@link Property} components in {@link PropertySet.properties}
 */
declare class PropertySet {
    /**
     * The DataModel to which this PropertySet belongs.
     */
    readonly dataModel: DataModel;
    /**
     * Unique ID.
     *
     * PropertySet instances are registered by this ID in {@link Data#propertySets} and {@link DataModel#propertySets}.
     */
    readonly id: string;
    /**
     * ID of the corresponding object within the originating system, if any.
     */
    readonly originalSystemId?: string;
    /**
     * Human-readable name of this PropertySet.
     */
    readonly name: string;
    /**
     * Type of this PropertySet.
     */
    readonly type: string;
    /**
     * Properties within this PropertySet.
     */
    readonly properties: Property[];
    /**
     * @private
     * @ignore
     */
    constructor(dataModel: DataModel, propertySetCfg: PropertySetParams);
    /**
     * Creates a Property within this PropertySet.
     * @param propertyCfg
     */
    createProperty(propertyCfg: PropertyParams): Property;
}
export { PropertySet };
