import type {DataObject} from "./DataObject";

/**
 * A relationship between two {@link DataObject}s.
 */
class Relation {

    /**
     * Containment relationship.
     */
    public static ContainedBy = 0;

    /**
     * Adjacency relationship.
     */
    public static AdjacentTo = 1;

    /**
     * The type of this Relation.
     */
    public readonly type: number;

    /**
     * The source DataObject.
     */
    public readonly source: DataObject;

    /**
     * The target DataObject.
     */
    public readonly target: DataObject;

    /**
     * @private
     * @ignore
     */
    constructor(type: number, source: DataObject, target: DataObject) {
        this.type = type;
        this.source = source;
        this.target = target;
    }
}

export {Relation};