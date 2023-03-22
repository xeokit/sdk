import {Component, EventEmitter} from "@xeokit/core/components";

import type {Data} from "./Data";
import {PropertySet} from "./PropertySet";
import {DataObject} from "./DataObject";
import type {DataModelParams} from "./DataModelParams";
import type {DataObjectParams} from "./DataObjectParams";
import type {PropertySetParams} from "./PropertySetParams";
import {Relationship} from "./Relationship";
import type {RelationshipParams} from "./RelationshipParams";
import {EventDispatcher} from "strongly-typed-events";
import {PropertyParams} from "./PropertyParams";

/**
 * A semantic data model, as an entity-relationship graph.
 *
 * See {@link "@xeokit/data"} for usage.
 */
export class DataModel extends Component {

    /**
     * The Data that contains this DataModel.
     */
    public readonly data: Data;

    /**
     * Unique ID of this DataModel.
     *
     * DataModels are stored against this ID in {@link Data.models}.
     */
    declare public readonly id: string;

    /**
     * The project ID, if available.
     */
    public readonly projectId?: string | number;

    /**
     * The revision ID, if available.
     */
    public readonly revisionId?: string | number;

    /**
     * The model author, if available.
     */
    public readonly author?: string;

    /**
     * The date the model was created, if available.
     */
    public readonly createdAt?: string;

    /**
     * The application that created the model, if available.
     */
    public readonly creatingApplication?: string;

    /**
     * The model schema version, if available.
     */
    public readonly schema?: string;

    /**
     * The {@link PropertySet | PropertySets} in this DataModel, mapped to {@link PropertySet.id | PropertySet.id}.
     *
     * PropertySets have globally-unique IDs and will also be stored in {@link Data.propertySets | Data.propertySets}.
     */
    public readonly propertySets: { [key: string]: PropertySet };

    /**
     * The {@link DataObject | DataObjects} in this DataModel, mapped to {@link DataObject.id | DataObject.id}.
     *
     * DataObjects have globally-unique IDs and will also be stored in {@link Data.objects | Data.objects}.
     */
    public objects: { [key: string]: DataObject };

    /**
     * The root {@link DataObject | DataObjects} in this DataModel, mapped to {@link DataObject.id | DataObject.id}.
     *
     * * This is the set of DataObjects in this DataModel that are not the *related* participant in
     * any {@link Relationship | Relationships}, where they have no incoming Relationships and
     * their {@link DataObject.relating} property is empty.
     */
    public rootObjects: { [key: string]: DataObject };

    /**
     * The {@link DataObject | DataObjects} in this DataModel, mapped to {@link DataObject.type | DataObject.type},
     * sub-mapped to {@link DataObject.id | DataObject.id}.
     */
    public objectsByType: { [key: string]: { [key: string]: DataObject } };

    /**
     * The {@link Relationship | Relationships} in this DataModel.
     *
     * * The Relationships can be between DataObjects in different DataModels, but always within the same Data.
     */
    public relationships: Relationship[];

    /**
     * The count of each type of {@link DataObject} in this DataModel, mapped to {@link DataObject.type | DataObject.type}.
     */
    public typeCounts: { [key: string]: number };

    /**
     * Emits an event when the {@link @xeokit/data!DataModel} has been built.
     *
     * * The DataModel is built using {@link DataModel.build | DataModel.build}.
     * * {@link DataModel.built | DataModel.built} indicates if the DataModel is currently built.
     *
     * @event
     */
    readonly onBuilt: EventEmitter<DataModel, null>;

    /**
     * Indicates if this DataModel has been built.
     *
     * * Set true by {@link DataModel.build | DataModel.build}.
     * * Subscribe to updates using {@link DataModel.onBuilt | DataModel.onBuilt} and {@link Data.onModelCreated | Data.onModelCreated}.
     */
    built: boolean;

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

        this.onBuilt = new EventEmitter(new EventDispatcher<DataModel, null>());

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
        this.relationships = [];
        this.typeCounts = {};
        this.rootObjects = {};
        this.built = false;
        this.#destroyed = false;

