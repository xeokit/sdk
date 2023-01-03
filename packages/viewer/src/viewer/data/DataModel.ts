import {Component} from "../Component";
import type {Data} from "./Data";
import {PropertySet} from "./PropertySet";
import {DataObject} from "./DataObject";
import type {DataModelParams} from "./DataModelParams";
import type {DataObjectParams} from "./DataObjectParams";
import type {PropertySetParams} from "./PropertySetParams";
import {EventEmitter} from "../EventEmitter";
import {EventDispatcher} from "strongly-typed-events";
import {Relationship} from "./Relationship";
import type {RelationshipParams} from "./RelationshipParams";

/**
 * A buildable entity-relationship semantic data model, stored in {@link Data}.
 *
 * See {@link Data} for usage examples.
 *
 * ## Summary
 *
 *  * A DataModel is a generic entity-relationship graph of {@link DataObject|DataObjects}, {@link PropertySet|PropertySets} and {@link Relationship|Relationships}
 *  * Can be used for IFC and all other schemas that are expressable as an ER graph
 *  * Created with {@link Data.createModel}
 *  * Stored in {@link Data.models}
 *
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
     * The {@link PropertySet|PropertySets} in this DataModel, mapped to {@link PropertySet.id}.
     */
    public readonly propertySets: { [key: string]: PropertySet };

    /**
     * The root {@link DataObject} in this DataModel's composition hierarchy.
     */
    public rootDataObject: null | DataObject;

    /**
     * The {@link DataObject|DataObjects} in this DataModel, mapped to {@link DataObject.id}.
     */
    public objects: { [key: string]: DataObject };

    /**
     * The root {@link DataObject|DataObjects} in this DataModel, mapped to {@link DataObject.id}.
     */
    public rootObjects: { [key: string]: DataObject };

    /**
     * The {@link DataObject|DataObjects} in this DataModel, mapped to {@link DataObject.type}, sub-mapped to {@link DataObject.id}.
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
            //     const dataObjectParams = dataModelParams.objects[i];
            //     const dataObject = this.objects[dataObjectParams.id];
            //     if (dataObject) {
            //         if (dataObjectParams.parentId) {
            //             const parentDataObject = this.objects[dataObjectParams.parentId];
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
     * @param dataObjectParams
     */
    createObject(dataObjectParams: DataObjectParams): null | DataObject {
        if (this.#destroyed) {
            return null;
        }
        const id = dataObjectParams.id;
        const type = dataObjectParams.type;
        let dataObject = this.data.objects[id];
        if (!dataObject) {
            const propertySets = [];
            if (dataObjectParams.propertySetIds) {
                for (let i = 0, len = dataObjectParams.propertySetIds.length; i < len; i++) {
                    const propertySetId = dataObjectParams.propertySetIds[i];
                    const propertySet = this.propertySets[propertySetId];
                    if (!propertySet) {
                        console.error(`PropertySet not found: "${propertySetId}"`);
                    } else {
                        propertySets.push(propertySet);
                    }
                }
            }
            dataObject = new DataObject(this, id, dataObjectParams.name, dataObjectParams.type, propertySets);
            this.data.objects[id] = dataObject;
            if (!this.data.objectsByType[type]) {
                this.data.objectsByType[type] = {};
            }
            this.data.objectsByType[type][id] = dataObject;
            this.data.typeCounts[type] = (this.data.typeCounts[type] === undefined) ? 1 : this.data.typeCounts[type] + 1;
            dataObject.models.push(this);
            if (dataObjectParams.relations) {
                for (let relationType in dataObjectParams.relations) {
                    if (!dataObject.relating[relationType]) {
                        dataObject.relating[relationType] = [];
                    }
                    const relatedObjectIds = dataObjectParams.relations[relationType];
                    for (let j = 0, lenj = relatedObjectIds.length; j < lenj; j++) {
                        const relatedObjectId = relatedObjectIds[j];
                        const relatedObject = this.data.objects[relatedObjectId];
                        if (!relatedObject) {
                            this.error(`[createObject] Can't create Relationship - DataObject not found: ${relatedObjectId}`);
                        } else {
                            // @ts-ignore
                            const relation = new Relationship(relationType, this, relatedObject);
                            relatedObject.relating[relationType].push(relation);
                            dataObject.related[relationType].push(relation);
                        }
                    }
                }
            }
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
     * Creates a {@link Relationship} between two {@link DataObject|DataObjects}.
     *
     * @param relationshipParams
     */
    createRelationship(relationshipParams: RelationshipParams) {
        const relatingObject = this.data.objects[relationshipParams.relatingObjectId];
        if (!relatingObject) {
            this.error(`[createRelation] DataObject not found: ${relationshipParams.relatingObjectId}`);
            return;
        }
        const relatedObject = this.data.objects[relationshipParams.relatedObjectId];
        if (!relatedObject) {
            this.error(`[createRelation] DataObject not found: ${relationshipParams.relatedObjectId}`);
            return;
        }
        const relation = new Relationship(relationshipParams.relationType, relatingObject, relatedObject);
        relatedObject.relating[relationshipParams.relationType].push(relation);
        relatingObject.related[relationshipParams.relationType].push(relation);
    }

    /**
     * Builds this DataModel, readying it for use.
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
                    for (let type in dataObject.relating) {
                        const relations = dataObject.relating[type];
                        for (let i = 0, len = relations.length; i < len; i++) {
                            const relation = relations[i];
                            const related = relation.related;
                            const list = related.relating[type];
                            for (let j = 0, k = 0, lenj = list.length; j < lenj; j++) {
                                if (list[k].relating === dataObject) {
                                    // Splice j from related.relating[type]
                                    list[j] = list[j]
                                }
                            }
                        }
                    }
                }
            }

            // if (dataObject.parent) {
            //     const objects = dataObject.parent.objects;
            //     objects.length--;
            //     let f = false;
            //     for (let i = 0, len = objects.length; i < len; i++) {
            //         if (f || (f = objects[i] === dataObject)) {
            //             objects[i] = objects[i + 1];
            //         }
            //     }
            // }
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