import {Property} from "./Property";
import {DataModel} from "./DataModel";

/**
 * A set of properties of a model or object within a {@link Viewer}.
 *
 * ## Overview
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
    public readonly originalSystemId: string;

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
        id: string,
        originalSystemId: string,
        name: string,
        type: string,
        properties?: {
            name: string,
            value: any,
            type?: string |number,
            valueType?: string | number,
            description?: string
        }[]) {
        this.dataModel = dataModel;
        this.id = id;
        this.originalSystemId = originalSystemId;
        this.name = name;
        this.type = type;
        this.properties = [];
        if (properties) {
            for (let i = 0, len = properties.length; i < len; i++) {
                this.createProperty(properties[i]);
             }
        }
    }

    /**
     * Creates a Property within this PropertySet.
     * @param cfg
     */
    createProperty(cfg: {
        name: string;
        value: any,
        type?: string |number,
        valueType?: string |number,
        description?: string
    }): Property {
        const property = new Property(this, cfg.name, cfg.value, cfg.type, cfg.valueType, cfg.description);
        this.properties.push(property);
        return property;
    }
}

export {PropertySet};