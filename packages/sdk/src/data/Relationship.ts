import type {DataObject} from "./DataObject";

/**
 * Represents a relationship between two {@link DataObject | DataObjects}.
 *
 * This class defines the connection between two objects in a data model, which can be of any type
 * that identifies the relationship. This relationship is stored within the related and relating
 * attributes of the {@link DataObject | DataObject}.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
 */
export class Relationship {

  /**
   * The type of this Relationship.
   *
   * This value uniquely identifies the relationship type within your DataModel.
   */
  readonly type: string;

  /**
   * The {@link DataObject | DataObject} that is the source of this Relationship.
   *
   * This Relationship will be stored in the {@link DataObject.related | DataObject.related} attribute
   * of the relating DataObject.
   */
  readonly relatingObject: DataObject;

  /**
   * The {@link DataObject | DataObject} that is the target of this Relationship.
   *
   * This Relationship will be stored in the {@link DataObject.relating | DataObject.relating} attribute
   * of the related DataObject.
   */
  readonly relatedObject: DataObject;

  /**
   * Constructs a new Relationship between two {@link DataObject | DataObjects}.
   *
   * @private
   * @param type - The type of relationship.
   * @param relatingObject - The source DataObject in the relationship.
   * @param relatedObject - The target DataObject in the relationship.
   */
  constructor(type: string, relatingObject: DataObject, relatedObject: DataObject) {
    this.type = type;
    this.relatingObject = relatingObject;
    this.relatedObject = relatedObject;
  }
}
