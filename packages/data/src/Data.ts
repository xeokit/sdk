import {Component, EventEmitter, SDKError} from "@xeokit/core";

import {DataModel} from "./DataModel";
import {DataObject} from "./DataObject";
import type {PropertySet} from "./PropertySet";
import type {DataModelParams} from "./DataModelParams";
import {EventDispatcher} from "strongly-typed-events";
import type {SearchParams} from "./SearchParams";

/**
 * An entity-relationship semantic data model.
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export class Data extends Component {

    /**
     * The {@link @xeokit/data!DataModel | DataModels} belonging to this Data, each keyed to
     * its {@link @xeokit/data!DataModel.id | DataModel.id}.
     */
    public readonly models: { [key: string]: DataModel };

    /**
     * The{@link @xeokit/data!PropertySet | PropertySets} belonging to this Data, mapped to{@link @xeokit/data!PropertySet.id | PropertySet.id}.
     */
    public readonly propertySets: { [key: string]: PropertySet };

    /**
     * The {@link @xeokit/data!DataObject | DataObjects} in this Data, mapped to {@link @xeokit/data!DataObject.id | DataObject.id}.
     */
    public readonly objects: { [key: string]: DataObject };

    /**
     * The root {@link @xeokit/data!DataObject | DataObjects} belonging to this Data, each keyed to its {@link @xeokit/data!DataObject.id | DataObject.id}.
     *
     * * This is the set of DataObjects in the DataModels within this Data that are not the *related* participant in
     * any {@link @xeokit/data!Relationship | Relationships}, where they have no incoming Relationships and
     * their {@link @xeokit/data!DataObject.relating} property is empty.
     */
    public readonly rootObjects: { [key: string]: DataObject };

    /**
     * The {@link @xeokit/data!DataObject | DataObjects} belonging to this Data, each map keyed to {@link @xeokit/data!DataObject.type | DataObject.type},
     * containing {@link @xeokit/data!DataObject | DataObjects} keyed to {@link @xeokit/data!DataObject.id | DataObject.id}.
     */
    public readonly objectsByType: { [key: string]: { [key: string]: DataObject } };

    /**
     * Tracks number of {@link @xeokit/data!DataObject | DataObjects} of each type in this Data.
     */
    public readonly typeCounts: { [key: string]: number };

    /**
     * Emits an event each time a {@link @xeokit/data!DataModel | DataModel} has been created in this Data.
     *
     * @event
     */
    public readonly onModelCreated: EventEmitter<Data, DataModel>;

    /**
     * Emits an event each time a {@link @xeokit/data!DataModel | DataModel} has been destroyed within this Data.
     *
     * @event
     */
    public readonly onModelDestroyed: EventEmitter<Data, DataModel>;

    /**
     * Emits an event each time a {@link @xeokit/data!DataObject | DataObject} is created within this Data.
     *
     * @event
     */
    public readonly onObjectCreated: EventEmitter<Data, DataObject>;

    /**
     * Emits an event each time a {@link @xeokit/data!DataObject | DataObject} is destroyed within this Data.
     *
     * @event
     */
    public readonly onObjectDestroyed: EventEmitter<Data, DataObject>;

    /**
     * Creates a new Data.
     *
     * See {@link "@xeokit/data" | @xeokit/data}  for usage.
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
     * Creates a new {@link @xeokit/data!DataModel | DataModel} in this Data.
     *
     * Remember to call {@link @xeokit/data!DataModel.build | DataModel.build} when you've finished building or loading the DataModel. That will
     * fire events via {@link @xeokit/data!Data.onModelCreated | Data.onModelCreated} and {@link @xeokit/data!DataModel.onBuilt | DataModel.onBuilt}, to
     * indicate to any subscribers that the DataModel is built and ready for use.
     *
     * Note that while we're building/loading the SceneModel, each call that we make to {@link @xeokit/data!DataModel.createObject | DataModel.createObject}
     * will create a new {@link @xeokit/data!DataObject | DataObject}
     * in {@link @xeokit/data!Data.objects | Data.objects} and {@link @xeokit/data!DataModel.objects | DataModel.objects}, and will also fire an event
     * via {@link @xeokit/data!Data.onObjectCreated | Data.onObjectCreated}. However,
     * only when we've received the {@link @xeokit/data!Data.onModelCreated | Data.onModelCreated} and {@link @xeokit/data!DataModel.onBuilt | DataModel.onBuilt}
     * events can we actually consider the DataModel to be fully constructed.
     *
     * See {@link "@xeokit/data" | @xeokit/data}  for more details on usage.
     *
     * @param  dataModelParams Creation parameters for the new {@link @xeokit/data!DataModel | DataModel}.
     * @param [options] Options for creating the {@link @xeokit/data!DataModel | DataModel}.
     * @param [options.includeTypes] When provided, only create {@link @xeokit/data!DataObject | DataObjects} with types in this list.
     * @param  [options.excludeRelating] When provided, never create {@link @xeokit/data!DataObject | DataObjects} with types in this list.
     * @returns {@link @xeokit/data!DataModel | DataModel}
     * * On success.
     * @returns *{@link @xeokit/core!SDKError | SDKError}*
     * * This Data has already been destroyed.
     * * A DataModel with the given ID already exists in this Data.
     */
    createModel(
        dataModelParams: DataModelParams,
        options?: {
            includeRelating?: string[],
            excludeRelating?: string[],
        }
    ): DataModel | SDKError {
        if (this.destroyed) {
            return new SDKError("Data already destroyed");
        }
        let id = dataModelParams.id;
        if (this.models[id]) {
            return new SDKError(`DataModel already created in this Data: ${id}`);
        }
        // @ts-ignore
        const dataModel = new DataModel(this, id, dataModelParams, options);
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
     * Gets the {@link @xeokit/data!DataObject.id}s of the {@link DataObject | DataObjects} that have the given {@link DataObject.type}.
     *
     * See {@link "@xeokit/data" | @xeokit/data}  for usage.
     *
     * @param type The type.
     * @returns {string[]}
     * * Array of {@link DataObject.id}s on success.
     * @returns *{@link @xeokit/core!SDKError | SDKError}*
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
     * Finds {@link DataObject | DataObjects} using a customized depth-first traversal.
     *
     * Usually we use this method to recursively find DataObjects of specific {@link DataObject.type | types} within
     * a hierarchy.
     *
     * See {@link "@xeokit/data" | @xeokit/data}  for usage.
     *
     * @param searchParams Search parameters.
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError | SDKError}*
     * * This Data has already been destroyed.
     * * The specified starting DataObject was not found in this Data.
     * * The specified starting DataObject is contained in a different Data than this one.
     */
    searchObjects(searchParams: SearchParams): void | SDKError {
        if (this.destroyed) {
            return new SDKError("Data already destroyed");
        }
        const includeObjects = (searchParams.includeObjects && searchParams.includeObjects.length > 0) ? arrayToMap(searchParams.includeObjects) : null;
        const excludeObjects = (searchParams.excludeObjects && searchParams.excludeObjects.length > 0) ? arrayToMap(searchParams.excludeObjects) : null;
        const includeRelating = (searchParams.includeRelating && searchParams.includeRelating.length > 0) ? arrayToMap(searchParams.includeRelating) : null;
        const excludeRelating = (searchParams.excludeRelating && searchParams.excludeRelating.length > 0) ? arrayToMap(searchParams.excludeRelating) : null;

        function visit(dataObject: DataObject, depth: number) {
            if (!dataObject) {
                return;
            }
            let includeObject = true;
            if (excludeObjects && excludeObjects[dataObject.type]) {
                includeObject = false;
            } else { // @ts-ignore
                if (includeObjects && (!includeObjects[dataObject.type])) {
                    includeObject = false;
                }
            }
            if (depth === 0 && searchParams.includeStart === false) {
                includeObject = false;
            }
            if (includeObject) {
                if (searchParams.resultObjectIds) {
                    searchParams.resultObjectIds.push(dataObject.id);
                } else if (searchParams.resultObjects) {
                    searchParams.resultObjects.push(dataObject);
                } else if (searchParams.resultCallback) {
                    if (searchParams.resultCallback(dataObject)) {
                        return; // Stop searching
                    }
                }
            }
            const related = dataObject.related;
            for (let type in related) {
                const relations = related[type];
                if (relations) {
                    for (let i = 0, len = relations.length; i < len; i++) {
                        let includeRelation = true;
                        if (excludeRelating && excludeRelating[dataObject.type]) {
                            includeRelation = false;
                        } else {
                            if (includeRelating && (!includeRelating[dataObject.type])) {
                                includeRelation = false;
                            }
                        }
                        if (includeRelation) {
                            visit(relations[i].relatedObject, depth + 1);
                        }
                    }
                }
            }
        }

        const depth = 0;
        if (searchParams.startObjectId) {
            const startObject = this.objects[searchParams.startObjectId];
            if (!startObject) {
                return new SDKError(`Failed to search DataObjects - starting DataObject not found in Data: "${searchParams.startObjectId}"`);
            }
            visit(startObject, depth);
        } else if (searchParams.startObject) {
            if (searchParams.startObject.data != this) {
                return new SDKError(`Failed to search DataObjects - starting DataObject not in same Data: "${searchParams.startObjectId}"`);
            }
            visit(searchParams.startObject, depth + 1);
        } else {
            for (let id in this.rootObjects) {
                visit(this.rootObjects[id], depth + 1);
            }
        }
    }

    /**
     * Destroys all contained {@link DataModel | DataModels}.
     *
     * * Fires {@link Data.onModelDestroyed | Data.onModelDestroyed} and {@link DataModel.onDestroyed | DataModel.onDestroyed}
     * for each existing DataModel in this Data.
     *
     * See {@link "@xeokit/data" | @xeokit/data}  for usage.
     *
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError | SDKError}*
     * * This Data has already been destroyed.
     */
    clear(): void | SDKError {
        if (this.destroyed) {
            return new SDKError("Data already destroyed");
        }
        for (let id in this.models) {
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
     * See {@link "@xeokit/data" | @xeokit/data}  for usage.
     *
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError | SDKError}*
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

function arrayToMap(array: any[]): { [key: string]: any } {
    const map: { [key: string]: any } = {};
    for (let i = 0, len = array.length; i < len; i++) {
        map[array[i]] = true;
    }
    return map;
}

