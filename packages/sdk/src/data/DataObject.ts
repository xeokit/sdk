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
 * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
 */
export class DataObject {

  /**
   * The {@link Data | Data} instance that contains this DataObject.
   */
  public data: Data;

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
  originalSystemId?: string;

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
  public readonly type: number;

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
    [key: number]: Relationship[];
  };

  /**
   * A map of {@link Relationship | Relationships} in which this DataObject is the {@link Relationship.relatedObject | relatedObject}.
   *
   * Relationships are categorized by {@link Relationship.type | Relationship.type} and further indexed by
   * {@link Relationship.relatedObject | relatedObject}.
   */
  public readonly related: {
    [key: number]: Relationship[];
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
    type: number,
    propertySets?: PropertySet[]) {

    this.data = data;
    this.models = [model];
    this.id = id;
    this.originalSystemId = originalSystemId;
    this.name = name;
    this.description = description;
    this.type = type;
    this.propertySets = propertySets || [];
    this.related = {};
    this.relating = {};
  }
}
