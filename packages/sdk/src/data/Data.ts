import {SDKErrorType, type SDKResult} from "../core";
import {DataModel} from "./DataModel";
import type {DataModelParams} from "./DataModelParams";
import type {DataObject} from "./DataObject";
import type {PropertySet} from "./PropertySet";
import {DataEvents} from "./DataEvents";
import {createUUID} from "../utils";

/**
 * Represents the root container for semantic data, including models, objects,
 * relationships and property sets.
 *
 * A `Data` serves as the authoritative registry and lifecycle manager of:
 *
 * - {@link DataModel | DataModels}
 * - {@link DataObject | DataObjects}
 * - {@link Relationship | Relationships}
 * - {@link PropertySet | PropertySets}
 *
 * It provides:
 * - A central event hub via {@link DataEvents}
 * - Lifecycle management (creation, destruction, registration)
 * - Error reporting with optional console logging
 *
 * See {@link data | @xeokit/sdk/data} for general usage examples.
 */
export class Data {

  /**
   * A collection of {@link DataModel | DataModels} in this `Data`, keyed by their {@link DataModel.id | ID}.
   */
  public readonly models: { [key: string]: DataModel };

  /**
   * A collection of {@link PropertySet | PropertySets} in this `Data`, keyed by their {@link PropertySet.id | ID}.
   */
  public readonly propertySets: { [key: string]: PropertySet };

  /**
   * A collection of {@link DataObject | DataObjects} in this `Data`, keyed by their {@link DataObject.id | ID}.
   */
  public readonly objects: { [key: string]: DataObject };

  /**
   * A collection of root {@link DataObject | DataObjects} in this `Data`, keyed by their {@link DataObject.id | ID}.
   *
   * Root objects are those that are not the "related" participant in any {@link Relationship | Relationships}.
   */
  public readonly rootObjects: { [key: string]: DataObject };

  /**
   * A collection of {@link DataObject | DataObjects} grouped by their {@link DataObject.type | type}.
   * Each type maps to a collection of objects keyed by their {@link DataObject.id | ID}.
   */
  public readonly objectsByType: { [key: string]: { [key: string]: DataObject } };

  /**
   * Tracks the count of {@link DataObject | DataObjects} for each type in this `Data`.
   */
  public readonly typeCounts: { [key: string]: number };

  /**
   * Events emitted by this `Data` instance.
   */
  public readonly events: DataEvents;

  /**
   * Indicates whether this `Data` instance has been destroyed.
   */
  public destroyed:boolean = false;

  /**
   * Indicates whether to log errors to the console for this Data.
   *
   * Default value is ````false````.
   */
  public logging: boolean = false;

  /**
   * Creates a new Data.
   *
   * See {@link data | @xeokit/sdk/data}   for usage.
   *
   * @param dataParams Parameters for creating this Data.
   * @param dataParams.logging Indicates whether to log errors to the console for this Data.
   */
  constructor(dataParams?:{
    logging?: boolean
  }) {
    this.models = {};
    this.propertySets = {};
    this.objects = {};
    this.rootObjects = {};
    this.objectsByType = {};
    this.typeCounts = {};
    this.logging = dataParams?.logging ?? false;
    this.events = new DataEvents();
  }

  /**
   * Creates a new {@link DataModel | DataModel} in this `Data`.
   *
   * @param dataModelParams The parameters for creating the new {@link DataModel | DataModel}.
   * @returns A result containing the created {@link DataModel | DataModel} on success, or an error message on failure.
   */
  createModel(dataModelParams: DataModelParams): SDKResult<DataModel> {
    if (this.destroyed) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Data.createModel] Cannot create DataModel - Data already destroyed"
      });
    }
    const id = dataModelParams.id || createUUID();
    if (this.models[id]) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[Data.createModel] Cannot create DataModel - DataModel already created in this Data: ${id}`
      });
    }
    // @ts-ignore
    const dataModel = new DataModel(this, id, dataModelParams);
    this.models[dataModel.id] = dataModel;
    this.events.onDataModelCreated.dispatch(this, dataModel);
    return {
      ok: true,
      value: dataModel
    };
  }

  /**
   * Called by a {@link DataModel | DataModel} when it is destroyed.
   * @private
   * @param dataModel
   */
  _destroyModel(dataModel: DataModel) {
    delete this.models[dataModel.id];
    this.events.onDataModelDestroyed.dispatch(this, dataModel);
  }

  /**
   * Retrieves the IDs of {@link DataObject | DataObjects} that have the specified {@link DataObject.type | type}.
   *
   * @param type The type of the objects to retrieve.
   * @returns A result containing an array of object IDs on success, or an error message on failure.
   */
  getObjectIdsByType(type: string): SDKResult<string[]> {
    if (this.destroyed) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Data.getObjectIdsByType] Data already destroyed"
      });
    }
    const objects = this.objectsByType[type];
    return { ok: true, value: objects ? Object.keys(objects) : [] };
  }

  /**
   * Destroys all {@link DataModel | DataModels} contained in this `Data`.
   *
   * Fires the {@link DataEvents.onDataModelDestroyed | DataEvents.onModelDestroyed} event
   * for each destroyed {@link DataModel | DataModel}.
   *
   * @returns A result indicating success or an error message on failure.
   */
  clear(): SDKResult<void> {
    if (this.destroyed) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Data.clear] Data already destroyed"
      });
    }
    for (const id in this.models) {
      this.models[id].destroy();
    }
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Logs an error via the Data's {@link DataEvents.onError | DaraEvents.onError} event.
   * @private
   * @param result
   */
  logError(result:SDKResult<void>) : SDKResult<any>{
    if (result.ok === false) {
      if (this.logging) {
        console.error(`[xeokit Data] ${result.error}`);
      }
      this.events.onError.dispatch(this, result);
    }
    return result;
  }

  /**
   * Destroys this `Data` instance and all contained {@link DataModel | DataModels}.
   *
   * Fires the {@link DataEvents.onDataModelDestroyed | onModelDestroyed} event
   * for each destroyed {@link DataModel | DataModel}.
   *
   * Fires the {@link DataEvents.onDataDestroyed | onDataDestroyed} event.
   *
   * Unsubscribes all event listeners.
   *
   * @returns A result indicating success or an error message on failure.
   */
  destroy(): SDKResult<void> {
    if (this.destroyed) {
      return this.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Data.destroy] Data already destroyed"
      });
    }
    const result = this.clear();
    if (!result.ok) {
      return result;
    }
    this.events.onDataDestroyed.dispatch(this, undefined);
    this.events.destroy();
    return {
      ok: true,
      value: undefined
    };
  }
}

