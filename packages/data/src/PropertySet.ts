import {Property} from "./Property";
import type {DataModel} from "./DataModel";
import type {PropertySetParams} from "./PropertySetParams";

/**
 * A set of {@link Property | Properties} in a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Created with {@link @xeokit/data!DataModel.createPropertySet | DataModel.createPropertySet}
 * * Stored in {@link @xeokit/data!Data.propertySets | Data.propertySets} and {@link @xeokit/data!DataModel.propertySets | Data.propertySets}
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export class PropertySet {

    /**
     * The DataModels to which this PropertySet belongs.
     */
    public readonly models: DataModel[];

    /**
     * Unique ID.
     *
     * PropertySet instances are registered by this ID in {@link @xeokit/data!Data.propertySets | Data.propertySets}
     * and {@link @xeokit/data!DataModel.propertySets | DataModel.propertySets}.
     */
    public readonly id: string;

    /**
     * ID of the corresponding object within the originating system, if any.
     */
    public readonly originalSystemId?: string;

    /**
     * Human-readable name of this PropertySet.
     */
    public readonly name: string;

    /**
     * Type of this PropertySet.
     */
    public readonly type: string;

    /**
     * Properties within this PropertySet.
     */
    public readonly properties: Property[];

    /**
     * @private
     */
    constructor(
        dataModel: DataModel,
        propertySetCfg: PropertySetParams) {
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
