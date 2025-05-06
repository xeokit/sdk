import type {PropertyParams} from "./PropertyParams";

/**
 * Parameters used to define a {@link PropertySet | PropertySet}.
 *
 * These parameters are:
 * * Passed to {@link DataModel.createPropertySet | DataModel.createPropertySet}.
 * * Located at {@link DataModelParams.propertySets | DataModelParams.propertySets}.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
 */
export interface PropertySetParams {

  /**
   * The unique identifier for the PropertySet.
   *
   * PropertySets are stored by this ID in {@link Data.propertySets | Data.propertySets} and {@link DataModel.propertySets | DataModel.propertySets}.
   */
  id: string;

  /**
   * The human-readable name of the PropertySet.
   */
  name: string;

  /**
   * The type of this PropertySet.
   */
  type: string;

  /**
   * The collection of {@link Property | Properties} within the PropertySet.
   */
  properties: PropertyParams[];
}