        this.fromJSON(dataModelParams);
    }

    /**
     * Adds the given {@link PropertySet | PropertySets}, {@link DataObject | DataObjects}
     * and {@link Relationship | PropertySets} to this DataModel.
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @param dataModelParams
     */
    fromJSON(dataModelParams: DataModelParams) {
        if (dataModelParams.propertySets) {
            for (let i = 0, len = dataModelParams.propertySets.length; i < len; i++) {
                this.createPropertySet(dataModelParams.propertySets[i]);
            }
        }
        if (dataModelParams.objects) {
            for (let i = 0, len = dataModelParams.objects.length; i < len; i++) {
                this.createObject(dataModelParams.objects[i]);
            }
        }
        if (dataModelParams.relationships) {
            for (let i = 0, len = dataModelParams.relationships.length; i < len; i++) {
                this.createRelationship(dataModelParams.relationships[i]);
            }
        }
    }

    /**
     * Creates a new {@link PropertySet}.
     *
     * * Stores the new PropertySet in {@link DataModel.propertySets | DataModel.propertySets}
     * and {@link Data.propertySets | Data.propertySets}.
     * * Note that PropertySet IDs are globally unique. PropertySet instances are automatically reused and shared among DataModels
     * when IDs given to {@link DataModel.createPropertySet | DataModel.createPropertySet} match existing PropertySet
     * instances in the same Data.
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @param propertySetCfg - PropertySet creation parameters.
     * @throws {@link Error}
     * * If this DataModel has already been built.
     * * If this DataModel has already been destroyed.
     * * A PropertySet of the given ID was already created for this DataModel. While it's OK
     * for multiple DataModels to *share* PropertySets with duplicate IDs between them, it's not permitted to
     * create duplicate PropertySets within the same DataModel.
     */
    createPropertySet(propertySetCfg: PropertySetParams): null | PropertySet {
        if (this.destroyed) {
            throw new Error("DataModel already destroyed - not allowed to add property sets");
        }
        if (this.built) {
            throw new Error("DataModel already built - not allowed to add property sets");
        }
        if (this.propertySets[propertySetCfg.id]) {
            throw new Error("PropertySet already created in this DataModel (note: OK to have duplicates between DataModels, but they must be unique within each DataModel)")
        }
        let propertySet = this.data.propertySets[propertySetCfg.id];
        if (propertySet) {
            this.propertySets[propertySetCfg.id] = propertySet;
            propertySet.models.push(this);
            return propertySet;
        }
        propertySet = new PropertySet(this, propertySetCfg);
        this.propertySets[propertySetCfg.id] = propertySet;
        this.data.propertySets[propertySetCfg.id] = propertySet;
        return propertySet;
    }

    /**
     * Creates a new {@link DataObject}.
     *
     * * Stores the new {@link DataObject} in {@link DataModel.objects | DataModel.objects} and {@link Data.objects | Data.objects}.
     * * Fires an event via {@link Data.onObjectCreated | Data.onObjectCreated}.
     * * Note that DataObject IDs are globally unique. DataObject instances are automatically reused and shared among DataModels when
     * IDs given to {@link DataModel.createObject | DataModel.createObject} match existing DataObject instances in the same
     * Data. This feature is part of how xeokit supports [*federated data models*](/docs/pages/GLOSSARY.html#federated-models).
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @param dataObjectParams - DataObject creation parameters.
     * @throws {@link Error}
     * * If this DataModel has already been built.
     * * If this DataModel has already been destroyed.
     * * A DataObject of the given ID was already created in this DataModel. While it's OK
     * for multiple DataModels to *share* DataObjects with duplicate IDs between them, we're not permitted to
     * create duplicate DataObjects within the same DataModel.
     */
    createObject(dataObjectParams: DataObjectParams): null | DataObject {
        if (this.destroyed) {
            throw new Error("DataModel already destroyed - not allowed to add objects");
        }
        if (this.built) {
            throw new Error("DataModel already built - not allowed to add objects");
        }
        const id = dataObjectParams.id;
        if (this.objects[id]) {
            throw new Error("DataObject already created in this DataModel (note: OK to have duplicates between DataModels, but they must be unique within each DataModel)")
        }
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
            this.objects[id] = dataObject;
            this.data.objects[id] = dataObject;
            if (!this.data.objectsByType[type]) {
                this.data.objectsByType[type] = {};
            }
            this.data.objectsByType[type][id] = dataObject;
            this.data.typeCounts[type] = (this.data.typeCounts[type] === undefined) ? 1 : this.data.typeCounts[type] + 1;
            dataObject.models.push(this);
            // if (dataObjectParams.relations) {
            //     for (let relationType in dataObjectParams.relations) {
            //         if (!dataObject.relating[relationType]) {
            //             dataObject.relating[relationType] = [];
            //         }
            //         const relatedObjectIds = dataObjectParams.relations[relationType];
            //         for (let j = 0, lenj = relatedObjectIds.length; j < lenj; j++) {
            //             const relatedObjectId = relatedObjectIds[j];
            //             const relatedObject = this.data.objects[relatedObjectId];
            //             if (!relatedObject) {
            //                 this.error(`[createObject] Can't create Relationship - DataObject not found: ${relatedObjectId}`);
            //             } else {
            //                 // @ts-ignore
            //                 const relation = new Relationship(relationType, this, relatedObject);
            //                 relatedObject.relating[relationType].push(relation);
            //                 dataObject.related[relationType].push(relation);
            //             }
            //         }
            //     }
            // }
            this.data.onObjectCreated.dispatch(this.data, dataObject);
        } else {
            this.objects[id] = dataObject;
            this.data.objects[id] = dataObject;
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
     * Creates a new {@link Relationship} between two existing {@link DataObject | DataObjects}.
     *
     * * A Relationship involves a *relating* DataObject and a *related* DataObject.
     * * The *relating* and *related* DataObjects can exist within different DataModels,
     * as long as the DataModels both exist in the same {@link Data}. This feature is part of
     * how xeokit supports the viewing of [*federated models*](/docs/pages/GLOSSARY.html#federated-models).
     * * The new Relationship will be stored in
     *   - {@link DataModel.relationships | DataModel.relationships},
     *   - {@link DataObject.related | DataObject.related} on the *relating* DataObject, and
     *   - {@link DataObject.relating | DataObject.relating} on the *related* DataObject.
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @param relationshipParams - Relationship creation parameters.
     * @throws {@link Error}
     * * If this DataModel has already been built or destroyed.
     * * The *relating* DataObject was not found in the {@link Data} that contains this DataModel.
     * * The *related* DataObject was not found in the Data that contains this DataModel.
     */
    createRelationship(relationshipParams: RelationshipParams): Relationship {
        if (this.destroyed) {
            throw new Error("DataModel already destroyed - not allowed to add relationships");
        }
        if (this.built) {
            throw new Error("DataModel already built - not allowed to add relationships");
        }
        const relatingObject = this.data.objects[relationshipParams.relatingObjectId];
        if (!relatingObject) {
            throw new Error(`Relating DataObject not found: ${relationshipParams.relatingObjectId}`);
        }
        const relatedObject = this.data.objects[relationshipParams.relatedObjectId];
        if (!relatedObject) {
            throw new Error(`Related DataObject not found: ${relationshipParams.relatedObjectId}`);
        }
        const relation = new Relationship(relationshipParams.type, relatingObject, relatedObject);
        if (!relatedObject.relating[relationshipParams.type]) {
            relatedObject.relating[relationshipParams.type] = [];
        }
        relatedObject.relating[relationshipParams.type].push(relation);
        if (!relatingObject.related[relationshipParams.type]) {
            relatingObject.related[relationshipParams.type] = [];
        }
        relatingObject.related[relationshipParams.type].push(relation);
        this.relationships.push(relation);
        return relation;
    }

    /**
     * Finalizes this DataModel, readying it for use.
     *
     * * Fires an event via {@link DataModel.onBuilt | DataModel.onBuilt} and {@link Data.onModelCreated | DataModel.onCreated}, to indicate to subscribers that
     * the DataModel is complete and ready to use.
     * * You can only call this method once on a DataModel.
     * * Once built, no more components can be created in a DataModel.
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @throws {@link Error}
     * * If this DataModel has already been built or destroyed.
     */
    build(): void {
        if (this.destroyed) {
            throw new Error("DataModel already destroyed");
        }
        if (this.built) {
            throw new Error("DataModel already built");
        }
        this.built = true;
        this.onBuilt.dispatch(this, null);
    }

    getJSON(): DataModelParams {
        const dataModelParams = <DataModelParams>{
            id: this.id,
            propertySets: [],
            objects: [],
            relationships: []
        };

        for (let id in this.propertySets) {
            const propertySet = this.propertySets[id];
            const propertySetParams = <PropertySetParams>{
                id,
                name: propertySet.name,
                properties: [],
                type: propertySet.type,
                originalSystemId: propertySet.originalSystemId
            };
            for (let i = 0, len = propertySet.properties.length; i < len; i++) {
                const property = propertySet.properties[i];
                const propertyParams = <PropertyParams>{
                    name: property.name,
                    value: property.value,
                    type: property.type,
                    valueType: property.valueType,
                    description: property.description
                }
                propertySetParams.properties.push(propertyParams);
            }
            dataModelParams.propertySets.push(propertySetParams);
        }
        for (let id in this.objects) {
            const object = this.objects[id];
            const objectParams = <DataObjectParams>{
                id,
                type: object.type,
                name: object.name,
                propertySetIds: []
            };
            for (let id2 in object.propertySets) {
                const propertySet = object.propertySets[id2];
                objectParams.propertySetIds.push(propertySet.id);
            }
            dataModelParams.objects.push(objectParams);
        }
        for (let i = 0, len = this.relationships.length; i < len; i++) {
            const relationship = this.relationships[i];
            const relationParams = <RelationshipParams>{
                type: relationship.type,
                relatingObjectId: relationship.relatingObject.id,
                relatedObjectId: relationship.relatedObject.id
            };
            dataModelParams.relationships.push(relationParams);
        }
        return dataModelParams;
    }

    /**
     * Destroys this DataModel.
     *
     * * Fires an event via {@link DataModel.onDestroyed | DataModel.onDestroyed} and {@link Data.onModelDestroyed | Data.onModelDestroyed}.
     * * You can only call this method once on a DataModel.
     * * Once destroyed, no more components can be created in a DataModel.
     * * Does not matter if the DataModel has not yet been built.
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @throws {@link Error}
     * * If this DataModel has already been destroyed.
     */
    destroy() {
        if (this.destroyed) {
            throw new Error("DataModel already destroyed");
        }
        for (let id in this.objects) {
            const dataObject = this.objects[id];
            if (dataObject.models.length > 1) {
                this.#removeObjectFromModels(dataObject);
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
                            const related = relation.relatedObject;
                            const list = related.relating[type];
                            for (let j = 0, k = 0, lenj = list.length; j < lenj; j++) {
                                if (list[k].relatingObject === dataObject) {
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

    // #removePropertySetFromModels(dataObject: DataObject) {
    //     for (let i = 0, len = dataObject.models.length; i < len; i++) {
    //         if (dataObject.models[i] === this) {
    //             dataObject.models = dataObject.models.splice(i, 1);
    //             break;
    //         }
    //     }
    // }

    #removeObjectFromModels(dataObject: DataObject) {
        for (let i = 0, len = dataObject.models.length; i < len; i++) {
            if (dataObject.models[i] === this) {
                dataObject.models = dataObject.models.splice(i, 1);
                break;
            }
        }
    }
}

