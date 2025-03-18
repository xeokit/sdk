import { Property } from "./Property";
/**
 * A set of {@link Property | Properties} in a {@link data!DataModel | DataModel}.
 *
 * * Created with {@link data!DataModel.createPropertySet | DataModel.createPropertySet}
 * * Stored in {@link data!Data.propertySets | Data.propertySets} and {@link data!DataModel.propertySets | Data.propertySets}
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export class PropertySet {
    /**
     * The DataModels to which this PropertySet belongs.
     */
    models;
    /**
     * Unique ID.
     *
     * PropertySet instances are registered by this ID in {@link data!Data.propertySets | Data.propertySets}
     * and {@link data!DataModel.propertySets | DataModel.propertySets}.
     */
    id;
    /**
     * ID of the corresponding object within the originating system, if any.
     */
    originalSystemId;
    /**
     * Human-readable name of this PropertySet.
     */
    name;
    /**
     * Type of this PropertySet.
     */
    type;
    /**
     * Properties within this PropertySet.
     */
    properties;
    /**
     * @private
     */
    constructor(dataModel, propertySetCfg) {
        this.models = [dataModel];
        this.id = propertySetCfg.id;
        this.name = propertySetCfg.name;
        this.type = propertySetCfg.type;
        this.properties = [];
        if (propertySetCfg.properties) {
            for (let i = 0, len = propertySetCfg.properties.length; i < len; i++) {
                const property = new Property(this, propertySetCfg.properties[i]);
                this.properties.push(property);
            }
        }
    }
}
//# sourceMappingURL=PropertySet.js.map