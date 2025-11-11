import {SDKErrorType, SDKResult} from "../core";
import {DataModel} from "./DataModel";
import type {DataModelParams} from "./DataModelParams";
import type {DataObject} from "./DataObject";
import type {PropertySet} from "./PropertySet";
import {DataEvents} from "./DataEvents";
import {createUUID} from "../utils";

/**
 * Container of model semantic data.
 *
 * A Data is a container of {@link DataModel | DataModels}, {@link DataObject | DataObjects},
 * {@link Relationship | Relationships}, {@link PropertySet | PropertySets}
 * and {@link Property | Properties}.
 *
 * See {@link data | @xeokit/sdk/data}  for usage.
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
  public destroyed = false;

  /**
   * Creates a new Data.
   *
   * See {@link data | @xeokit/sdk/data}   for usage.
   */
  constructor() {

    this.models = {};
    this.propertySets = {};
    this.objects = {};
    this.rootObjects = {};
    this.objectsByType = {};
    this.typeCounts = {};

   this.events = new DataEvents();
  }

  /**
   * Creates a new {@link DataModel | DataModel} in this `Data`.
   *
   * @param dataModelParams The parameters for creating the new {@link DataModel | DataModel}.
   * @returns A result containing the created {@link DataModel | DataModel} on success, or an error message on failure.
   */
  createModel(dataModelParams: DataModelParams): SDKResult<DataModel, string> {
    if (this.destroyed) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "Cannot create DataModel - Data already destroyed"
      };
    }
    const id = dataModelParams.id || createUUID();
    if (this.models[id]) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `Cannot create DataModel - DataModel already created in this Data: ${id}`
      };
    }
    // @ts-ignore
    const dataModel = new DataModel(this, id, dataModelParams);
    this.models[dataModel.id] = dataModel;
    this.events.onModelCreated.dispatch(this, dataModel);
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
    this.events.onModelDestroyed.dispatch(this, dataModel);
  }

  /**
   * Retrieves the IDs of {@link DataObject | DataObjects} that have the specified {@link DataObject.type | type}.
   *
   * @param type The type of the objects to retrieve.
   * @returns A result containing an array of object IDs on success, or an error message on failure.
   */
  getObjectIdsByType(type: string): SDKResult<string[], string> {
    if (this.destroyed) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "Data already destroyed"
      };
    }
    const objects = this.objectsByType[type];
    return { ok: true, value: objects ? Object.keys(objects) : [] };
  }

  /**
   * Destroys all {@link DataModel | DataModels} contained in this `Data`.
   *
   * Fires the {@link DataEvents.onModelDestroyed | DataEvents.onModelDestroyed} event
   * for each destroyed {@link DataModel | DataModel}.
   *
   * @returns A result indicating success or an error message on failure.
   */
  clear(): SDKResult<void, string> {
    if (this.destroyed) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "Data already destroyed"
      };
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
   * Destroys this `Data` instance and all contained {@link DataModel | DataModels}.
   *
   * Fires the {@link DataEvents.onModelDestroyed | onModelDestroyed} event
   * for each destroyed {@link DataModel | DataModel}.
   * Unsubscribes all event listeners.
   *
   * @returns A result indicating success or an error message on failure.
   */
  destroy(): SDKResult<void, string> {
    if (this.destroyed) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "Data already destroyed"
      };
    }
    const result = this.clear();
    if (!result.ok) {
      return result;
    }
    this.events.destroy();
    return { ok: true, value: undefined };
  }
}

