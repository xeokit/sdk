import { EventEmitter, type SDKResult } from "../../base/core";
import { DataModel } from "./DataModel";
import { DataObject } from "./DataObject";
import { Data } from "./Data";
import { EventDispatcher } from "strongly-typed-events";
import { Relationship } from "./Relationship";
import { PropertySet } from "./PropertySet";

/**
 * Defines the events emitted by a {@link Data}.
 *
 * Events describe changes occurring within the {@link Data} or on components
 * owned by the {@link Data}, such as models, objects, relationships, and property sets.
 */
export class DataEvents {

  /**
   * Emits an event when an error occurs within the {@link Data} or any of its child components.
   * This non-fatal event is fired with an `SDKResult` containing error details whenever an operation fails.
   */
  public readonly onError: EventEmitter<Data, SDKResult<any>>;

  /**
   * Emits an event each time a {@link model!data.DataModel | DataModel} is created within the {@link Data}.
   */
  public readonly onDataModelCreated: EventEmitter<Data, DataModel>;

  /**
   * Emits an event each time a {@link model!data.DataModel | DataModel} is destroyed within the {@link Data}.
   */
  public readonly onDataModelDestroyed: EventEmitter<Data, DataModel>;

  /**
   * Emits an event each time a {@link model!data.DataObject | DataObject} is created within the {@link Data}.
   */
  public readonly onDataObjectCreated: EventEmitter<Data, DataObject>;

  /**
   * Emits an event each time a {@link model!data.DataObject | DataObject} is destroyed within the {@link Data}.
   */
  public readonly onDataObjectDestroyed: EventEmitter<Data, DataObject>;

  /**
   * Emits an event each time a {@link Relationship} is created within the {@link Data}.
   */
  public readonly onRelationshipCreated: EventEmitter<Data, Relationship>;

  /**
   * Emits an event each time a {@link Relationship} is destroyed within the {@link Data}.
   */
  public readonly onRelationshipDestroyed: EventEmitter<Data, Relationship>;

  /**
   * Emits an event each time a {@link PropertySet} is created within the {@link Data}.
   */
  public readonly onPropertySetCreated: EventEmitter<Data, PropertySet>;

  /**
   * Emits an event each time a {@link PropertySet} is destroyed within the {@link Data}.
   */
  public readonly onPropertySetDestroyed: EventEmitter<Data, PropertySet>;

  /**
   * Emits an event when the {@link Data} is destroyed.
   */
  public readonly onDataDestroyed: EventEmitter<Data, void> = new EventEmitter(
    new EventDispatcher<Data, void>()
  );

  /**
   * @private
   */
  constructor() {
    this.onError = new EventEmitter(new EventDispatcher<Data, SDKResult<any>>());
    this.onDataDestroyed = new EventEmitter(new EventDispatcher<Data, void>());
    this.onDataModelCreated = new EventEmitter(new EventDispatcher<Data, DataModel>());
    this.onDataModelDestroyed = new EventEmitter(new EventDispatcher<Data, DataModel>());
    this.onDataObjectCreated = new EventEmitter(new EventDispatcher<Data, DataObject>());
    this.onDataObjectDestroyed = new EventEmitter(new EventDispatcher<Data, DataObject>());
    this.onRelationshipCreated = new EventEmitter(new EventDispatcher<Data, Relationship>());
    this.onRelationshipDestroyed = new EventEmitter(new EventDispatcher<Data, Relationship>());
    this.onPropertySetCreated = new EventEmitter(new EventDispatcher<Data, PropertySet>());
    this.onPropertySetDestroyed = new EventEmitter(new EventDispatcher<Data, PropertySet>());
  }

  /**
   * @private
   */
  destroy() {
    this.onError.clear();
    this.onDataDestroyed.clear();
    this.onDataModelCreated.clear();
    this.onDataModelDestroyed.clear();
    this.onDataObjectCreated.clear();
    this.onDataObjectDestroyed.clear();
    this.onRelationshipCreated.clear();
    this.onRelationshipDestroyed.clear();
    this.onPropertySetCreated.clear();
    this.onPropertySetDestroyed.clear();
  }
}
