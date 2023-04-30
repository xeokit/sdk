import type { DataObject } from "./DataObject";
/**
 * A one-to-one relationship between two {@link DataObject | DataObjects}.
 *
 * See {@link "@xeokit/data"} for usage.
 */
export declare class Relationship {
    /**
     * The type of this Relationship.
     *
     * This can be any value that identifies the Relationship type within your DataModel.
     */
    readonly type: number;
    /**
     * The relating {@link DataObject} in this Relationship.
     *
     * This Relationship will be stored by {@link DataObject.type | DataObject.type}
     * in the DataObject's {@link DataObject.relatedObject | DataObject.relatedObject} attribute.
     */
    readonly relatingObject: DataObject;
    /**
     * The related {@link DataObject} in this Relationship.
     *
     * This Relationship will be stored by {@link DataObject.type | DataObject.type} in
     * the DataObject's {@link DataObject.relatingObject | DataObject.relatingObject} attribute.
     */
    readonly relatedObject: DataObject;
    /**
     * @private
     * @ignore
     */
    constructor(type: number, relatingObject: DataObject, relatedObject: DataObject);
}
