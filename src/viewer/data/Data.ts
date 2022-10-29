import {Component} from "../Component";
import {DataModel} from "./DataModel";
import {DataObject} from "./DataObject";
import {PropertySet} from "./PropertySet";
import {Events} from "../Events";
import {Viewer} from "../Viewer";
import {DataModelParams} from "./DataModelParams";
import {createUUID} from "../utils/index";

/**
 * Contains semantic data about the models within a {@link Viewer}.
 *
 * ## Overview
 *
 * * Located at {@link Viewer.data}
 * * Contains {@link DataModel}s to classify the {@link SceneModel}s in the Viewer's {@link Scene}
 * * Contains hierarchies of {@link DataObject}s to classify the {@link SceneObject}s in the Scene
 * * Provides methods to build its MetaModels and objects
 * * Provides methods to iterate and query objects
 */
class Data extends Component {

    /**
     * The {@link Viewer} to which this Data belongs.
     *
     * The Data is located at {@link Viewer.data}.
     */
    declare public readonly viewer: Viewer;

    /**
     * Manages events on this Data.
     */
    declare public readonly events: Events;

    /**
     * The {@link DataModel}s belonging to this Data, each keyed to its {@link DataModel.id}.
     */
    public readonly dataModels: { [key: string]: DataModel };

    /**
     * The {@link PropertySet}s belonging to this Data, each keyed to its {@link PropertySet.id}.
     */
    public readonly propertySets: { [key: string]: PropertySet };

    /**
     * The {@link DataObject}s belonging to this Data, each keyed to its {@link DataObject.id}.
     */
    public readonly objects: { [key: string]: DataObject };

    /**
     * The {@link DataObject}s belonging to this Data, each map keyed to {@link DataObject.type}, containing {@link DataObject}s keyed to {@link DataObject.id}.
     */
    public readonly objectsByType: { [key: string]: { [key: string]: DataObject } };

    /**
     * Tracks number of {@link DataObject}s of each type.
     */
    private readonly typeCounts: { [key: string]: number };

    /**
     * @private
     */
    constructor(viewer: Viewer) {

        super();

        this.viewer = viewer;
        this.dataModels = {};
        this.propertySets = {};
        this.objects = {};
        this.objectsByType = {};
        this.typeCounts = {};
    }

    /**
     * Creates a {@link DataModel} in this Data.
     *
     * @param  dataModelCfg Data for the {@link DataModel}.
     * @param [options] Options for creating the {@link DataModel}.
     * @param [options.includeTypes] When provided, only create {@link DataObject}s with types in this list.
     * @param  [options.excludeTypes] When provided, never create {@link DataObject}s with types in this list.
     * @param [options.globalizeObjectIds=false] Whether to globalize each {@link DataObject.id}. Set this ````true```` when you need to load multiple instances of the same meta model, to avoid ID clashes between the meta objects in the different instances.
     * @returns The new DataModel.
     * @see {@link Scene.createModel}
     */
    createModel(
        dataModelCfg: DataModelParams,
        options?: {
            includeTypes?: string[],
            excludeTypes?: string[],
            globalizeObjectIds?: boolean
        }
    ): DataModel {
        let id = dataModelCfg.id || createUUID();
        if (this.dataModels[id]) {
            this.error(`DataModel with ID "${id}" already exists - will randomly-generate ID`);
            id = createUUID();
        }
        const dataModel = new DataModel(this, id, dataModelCfg, options);
        this.#registerDataModel(dataModel);
        dataModel.events.on("destroyed", () => { // DataModel#destroy() called
            this.#deregisterDataModel(dataModel);
            this.events.fire("dataModelDestroyed", dataModel);
        });
        this.events.fire("dataModelCreated", dataModel);
        return dataModel;
    }

    /**
     * Gets the {@link DataObject.id}s of the {@link DataObject}s that have the given {@link DataObject.type}.
     *
     * @param type The type.
     * @returns Array of {@link DataObject.id}s.
     */
    getObjectIdsByType(type: string) {
        const objects = this.objectsByType[type];
        return objects ? Object.keys(objects) : [];
    }

