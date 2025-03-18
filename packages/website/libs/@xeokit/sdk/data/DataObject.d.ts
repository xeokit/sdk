import type { PropertySet } from "./PropertySet";
import type { DataModel } from "./DataModel";
import type { Relationship } from "./Relationship";
import type { Data } from "./Data";
/**
 * Represents an object within a {@link DataModel | DataModel}.
 *
 * - Created using {@link DataModel.createObject | DataModel.createObject}.
 * - Stored in {@link Data.objects | Data.objects}, {@link Data.rootObjects | Data.rootObjects},
 *   {@link Data.objectsByType | Data.objectsByType}, {@link DataModel.objects | DataModel.objects},
 *   and {@link DataModel.rootObjects | DataModel.rootObjects}.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
 */
export declare class DataObject {
    /**
     * The {@link Data | Data} instance that contains this DataObject.
     */
    data: Data;
    /**
     * The {@link DataModel | DataModels} that share this DataObject.
     */
    models: DataModel[];
    /**
     * A globally unique identifier for this DataObject.
     *
     * This ID is used to store the DataObject in {@link Data.objects | Data.objects},
     * {@link Data.rootObjects | Data.rootObjects}, {@link Data.objectsByType | Data.objectsByType},
     * and {@link DataModel.rootObjects | DataModel.rootObjects}.
     */
    readonly id: string;
    /**
     * The ID of this DataObject in the originating system, if available.
     *
     * Defaults to the value of {@link DataObject.id | DataObject.id} if not provided.
     */
    originalSystemId?: string;
    /**
     * A human-readable name for this DataObject.
     */
    readonly name?: string;
    /**
     * A human-readable description of this DataObject.
     */
    readonly description?: string;
    /**
     * The type of this DataObject.
     */
    readonly type: number;
    /**
     * A list of {@link PropertySet | PropertySets} referenced by this DataObject.
     */
    readonly propertySets?: PropertySet[];
    /**
     * A map of {@link Relationship | Relationships} in which this DataObject is the {@link Relationship.relatingObject | relatingObject}.
     *
     * Relationships are categorized by {@link Relationship.type | Relationship.type} and further indexed by
     * {@link Relationship.relatingObject | relatingObject}.
     */
    readonly relating: {
        [key: number]: Relationship[];
    };
    /**
     * A map of {@link Relationship | Relationships} in which this DataObject is the {@link Relationship.relatedObject | relatedObject}.
     *
     * Relationships are categorized by {@link Relationship.type | Relationship.type} and further indexed by
     * {@link Relationship.relatedObject | relatedObject}.
     */
    readonly related: {
        [key: number]: Relationship[];
    };
    /**
     * @private
     */
    constructor(data: Data, model: DataModel, id: string, originalSystemId: string, name: string, description: string | undefined, type: number, propertySets?: PropertySet[]);
}
//# sourceMappingURL=DataObject.d.ts.map