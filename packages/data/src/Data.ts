import * as utils from "@xeokit/core/utils";
import {Component, EventEmitter} from "@xeokit/core/components";

import {DataModel} from "./DataModel";
import type {DataObject} from "./DataObject";
import {PropertySet} from "./PropertySet";
import type {DataModelParams} from "./DataModelParams";
import {EventDispatcher} from "strongly-typed-events";
import type {SearchParams} from "./SearchParams";

/**
 * An entity-relationship semantic data model.
 *
 * See {@link "@xeokit/data"} for usage.
 */
export class Data extends Component {

    /**
     * The {@link @xeokit/data!DataModel | DataModels} belonging to this Data, each keyed to
     * its {@link @xeokit/data!DataModel.id | DataModel.id}.
     */
    public readonly models: { [key: string]: DataModel };

    /**
     * The {@link PropertySet | PropertySets} belonging to this Data, mapped to {@link PropertySet.id | PropertySet.id}.
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
     * Emits an event each time a {@link @xeokit/data!DataModel} has been created in this Data.
     *
     * @event
     */
   public readonly onModelCreated: EventEmitter<Data, DataModel>;

    /**
     * Emits an event each time a {@link @xeokit/data!DataModel} has been destroyed within this Data.
     *
     * @event
     */
   public readonly onModelDestroyed: EventEmitter<Data, DataModel>;

    /**
     * Emits an event each time a {@link DataObject} is created within this Data.
     *
     * @event
     */
   public readonly onObjectCreated: EventEmitter<Data, DataObject>;

    /**
     * Emits an event each time a {@link DataObject} is destroyed within this Data.
     *
     * @event
     */
   public readonly onObjectDestroyed: EventEmitter<Data, DataObject>;

    /**
     * Creates a new Data.
     *
     * See {@link "@xeokit/data"} for usage.
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
     * Creates a new {@link @xeokit/data!DataModel} in this Data.
     *
     * Remember to call {@link DataModel.build | DataModel.build} when you've finished building or loading the DataModel. That will
     * fire events via {@link Data.onModelCreated | Data.onModelCreated} and {@link DataModel.onBuilt | DataModel.onBuilt}, to
     * indicate to any subscribers that the DataModel is built and ready for use.
     *
     * Note that while we're building/loading the SceneModel, each call that we make to {@link DataModel.createObject | DataModel.createObject}
     * will create a new {@link DataObject}
     * in {@link Data.objects | Data.objects} and {@link DataModel.objects | DataModel.objects}, and will also fire an event
     * via {@link Data.onObjectCreated | Data.onObjectCreated}. However,
     * only when we've received the {@link Data.onModelCreated | Data.onModelCreated} and {@link DataModel.onBuilt | DataModel.onBuilt}
     * events can we actually consider the DataModel to be fully constructed.
     *
     * See {@link "@xeokit/data"} for more details on usage.
     *
     * @param  dataModelParams Creation parameters for the new {@link @xeokit/data!DataModel}.
     * @param [options] Options for creating the {@link @xeokit/data!DataModel}.
     * @param [options.includeTypes] When provided, only create {@link DataObject | DataObjects} with types in this list.
     * @param  [options.excludeRelating] When provided, never create {@link DataObject | DataObjects} with types in this list.
     * @throws {@link Error}
     * * This Data has already been destroyed.
     * * A DataModel with the given ID already exists in this Data.
     */
    createModel(
        dataModelParams: DataModelParams,
        options?: {
            includeRelating?: string[],
            excludeRelating?: string[],
        }
    ): DataModel {
        if (this.destroyed) {
            throw new Error("Data already destroyed");
        }
        let id = dataModelParams.id ;
        if (this.models[id]) {
           throw new Error(`DataModel already created in this Data: ${id}`);
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
     * Gets the {@link DataObject.id}s of the {@link DataObject | DataObjects} that have the given {@link DataObject.type}.
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @param type The type.
     * @returns Array of {@link DataObject.id}s.
     * @throws {@link Error}
     * * This Data has already been destroyed.
     */
    getObjectIdsByType(type: string) {
        if (this.destroyed) {
            throw new Error("Data already destroyed");
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
     * See {@link "@xeokit/data"} for usage.
     *
     * @param searchParams Search parameters.
     * @throws {@link Error}
     * * This Data has already been destroyed.
     */
    searchObjects(searchParams: SearchParams) {
        if (this.destroyed) {
            throw new Error("Data already destroyed");
        }
        const includeObjects = (searchParams.includeObjects && searchParams.includeObjects.length > 0) ? arrayToMap(searchParams.includeObjects) : null;
        const excludeObjects = (searchParams.excludeObjects && searchParams.excludeObjects.length > 0) ? arrayToMap(searchParams.excludeObjects) : null;
        const includeRelating = (searchParams.includeRelating && searchParams.includeRelating.length > 0) ? arrayToMap(searchParams.includeRelating) : null;
        const excludeRelating = (searchParams.excludeRelating && searchParams.excludeRelating.length > 0) ? arrayToMap(searchParams.excludeRelating) : null;
        function visit(dataObject: DataObject) {
            if (!dataObject) {
                return;
            }
            let includeObject = true;
            // @ts-ignore
            if (excludeObjects && excludeObjects[dataObject.type]) {
                includeObject = false;
            } else { // @ts-ignore
                if (includeObjects && (!includeObjects[dataObject.type])) {
                    includeObject = false;
                }
            }
            if (includeObject) {
                if (searchParams.resultObjectIds) {
                    searchParams.resultObjectIds.push(dataObject.id);
                } else if (searchParams.resultObjects) {
                    searchParams.resultObjects.push(dataObject);
                } else if (searchParams.resultCallback) {
                    if (searchParams.resultCallback(dataObject)) {
                        return;
                    }
                }
            }
            // const relations = dataObject.related[searchParams.type];
            // if (relations) {
            //     for (let i = 0, len = relations.length; i < len; i++) {
            //         let includeRelation = true;
            //         // @ts-ignore
            //         if (excludeRelating && excludeRelating[dataObject.type]) {
            //             includeRelation = false;
            //         } else { // @ts-ignore
            //             if (includeRelating && (!includeRelating[dataObject.type])) {
            //                 includeRelation = false;
            //             }
            //         }
            //         if (includeRelation) {
            //             visit(relations[i].related);
            //         }
            //     }
            // }
        }

        if (searchParams.startObjectId) {
            const startObject = this.objects[searchParams.startObjectId];
            if (startObject) {
                visit(startObject);
            }
        } else if (searchParams.startObject) {
            if (searchParams.startObject) {
                visit(searchParams.startObject);
            }
        } else {
            for (let id in this.rootObjects) {
                visit(this.rootObjects[id]);
            }
        }
    }

    /**
     * Destroys all contained {@link DataModel | DataModels}.
     *
     * * Fires {@link Data.onModelDestroyed | Data.onModelDestroyed} and {@link DataModel.onDestroyed | DataModel.onDestroyed}
     * for each existing DataModel in this Data.
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @throws {@link Error}
     * * This Data has already been destroyed.
     */
    clear(): void {
        if (this.destroyed) {
            throw new Error("Data already destroyed");
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
     * See {@link "@xeokit/data"} for usage.
     *
     * @throws {@link Error}
     * * This Data has already been destroyed.
     */
    destroy(): void {
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

