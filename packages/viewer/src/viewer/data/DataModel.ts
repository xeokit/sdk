import {Component} from "../Component";
import type {Data} from "./Data";
import {PropertySet} from "./PropertySet";
import {DataObject} from "./DataObject";
import type {DataModelParams} from "./DataModelParams";
import type {DataObjectParams} from "./DataObjectParams";
import type {PropertySetParams} from "./PropertySetParams";
import {EventEmitter, SceneModel} from "@xeokit-viewer/viewer";
import {EventDispatcher} from "strongly-typed-events";


/**
 * A buildable semantic data model within {@link Data}.
 *
 * See {@link Data} for usage examples.
 *
 * ## Summary
 *
 *  * Created with {@link Data.createModel}
 *  * Stored in {@link Data.models}
 *  * Contains {@link DataObject|DataObjects} and {@link PropertySet|PropertySets}
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
    public rootDataObject: null | DataObject;

    /**
     * The {@link DataObject}s in this DataModel, mapped to {@link DataObject.id}.
     */
    public objects: { [key: string]: DataObject };

    /**
     * The root {@link DataObject}s in this DataModel, mapped to {@link DataObject.id}.
     */
    public rootObjects: { [key: string]: DataObject };

    /**
     * The {@link DataObject}s in this DataModel, mapped to {@link DataObject.type}, sub-mapped to {@link DataObject.id}.
     */
    public objectsByType: { [key: string]: { [key: string]: DataObject } };

    /**
     * The count of each type of {@link DataObject} in this DataModel, mapped to {@link DataObject.type}.
     */
    public typeCounts: { [key: string]: number };

    /**
     * Emits an event when the {@link DataModel} has been built.
     *
     * @event
     */
    readonly onBuilt: EventEmitter<DataModel, null>;

    #built: boolean;
    #destroyed: boolean;

    /**
     * @private
     */
    constructor(
        data: Data,
        id: string,
        dataModelParams: DataModelParams,
        options?: {
            includeTypes?: string[],
            excludeTypes?: string[],
            globalizeObjectIds?: boolean
        }) {

        super(data);

        this.data = data;

        this.id = id;
        this.projectId = dataModelParams.projectId || "";
        this.revisionId = dataModelParams.revisionId || "";
        this.author = dataModelParams.author || "";
        this.createdAt = dataModelParams.createdAt || "";
        this.creatingApplication = dataModelParams.creatingApplication || "";
        this.schema = dataModelParams.schema || "";
        this.propertySets = {};
        this.objects = {};
        this.objectsByType = {};
        this.typeCounts = {};
        this.rootDataObject = null;
        this.#built = false;
        this.#destroyed = false;

        if (dataModelParams.propertySets) {

            // TODO: global property sets

            for (let i = 0, len = dataModelParams.propertySets.length; i < len; i++) {
                this.createPropertySet(dataModelParams.propertySets[i]);
            }
        }

        if (dataModelParams.objects) {
            for (let i = 0, len = dataModelParams.objects.length; i < len; i++) {
                this.createObject(dataModelParams.objects[i]);
            }
            // for (let i = 0, len = dataModelParams.objects.length; i < len; i++) {
            //     const dataObjectCfg = dataModelParams.objects[i];
            //     const dataObject = this.objects[dataObjectCfg.id];
            //     if (dataObject) {
            //         if (dataObjectCfg.parentId) {
            //             const parentDataObject = this.objects[dataObjectCfg.parentId];
            //             if (parentDataObject) {
            //                 dataObject.parent = parentDataObject;
            //                 parentDataObject.objects.push(dataObject);
            //             } else {
            //                 this.rootDataObject = dataObject; // FIXME
            //             }
            //         } else {
            //             this.rootDataObject = dataObject; // FIXME
            //         }
            //     }
            // }
        }

        this.onBuilt = new EventEmitter(new EventDispatcher<DataModel, null>());
    }

    /**
     * Creates a {@link PropertySet} within this DataModel.
     *
     * @param propertySetCfg
     */
    createPropertySet(propertySetCfg: PropertySetParams): null | PropertySet {
        if (this.#destroyed) {
            return null;
        }
        const propertySet = new PropertySet(this, propertySetCfg);
        this.propertySets[propertySetCfg.id] = propertySet;
        return propertySet;
    }

    /**
     * Creates a {@link DataObject} in this DataModel.
     *
     * Each DataObject has a globally-unique ID in {@link DataObject.id}, with which it's registered
     * in {@link Data.objects} and {@link DataModel.objects}.
     *
     * If {@link DataObjectParams.id} matches a DataObject that
     * already exists (ie. already created for a different DataModel), then this method will reuse that DataObject for this DataModel,
     * and will ignore any other {@link DataObjectParams} parameters that we provide. This makes the assumption that each
     * value of {@link DataObjectParams.id} is associated with a single value for {@link DataObjectParams.type}
     * and {@link DataObjectParams.name}. This aligns well with IFC, in which wewe never have two elements with the same
     * ID but different types or names.
     *
     * Each DataObject automatically gets destroyed whenever all the {@link DataModel|DataModels} that share
     * it have been destroyed.
     *
     * We can attach our DataObject as child of an existing parent DataObject. To do that, we provide the ID of the parent
     * in {@link DataObjectParams.parentId}. Following the reuse mechanism just described, the parent is allowed to be a
     * DataObject that we created in a different DataModel. If the parent does not exist yet, then our new DataObject will
     * automatically become the parent's child when the parent is created later.
     *
     * @param dataObjectCfg
     */
    createObject(dataObjectCfg: DataObjectParams): null | DataObject {
        if (this.#destroyed) {
            return null;
        }
        const id = dataObjectCfg.id;
        const type = dataObjectCfg.type;
        let parentDataObject;
        if (dataObjectCfg.parentId) {
            parentDataObject = this.objects[dataObjectCfg.parentId];
            if (!parentDataObject) {
                // Warn?
                // Or buffer the parent requirement and satisfy once parent created later
            }
        }
        let dataObject = this.data.objects[id];
        if (!dataObject) {
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
            dataObject = new DataObject(this, id, dataObjectCfg.name, dataObjectCfg.type, propertySets);
            if (parentDataObject) {
                dataObject.parent = parentDataObject;
                parentDataObject.objects.push(dataObject);
            }
            this.data.objects[id] = dataObject;
            if (!this.data.objectsByType[type]) {
                this.data.objectsByType[type] = {};
            }
            this.data.objectsByType[type][id] = dataObject;
            this.data.typeCounts[type] = (this.data.typeCounts[type] === undefined) ? 1 : this.data.typeCounts[type] + 1;
            dataObject.models.push(this);
            this.data.onObjectCreated.dispatch(this.data, dataObject);
        } else {
            this.objects[id] = dataObject;
            if (!this.objectsByType[type]) {
                this.objectsByType[type] = {};
            }
            this.objectsByType[type][id] = dataObject;
            this.typeCounts[type] = (this.typeCounts[type] === undefined) ? 1 : this.typeCounts[type] + 1;
            dataObject.models.push(this);
        }
        return dataObject;
    }

    /**
     *
     */
    build() {
        if (this.destroyed) {
            this.log("DataModel already destroyed");
            return;
        }
        if (this.#built) {
            this.log("DataModel already built");
            return;
        }
        this.#built = true;
        this.onBuilt.dispatch(this, null);
    }

    /**
     * Destroys this DataModel.
     */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        for (let id in this.objects) {
            const dataObject = this.objects[id];
            if (dataObject.models.length > 1) {
                this.#removeFromModels(dataObject);
            } else {
                delete this.data.objects[id];
                const type = dataObject.type;
                if ((--this.data.typeCounts[type]) === 0) {
                    delete this.data.typeCounts[type];
                    delete this.data.objectsByType[type];
                    this.data.onObjectDestroyed.dispatch(this.data, dataObject);
                }
            }
            if (dataObject.parent) {
                const objects = dataObject.parent.objects;
                objects.length--;
                let f = false;
                for (let i = 0, len = objects.length; i < len; i++) {
                    if (f || (f = objects[i] === dataObject)) {
                        objects[i] = objects[i + 1];
                    }
                }
            }
        }
        this.#destroyed = true;
        this.onBuilt.clear();
        super.destroy();
    }

    #removeFromModels(dataObject: DataObject) {
        for (let i = 0, len = dataObject.models.length; i < len; i++) {
            if (dataObject.models[i] === this) {
                dataObject.models = dataObject.models.splice(i, 1);
                break;
            }
        }
    }
}

export {DataModel};