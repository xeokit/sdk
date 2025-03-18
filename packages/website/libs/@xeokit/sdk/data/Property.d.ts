import type { PropertySet } from "./PropertySet";
import type { PropertyParams } from "./PropertyParams";
/**
 * Represents a property in a {@link PropertySet | PropertySet}.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
 */
export declare class Property {
    /**
     * The {@link PropertySet | PropertySet} to which this Property belongs.
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
     * The type of this property (e.g., string, number, etc.).
     */
    readonly type?: string | number;
    /**
     * The type of this property's value (e.g., string, integer, etc.).
     */
    readonly valueType?: string | number;
    /**
     * An informative description to explain the purpose or details of the property.
     */
    readonly description?: string;
    /**
     * @private
     * @ignore
     */
    constructor(propertySet: PropertySet, propertyCfg: PropertyParams);
}
//# sourceMappingURL=Property.d.ts.map