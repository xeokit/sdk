import type { PropertySet } from "./PropertySet";
import type { DataModel } from "./DataModel";
import type { Relationship } from "./Relationship";
import type { Data } from "./Data";
/**
 * An object in a {@link @xeokit/data!DataModel}.
 *
 * * Created with {@link @xeokit/data!DataModel.createObject | DataModel.createObject}
 * * Stored in {@link Data.objects | Data.objects}, {@link Data.rootObjects | Data.rootObjects}, {@link Data.objectsByType | Data.objectsByType}, {@link DataModel.objects | Data.objects}, {@link DataModel.rootObjects | Data.rootObjects}
 *
 * See {@link "@xeokit/data"} for usage.
 */
export declare class DataObject {
    /**
     *  {@link Data} that contains this DataObject.
     */
    data: Data;
    /**
     * {@link DataModel | DataModels} that share this DataObject.
     */
    models: DataModel[];
    /**
     * Globally-unique ID.
     *
     * DataObjects are stored by ID in {@link Data.objects | Data.objects}, {@link Data.rootObjects | Data.rootObjects}, {@link Data.objectsByType | Data.objectsByType} and {@link DataModel.rootObjects | Data.rootObjects}.
     */
    readonly id: string;
    /**
     * Human-readable name.
     */
    readonly name?: string;
    /**
     * DataObject's type.
     */
    readonly type: number;
    /**
     *{@link @xeokit/data!PropertySet | PropertySets} referenced by this DataObject.
     */
    readonly propertySets?: PropertySet[];
    /**
     * The {@link @xeokit/data!Relationship | Relations} in which this DataObject is the {@link @xeokit/data!Relationship.relatingObject | Relationship.relatingObject} participant.
     *
     * Each DataObject is mapped here by {@link @xeokit/data!Relationship.type | Relationship.type} and sub-mapped by {@link @xeokit/data!Relationship.relatingObject | Relationship.relatingObject}.
     */
    readonly relating: {
        [key: number]: Relationship[];
    };
    /**
     * The {@link @xeokit/data!Relationship | Relationships} in which this DataObject is the {@link @xeokit/data!Relationship.relatedObject | Relationship.relatedObject} participant.
     *
     * Each DataObject is mapped here by {@link @xeokit/data!Relationship.type | Relationship.type} and sub-mapped by {@link @xeokit/data!Relationship.relatedObject | Relationship.relatedObject}.
     */
    readonly related: {
        [key: number]: Relationship[];
    };
    /**
     * @private
     */
    constructor(data: Data, model: DataModel, id: string, name: string, type: number, propertySets?: PropertySet[]);
}