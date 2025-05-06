import {Component, EventEmitter, SDKError} from "../core";
import {DataModel} from "./DataModel";
import type {DataModelParams} from "./DataModelParams";
import type {DataObject} from "./DataObject";
import {EventDispatcher} from "strongly-typed-events";
import type {PropertySet} from "./PropertySet";

/**
 * Container of model semantic data.
 *
 * A Data is a container of {@link DataModel | DataModels}, {@link DataObject | DataObjects},
 * {@link Relationship | Relationships}, {@link PropertySet | PropertySets}
 * and {@link Property | Properties}.
 *
 * See {@link data | @xeokit/sdk/data}  for usage.
 */
export class Data extends Component {

  /**
   * The {@link DataModel | DataModels} belonging to this Data, each keyed to
   * its {@link DataModel.id | DataModel.id}.
   */
  public readonly models: { [key: string]: DataModel };

  /**
   * The{@link PropertySet | PropertySets} belonging to this Data, mapped to{@link PropertySet.id | PropertySet.id}.
   */
  public readonly propertySets: { [key: string]: PropertySet };

  /**
   * The {@link DataObject | DataObjects} in this Data, mapped to {@link DataObject.id | DataObject.id}.
   */
  public readonly objects: { [key: string]: DataObject };

  /**
   * The root {@link DataObject | DataObjects} belonging to this Data, each keyed to its {@link DataObject.id | DataObject.id}.
   *
   * * This is the set of DataObjects in the DataModels within this Data that are not the *related* participant in
   * any {@link Relationship | Relationships}, where they have no incoming Relationships and
   * their {@link DataObject.relating} property is empty.
   */
  public readonly rootObjects: { [key: string]: DataObject };

  /**
   * The {@link DataObject | DataObjects} belonging to this Data, each map keyed to {@link DataObject.type | DataObject.type},
   * containing {@link DataObject | DataObjects} keyed to {@link DataObject.id | DataObject.id}.
   */
  public readonly objectsByType: { [key: string]: { [key: string]: DataObject } };

  /**
   * Tracks number of {@link DataObject | DataObjects} of each type in this Data.
   */
  public readonly typeCounts: { [key: string]: number };

  /**
   * Emits an event each time a {@link DataModel | DataModel} has been created in this Data.
   *
   * @event
   */
  public readonly onModelCreated: EventEmitter<Data, DataModel>;

  /**
   * Emits an event each time a {@link DataModel | DataModel} has been destroyed within this Data.
   *
   * @event
   */
  public readonly onModelDestroyed: EventEmitter<Data, DataModel>;

  /**
   * Emits an event each time a {@link DataObject | DataObject} is created within this Data.
   *
   * @event
   */
  public readonly onObjectCreated: EventEmitter<Data, DataObject>;

  /**
   * Emits an event each time a {@link DataObject | DataObject} is destroyed within this Data.
   *
   * @event
   */
  public readonly onObjectDestroyed: EventEmitter<Data, DataObject>;

  /**
   * Creates a new Data.
   *
   * See {@link data | @xeokit/sdk/data}   for usage.
   */
  constructor() {

    super(null, {});

    this.models = {};
    this.propertySets = {};
    this.objects = {};
    this.rootObjects = {};
    this.objectsByType = {};
    this.typeCounts = {};

    this.onModelCreated = new EventEmitter(new EventDispatcher<Data, DataModel>());
    this.onModelDestroyed = new EventEmitter(new EventDispatcher<Data, DataModel>());
    this.onObjectCreated = new EventEmitter(new EventDispatcher<Data, DataObject>());
    this.onObjectDestroyed = new EventEmitter(new EventDispatcher<Data, DataObject>());
  }

