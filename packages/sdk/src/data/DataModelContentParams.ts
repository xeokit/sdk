import type { PropertySetParams } from "./PropertySetParams";
import type { DataObjectParams } from "./DataObjectParams";
import type { RelationshipParams } from "./RelationshipParams";

/**
 * Parameters for populating a {@link DataModel | DataModel} using {@link data!DataModel.fromParams | DataModel.fromParams}.
 *
 * This interface provides the configuration required to load {@link PropertySet | PropertySets},
 * {@link DataObject | DataObjects}, and {@link Relationship | Relationships} into a {@link DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
 */
export interface DataModelContentParams {

  /**
     * Parameters for {@link PropertySet | PropertySets} in the {@link DataModel | DataModel}.
     *
     * This array contains the configuration for the {@link PropertySet | PropertySets} that will be
     * added to the DataModel.
     */
  propertySets?: PropertySetParams[];

  /**
     * Parameters for {@link DataObject | DataObjects} in the {@link DataModel | DataModel}.
     *
     * This array contains the configuration for the {@link DataObject | DataObjects} to be added
     * to the DataModel.
     */
  objects?: DataObjectParams[];

  /**
     * Parameters for {@link Relationship | Relationships} in the {@link DataModel | DataModel}.
     *
     * This array contains the configuration for the {@link Relationship | Relationships} that will
     * be established between the {@link DataObject | DataObjects} within the DataModel.
     */
  relationships?: RelationshipParams[];
}
