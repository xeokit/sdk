import {Component} from "../Component";
import {Data} from "./Data";
import {PropertySet} from "./PropertySet";
import {DataObject} from "./DataObject";
import {DataModelSchema} from "./DataModelSchema";

/**
 *  Metadata about a model within a {@link Viewer}.
 *
 * ## Overview
 *
 *  * Belongs to a {@link Data}
 *  * Created with {@link Data.createDataModel}
 *  * Registered by {@link DataModel.id} in {@link Data.dataModels}
 *  * Contains {@link DataObject}s and {@link PropertySet}s
 */
class DataModel extends Component {

    /**
     * The data to which this DataModel belongs.
     */
    public readonly data: Data;

    /**
     * Unique ID of this DataModel within its Data.
     *
     * MetaModels are registered by ID in {@link Data.dataModels}.
     */
    public readonly id: string;

    /**
     * The project ID.
     */
    public readonly projectId?: string | number;

    /**
     * The revision ID, if available.
     *
     * Will be undefined if not available.
     */
    public readonly revisionId?: string | number;

    /**
     * The model author, if available.
     *
     * Will be undefined if not available.
     */
    public readonly author?: string;

    /**
     * The date the model was created, if available.
     *
     * Will be undefined if not available.
     */
    public readonly createdAt?: string;

    /**
     * The application that created the model, if available.
     *
     * Will be undefined if not available.
     */
    public readonly creatingApplication?: string;

    /**
     * The model schema version, if available.
     *
     * Will be undefined if not available.
     */
    public readonly schema?: string;

    /**
     * The {@link PropertySet}s in this DataModel, mapped to {@link PropertySet.id}.
     */
    public readonly propertySets: { [key: string]: PropertySet };

    /**
     * The root {@link DataObject} in this DataModel's composition hierarchy.
     */
    public rootDataObject: DataObject;

    /**
     * The {@link DataObject}s in this DataModel, mapped to {@link DataObject.id}.
     */
    public dataObjects: { [key: string]: DataObject };

    /**
     * The {@link DataObject}s in this DataModel, mapped to {@link DataObject.type}, sub-mapped to {@link DataObject.id}.
     */
    public dataObjectsByType: { [key: string]: { [key: string]: DataObject } };

    /**
     * The count of each type of {@link DataObject} in this DataModel, mapped to {@link DataObject.type}.
     */
    public typeCounts: { [key: string]: number };

    #destroyed: boolean;

    /**
     * @private
     */
    constructor(
        data: Data,
        id: string,
        cfg: DataModelSchema,
        options?: {
            includeTypes?: string[],
            excludeTypes?: string[],
            globalizeObjectIds?: boolean
        }) {

        super(data);

        this.data = data;

        this.id = id;
        this.projectId = cfg.projectId || "";
        this.revisionId = cfg.revisionId || "";
        this.author = cfg.author || "";
        this.createdAt = cfg.createdAt || "";
        this.creatingApplication = cfg.creatingApplication || "";
        this.schema = cfg.schema || "";
        this.propertySets = {};
        this.dataObjects = {};
        this.rootDataObject = null;
        this.#destroyed = false;

        if (cfg.propertySets) {
            for (let i = 0, len = cfg.propertySets.length; i < len; i++) {
                this.createPropertySet(cfg.propertySets[i]);
            }
        }

        if (cfg.dataObjects) {
            for (let i = 0, len = cfg.dataObjects.length; i < len; i++) {
                const dataObjectCfg = cfg.dataObjects[i];
                this.createDataObject({
                    id: dataObjectCfg.id,
                    originalSystemId: dataObjectCfg.originalSystemId,
                    name: dataObjectCfg.name,
                    type: dataObjectCfg.type,
                    propertySetIds: dataObjectCfg.propertySetIds
                });
            }
            for (let i = 0, len = cfg.dataObjects.length; i < len; i++) {
                const dataObjectCfg = cfg.dataObjects[i];
                const dataObject = this.dataObjects[dataObjectCfg.id];
                if (dataObject) {
                    if (dataObjectCfg.parentId) {
                        const parentDataObject = this.dataObjects[dataObjectCfg.parentId];
                        if (parentDataObject) {
                            dataObject.parent = parentDataObject;
                        } else {
                            this.rootDataObject = dataObject; // FIXME
                        }
                    } else {
                        this.rootDataObject = dataObject; // FIXME
                    }
                }
            }
        }
    }

    /**
     * Creates a PropertySet within this DataModel.
     *
     * The PropertySet will be associated directly with the DataModel, and not with any {@link DataObject}s.
     *
     * @param cfg
     */
    createPropertySet(cfg: {
        id: string;
        originalSystemId?: string;
        name: string;
        type: string;
        properties?: {
            name: string,
            value: any,
            type?: string,
            valueType?: string | number,
            description?: string
        }[]
    }): PropertySet {
        if (this.#destroyed) {
            return;
        }
        const propertySet = new PropertySet(this, cfg.id, cfg.originalSystemId, cfg.name, cfg.type, cfg.properties);
        this.propertySets[cfg.id] = propertySet;
        return propertySet;
    }

    /**
     * Creates a DataObject within this DataModel.
     *
     * ## Usage
     *
     * ````javascript
     * myMetaModel.createDataObject({
     *    id: "foo",
     *    name: "Foo",
     *    originalSystemId?: "foo",
     *    parentId:"bar",
     *    propertySetIds: ["baz"],
     *    type: "Default"
     * });
     * ````
     * @param cfg
     */
    createDataObject(cfg: {
        id: string;
        originalSystemId?: string;
        type: string;
        name: string;
        parentId?: string,
        propertySetIds?: string[]
    }): DataObject {
        if (this.#destroyed) {
            return;
        }
        const id = cfg.id;
        const type = cfg.type;
        let parentDataObject;
        if (cfg.parentId) {
            parentDataObject = this.dataObjects[cfg.parentId];
        }
        const propertySets = [];
        if (cfg.propertySetIds) {
            for (let i = 0, len = cfg.propertySetIds.length; i < len; i++) {
                const propertySetId = cfg.propertySetIds[i];
                const propertySet = this.propertySets[propertySetId];
                if (!propertySet) {
                    console.error(`PropertySet not found: "${propertySetId}"`);
                } else {
                    propertySets.push(propertySet);
                }
            }
        }
        const dataObject = new DataObject(this, id, cfg.originalSystemId, cfg.name, cfg.type, parentDataObject, propertySets);
        this.dataObjects[id] = dataObject;
        if (!this.dataObjectsByType[type]) {
            this.dataObjectsByType[type] = {};
        }
        this.dataObjectsByType[type][id] = dataObject;
        this.typeCounts[type] = (this.typeCounts[type] === undefined) ? 1 : this.typeCounts[type] + 1;
        return dataObject;
    }

    /**
     * Destroys this DataModel.
     */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        this.#destroyed = true;
    }
}

export {DataModel};