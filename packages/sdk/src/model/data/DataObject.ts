import type {Data} from "./Data";
import type {DataModel} from "./DataModel";
import type {PropertySet} from "./PropertySet";
import type {Relationship} from "./Relationship";

/**
 * An object within a {@link DataModel | DataModel}.
 *
 * - Created using {@link DataModel.createObject | DataModel.createObject}.
 * - Stored in {@link Data.objects | Data.objects}, {@link Data.rootObjects | Data.rootObjects},
 *   {@link Data.objectsByType | Data.objectsByType}, {@link DataModel.objects | DataModel.objects},
 *   and {@link DataModel.rootObjects | DataModel.rootObjects}.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/model/data}.
 */
export class DataObject {

  /**
   * The {@link Data | Data} instance that contains this DataObject.
   */
  public readonly data: Data;

  /**
   * The {@link DataModel | DataModels} that share this DataObject.
   */
  public models: DataModel[];

  /**
   * A globally unique identifier for this DataObject.
   *
   * This ID is used to store the DataObject in {@link Data.objects | Data.objects},
   * {@link Data.rootObjects | Data.rootObjects}, {@link Data.objectsByType | Data.objectsByType},
   * and {@link DataModel.rootObjects | DataModel.rootObjects}.
   */
  public readonly id: string;

  /**
   * The ID of this DataObject in the originating system, if available.
   *
   * Defaults to the value of {@link DataObject.id | DataObject.id} if not provided.
   */
 public readonly originalSystemId?: string;

  /**
   * A human-readable name for this DataObject.
   */
  public readonly name?: string;

  /**
   * A human-readable description of this DataObject.
   */
  public readonly description?: string;

  /**
   * The type of this DataObject.
   */
  public readonly type: string;

  /**
   * The schema this DataObject conforms to.
   *
   * Inherited from the owning {@link DataModel.schema} at creation time;
   * a DataObject always has the same schema as the DataModel that created
   * it, and is immutable thereafter. May be undefined if the parent
   * DataModel was created without a schema.
   */
  public readonly schema?: string;

  /**
   * A list of {@link PropertySet | PropertySets} referenced by this DataObject.
   */
  public readonly propertySets?: PropertySet[];

  /**
   * A map of {@link Relationship | Relationships} in which this DataObject is the {@link Relationship.relatingObject | relatingObject}.
   *
   * Relationships are categorized by {@link Relationship.type | Relationship.type} and further indexed by
   * {@link Relationship.relatingObject | relatingObject}.
   */
  public readonly relating: {
    [key: string]: Relationship[];
  };

  /**
   * A map of {@link Relationship | Relationships} in which this DataObject is the {@link Relationship.relatedObject | relatedObject}.
   *
   * Relationships are categorized by {@link Relationship.type | Relationship.type} and further indexed by
   * {@link Relationship.relatedObject | relatedObject}.
   */
  public readonly related: {
    [key: string]: Relationship[];
  };

  /**
   * @private
   */
  constructor(
    data: Data,
    model: DataModel,
    id: string,
    originalSystemId: string,
    name: string,
    description: string | undefined,
    type: string,
    schema?: string,
    propertySets?: PropertySet[]) {

    this.data = data;
    this.models = [model];
    this.id = id;
    this.originalSystemId = originalSystemId;
    this.name = name;
    this.description = description;
    this.type = type;
    this.schema = schema;
    this.propertySets = propertySets || [];
    this.related = {};
    this.relating = {};
  }
}
