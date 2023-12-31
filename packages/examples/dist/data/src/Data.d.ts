import { Component, EventEmitter, SDKError } from "@xeokit/core";
import { DataModel } from "./DataModel";
import type { DataObject } from "./DataObject";
import type { PropertySet } from "./PropertySet";
import type { DataModelParams } from "./DataModelParams";
import type { SearchParams } from "./SearchParams";
/**
 * An entity-relationship semantic data model.
 *
 * See {@link "@xeokit/data"} for usage.
 */
export declare class Data extends Component {
    /**
     * The {@link @xeokit/data!DataModel | DataModels} belonging to this Data, each keyed to
     * its {@link @xeokit/data!DataModel.id | DataModel.id}.
     */
    readonly models: {
        [key: string]: DataModel;
    };
    /**
     * The{@link @xeokit/data!PropertySet | PropertySets} belonging to this Data, mapped to{@link @xeokit/data!PropertySet.id | PropertySet.id}.
     */
    readonly propertySets: {
        [key: string]: PropertySet;
    };
    /**
     * The {@link @xeokit/data!DataObject | DataObjects} in this Data, mapped to {@link @xeokit/data!DataObject.id | DataObject.id}.
     */
    readonly objects: {
        [key: string]: DataObject;
    };
    /**
     * The root {@link @xeokit/data!DataObject | DataObjects} belonging to this Data, each keyed to its {@link @xeokit/data!DataObject.id | DataObject.id}.
     *
     * * This is the set of DataObjects in the DataModels within this Data that are not the *related* participant in
     * any {@link @xeokit/data!Relationship | Relationships}, where they have no incoming Relationships and
     * their {@link @xeokit/data!DataObject.relating} property is empty.
     */
    readonly rootObjects: {
        [key: string]: DataObject;
    };
    /**
     * The {@link @xeokit/data!DataObject | DataObjects} belonging to this Data, each map keyed to {@link @xeokit/data!DataObject.type | DataObject.type},
     * containing {@link @xeokit/data!DataObject | DataObjects} keyed to {@link @xeokit/data!DataObject.id | DataObject.id}.
     */
    readonly objectsByType: {
        [key: string]: {
            [key: string]: DataObject;
        };
    };
    /**
     * Tracks number of {@link @xeokit/data!DataObject | DataObjects} of each type in this Data.
     */
    readonly typeCounts: {
        [key: string]: number;
    };
    /**
     * Emits an event each time a {@link @xeokit/data!DataModel} has been created in this Data.
     *
     * @event
     */
    readonly onModelCreated: EventEmitter<Data, DataModel>;
    /**
     * Emits an event each time a {@link @xeokit/data!DataModel} has been destroyed within this Data.
     *
     * @event
     */
    readonly onModelDestroyed: EventEmitter<Data, DataModel>;
    /**
     * Emits an event each time a {@link @xeokit/data!DataObject} is created within this Data.
     *
     * @event
     */
    readonly onObjectCreated: EventEmitter<Data, DataObject>;
    /**
     * Emits an event each time a {@link @xeokit/data!DataObject} is destroyed within this Data.
     *
     * @event
     */
    readonly onObjectDestroyed: EventEmitter<Data, DataObject>;
    /**
     * Creates a new Data.
     *
     * See {@link "@xeokit/data"} for usage.
     */
    constructor();
    /**
     * Creates a new {@link @xeokit/data!DataModel} in this Data.
     *
     * Remember to call {@link @xeokit/data!DataModel.build | DataModel.build} when you've finished building or loading the DataModel. That will
     * fire events via {@link @xeokit/data!Data.onModelCreated | Data.onModelCreated} and {@link @xeokit/data!DataModel.onBuilt | DataModel.onBuilt}, to
     * indicate to any subscribers that the DataModel is built and ready for use.
     *
     * Note that while we're building/loading the SceneModel, each call that we make to {@link @xeokit/data!DataModel.createObject | DataModel.createObject}
     * will create a new {@link @xeokit/data!DataObject}
     * in {@link @xeokit/data!Data.objects | Data.objects} and {@link @xeokit/data!DataModel.objects | DataModel.objects}, and will also fire an event
     * via {@link @xeokit/data!Data.onObjectCreated | Data.onObjectCreated}. However,
     * only when we've received the {@link @xeokit/data!Data.onModelCreated | Data.onModelCreated} and {@link @xeokit/data!DataModel.onBuilt | DataModel.onBuilt}
     * events can we actually consider the DataModel to be fully constructed.
     *
     * See {@link "@xeokit/data"} for more details on usage.
     *
     * @param  dataModelParams Creation parameters for the new {@link @xeokit/data!DataModel}.
     * @param [options] Options for creating the {@link @xeokit/data!DataModel}.
     * @param [options.includeTypes] When provided, only create {@link @xeokit/data!DataObject | DataObjects} with types in this list.
     * @param  [options.excludeRelating] When provided, never create {@link @xeokit/data!DataObject | DataObjects} with types in this list.
     * @returns {@link @xeokit/data!DataModel}
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * This Data has already been destroyed.
     * * A DataModel with the given ID already exists in this Data.
     */
    createModel(dataModelParams: DataModelParams, options?: {
        includeRelating?: string[];
        excludeRelating?: string[];
    }): DataModel | SDKError;
    /**
     * Gets the {@link @xeokit/data!DataObject.id}s of the {@link DataObject | DataObjects} that have the given {@link DataObject.type}.
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @param type The type.
     * @returns {string[]}
     * * Array of {@link DataObject.id}s on success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * This Data has already been destroyed.
     */
    getObjectIdsByType(type: string): string[] | SDKError;
    /**
     * Finds {@link DataObject | DataObjects} using a customized depth-first traversal.
     *
     * Usually we use this method to recursively find DataObjects of specific {@link DataObject.type | types} within
     * a hierarchy.
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @param searchParams Search parameters.
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * This Data has already been destroyed.
     * * The specified starting DataObject was not found in this Data.
     * * The specified starting DataObject is contained in a different Data than this one.
     */
    searchObjects(searchParams: SearchParams): void | SDKError;
    /**
     * Destroys all contained {@link DataModel | DataModels}.
     *
     * * Fires {@link Data.onModelDestroyed | Data.onModelDestroyed} and {@link DataModel.onDestroyed | DataModel.onDestroyed}
     * for each existing DataModel in this Data.
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * This Data has already been destroyed.
     */
    clear(): void | SDKError;
    /**
     * Destroys this Data and all contained {@link DataModel | DataModels}.
     *
     * * Fires {@link Data.onModelDestroyed | Data.onModelDestroyed} and {@link DataModel.onDestroyed | DataModel.onDestroyed}
     * for each existing DataModels in this Data.
     * * Unsubscribes all subscribers to {@link Data.onModelCreated | Data.onModelCreated}, {@link Data.onModelDestroyed | Data.onModelDestroyed}, {@link DataModel.onDestroyed | DataModel.onDestroyed}
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * This Data has already been destroyed.
     */
    destroy(): void | SDKError;
}
