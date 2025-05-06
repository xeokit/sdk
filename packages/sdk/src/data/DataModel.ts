import {Component, EventEmitter, SDKError} from "../core";
import type {Data} from "./Data";
import type {DataModelContentParams} from "./DataModelContentParams";
import type {DataModelParams} from "./DataModelParams";
import type {DataModelStats} from "./DataModelStats";
import {DataObject} from "./DataObject";
import type {DataObjectParams} from "./DataObjectParams";
import {EventDispatcher} from "strongly-typed-events";
import type {PropertyParams} from "./PropertyParams";
import {PropertySet} from "./PropertySet";
import type {PropertySetParams} from "./PropertySetParams";
import {Relationship} from "./Relationship";
import type {RelationshipParams} from "./RelationshipParams";

/**
 * Contains a model's semantic data, as an entity-relationship graph.
 *
 * This data model is:
 * * Created using {@link Data.createModel | Data.createModel}.
 * * Stored in {@link Data.models | Data.models}.
 * * Composed of {@link DataObject | DataObjects}, {@link Relationship | Relationships}, {@link PropertySet | PropertySets}, and {@link Property | Properties}.
 * * Capable of importing and exporting various file formats.
 * * Supports traversal and search of the data structure.
 * * Can be built programmatically.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/data}.
 */

export class DataModel extends Component {

  /**
   * The Data that contains this DataModel.
   */
  public readonly data: Data;

  /**
   * Unique ID of this DataModel.
   *
   * DataModels are stored against this ID in {@link Data.models | Data.models}.
   */
  declare public readonly id: string;

  /**
   * The model name, if available.
   */
  public name?: string;

  /**
   * The project ID, if available.
   */
  public projectId?: string | number;

  /**
   * The revision ID, if available.
   */
  public revisionId?: string | number;

  /**
   * The model author, if available.
   */
  public author?: string;

  /**
   * The date the model was created, if available.
   */
  public createdAt?: string;

  /**
   * The application that created the model, if available.
   */
  public creatingApplication?: string;

  /**
   * The model schema version, if available.
   */
  public schema?: string;

  /**
   * The{@link PropertySet | PropertySets} in this DataModel, mapped to{@link PropertySet.id | PropertySet.id}.
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
   * The root {@link DataObject | DataObjects} in this DataModel, mapped
   * to {@link DataObject.id | DataObject.id}.
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
   * The count of each type of {@link DataObject | DataObject} in this DataModel, mapped to {@link DataObject.type | DataObject.type}.
   */
  public readonly typeCounts: { [key: string]: number };

  /**
   * Emits an event when the {@link DataModel | DataModel} has been built.
   *
   * * The DataModel is built using {@link DataModel.build | DataModel.build}.
   * * {@link DataModel.built | DataModel.built} indicates if the DataModel is currently built.
   * * Don't create anything more in this DataModel once it's built.
   *
   * @event
   */
  public readonly onBuilt: EventEmitter<DataModel, null>;

  /**
   * Indicates if this DataModel has been built.
   *
   * * Set true by {@link DataModel.build | DataModel.build}.
   * * Subscribe to updates using {@link DataModel.onBuilt | DataModel.onBuilt} and {@link Data.onModelCreated | Data.onModelCreated}.
   */
  built: boolean;

  /**
   * Statistics on this DataModel.
   */
  public readonly stats: DataModelStats;

  #destroyed: boolean;

