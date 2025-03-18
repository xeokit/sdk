/**
 * A relationship between two {@link data!DataObject | DataObjects}.
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export class Relationship {
    /**
     * The type of this Relationship.
     *
     * This can be any value that identifies the Relationship type within your DataModel.
     */
    type;
    /**
     * The relating {@link data!DataObject | DataObject} in this Relationship.
     *
     * This Relationship will be stored by {@link data!DataObject.type | DataObject.type}
     * in the DataObject's {@link data!DataObject.related | DataObject.related} attribute.
     */
    relatingObject;
    /**
     * The related {@link data!DataObject | DataObject} in this Relationship.
     *
     * This Relationship will be stored by {@link data!DataObject.type | DataObject.type} in
     * the DataObject's {@link data!DataObject.relating | DataObject.relating} attribute.
     */
    relatedObject;
    /**
     * @private
     * @ignore
     */
    constructor(type, relatingObject, relatedObject) {
        this.type = type;
        this.relatingObject = relatingObject;
        this.relatedObject = relatedObject;
    }
}
//# sourceMappingURL=Relationship.js.map