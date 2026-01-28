import { Component, EventEmitter, SDKError } from "../core";
import { PropertySet } from "./PropertySet";
import { DataObject } from "./DataObject";
import { Relationship } from "./Relationship";
import { EventDispatcher } from "strongly-typed-events";
/**
 *
 * An entity-relationship data model.
 *
 * * Created with {@link data!Data.createModel | Data.createModel}
 * * Stored in {@link data!Data.models | Data.models}
 * * Contains {@link data!DataObject | DataObjects}, {@link data!Relationship | Relationships}, {@link data!PropertySet | PropertySets} and {@link data!Property | Properties}
 * * Import and export various file formats
 * * Traverse and search
 * * Build programmatically
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export class DataModel extends Component {
    /**
     * The Data that contains this DataModel.
     */
    data;
    /**
     * The model name, if available.
     */
    name;
    /**
     * The project ID, if available.
     */
    projectId;
    /**
     * The revision ID, if available.
     */
    revisionId;
    /**
     * The model author, if available.
     */
    author;
    /**
     * The date the model was created, if available.
     */
    createdAt;
    /**
     * The application that created the model, if available.
     */
    creatingApplication;
    /**
     * The model schema version, if available.
     */
    schema;
    /**
     * The{@link data!PropertySet | PropertySets} in this DataModel, mapped to{@link data!PropertySet.id | PropertySet.id}.
     *
     * PropertySets have globally-unique IDs and will also be stored in {@link data!Data.propertySets | Data.propertySets}.
     */
    propertySets;
    /**
     * The {@link data!DataObject | DataObjects} in this DataModel, mapped to {@link data!DataObject.id | DataObject.id}.
     *
     * DataObjects have globally-unique IDs and will also be stored in {@link data!Data.objects | Data.objects}.
     */
    objects;
    /**
     * The root {@link data!DataObject | DataObjects} in this DataModel, mapped
     * to {@link data!DataObject.id | DataObject.id}.
     *
     * * This is the set of DataObjects in this DataModel that are not the *related* participant in
     * any {@link data!Relationship | Relationships}, where they have no incoming Relationships and
     * their {@link data!DataObject.relating} property is empty.
     */
    rootObjects;
    /**
     * The {@link data!DataObject | DataObjects} in this DataModel, mapped to {@link data!DataObject.type | DataObject.type},
     * sub-mapped to {@link data!DataObject.id | DataObject.id}.
     */
    objectsByType;
    /**
     * The {@link data!Relationship | Relationships} in this DataModel.
     *
     * * The Relationships can be between DataObjects in different DataModels, but always within the same Data.
     */
    relationships;
    /**
     * The count of each type of {@link data!DataObject | DataObject} in this DataModel, mapped to {@link data!DataObject.type | DataObject.type}.
     */
    typeCounts;
    /**
     * Emits an event when the {@link data!DataModel | DataModel} has been built.
     *
     * * The DataModel is built using {@link data!DataModel.build | DataModel.build}.
     * * {@link data!DataModel.built | DataModel.built} indicates if the DataModel is currently built.
     * * Don't create anything more in this DataModel once it's built.
     *
     * @event
     */
    onBuilt;
    /**
     * Indicates if this DataModel has been built.
     *
     * * Set true by {@link data!DataModel.build | DataModel.build}.
     * * Subscribe to updates using {@link data!DataModel.onBuilt | DataModel.onBuilt} and {@link data!Data.modelCreated | Data.modelCreated}.
     */
    built;
    #destroyed;
    /**
     * @private
     */
    constructor(data, id, dataModelParams, options) {
        super(data);
        this.onBuilt = new EventEmitter(new EventDispatcher());
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
     * Creates components in this DataModel from JSON.
     *
     * See {@link "@xeokit/data" | @xeokit/data}  for usage.
     *
     * @param dataModelParams
     * @returns *void*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * If this DataModel has already been built.
     * * If this DataModel has already been destroyed.
     * * A duplicate PropertySet was already created for this DataModel.
     * * A duplicate DataObject was already created in this DataModel.
     * * DataObjects were not found for a Relationship.
     */
    fromJSON(dataModelParams) {
        if (this.destroyed) {
            return new SDKError("Cannot add components to DataModel - DataModel already destroyed");
        }
        if (this.built) {
            throw new SDKError("Cannot add components to DataModel - DataModel already built");
        }
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
     * Creates a new {@link data!PropertySet | PropertySet}.
     *
     * * Stores the new PropertySet in {@link data!DataModel.propertySets | DataModel.propertySets}
     * and {@link data!Data.propertySets | Data.propertySets}.
     * * Note that PropertySet IDs are globally unique. PropertySet instances are automatically reused and shared among DataModels
     * when IDs given to {@link data!DataModel.createPropertySet | DataModel.createPropertySet} match existing PropertySet
     * instances in the same Data.
     *
     * ### Usage
     *
     * ````javascript
     *  const propertySet = dataModel.createPropertySet({
     *      id: "myPropertySet",
     *      name: "My properties",
     *      properties: [{
     *          name: "Weight",
     *          value: 5,
     *          type: "",
     *          valueType: "",
     *          description: "Weight of a thing"
     *      }, {
     *          name: "Height",
     *          value: 12,
     *          type: "",
     *          valueType: "",
     *          description: "Height of a thing"
     *      }]
     * });
     *
     * if (propertySet instanceof SDKError) {
     *     console.error(propertySet.message);
     * } else {
     *     // Success
     * }
     * ````
     *
     * See {@link "@xeokit/data" | @xeokit/data}  for more usage info.
     *
     * @param propertySetCfg - PropertySet creation parameters.
     * @returns *{@link PropertySet}*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * If this DataModel has already been built.
     * * If this DataModel has already been destroyed.
     * * A PropertySet of the given ID was already created for this DataModel. While it's OK
     * for multiple DataModels to *share* PropertySets with duplicate IDs between them, it's not permitted to
     * create duplicate PropertySets within the same DataModel.
     */
    createPropertySet(propertySetCfg) {
        if (this.destroyed) {
            return new SDKError("Cannot create PropertySet - DataModel already destroyed");
        }
        if (this.built) {
            return new SDKError("DataModel already built");
        }
        if (this.propertySets[propertySetCfg.id]) {
            return new SDKError("Cannot create PropertySet - PropertySet with same ID already created in this DataModel. It's OK to have duplicates shared between DataModels, but they must be unique within each DataModel.");
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
     * Creates a new {@link data!DataObject | DataObject}.
     *
     * * Stores the new {@link data!DataObject | DataObject} in {@link DataModel.objects | DataModel.objects} and {@link Data.objects | Data.objects}.
     * * Fires an event via {@link Data.onObjectCreated | Data.objectCreated}.
     * * Note that DataObject IDs are globally unique. DataObject instances are automatically reused and shared among DataModels when
     * IDs given to {@link DataModel.createObject | DataModel.createObject} match existing DataObject instances in the same
     * Data. This feature is part of how xeokit supports [*federated data models*](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#federated-models).
     *
     * ### Usage
     *
     * ````javascript
     * const myDataObject = dataModel.createObject({
     *     id: "myDataObject",
     *     type: BasicEntity,     // @xeokit/basictypes!basicTypes
     *     name: "My Object",
     *     propertySetIds: ["myPropertySet"]
     * });
     *
     * const myDataObject2 = dataModel.createObject({
     *     id: "myDataObject2",
     *     name: "My Other Object",
     *     type: BasicEntity,
     *     propertySetIds: ["myPropertySet"]
     * });
     *
     * if (myDataObject instanceof SDKError) {
     *     console.error(myDataObject.message);
     *
     * } else if (myDataObject2 instanceof SDKError) {
     *     console.error(myDataObject2.message);
     *
     * } else { // Success
     *     const gotMyDataObject = dataModel.objects["myDataObject"];
     *     const gotMyDataObjectAgain = data.objects["myDataObject"];
     * }
     * ````
     *
     * See {@link "@xeokit/data" | @xeokit/data}  for more usage info.
     *
     * @param dataObjectParams - DataObject creation parameters.
     * @returns *{@link DataObject}*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * If this DataModel has already been built.
     * * If this DataModel has already been destroyed.
     * * A DataObject of the given ID was already created in this DataModel. While it's OK
     * for multiple DataModels to *share* DataObjects with duplicate IDs between them, we're not permitted to
     * create duplicate DataObjects within the same DataModel.
     * * A specified PropertySet could not be found.
     */
    createObject(dataObjectParams) {
        if (this.destroyed) {
            return new SDKError("Cannot create DataObject - DataModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Cannot create DataObject - DataModel already built");
        }
        const id = dataObjectParams.id;
        if (this.objects[id]) {
            return new SDKError("Cannot create DataObject - DataObject with same ID already created in this DataModel. It's OK to have duplicates shared between DataModels, but they must be unique within each DataModel.");
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
                        return new SDKError(`Cannot create DataObject - PropertySet not found: "${propertySetId}"`);
                    }
                    else {
                        propertySets.push(propertySet);
                    }
                }
            }
            dataObject = new DataObject(this.data, this, id, dataObjectParams.originalSystemId, dataObjectParams.name, dataObjectParams.description, dataObjectParams.type, propertySets);
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
        }
        else {
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
     * Creates a new {@link data!Relationship | Relationship} between two existing {@link DataObject | DataObjects}.
     *
     * * A Relationship involves a *relating* DataObject and a *related* DataObject.
     * * The *relating* and *related* DataObjects can exist within different DataModels,
     * as long as the DataModels both exist in the same {@link Data}. This feature is part of
     * how xeokit supports the viewing of [*federated models*](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#federated-models).
     * * The new Relationship will be stored in
     *   - {@link DataModel.relationships | DataModel.relationships},
     *   - {@link DataObject.related | DataObject.related} on the *relating* DataObject, and
     *   - {@link DataObject.relating | DataObject.relating} on the *related* DataObject.
     *
     * ### Usage
     *
     * ````javascript
     * const myRelationship = dataModel.createRelationship({
     *     type: BasicAggregation,            // @xeokit/basictypes!basicTypes
     *     relatingObjectId: "myDataObject",
     *     relatedObjectId: "myDataObject2"
     * });
     *
     * if (myRelationship instanceof SDKError) {
     *     console.error(myRelationship.message);
     *
     * } else { // Success
     *     const myDataObject = dataModel.objects["myDataObject"];
     *     const myDataObject2 = dataModel.objects["myDataObject2"];
     *
     *     const gotMyRelationship = myDataObject.related[BasicAggregation][0];
     *     const gotMyRelationshipAgain = myDataObject2.relating[BasicAggregation][0];
     * }
     * ````
     *
     * See {@link "@xeokit/data" | @xeokit/data}  for more usage info.
     *
     * @param relationshipParams - Relationship creation parameters.
     * @returns *{@link data!Relationship | Relationship}*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * If this DataModel has already been built or destroyed.
     * * The *relating* DataObject was not found in the {@link Data} that contains this DataModel.
     * * The *related* DataObject was not found in the Data that contains this DataModel.
     */
    createRelationship(relationshipParams) {
        if (this.destroyed) {
            return new SDKError("Cannot create Relationship - DataModel already destroyed");
        }
        if (this.built) {
            return new SDKError("Cannot create Relationship - DataModel already built");
        }
        const relatingObject = this.data.objects[relationshipParams.relatingObjectId];
        if (!relatingObject) {
            return new SDKError(`Cannot create Relationship - relating DataObject not found: ${relationshipParams.relatingObjectId}`);
        }
        const relatedObject = this.data.objects[relationshipParams.relatedObjectId];
        if (!relatedObject) {
            return new SDKError(`Cannot create Relationship - related DataObject not found: ${relationshipParams.relatedObjectId}`);
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
     * * Sets {@link DataModel.built | DataModel.built} ````true````.
     * * You can only call this method once on a DataModel.
     * * Once built, no more components can be created in a DataModel.
     *
     * ````javascript
     * dataModel.onBuilt.subscribe(()=>{
     *     // Our DataModel is built and ready to use
     * });
     *
     * data.modelCreated.subscribe((dataModel)=>{
     *     // Another way to subscribe to DataModel readiness
     * });
     *
     * const result = dataModel.build();
     *
     * if (result instanceof SDKError) {
     *     console.error(result.message);
     * } else {
     *     // Success
     * }
     * ````
     *
     * See {@link "@xeokit/data" | @xeokit/data}  for usage.
     *
     * @throws *{@link core!SDKError | SDKError}*
     * * If DataModel has already been built or destroyed.
     */
    build() {
        return new Promise((resolve) => {
            if (this.destroyed) {
                throw new SDKError("Cannot build DataModel - DataModel already destroyed");
            }
            if (this.built) {
                throw new SDKError("Failed to build DataModel - DataModel already built");
            }
            this.built = true;
            this.onBuilt.dispatch(this, null);
            resolve(this);
        });
    }
    /**
     * Gets this DataModel as JSON.
     */
    getJSON() {
        if (this.destroyed) {
            return new SDKError("DataModel already destroyed");
        }
        const dataModelParams = {
            id: this.id,
            propertySets: [],
            objects: [],
            relationships: []
        };
        for (let id in this.propertySets) {
            const propertySet = this.propertySets[id];
            const propertySetParams = {
                id,
                name: propertySet.name,
                properties: [],
                type: propertySet.type,
                originalSystemId: propertySet.originalSystemId
            };
            for (let i = 0, len = propertySet.properties.length; i < len; i++) {
                const property = propertySet.properties[i];
                const propertyParams = {
                    name: property.name,
                    value: property.value,
                    type: property.type,
                    valueType: property.valueType,
                    description: property.description
                };
                propertySetParams.properties.push(propertyParams);
            }
            dataModelParams.propertySets?.push(propertySetParams);
        }
        for (let id in this.objects) {
            const dataObject = this.objects[id];
            const dataObjectParams = {
                id,
                originalSystemId: dataObject.originalSystemId,
                type: dataObject.type,
                name: dataObject.name,
                propertySetIds: []
            };
            if (dataObject.description !== undefined) {
                dataObjectParams.description = dataObject.description;
            }
            if (dataObject.propertySets) {
                for (let i = 0, len = dataObject.propertySets.length; i < len; i++) {
                    const propertySet = dataObject.propertySets[i];
                    dataObjectParams.propertySetIds?.push(propertySet.id);
                }
            }
            dataModelParams.objects?.push(dataObjectParams);
        }
        for (let i = 0, len = this.relationships.length; i < len; i++) {
            const relationship = this.relationships[i];
            const relationParams = {
                type: relationship.type,
                relatingObjectId: relationship.relatingObject.id,
                relatedObjectId: relationship.relatedObject.id
            };
            dataModelParams.relationships?.push(relationParams);
        }
        return dataModelParams;
    }
    /**
     * Destroys this DataModel.
     *
     * * Fires an event via {@link DataModel.onDestroyed | DataModel.onDestroyed} and {@link Data.onModelDestroyed | Data.modelDestroyed}.
     * * You can only call this method once on a DataModel.
     * * Once destroyed, no more components can be created in a DataModel.
     * * Does not matter if the DataModel has not yet been built.
     *
     * See {@link "@xeokit/data" | @xeokit/data}  for usage.
     *
     * @returns *void*
     * * On success.
     * @returns *{@link core!SDKError | SDKError}*
     * * If this DataModel has already been destroyed.
     */
    destroy() {
        if (this.destroyed) {
            return new SDKError("Failed to destroy DataModel - DataModel already destroyed");
        }
        for (let id in this.objects) {
            const dataObject = this.objects[id];
            if (dataObject.models.length > 1) {
                this.#removeObjectFromModels(dataObject);
            }
            else {
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
                                    list[j] = list[j];
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
    #removeObjectFromModels(dataObject) {
        for (let i = 0, len = dataObject.models.length; i < len; i++) {
            if (dataObject.models[i] === this) {
                dataObject.models = dataObject.models.splice(i, 1);
                break;
            }
        }
    }
}
//# sourceMappingURL=DataModel.js.map
