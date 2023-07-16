import { Component, EventEmitter, SDKError } from "@xeokit/core";
import type { Data } from "./Data";
import { PropertySet } from "./PropertySet";
import { DataObject } from "./DataObject";
import type { DataModelParams } from "./DataModelParams";
import type { DataObjectParams } from "./DataObjectParams";
import type { PropertySetParams } from "./PropertySetParams";
import { Relationship } from "./Relationship";
import type { RelationshipParams } from "./RelationshipParams";
/**
 * xeokit Semantic Data Model.
 *
 * See {@link "@xeokit/data"} for usage.
 */
export declare class DataModel extends Component {
    #private;
    /**
     * The Data that contains this DataModel.
     */
    readonly data: Data;
    /**
     * Unique ID of this DataModel.
     *
     * DataModels are stored against this ID in {@link @xeokit/data!Data.models}.
     */
    readonly id: string;
    /**
     * The model name, if available.
     */
    name?: string;
    /**
     * The project ID, if available.
     */
    projectId?: string | number;
    /**
     * The revision ID, if available.
     */
    revisionId?: string | number;
    /**
     * The model author, if available.
     */
    author?: string;
    /**
     * The date the model was created, if available.
     */
    createdAt?: string;
    /**
     * The application that created the model, if available.
     */
    creatingApplication?: string;
    /**
     * The model schema version, if available.
     */
    schema?: string;
    /**
     * The{@link @xeokit/data!PropertySet | PropertySets} in this DataModel, mapped to{@link @xeokit/data!PropertySet.id | PropertySet.id}.
     *
     * PropertySets have globally-unique IDs and will also be stored in {@link @xeokit/data!Data.propertySets | Data.propertySets}.
     */
    readonly propertySets: {
        [key: string]: PropertySet;
    };
    /**
     * The {@link @xeokit/data!DataObject | DataObjects} in this DataModel, mapped to {@link DataObject.id | DataObject.id}.
     *
     * DataObjects have globally-unique IDs and will also be stored in {@link Data.objects | Data.objects}.
     */
    objects: {
        [key: string]: DataObject;
    };
    /**
     * The root {@link DataObject | DataObjects} in this DataModel, mapped to {@link DataObject.id | DataObject.id}.
     *
     * * This is the set of DataObjects in this DataModel that are not the *related* participant in
     * any {@link @xeokit/data!Relationship | Relationships}, where they have no incoming Relationships and
     * their {@link DataObject.relating} property is empty.
     */
    rootObjects: {
        [key: string]: DataObject;
    };
    /**
     * The {@link DataObject | DataObjects} in this DataModel, mapped to {@link DataObject.type | DataObject.type},
     * sub-mapped to {@link DataObject.id | DataObject.id}.
     */
    objectsByType: {
        [key: string]: {
            [key: string]: DataObject;
        };
    };
    /**
     * The {@link @xeokit/data!Relationship | Relationships} in this DataModel.
     *
     * * The Relationships can be between DataObjects in different DataModels, but always within the same Data.
     */
    relationships: Relationship[];
    /**
     * The count of each type of {@link DataObject} in this DataModel, mapped to {@link DataObject.type | DataObject.type}.
     */
    readonly typeCounts: {
        [key: string]: number;
    };
    /**
     * Emits an event when the {@link @xeokit/data!DataModel} has been built.
     *
     * * The DataModel is built using {@link DataModel.build | DataModel.build}.
     * * {@link DataModel.built | DataModel.built} indicates if the DataModel is currently built.
     * * Don't create anything more in this DataModel once it's built.
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
    /**
     * @private
     */
    constructor(data: Data, id: string, dataModelParams: DataModelParams, options?: {
        includeTypes?: string[];
        excludeTypes?: string[];
        globalizeObjectIds?: boolean;
    });
    /**
     * Adds the given components to this DataModel.
     *
     * See {@link "@xeokit/data"} for usage.
     *
     * @param dataModelParams
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If this DataModel has already been built.
     * * If this DataModel has already been destroyed.
     * * A duplicate PropertySet was already created for this DataModel.
     * * A duplicate DataObject was already created in this DataModel.
     * * DataObjects were not found for a Relationship.
     */
    fromJSON(dataModelParams: DataModelParams): void | SDKError;
    /**
     * Creates a new {@link @xeokit/data!PropertySet}.
     *
     * * Stores the new PropertySet in {@link DataModel.propertySets | DataModel.propertySets}
     * and {@link Data.propertySets | Data.propertySets}.
     * * Note that PropertySet IDs are globally unique. PropertySet instances are automatically reused and shared among DataModels
     * when IDs given to {@link DataModel.createPropertySet | DataModel.createPropertySet} match existing PropertySet
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
     * See {@link "@xeokit/data"} for more usage info.
     *
     * @param propertySetCfg - PropertySet creation parameters.
     * @returns *{@link PropertySet}*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If this DataModel has already been built.
     * * If this DataModel has already been destroyed.
     * * A PropertySet of the given ID was already created for this DataModel. While it's OK
     * for multiple DataModels to *share* PropertySets with duplicate IDs between them, it's not permitted to
     * create duplicate PropertySets within the same DataModel.
     */
    createPropertySet(propertySetCfg: PropertySetParams): PropertySet | SDKError;
    /**
     * Creates a new {@link DataObject}.
     *
     * * Stores the new {@link DataObject} in {@link DataModel.objects | DataModel.objects} and {@link Data.objects | Data.objects}.
     * * Fires an event via {@link Data.onObjectCreated | Data.onObjectCreated}.
     * * Note that DataObject IDs are globally unique. DataObject instances are automatically reused and shared among DataModels when
     * IDs given to {@link DataModel.createObject | DataModel.createObject} match existing DataObject instances in the same
     * Data. This feature is part of how xeokit supports [*federated data models*](/docs/pages/GLOSSARY.html#federated-models).
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
     * See {@link "@xeokit/data"} for more usage info.
     *
     * @param dataObjectParams - DataObject creation parameters.
     * @returns *{@link DataObject}*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If this DataModel has already been built.
     * * If this DataModel has already been destroyed.
     * * A DataObject of the given ID was already created in this DataModel. While it's OK
     * for multiple DataModels to *share* DataObjects with duplicate IDs between them, we're not permitted to
     * create duplicate DataObjects within the same DataModel.
     * * A specified PropertySet could not be found.
     */
    createObject(dataObjectParams: DataObjectParams): DataObject | SDKError;
    /**
     * Creates a new {@link @xeokit/data!Relationship} between two existing {@link DataObject | DataObjects}.
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
     * See {@link "@xeokit/data"} for more usage info.
     *
     * @param relationshipParams - Relationship creation parameters.
     * @returns *{@link @xeokit/data!Relationship}*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If this DataModel has already been built or destroyed.
     * * The *relating* DataObject was not found in the {@link Data} that contains this DataModel.
     * * The *related* DataObject was not found in the Data that contains this DataModel.
     */
    createRelationship(relationshipParams: RelationshipParams): Relationship | SDKError;
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
     * data.onModelCreated.subscribe((dataModel)=>{
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
     * See {@link "@xeokit/data"} for usage.
     *
     * @throws *{@link @xeokit/core!SDKError}*
     * * If DataModel has already been built or destroyed.
     */
    build(): Promise<DataModel>;
    /**
     * Gets this DataModel as JSON.
     */
    getJSON(): DataModelParams | SDKError;
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
     * @returns *void*
     * * On success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * If this DataModel has already been destroyed.
     */
    destroy(): void | SDKError;
}
