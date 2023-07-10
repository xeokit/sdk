import type { PropertySet } from "./PropertySet";
import type { DataModel } from "./DataModel";
import type { Relationship } from "./Relationship";
import type { Data } from "./Data";
/**
 * An object in a {@link @xeokit/data!DataModel}.
 *
 * * Created with {@link DataModel.createObject | DataModel.createObject}
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
     * {@link PropertySet | PropertySets} referenced by this DataObject.
     */
    readonly propertySets?: PropertySet[];
    /**
     * The {@link Relationship | Relations} in which this DataObject is the {@link Relationship.relating} participant.
     *
     * Each DataObject is mapped here by {@link Relationship.type | Relationship.type} and sub-mapped by {@link Relationship.relating | Relationship.relating}.
     */
    readonly relating: {
        [key: number]: Relationship[];
    };
    /**
     * The {@link Relationship | Relationships} in which this DataObject is the {@link Relationship.related} participant.
     *
     * Each DataObject is mapped here by {@link Relationship.type | Relationship.type} and sub-mapped by {@link Relationship.related | Relationship.related}.
     */
    readonly related: {
        [key: number]: Relationship[];
    };
    /**
     * @private
     */
    constructor(data: Data, model: DataModel, id: string, name: string, type: number, propertySets?: PropertySet[]);
}
