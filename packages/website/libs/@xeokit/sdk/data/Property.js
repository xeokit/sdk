/**
 * A property in a {@link data!PropertySet | PropertySet}.
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export class Property {
    /**
     * The PropertySet to which this Property belongs.
     */
    propertySet;
    /**
     * The name of this property.
     */
    name;
    /**
     * The value of this property.
     */
    value;
    /**
     * The type of this property.
     */
    type;
    /**
     * The type of this property's value.
     */
    valueType;
    /**
     * Informative text to explain the property.
     */
    description;
    /**
     * @private
     * @ignore
     */
    constructor(propertySet, propertyCfg) {
        this.propertySet = propertySet;
        this.name = propertyCfg.name;
        this.type = propertyCfg.type;
        this.value = propertyCfg.value;
        this.valueType = propertyCfg.valueType;
        this.description = propertyCfg.description;
    }
}
//# sourceMappingURL=Property.js.map