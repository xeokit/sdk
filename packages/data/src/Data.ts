import * as utils from "@xeokit/core/utils";
import {Component, EventEmitter} from "@xeokit/core/components";

import {DataModel} from "./DataModel";
import type {DataObject} from "./DataObject";
import type {PropertySet} from "./PropertySet";
import type {DataModelParams} from "./DataModelParams";
import {EventDispatcher} from "strongly-typed-events";
import type {SearchParams} from "./SearchParams";

/**
 * An entity-relationship data model.
 *
 * See {@link "@xeokit/data"} for usage.
 */
export class Data extends Component {

    /**
     * Emits an event each time a {@link @xeokit/data!DataModel} is created.
     *
     * @event
     */
    readonly onModelAdded: EventEmitter<Data, DataModel>;

    /**
     * Emits an event each time a {@link @xeokit/data!DataModel} is destroyed.
     *
     * @event
     */
    readonly onModelRemoved: EventEmitter<Data, DataModel>;

    /**
     * Emits an event each time a {@link DataObject} is created.
     *
     * @event
     */
    readonly onObjectCreated: EventEmitter<Data, DataObject>;

    /**
     * Emits an event each time a {@link DataObject} is destroyed.
     *
     * @event
     */
    readonly onObjectDestroyed: EventEmitter<Data, DataObject>;

    /**
     * The {@link @xeokit/data!DataModel|DataModels} belonging to this Data, each keyed to
     * its {@link @xeokit/data!DataModel.id}.
     */
    public readonly models: { [key: string]: DataModel };

    /**
     * The {@link PropertySet|PropertySets} belonging to this Data, each keyed to its {@link PropertySet.id}.
     */
    public readonly propertySets: { [key: string]: PropertySet };

    /**
     * All {@link DataObject|DataObjects} belonging to this Data, each keyed to its {@link DataObject.id}.
     */
    public readonly objects: { [key: string]: DataObject };

    /**
     * The root {@link DataObject|DataObjects} belonging to this Data, each keyed to its {@link DataObject.id}.
     *
     * Root DataObjects are those with {@link DataObject.parent} set to ````null````.
     */
    public readonly rootObjects: { [key: string]: DataObject };

    /**
     * The {@link DataObject|DataObjects} belonging to this Data, each map keyed to {@link DataObject.type},
     * containing {@link DataObject|DataObjects} keyed to {@link DataObject.id}.
     */
    public readonly objectsByType: { [key: string]: { [key: string]: DataObject } };

    /**
     * Tracks number of {@link DataObject|DataObjects} of each type.
     */
    readonly typeCounts: { [key: string]: number };

    /**
     *
     */
    constructor() {

        super(null, {});

        this.models = {};
        this.propertySets = {};
        this.objects = {};
        this.rootObjects = {};
        this.objectsByType = {};
        this.typeCounts = {};

        this.onModelAdded = new EventEmitter(new EventDispatcher<Data, DataModel>());
        this.onModelRemoved = new EventEmitter(new EventDispatcher<Data, DataModel>());
        this.onObjectCreated = new EventEmitter(new EventDispatcher<Data, DataObject>());
        this.onObjectDestroyed = new EventEmitter(new EventDispatcher<Data, DataObject>());
    }

    /**
     * Creates a {@link @xeokit/data!DataModel} in this Data.
     *
     * @param  dataModelParams Data for the {@link @xeokit/data!DataModel}.
     * @param [options] Options for creating the {@link @xeokit/data!DataModel}.
     * @param [options.includeTypes] When provided, only create {@link DataObject|DataObjects} with types in this list.
     * @param  [options.excludeRelating] When provided, never create {@link DataObject|DataObjects} with types in this list.
     * @returns The new DataModel.
     * @see {@link View.createModel}
     */
    createModel(
        dataModelParams: DataModelParams,
        options?: {
            includeRelating?: string[],
            excludeRelating?: string[],
        }
    ): DataModel {
        let id = dataModelParams.id || utils.createUUID();
        if (this.models[id]) {
            this.error(`DataModel with ID "${id}" already exists - will randomly-generate ID`);
            id = utils.createUUID();
        }
        // @ts-ignore
        const dataModel = new DataModel(this, id, dataModelParams, options);
        this.models[dataModel.id] = dataModel;
        dataModel.onDestroyed.one(() => { // DataModel#destroy() called
            delete this.models[dataModel.id];
            this.onModelRemoved.dispatch(this, dataModel);
        });
        this.onModelAdded.dispatch(this, dataModel);
        return dataModel;
    }

    /**
     * Gets the {@link DataObject.id}s of the {@link DataObject|DataObjects} that have the given {@link DataObject.type}.
     *
     * @param type The type.
     * @returns Array of {@link DataObject.id}s.
     */
    getObjectIdsByType(type: string) {
        const objects = this.objectsByType[type];
        return objects ? Object.keys(objects) : [];
    }

    /**
     * Finds {@link DataObject|DataObjects} using a customized depth-first traversal.
     *
     * Usually we use this method to recursively find DataObjects of specific {@link DataObject.type|types} within
     * a hierarchy.
     *
     * See {@link Data} for usage examples.
     *
     * @param searchParams
     */
    searchDataObjects(searchParams: SearchParams) {

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
     * @private
     */
    destroy(): void {
        this.onModelAdded.clear();
        this.onModelRemoved.clear();
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

