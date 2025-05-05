import type { PropertyParams } from "./PropertyParams";
import type { PropertySet } from "./PropertySet";

/**
 * Represents a property in a {@link PropertySet | PropertySet}.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
 */
export class Property {

  /**
     * The {@link PropertySet | PropertySet} to which this Property belongs.
     */
  public readonly propertySet: PropertySet;

  /**
     * The name of this property.
     */
  public readonly name: string;

  /**
     * The value of this property.
     */
  public readonly value: any;

  /**
     * The type of this property (e.g., string, number, etc.).
     */
  public readonly type?: string | number;

  /**
     * The type of this property's value (e.g., string, integer, etc.).
     */
  public readonly valueType?: string | number;

  /**
     * An informative description to explain the purpose or details of the property.
     */
  public readonly description?: string;

  /**
     * @private
     * @ignore
     */
  constructor(
    propertySet: PropertySet,
    propertyCfg: PropertyParams) {
    this.propertySet = propertySet;
    this.name = propertyCfg.name;
    this.type = propertyCfg.type;
    this.value = propertyCfg.value;
    this.valueType = propertyCfg.valueType;
    this.description = propertyCfg.description;
  }
}
