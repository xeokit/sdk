import { Property } from "./Property";
import type { DataModel } from "./DataModel";
import type { PropertySetParams } from "./PropertySetParams";

/**
 * Represents a set of {@link Property | Properties} within a {@link DataModel | DataModel}.
 *
 * This set is:
 * * Created using {@link DataModel.createPropertySet | DataModel.createPropertySet}.
 * * Stored in {@link Data.propertySets | Data.propertySets} and {@link DataModel.propertySets | DataModel.propertySets}.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
 */
export class PropertySet {

  /**
     * The {@link DataModel | DataModels} that this PropertySet belongs to.
     */
  public readonly models: DataModel[];

  /**
     * The unique identifier for this PropertySet.
     *
     * PropertySet instances are registered by this ID in {@link Data.propertySets | Data.propertySets}
     * and {@link DataModel.propertySets | DataModel.propertySets}.
     */
  public readonly id: string;

  /**
     * The ID of the corresponding object in the originating system, if applicable.
     */
  public readonly originalSystemId?: string;

  /**
     * The human-readable name of this PropertySet.
     */
  public readonly name: string;

  /**
     * The type of this PropertySet.
     */
  public readonly type: string;

  /**
     * The collection of {@link Property | Properties} within this PropertySet.
     */
  public readonly properties: Property[];

  /**
     * Constructs a new PropertySet.
     *
     * @param dataModel - The DataModel to which this PropertySet belongs.
     * @param propertySetCfg - Configuration parameters to initialize the PropertySet.
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
