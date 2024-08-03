
import type {PropertySetParams} from "./PropertySetParams";
import type {DataObjectParams} from "./DataObjectParams";
import type {RelationshipParams} from "./RelationshipParams";

/**
 * Parameters for creating content within a {@link @xeokit/data!DataModel | DataModel}.
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export interface DataModelContentParams {

    /**
     * The{@link @xeokit/data!PropertySet | PropertySets} in the DataModel.
     */
    propertySets?: PropertySetParams[];

    /**
     * The {@link @xeokit/data!DataObject | DataObjects} in the DataModel.
     */
    objects?: DataObjectParams[];

    /**
     * The {@link @xeokit/data!Relationship | Relationshipships} in the DataModel.
     */
    relationships?: RelationshipParams[];
}
