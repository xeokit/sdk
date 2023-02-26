import type {PropertySet} from "./PropertySet";
import type {DataModel} from "./DataModel";
import {Relationship} from "./Relationship";

/**
 * An object in a {@link @xeokit/datamodel/DataModel}.
 *
 * See {@link "@xeokit/datamodel"} for usage.
 */
export class DataObject {

    /**
     * ScratchModel metadata.
     */
    public models: DataModel[];

    /**
     * Globally-unique ID.
     *
     * DataObjects are stored by ID in {@link Data.objects} and {@link @xeokit/datamodel/DataModel.objects}.
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
     * {@link PropertySet|PropertySets} used by this DataObject.
     */
    public readonly propertySets?: PropertySet[];

    /**
     * The {@link Relationship|Relations} in which this DataObject is the {@link Relationship.relating} participant.
     *
     * Each DataObject is mapped here by {@link Relationship.type} and sub-mapped by {@link Relationship.relating}.
     */
    public readonly relating: {
        [key: number]: Relationship[]
    };

    /**
     * The {@link Relationship|Relations} in which this DataObject is the {@link Relationship.related} participant.
     *
     * Each DataObject is mapped here by {@link Relationship.type} and sub-mapped by {@link Relationship.related}.
     */
    public readonly related: {
        [key: number]: Relationship[]
    };

    // /**
    //  * IDs of one or more {@link ViewerObject|ViewerObjects} / {@link ViewObject|ViewObjects} that represent this DataObject.
    //  *
    //  * Only DataObjects that represent some physical object, such as a wall or a roof, will have a representation.
    //  */
    // public readonly representation: string[] | null;

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
        //    this.representation = null;
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
}
