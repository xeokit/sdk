import type {DataObject} from "./DataObject";

/**
 * A one-to-one relationship between two {@link DataObject|DataObjects}.
 *
 * See {@link Data} for usage examples.
 *
 * ## Summary
 *
 * * {@link Relationship.type} indicates the type of the relationship
 * * {@link Relationship.relating} the relating DataObject
 * * {@link Relationship.related} the related DataObject
 */
export class Relationship {

    /**
     * The type of this Relationship.
     *
     * This can be any value that identifies the Relationship type within your DataModel.
     */
    readonly type: number;

    /**
     * The relating {@link DataObject} in this Relationship.
     *
     * This Relationship will be stored by {@link DataObject.type} in the DataObject's {@link DataObject.related} attribute.
     */
    readonly relating: DataObject;

    /**
     * The related {@link DataObject} in this Relationship.
     *
     * This Relationship will be stored by {@link DataObject.type} in the DataObject's {@link DataObject.relating} attribute.
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