  /**
   * Creates a new {@link DataModel | DataModel} in this Data.
   *
   * Remember to call {@link DataModel.build | DataModel.build} when you've finished building or loading the DataModel. That will
   * fire events via {@link Data.onModelCreated | Data.onModelCreated} and {@link DataModel.onBuilt | DataModel.onBuilt}, to
   * indicate to any subscribers that the DataModel is built and ready for use.
   *
   * Note that while we're building/loading the DataModel, each call that we make to {@link DataModel.createObject | DataModel.createObject}
   * will create a new {@link DataObject | DataObject}
   * in {@link Data.objects | Data.objects} and {@link DataModel.objects | DataModel.objects}, and will also fire an event
   * via {@link Data.onObjectCreated | Data.onObjectCreated}. However,
   * only when we've received the {@link Data.onModelCreated | Data.onModelCreated} and {@link DataModel.onBuilt | DataModel.onBuilt}
   * events can we actually consider the DataModel to be fully constructed.
   *
   * See {@link data | @xeokit/sdk/data}   for more details on usage.
   *
   * @param  dataModelParams Creation parameters for the new {@link DataModel | DataModel}.
   * @returns {@link DataModel | DataModel}
   * * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * This Data has already been destroyed.
   * * A DataModel with the given ID already exists in this Data.
   */
  createModel(dataModelParams: DataModelParams): DataModel | SDKError {
    if (this.destroyed) {
      return new SDKError("Data already destroyed");
    }
    const id = dataModelParams.id;
    if (this.models[id]) {
      return new SDKError(`DataModel already created in this Data: ${id}`);
    }
    // @ts-ignore
    const dataModel = new DataModel(this, id, dataModelParams);
    this.models[dataModel.id] = dataModel;
    dataModel.onDestroyed.one(() => { // DataModel#destroy() called
      delete this.models[dataModel.id];
      this.onModelDestroyed.dispatch(this, dataModel);
    });
    dataModel.onBuilt.one(() => { // DataModel#build() called
      this.onModelCreated.dispatch(this, dataModel);
    });
    return dataModel;
  }

  /**
   * Gets the {@link DataObject.id}s of the {@link DataObject | DataObjects} that have the given {@link DataObject.type}.
   *
   * See {@link data | @xeokit/sdk/data} for usage.
   *
   * @param type The type.
   * @returns {string[]}
   * * Array of {@link DataObject.id}s on success.
   * @returns *{@link core!SDKError | SDKError}*
   * * This Data has already been destroyed.
   */
  getObjectIdsByType(type: string): string[] | SDKError {
    if (this.destroyed) {
      return new SDKError("Data already destroyed");
    }
    const objects = this.objectsByType[type];
    return objects ? Object.keys(objects) : [];
  }

  /**
   * Destroys all contained {@link DataModel | DataModels}.
   *
   * Fires {@link Data.onModelDestroyed | Data.onModelDestroyed} and {@link DataModel.onDestroyed | DataModel.onDestroyed}
   * for each existing DataModel in this Data.
   *
   * See {@link data | @xeokit/sdk/data}   for usage.
   *
   * @returns *void*
   * * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * This Data has already been destroyed.
   */
  clear(): void | SDKError {
    if (this.destroyed) {
      return new SDKError("Data already destroyed");
    }
    for (const id in this.models) {
      this.models[id].destroy();
    }
  }

  /**
   * Destroys this Data and all contained {@link DataModel | DataModels}.
   *
   * * Fires {@link Data.onModelDestroyed | Data.onModelDestroyed} and {@link DataModel.onDestroyed | DataModel.onDestroyed}
   * for each existing DataModels in this Data.
   * * Unsubscribes all subscribers to {@link Data.onModelCreated | Data.onModelCreated}, {@link Data.onModelDestroyed | Data.onModelDestroyed}, {@link DataModel.onDestroyed | DataModel.onDestroyed}
   *
   * See {@link data | @xeokit/sdk/data}   for usage.
   *
   * @returns *void*
   * * On success.
   * @returns *{@link core!SDKError | SDKError}*
   * * This Data has already been destroyed.
   */
  destroy(): void | SDKError {
    if (this.destroyed) {
      return new SDKError("Data already destroyed");
    }
    this.clear();
    this.onModelCreated.clear();
    this.onModelDestroyed.clear();
    super.destroy();
  }
}

