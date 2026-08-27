/**
 * Parameters for creating a {@link Property | Property}.
 *
 * These parameters are used when creating {@link Property | Properties} within a {@link PropertySet | PropertySet}.
 *
 * For detailed usage, refer to {@link model!data | @xeokit/sdk/model/data}.
 */
export interface PropertyParams {

  /**
   * The name of the {@link Property | Property}.
   */
  name: string;

  /**
   * The value of the {@link Property | Property}.
   * This can be any type of data depending on the property.
   */
  value: any;

  /**
   * The type of the {@link Property | Property}.
   * This could specify the general data type, such as `string`, `number`, etc.
   */
  type?: string;

  /**
   * The type of the {@link Property | Property}'s value.
   * This specifies the value's data type, which can be different from the property's type.
   */
  valueType?: string | number;

  /**
   * A description of the {@link Property | Property}.
   * This is typically used for providing additional context or clarification about the property.
   */
  description?: string;
}
