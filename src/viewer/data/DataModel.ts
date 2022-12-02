import {Component} from "../Component";
import {Data} from "./Data";
import {PropertySet} from "./PropertySet";
import {DataObject} from "./DataObject";
import {DataModelParams} from "./DataModelParams";
import {DataObjectParams} from "./DataObjectParams";
import {PropertySetParams} from "./PropertySetParams";

/**
 *  Buildable container of semantic data for a model.
 *
 * ## Overview
 *
 *  * Created with {@link Data.createModel}
 *  * Stored in {@link Data.models}
 *  * Contains {@link DataObject}s and {@link PropertySet}s
 *
 *  ## Usage
 *
 * ````javascript
 * import {Viewer, constants} from "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/xeokit-viewer.es.min.js";
 *
 * const myViewer = new Viewer({
 *   id: "myViewer"
 * });
 *
 * const myDataModel = myViewer.data.createModel({
 *   id: "myModel"
 * });
 *
 * myDataModel.createPropertySet({
 *     id: "myPropSet",
 *     properties: [
 *         {
 *             id: "myProp",
 *             value: 5
 *         },
 *         {
 *             id: "myOtherProp",
 *             value: "foo"
 *         }
 *     ]
 * });
 *
 * myDataModel.createObject({
 *   id: "myObject",
 *   name: "Some object",
 *   type: "MyType",
 *   propertySetIds: ["myPropSet"]
 * });
 *
 * myDataModel.createObject({
 *   id: "myObject2",
 *   name: "Some other object",
 *   type: "MyOtherType"
 * });
 * ````
 */
class DataModel extends Component {

    /**
     * The data to which this DataModel belongs.
     */
    public readonly data: Data;

    /**
     * Unique ID of this DataModel.
     *
     * MetaModels are registered by ID in {@link Data.models}.
     */
    declare public readonly id: string;

    /**
     * The project ID, if available.
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
    public objects: { [key: string]: DataObject };

    /**
     * The {@link DataObject}s in this DataModel, mapped to {@link DataObject.type}, sub-mapped to {@link DataObject.id}.
     */
    public objectsByType: { [key: string]: { [key: string]: DataObject } };

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
        dataModelCfg: DataModelParams,
        options?: {
            includeTypes?: string[],
            excludeTypes?: string[],
            globalizeObjectIds?: boolean
        }) {

        super(data);

        this.data = data;

        this.id = id;
        this.projectId = dataModelCfg.projectId || "";
        this.revisionId = dataModelCfg.revisionId || "";
        this.author = dataModelCfg.author || "";
        this.createdAt = dataModelCfg.createdAt || "";
        this.creatingApplication = dataModelCfg.creatingApplication || "";
        this.schema = dataModelCfg.schema || "";
        this.propertySets = {};
        this.objects = {};
        this.rootDataObject = null;
        this.#destroyed = false;

        if (dataModelCfg.propertySets) {
            for (let i = 0, len = dataModelCfg.propertySets.length; i < len; i++) {
                this.createPropertySet(dataModelCfg.propertySets[i]);
            }
        }

        if (dataModelCfg.objects) {
            for (let i = 0, len = dataModelCfg.objects.length; i < len; i++) {
                this.createObject(dataModelCfg.objects[i]);
            }
            for (let i = 0, len = dataModelCfg.objects.length; i < len; i++) {
                const dataObjectCfg = dataModelCfg.objects[i];
                const dataObject = this.objects[dataObjectCfg.id];
                if (dataObject) {
                    if (dataObjectCfg.parentId) {
                        const parentDataObject = this.objects[dataObjectCfg.parentId];
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
     * Creates a {@link PropertySet} within this DataModel.
     *
     * @param propertySetCfg
     */
    createPropertySet(propertySetCfg: PropertySetParams): PropertySet {
        if (this.#destroyed) {
            return;
        }
        const propertySet = new PropertySet(this, propertySetCfg);
        this.propertySets[propertySetCfg.id] = propertySet;
        return propertySet;
    }

    /**
     * Creates a {@link DataObject} within this DataModel.
     *
     * @param dataObjectCfg
     * @see {@link SceneModel.createObject}
     */
    createObject(dataObjectCfg: DataObjectParams): DataObject {
        if (this.#destroyed) {
            return;
        }
        const id = dataObjectCfg.id;
        const type = dataObjectCfg.type;
        let parentDataObject;
        if (dataObjectCfg.parentId) {
            parentDataObject = this.objects[dataObjectCfg.parentId];
        }
        const propertySets = [];
        if (dataObjectCfg.propertySetIds) {
            for (let i = 0, len = dataObjectCfg.propertySetIds.length; i < len; i++) {
                const propertySetId = dataObjectCfg.propertySetIds[i];
                const propertySet = this.propertySets[propertySetId];
                if (!propertySet) {
                    console.error(`PropertySet not found: "${propertySetId}"`);
                } else {
                    propertySets.push(propertySet);
                }
            }
        }
        const dataObject = new DataObject(this, id, dataObjectCfg.originalSystemId, dataObjectCfg.name, dataObjectCfg.type, parentDataObject, propertySets);
        this.objects[id] = dataObject;
        if (!this.objectsByType[type]) {
            this.objectsByType[type] = {};
        }
        this.objectsByType[type][id] = dataObject;
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