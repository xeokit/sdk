import type {PropertySet} from "./PropertySet";
import type {DataModel} from "./DataModel";
import  {Relationship} from "./Relationship";

/**
 *  Semantic data about an object in a {@link DataModel}.
 *
 *  See {@link Data} for usage examples.
 *
 *  ## Summary
 *
 *  * Created with {@link DataModel.createObject}
 *  * Stored in {@link Data.objects} and {@link DataModel.objects}
 */
export class DataObject {

    /**
     * Model metadata.
     */
    public models: DataModel[];

    /**
     * Globally-unique ID.
     *
     * DataObject instances are registered by this ID in {@link Data.objects} and {@link DataModel.objects}.
     */
    public readonly id: string;

    /**
     * Human-readable name.
     */
    public readonly name?: string;

    /**
     * DataObject's type.
     */
    public readonly type: number;

    /**
     * Optional {@link PropertySet}s used by this DataObject.
     */
    public readonly propertySets?: PropertySet[];

    /**
     * {@link Relationship|Relations} in which this DataObject is the {@link Relationship.relating} participant.
     *
     * Each DataObject is mapped here by {@link Relationship.type} and sub-mapped by {@link Relationship.relating}.
     */
    public readonly relating: {
        [key: number]: Relationship[]
    }

    /**
     * {@link Relationship|Relations} in which this DataObject is the {@link Relationship.related} participant.
     *
     * Each DataObject is mapped here by {@link Relationship.type} and sub-mapped by {@link Relationship.related}.
     */
    public readonly related: {
        [key: number]: Relationship[]
    }

    /**
     * @private
     */
    constructor(
        model: DataModel,
        id: string,
        name: string,
        type: number,
        propertySets?: PropertySet[]) {

        this.models = [model];
        this.id = id;
        this.name = name;
        this.type = type;
        this.propertySets = propertySets || [];
        this.related = {};
        this.relating = {};
    }

    /**
     * Creates a {@link Relationship} with another {@link DataObject}.
     *
     * @param relationType The relationship type
     * @param relatedObjectId ID of the related DataObject.
     */
    createRelation(relationType: number, relatedObjectId: string) {
        const relatedObject = this.models[0].data.objects[relatedObjectId];
        if (!relatedObject) {
            console.error(`[createRelation] DataObject not found: ${relatedObjectId}`);
            return;
        }
        const relation = new Relationship(relationType, this, relatedObject);
        relatedObject.relating[relationType].push(relation);
        this.related[relationType].push(relation);
    }

    //
    // /**
    //  * Creates a relationship with another {@link DataObject}.
    //  *
    //  * @param relationType The relationship type
    //  * @param relatedObjectId The related DataObject
    //  */
    // createRelationship(relationType: number, relatedObjectId: string) {
    //     const relation = new Relationship(this.models[0].data, relationType, this, relatedObjectId);
    //     if (!this.related[relationType]) {
    //         this.related[relationType] = [];
    //     }
    //     this.related[relationType].push(relation);
    // }
}
