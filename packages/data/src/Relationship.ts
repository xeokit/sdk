import type {DataObject} from "./DataObject";

/**
 * A one-to-one relationship between two {@link @xeokit/data!DataObject | DataObjects}.
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export class Relationship {

    /**
     * The type of this Relationship.
     *
     * This can be any value that identifies the Relationship type within your DataModel.
     */
    readonly type: number;

    /**
     * The relating {@link @xeokit/data!DataObject | DataObject} in this Relationship.
     *
     * This Relationship will be stored by {@link @xeokit/data!DataObject.type | DataObject.type}
     * in the DataObject's {@link @xeokit/data!DataObject.related | DataObject.related} attribute.
     */
    readonly relatingObject: DataObject;

    /**
     * The related {@link @xeokit/data!DataObject | DataObject} in this Relationship.
     *
     * This Relationship will be stored by {@link @xeokit/data!DataObject.type | DataObject.type} in
     * the DataObject's {@link @xeokit/data!DataObject.relating | DataObject.relating} attribute.
     */
    readonly relatedObject: DataObject;

    /**
     * @private
     * @ignore
     */
    constructor(type: number, relatingObject: DataObject, relatedObject: DataObject) {
        this.type = type;
        this.relatingObject = relatingObject;
        this.relatedObject = relatedObject;
    }
}
