import {EventEmitter, type SDKResult} from "../core";
import {DataModel} from "./DataModel";
import {DataObject} from "./DataObject";
import {Data} from "./Data";
import {EventDispatcher} from "strongly-typed-events";
import {Relationship} from "./Relationship";
import {PropertySet} from "./PropertySet";

/**
 * Defines the events emitted by a {@link Data | Data}.
 */
export class DataEvents {

    /**
     * Emits an event when an error occurs within the `Data` or its components. This non-fatal event
     * is fired with an `SDKResult` containing error details whenever any operation fails.
     */
    public readonly onError: EventEmitter<Data, SDKResult<any>>;

    /**
     * Emits an event each time a {@link DataModel | DataModel} has been created in this Data.
     */
    public readonly onDataModelCreated: EventEmitter<Data, DataModel>;

    /**
     * Emits an event each time a {@link DataModel | DataModel} has been destroyed within this Data.
     */
    public readonly onDataModelDestroyed: EventEmitter<Data, DataModel>;

    /**
     * Emits an event each time a {@link DataObject | DataObject} is created within this Data.
     */
    public readonly onDataObjectCreated: EventEmitter<Data, DataObject>;

    /**
     * Emits an event each time a {@link DataObject | DataObject} is destroyed within this Data.
     */
    public readonly onDataObjectDestroyed: EventEmitter<Data, DataObject>;

    /**
     * Emits an event each time a {@link Relationship | Relationship} is created within this Data.
     */
    public readonly onRelationshipCreated: EventEmitter<Data, Relationship>;

    /**
     * Emits an event each time a {@link Relationship | Relationship} is destroyed within this Data.
     */
    public readonly onRelationshipDestroyed: EventEmitter<Data, Relationship>;

    /**
     * Emits an event each time a {@link PropertySet | PropertySet} is created within this Data.
     */
    public readonly onPropertySetCreated: EventEmitter<Data, PropertySet>;

    /**
     * Emits an event each time a {@link PropertySet | PropertySet} is destroyed within this Data.
     */
    public readonly onPropertySetDestroyed: EventEmitter<Data, PropertySet>;

    /**
     * Emits an event when the Data itself is destroyed.
     */
    public readonly onDataDestroyed: EventEmitter<Data, void> = new EventEmitter(new EventDispatcher<Data, void>());

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
