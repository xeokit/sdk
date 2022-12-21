import {Property} from "./Property";
import type {DataModel} from "./DataModel";
import type {PropertyParams} from "./PropertyParams";
import type {PropertySetParams} from "./PropertySetParams";

/**
 * A set of {@link Property|Properties} within a {@link DataModel}.
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
class PropertySet {

    /**
     * The DataModel to which this PropertySet belongs.
     */
    public readonly dataModel: DataModel;

    /**
     * Unique ID.
     *
     * PropertySet instances are registered by this ID in {@link Data#propertySets} and {@link DataModel#propertySets}.
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
     * @ignore
     */
    constructor(
        dataModel: DataModel,
        propertySetCfg: PropertySetParams) {
        this.dataModel = dataModel;
        this.id = propertySetCfg.id;
        this.originalSystemId = propertySetCfg.originalSystemId;
        this.name = propertySetCfg.name;
        this.type = propertySetCfg.type;
        this.properties = [];
        if (propertySetCfg.properties) {
            for (let i = 0, len = propertySetCfg.properties.length; i < len; i++) {
                this.createProperty(propertySetCfg.properties[i]);
            }
        }
    }

    /**
     * Creates a Property within this PropertySet.
     * @param propertyCfg
     */
    createProperty(propertyCfg: PropertyParams): Property {
        const property = new Property(this, propertyCfg);
        this.properties.push(property);
        return property;
    }
}

export {PropertySet};