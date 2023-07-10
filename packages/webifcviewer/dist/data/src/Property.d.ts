import type { PropertySet } from "./PropertySet";
import type { PropertyParams } from "./PropertyParams";
/**
 * A property in a {@link PropertySet}.
 *
 * See {@link "@xeokit/data"} for usage.
 */
export declare class Property {
    /**
     * The PropertySet to which this Property belongs.
     */
    readonly propertySet: PropertySet;
    /**
     * The name of this property.
     */
    readonly name: string;
    /**
     * The value of this property.
     */
    readonly value: any;
    /**
     * The type of this property.
     */
    readonly type?: string | number;
    /**
     * The type of this property's value.
     */
    readonly valueType?: string | number;
    /**
     * Informative text to explain the property.
     */
    readonly description?: string;
    /**
     * @private
     * @ignore
     */
    constructor(propertySet: PropertySet, propertyCfg: PropertyParams);
}
