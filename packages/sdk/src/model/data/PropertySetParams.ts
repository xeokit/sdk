import type {PropertyParams} from "./PropertyParams";

/**
 * Parameters used to define a {@link PropertySet | PropertySet}.
 *
 * These parameters are:
 * * Passed to {@link DataModel.createPropertySet | DataModel.createPropertySet}.
 * * Located at {@link DataModelParams.propertySets | DataModelParams.propertySets}.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/model/data}.
 */
export interface PropertySetParams {

  /**
   * The unique identifier for the PropertySet.
   *
   * PropertySets are stored by this ID in {@link Data.propertySets | Data.propertySets} and {@link DataModel.propertySets | DataModel.propertySets}.
   */
  id: string;

  /**
   * The ID of this PropertySet in the originating system, if available.
   */
  originalSystemId?: string;

  /**
   * The human-readable name of the PropertySet.
   */
  name: string;

  /**
   * The type of this PropertySet.
   */
  type: string;

  /**
   * The schema this PropertySet conforms to. Optional.
   *
   * - If the owning DataModel's {@link DataModelParams.schema | schema}
   *   is **defined** (enforced mode), this value must match it or be
   *   omitted. {@link DataModel.createPropertySet} rejects a
   *   mismatching value, and a PropertySet that already exists in
   *   another DataModel can only be shared if its schema matches this
   *   DataModel's schema.
   *
   * - If the owning DataModel's schema is **undefined** (free mode),
   *   no check is performed and this value is stored as-is. Reused
   *   PropertySets from other DataModels are accepted regardless of
   *   their schema.
   */
  schema?: string;

  /**
   * The collection of {@link Property | Properties} within the PropertySet.
   */
  properties: PropertyParams[];
}
