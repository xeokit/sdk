import {EventEmitter} from "../core";
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
     * Emits an event each time a {@link DataModel | DataModel} has been created in this Data.
     */
    public readonly onModelCreated: EventEmitter<Data, DataModel>;

    /**
     * Emits an event each time a {@link DataModel | DataModel} has been destroyed within this Data.
     */
    public readonly onModelDestroyed: EventEmitter<Data, DataModel>;

    /**
     * Emits an event each time a {@link DataObject | DataObject} is created within this Data.
     */
    public readonly onObjectCreated: EventEmitter<Data, DataObject>;

    /**
     * Emits an event each time a {@link DataObject | DataObject} is destroyed within this Data.
     */
    public readonly onObjectDestroyed: EventEmitter<Data, DataObject>;

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
     * @private
     */
    constructor() {
        this.onModelCreated = new EventEmitter(new EventDispatcher<Data, DataModel>());
        this.onModelDestroyed = new EventEmitter(new EventDispatcher<Data, DataModel>());
        this.onObjectCreated = new EventEmitter(new EventDispatcher<Data, DataObject>());
        this.onObjectDestroyed = new EventEmitter(new EventDispatcher<Data, DataObject>());
        this.onRelationshipCreated = new EventEmitter(new EventDispatcher<Data, Relationship>());
        this.onRelationshipDestroyed = new EventEmitter(new EventDispatcher<Data, Relationship>());
        this.onPropertySetCreated = new EventEmitter(new EventDispatcher<Data, PropertySet>());
        this.onPropertySetDestroyed = new EventEmitter(new EventDispatcher<Data, PropertySet>());
    }

    /**
     * @private
     */
    destroy() {
        this.onModelCreated.clear();
        this.onModelDestroyed.clear();
        this.onObjectCreated.clear();
        this.onObjectDestroyed.clear();
        this.onRelationshipCreated.clear();
        this.onRelationshipDestroyed.clear();
        this.onPropertySetCreated.clear();
        this.onPropertySetDestroyed.clear();
    }
}