    /**
     * Gets the {@link DataObject.id}s of the {@link DataObject}s within the given subtree.
     *
     * @param id  ID of the root {@link DataObject} of the given subtree.
     * @param  [includeTypes] Optional list of types to include.
     * @param  [excludeTypes] Optional list of types to exclude.
     * @returns  Array of {@link DataObject.id}s.
     */
    getObjectIdsInSubtree(id: string, includeTypes: string[], excludeTypes: string[]): string[] {

        const list: string[] = [];
        const dataObject = this.objects[id];
        const includeMask = (includeTypes && includeTypes.length > 0) ? arrayToMap(includeTypes) : null;
        const excludeMask = (excludeTypes && excludeTypes.length > 0) ? arrayToMap(excludeTypes) : null;

        function visit(dataObject: DataObject) {
            if (!dataObject) {
                return;
            }
            let include = true;
            // @ts-ignore
            if (excludeMask && excludeMask[dataObject.type]) {
                include = false;
            } else { // @ts-ignore
                if (includeMask && (!includeMask[dataObject.type])) {
                    include = false;
                }
            }
            if (include) {
                list.push(dataObject.id);
            }
            const children = dataObject.children;
            if (children) {
                for (let i = 0, len = children.length; i < len; i++) {
                    visit(children[i]);
                }
            }
        }

        visit(dataObject);
        return list;
    }

    /**
     * Iterates over the {@link DataObject}s within the subtree.
     *
     * @param id ID of root {@link DataObject}.
     * @param callback Callback fired at each {@link DataObject}.
     */
    withObjectsInSubtree(id: string, callback: (arg0: DataObject) => void) {
        const dataObject = this.objects[id];
        if (!dataObject) {
            return;
        }
        dataObject.withObjectsInSubtree(callback);
    }

    #registerDataModel(dataModel: DataModel) {
        const objects = this.objects;
        const objectsByType = this.objectsByType;
        let visit = (dataObject: DataObject) => {
            objects[dataObject.id] = dataObject;
            const types = (objectsByType[dataObject.type] || (objectsByType[dataObject.type] = {}));
            if (!types[dataObject.id]) {
                types[dataObject.id] = dataObject;
                this.typeCounts[dataObject.type]++;
            }
            const children = dataObject.children;
            if (children) {
                for (let i = 0, len = children.length; i < len; i++) {
                    const childDataObject = children[i];
                    visit(childDataObject);
                }
            }
        };
        visit(dataModel.rootDataObject);
        for (let propertySetId in dataModel.propertySets) {
            if (dataModel.propertySets.hasOwnProperty(propertySetId)) {
                this.propertySets[propertySetId] = dataModel.propertySets[propertySetId];
            }
        }
        this.dataModels[dataModel.id] = dataModel;
    }

    #deregisterDataModel(dataModel: DataModel) {
        let visit = (dataObject: DataObject) => {
            delete this.objects[dataObject.id];
            const types = this.objectsByType[dataObject.type];
            if (types && types[dataObject.id]) {
                delete types[dataObject.id];
                if (--this.typeCounts[dataObject.type] === 0) {
                    delete this.typeCounts[dataObject.type];
                    delete this.objectsByType[dataObject.type];
                }
            }
            const children = dataObject.children;
            if (children) {
                for (let i = 0, len = children.length; i < len; i++) {
                    const childDataObject = children[i];
                    visit(childDataObject);
                }
            }
        };
        visit(dataModel.rootDataObject);
        for (let propertySetId in dataModel.propertySets) {
            if (dataModel.propertySets.hasOwnProperty(propertySetId)) {
                delete this.propertySets[propertySetId];
            }
        }
        delete this.dataModels[dataModel.id];
    }
}

function arrayToMap(array: any[]): { [key: string]: any } {
    const map: { [key: string]: any } = {};
    for (let i = 0, len = array.length; i < len; i++) {
        map[array[i]] = true;
    }
    return map;
}

export {Data};