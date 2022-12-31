import type {DataObject} from "./DataObject";

/**
 * A relationship between two {@link DataObject|DataObjects}.
 *
 * * {@link Relation.type} indicates the type of the relationship. Conceptually this is a verb
 * * {@link Relation.relating} holds the DataObject that is
 * * {@link Relation.related} holds the DataObject that is

 */
export class Relation {

    /**
     * The type of this Relation.
     *
     * This can be any value that identifies the Relation type within your DataModel.
     */
    public readonly type: number;

    /**
     * The relating {@link DataObject} in this Relation.
     *
     * This Relation will be stored by {@link DataObject.type} in the DataObject's {@link DataObject.related} attribute.
     */
    readonly relating: DataObject;

    /**
     * The related {@link DataObject} in this Relation.
     *
     * This Relation will be stored by {@link DataObject.type} in the DataObject's {@link DataObject.relating} attribute.
     */
    readonly related: DataObject;

    /**
     * @private
     * @ignore
     */
    constructor(type: number, relating: DataObject, related: DataObject) {
        this.type = type;
        this.relating = relating;
        this.related = related;
    }
}
