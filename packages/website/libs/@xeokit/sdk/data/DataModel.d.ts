import { Component, EventEmitter, SDKError } from "../core";
import type { Data } from "./Data";
import { PropertySet } from "./PropertySet";
import { DataObject } from "./DataObject";
import type { DataModelParams } from "./DataModelParams";
import type { DataObjectParams } from "./DataObjectParams";
import type { PropertySetParams } from "./PropertySetParams";
import { Relationship } from "./Relationship";
import type { RelationshipParams } from "./RelationshipParams";
import { DataModelContentParams } from "./DataModelContentParams";
/**
 * Represents an entity-relationship data model.
 *
 * This model is:
 * * Created using {@link Data.createModel | Data.createModel}.
 * * Stored in {@link Data.models | Data.models}.
 * * Composed of {@link DataObject | DataObjects}, {@link Relationship | Relationships}, {@link PropertySet | PropertySets}, and {@link Property | Properties}.
 * * Capable of importing and exporting various file formats.
 * * Supports traversal and search of the data structure.
 * * Can be built programmatically.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
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
     * DataModels are stored against this ID in {@link Data.models | Data.models}.
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
     * The{@link PropertySet | PropertySets} in this DataModel, mapped to{@link PropertySet.id | PropertySet.id}.
     *
     * PropertySets have globally-unique IDs and will also be stored in {@link Data.propertySets | Data.propertySets}.
     */
    readonly propertySets: {
        [key: string]: PropertySet;
    };
    /**
     * The {@link DataObject | DataObjects} in this DataModel, mapped to {@link DataObject.id | DataObject.id}.
     *
     * DataObjects have globally-unique IDs and will also be stored in {@link Data.objects | Data.objects}.
     */
    objects: {
        [key: string]: DataObject;
    };
    /**
     * The root {@link DataObject | DataObjects} in this DataModel, mapped
     * to {@link DataObject.id | DataObject.id}.
     *
     * * This is the set of DataObjects in this DataModel that are not the *related* participant in
     * any {@link Relationship | Relationships}, where they have no incoming Relationships and
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
     * The {@link Relationship | Relationships} in this DataModel.
     *
     * * The Relationships can be between DataObjects in different DataModels, but always within the same Data.
     */
    relationships: Relationship[];
    /**
     * The count of each type of {@link DataObject | DataObject} in this DataModel, mapped to {@link DataObject.type | DataObject.type}.
     */
    readonly typeCounts: {
        [key: string]: number;
    };
    /**
     * Emits an event when the {@link DataModel | DataModel} has been built.
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
     * Creates a new {@link PropertySet | PropertySet} and registers it within the DataModel and Data.
     *
     * - The new PropertySet is stored in {@link DataModel.propertySets | DataModel.propertySets} and
     *   {@link Data.propertySets | Data.propertySets}.
     * - PropertySet IDs are globally unique. If a PropertySet with the given ID already exists in the same Data,
     *   it will be reused and shared across DataModels instead of creating a duplicate.
     * - A PropertySet ID **must be unique within a single DataModel** but can be shared between multiple DataModels.
     *
     * ### Usage Example
     *
     * ```javascript
     * const propertySet = dataModel.createPropertySet({
     *     id: "myPropertySet",
     *     name: "My properties",
     *     properties: [
     *         {
     *             name: "Weight",
     *             value: 5,
     *             type: "",
     *             valueType: "",
     *             description: "Weight of a thing"
     *         },
     *         {
     *             name: "Height",
     *             value: 12,
     *             type: "",
     *             valueType: "",
     *             description: "Height of a thing"
     *         }
     *     ]
     * });
     *
     * if (propertySet instanceof SDKError) {
     *     console.error(propertySet.message);
     * } else {
     *     // PropertySet successfully created
     * }
     * ```
     *
     * See {@link data | @xeokit/sdk/data} for more details.
     *
     * @param propertySetCfg - Configuration parameters for the new PropertySet.
     * @returns {@link PropertySet} on success.
     * @returns {@link core!SDKError | SDKError} if:
     * - The DataModel has already been built.
     * - The DataModel has been destroyed.
     * - A PropertySet with the same ID already exists within this DataModel.
     */
    createPropertySet(propertySetCfg: PropertySetParams): PropertySet | SDKError;
    /**
     * Creates a new {@link DataObject | DataObject} and registers it within the DataModel and Data.
     *
     * - The new DataObject is stored in {@link DataModel.objects | DataModel.objects} and
     *   {@link Data.objects | Data.objects}.
     * - Triggers an event via {@link Data.onObjectCreated | Data.onObjectCreated}.
     * - DataObject IDs are **globally unique**. If a DataObject with the given ID already exists in the same Data,
     *   it will be reused and shared across DataModels rather than creating a duplicate.
     * - This behavior enables xeokit to support [*federated data models*](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#federated-models).
     *
     * ### Usage Example
     *
     * ```javascript
     * const myDataObject = dataModel.createObject({
     *     id: "myDataObject",
     *     type: BasicEntity, // @xeokit/basictypes!basicTypes
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
     * } else if (myDataObject2 instanceof SDKError) {
     *     console.error(myDataObject2.message);
     * } else {
     *     // Success
     *     const gotMyDataObject = dataModel.objects["myDataObject"];
     *     const gotMyDataObjectAgain = data.objects["myDataObject"];
     * }
     * ```
     *
     * See {@link data | @xeokit/sdk/data} for more details.
     *
     * @param dataObjectParams - Configuration parameters for the new DataObject.
     * @returns {@link DataObject} on success.
     * @returns {@link core!SDKError | SDKError} if:
     * - The DataModel has already been built.
     * - The DataModel has been destroyed.
     * - A DataObject with the same ID already exists within this DataModel.
     * - A specified PropertySet could not be found.
     */
    createObject(dataObjectParams: DataObjectParams): DataObject | SDKError;
    /**
     * Creates a new {@link Relationship | Relationship} between two existing {@link DataObject | DataObjects}.
     *
     * - A Relationship consists of a *relating* DataObject and a *related* DataObject.
     * - The *relating* and *related* DataObjects can belong to different DataModels, provided both DataModels exist
     *   within the same {@link Data}. This enables xeokit to support [*federated models*](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#federated-models).
     * - The created Relationship is stored in:
     *   - {@link DataModel.relationships | DataModel.relationships},
     *   - {@link DataObject.related | DataObject.related} on the *relating* DataObject, and
     *   - {@link DataObject.relating | DataObject.relating} on the *related* DataObject.
     *
     * ### Usage Example
     *
     * ```javascript
     * const myRelationship = dataModel.createRelationship({
     *     type: BasicAggregation,  // @xeokit/basictypes!basicTypes
     *     relatingObjectId: "myDataObject",
     *     relatedObjectId: "myDataObject2"
     * });
     *
     * if (myRelationship instanceof SDKError) {
     *     console.error(myRelationship.message);
     * } else {
     *     // Success
     *     const myDataObject = dataModel.objects["myDataObject"];
     *     const myDataObject2 = dataModel.objects["myDataObject2"];
     *
     *     const gotMyRelationship = myDataObject.related[BasicAggregation][0];
     *     const gotMyRelationshipAgain = myDataObject2.relating[BasicAggregation][0];
     * }
     * ```
     *
     * See {@link data | @xeokit/sdk/data} for more details.
     *
     * @param relationshipParams - Configuration parameters for the new Relationship.
     * @returns {@link Relationship} on success.
     * @returns {@link core!SDKError | SDKError} if:
     * - The DataModel has already been built or destroyed.
     * - The *relating* DataObject does not exist in the {@link Data} containing this DataModel.
     * - The *related* DataObject does not exist in the {@link Data} containing this DataModel.
     */
    createRelationship(relationshipParams: RelationshipParams): Relationship | SDKError;
    /**
     * Finalizes this DataModel, making it ready for use.
     *
     * - Triggers the following events to notify subscribers:
     *   - {@link DataModel.onBuilt | DataModel.onBuilt}
     *   - {@link Data.onModelCreated | Data.onModelCreated}
     * - Sets {@link DataModel.built | DataModel.built} to `true`.
     * - Can only be called once per DataModel.
     * - Once built, no additional components can be created within this DataModel.
     *
     * ### Usage Example
     *
     * ```javascript
     * dataModel.onBuilt.subscribe(() => {
     *     // The DataModel is built and ready for use
     * });
     *
     * data.onModelCreated.subscribe((dataModel) => {
     *     // Another way to listen for DataModel readiness
     * });
     *
     * const result = dataModel.build();
     *
     * if (result instanceof SDKError) {
     *     console.error(result.message);
     * } else {
     *     // Success
     * }
     * ```
     *
     * See {@link data | @xeokit/sdk/data} for more details.
     *
     * @throws {@link core!SDKError | SDKError} if:
     * - The DataModel has already been built.
     * - The DataModel has been destroyed.
     */
    build(): Promise<DataModel>;
    /**
     * Adds components from the specified `DataModelParams` to the data model.
     *
     * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
     *
     * @param dataModelParams - The parameters to configure and populate the data model.
     *
     * @returns `void`
     * * If the operation is successful.
     *
     * @returns {@link core!SDKError | SDKError}
     * * If the data model has already been built.
     * * If the data model has already been destroyed.
     * * If a duplicate `PropertySet` was already created for the data model.
     * * If a duplicate `DataObject` already exists in the data model.
     * * If the necessary `DataObjects` were not found for a relationship.
     */
    fromParams(dataModelParams: DataModelContentParams): void | SDKError;
    /**
     * Gets this DataModel as a DataModelParams.
     */
    toParams(): DataModelParams | SDKError;
    /**
     * Destroys this DataModel.
     *
     * This method performs the following actions:
     * * Fires an event via {@link DataModel.onDestroyed | DataModel.onDestroyed} and
     * {@link Data.onModelDestroyed | Data.onModelDestroyed}.
     * * Can only be called once on a DataModel.
     * * After destruction, no more components can be created in the DataModel.
     * * It is safe to call this method even if the DataModel has not yet been built.
     *
     * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
     *
     * @returns `void`
     * * If the operation is successful.
     *
     * @returns {@link core!SDKError | SDKError}
     * * If the DataModel has already been destroyed.
     */
    destroy(): void | SDKError;
}
//# sourceMappingURL=DataModel.d.ts.map