  /**
   * @private
   */
  constructor(
    data: Data,
    id: string,
    dataModelParams: DataModelParams) {

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

    this.stats = {
      numObjects: 0,
      numRelationships: 0,
      numPropertySets: 0
    };

    this.fromParams(dataModelParams);
  }

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
  createPropertySet(propertySetCfg: PropertySetParams): PropertySet | SDKError {
    if (this.destroyed) {
      return new SDKError("Failed to create PropertySet - DataModel already destroyed");
    }
    if (this.built) {
      return new SDKError("DataModel already built");
    }
    if (this.propertySets[propertySetCfg.id]) {
      return new SDKError("Failed to create PropertySet - PropertySet with same ID already created in this DataModel. It's OK to have duplicates shared between DataModels, but they must be unique within each DataModel.")
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
    this.stats.numPropertySets++;
    return propertySet;
  }

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
  createObject(dataObjectParams: DataObjectParams): DataObject | SDKError {
    if (this.destroyed) {
      return new SDKError("Failed to create DataObject - DataModel already destroyed");
    }
    if (this.built) {
      return new SDKError("Failed to create DataObject - DataModel already built");
    }
    const id = dataObjectParams.id;
    if (this.objects[id]) {
      return new SDKError("Failed to create DataObject - DataObject with same ID already created in this DataModel. It's OK to have duplicates shared between DataModels, but they must be unique within each DataModel.")
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
            return new SDKError(`Failed to create DataObject - PropertySet not found: "${propertySetId}"`);
          } else {
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
    } else {
      if (dataObject.models.length > 0 && this.schema !== dataObject.models[0].schema) {
        return new SDKError(`Failed to create DataObject of schema '${this.schema}' - ID clashes with existing DataObject of schema '${this.schema}'`);
      }
      this.objects[id] = dataObject;
      this.data.objects[id] = dataObject;
      if (!this.objectsByType[type]) {
        this.objectsByType[type] = {};
      }
      this.objectsByType[type][id] = dataObject;
      this.typeCounts[type] = (this.typeCounts[type] === undefined) ? 1 : this.typeCounts[type] + 1;
      dataObject.models.push(this);
    }
    this.stats.numObjects++;
    return dataObject;
  }

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
  createRelationship(relationshipParams: RelationshipParams): Relationship | SDKError {
    if (this.destroyed) {
      return new SDKError("Failed to create Relationship - DataModel already destroyed");
    }
    if (this.built) {
      return new SDKError("Failed to create Relationship - DataModel already built");
    }
    const relatingObject = this.data.objects[relationshipParams.relatingObjectId];
    if (!relatingObject) {
      return new SDKError(`Failed to create Relationship - relating DataObject not found: ${relationshipParams.relatingObjectId}`);
    }
    const relatedObject = this.data.objects[relationshipParams.relatedObjectId];
    if (!relatedObject) {
      return new SDKError(`Failed to create Relationship - related DataObject not found: ${relationshipParams.relatedObjectId}`);
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
    this.stats.numRelationships++;
    return relation;
  }

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
  build(): Promise<DataModel> {
    return new Promise<DataModel>((resolve) => {
      if (this.destroyed) {
        throw new SDKError("Failed to build DataModel - DataModel already destroyed");
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
  fromParams(dataModelParams: DataModelContentParams): void | SDKError {
    if (this.destroyed) {
      return new SDKError("Failed to add components to DataModel - DataModel already destroyed");
    }
    if (this.built) {
      throw new SDKError("Failed to add components to DataModel - DataModel already built");
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
   * Gets this DataModel as a DataModelParams.
   */
  toParams(): DataModelParams | SDKError {
    if (this.destroyed) {
      return new SDKError("DataModel already destroyed");
    }
    const dataModelParams = <DataModelParams>{
      id: this.id,
      propertySets: [],
      objects: [],
      relationships: []
    };
    for (const id in this.propertySets) {
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
        };
        propertySetParams.properties.push(propertyParams);
      }
      dataModelParams.propertySets?.push(propertySetParams);
    }
    for (const id in this.objects) {
      const dataObject = this.objects[id];
      const dataObjectParams = <DataObjectParams>{
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
      const relationParams = <RelationshipParams>{
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
  destroy(): void | SDKError {
    if (this.destroyed) {
      return new SDKError("Failed to destroy DataModel - DataModel already destroyed");
    }
    for (const id in this.objects) {
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
          for (const type in dataObject.relating) {
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

