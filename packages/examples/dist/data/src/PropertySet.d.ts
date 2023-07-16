import { Property } from "./Property";
import type { DataModel } from "./DataModel";
import type { PropertySetParams } from "./PropertySetParams";
/**
 * A set of {@link Property | Properties} in a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Created with {@link @xeokit/data!DataModel.createPropertySet | DataModel.createPropertySet}
 * * Stored in {@link Data.propertySets | Data.propertySets} and {@link DataModel.propertySets | Data.propertySets}
 *
 * See {@link "@xeokit/data"} for usage.
 */
export declare class PropertySet {
    /**
     * The DataModels to which this PropertySet belongs.
     */
    readonly models: DataModel[];
    /**
     * Unique ID.
     *
     * PropertySet instances are registered by this ID in {@link Data.propertySets | Data.propertySets}
     * and {@link DataModel.propertySets | DataModel.propertySets}.
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
     */
    constructor(dataModel: DataModel, propertySetCfg: PropertySetParams);
}
