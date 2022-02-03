
import {PropertySet} from "./PropertySet";

/**
 * A property within a {@link PropertySet}.
 */
class Property {

    /**
     * The PropertySet to which this Property belongs.
     */
    public readonly propertySet: PropertySet;

    /**
     * The name of this property.
     */
    public readonly name: string;

    /**
     * The type of this property.
     */
    public readonly type: string | number;

    /**
     * The value of this property.
     */
    public readonly value: any;

    /**
     * The type of this property's value.
     */
    public readonly valueType: string | number;

    /**
     * Informative text to explain the property.
     */
    public readonly description: string;

    /**
     * @private
     * @ignore
     */
    constructor(
        propertySet: PropertySet,
        name: string,
        value: any,
        type: (string | number),
        valueType: (string | number),
        description: string) {
        this.propertySet = propertySet;
        this.name = name;
        this.type = type
        this.value = value
        this.valueType = valueType;
        this.description = description;
    }
}

export {Property};