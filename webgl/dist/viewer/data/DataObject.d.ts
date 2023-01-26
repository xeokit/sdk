import type { PropertySet } from "./PropertySet";
import type { DataModel } from "./DataModel";
import { Relationship } from "./Relationship";
/**
 *  An object in a {@link DataModel}.
 *
 *  See {@link Data} for usage examples.
 *
 *  ## Summary
 *
 *  * Created with {@link DataModel.createObject}
 *  * Stored in {@link Data.objects} and {@link DataModel.objects}
 */
export declare class DataObject {
    /**
     * ScratchModel metadata.
     */
    models: DataModel[];
    /**
     * Globally-unique ID.
     *
     * DataObjects are stored by ID in {@link Data.objects} and {@link DataModel.objects}.
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
     * {@link PropertySet|PropertySets} used by this DataObject.
     */
    readonly propertySets?: PropertySet[];
    /**
     * The {@link Relationship|Relations} in which this DataObject is the {@link Relationship.relating} participant.
     *
     * Each DataObject is mapped here by {@link Relationship.type} and sub-mapped by {@link Relationship.relating}.
     */
    readonly relating: {
        [key: number]: Relationship[];
    };
    /**
     * The {@link Relationship|Relations} in which this DataObject is the {@link Relationship.related} participant.
     *
     * Each DataObject is mapped here by {@link Relationship.type} and sub-mapped by {@link Relationship.related}.
     */
    readonly related: {
        [key: number]: Relationship[];
    };
    /**
     * @private
     */
    constructor(model: DataModel, id: string, name: string, type: number, propertySets?: PropertySet[]);
    /**
     * Creates a {@link Relationship} with another {@link DataObject}.
     *
     * @param relationType The relationship type
     * @param relatedObjectId ID of the related DataObject.
     */
    createRelation(relationType: number, relatedObjectId: string): void;
}
