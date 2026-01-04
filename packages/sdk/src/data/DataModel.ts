import {SDKErrorType, type SDKResult} from "../core";
import type {Data} from "./Data";
import type {DataModelContentParams} from "./DataModelContentParams";
import type {DataModelParams} from "./DataModelParams";
import type {DataModelStats} from "./DataModelStats";
import {DataObject} from "./DataObject";
import type {DataObjectParams} from "./DataObjectParams";
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

export class DataModel  {

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
   * The{@link PropertySet | PropertySets} in this DataModel, mapped to
   * {@link PropertySet.id | PropertySet.id}.
   *
   * PropertySets have globally-unique IDs and will also be stored in
   * {@link Data.propertySets | Data.propertySets}.
   */
  public readonly propertySets: { [key: string]: PropertySet };

  /**
   * The {@link DataObject | DataObjects} in this DataModel, mapped to
   * {@link DataObject.id | DataObject.id}.
   *
   * DataObjects have globally-unique IDs and will also be stored in
   * {@link Data.objects | Data.objects}.
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
   * The count of each type of {@link DataObject | DataObject} in this DataModel, mapped
   * to {@link DataObject.type | DataObject.type}.
   */
  public readonly typeCounts: { [key: string]: number };

  /**
   * Statistics on this DataModel.
   */
  public readonly stats: DataModelStats;

    /**
     * Indicates whether this DataModel has been destroyed.
     */
  public destroyed: boolean;

  /**
   * @private
   */
  constructor(
    data: Data,
    id: string,
    dataModelParams: DataModelParams) {

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
    this.destroyed = false;

    this.stats = {
      numObjects: 0,
      numRelationships: 0,
      numPropertySets: 0
    };

    this.fromParams(dataModelParams);
  }

  /**
   * Creates a new {@link PropertySet | PropertySet} and registers it within the `DataModel` and `Data`.
   *
   * - The new `PropertySet` is stored in {@link DataModel.propertySets | DataModel.propertySets} and
   * {@link Data.propertySets | Data.propertySets}.
   * - `PropertySet` IDs are globally unique. If a `PropertySet` with the given ID already exists in the same `Data`,
   * it will be reused and shared across `DataModels` instead of creating a duplicate.
   * - A `PropertySet` ID **must be unique within a single `DataModel`** but can be shared between multiple `DataModels`.
   * - Triggers an event via {@link DataEvents.onPropertySetCreated | DataEvents.onPropertySetCreated}.
   *
   * See {@link data | @xeokit/sdk/data} for usage.
   *
   * @param propertySetCfg - Configuration parameters for the new `PropertySet`.
   * @returns A result containing the created `PropertySet` on success, or an error message on failure.
   */
  createPropertySet(propertySetCfg: PropertySetParams): SDKResult<PropertySet> {
    if (this.destroyed) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Data.createPropertySet] Cannot create PropertySet - DataModel already destroyed"
      });
    }
    if (this.propertySets[propertySetCfg.id]) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[Data.createPropertySet] Cannot create PropertySet - PropertySet with same ID already created in this DataModel. It's OK to have duplicates shared between DataModels, but they must be unique within each DataModel."
      });
    }
    let propertySet = this.data.propertySets[propertySetCfg.id];
    if (propertySet) {
      this.propertySets[propertySetCfg.id] = propertySet;
      propertySet.models.push(this);
      return {
        ok: true,
        value: propertySet
      };
    }
    propertySet = new PropertySet(this, propertySetCfg);
    this.propertySets[propertySetCfg.id] = propertySet;
    this.data.propertySets[propertySetCfg.id] = propertySet;
    this.stats.numPropertySets++;
    this.data.events.onPropertySetCreated.dispatch(this.data, propertySet);
    return {
      ok: true,
      value: propertySet
    };
  }

  /**
   * Creates a new {@link DataObject | DataObject} and registers it within the `DataModel` and `Data`.
   *
   * - The new `DataObject` is stored in {@link DataModel.objects | DataModel.objects} and
   *  {@link Data.objects | Data.objects}.
   *  - `DataObject` IDs are globally unique. If a `DataObject` with the given ID already exists in the same `Data`,
   *  it will be reused and shared across `DataModels` instead of creating a duplicate.
   *  - A `DataObject` ID **must be unique within a single `DataModel`** but can be shared between multiple `DataModels`.
   *  - Triggers an event via {@link DataEvents.onDataObjectCreated | DataEvents.onObjectCreated}.
   *
   * See {@link data | @xeokit/sdk/data} for usage.
   *
   * @param dataObjectParams - Configuration parameters for the new `DataObject`.
   * @returns A result containing the created `DataObject` on success, or an error message on failure.
   */
  createObject(dataObjectParams: DataObjectParams): SDKResult<DataObject> {
    if (this.destroyed) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Data.createObject] Cannot create DataObject - DataModel already destroyed"
      });
    }
    const id = dataObjectParams.id;
    if (this.objects[id]) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[Data.createObject] Cannot create DataObject - DataObject with same ID already created in this DataModel. It's OK to have duplicates shared between DataModels, but they must be unique within each DataModel."
      });
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
            return this.data.logError({
              ok: false,
              type: SDKErrorType.InvalidInput,
              error: `[Data.createObject] Cannot create DataObject - PropertySet not found: "${propertySetId}"`
            });
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
      this.data.events.onDataObjectCreated.dispatch(this.data, dataObject);
    } else {
      if (dataObject.models.length > 0 && this.schema !== dataObject.models[0].schema) {
        return this.data.logError({
          ok: false,
            type: SDKErrorType.InvalidInput,
          error: `[Data.createObject] Cannot create DataObject of schema '${this.schema}' - ID clashes with existing DataObject of schema '${this.schema}'`
        });
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
    return {
      ok: true,
      value: dataObject
    };
  }

  /**
   * Creates a new {@link Relationship | Relationship} between two existing {@link DataObject | DataObjects}.
   *
   * - The new `Relationship` is stored in {@link DataModel.relationships | DataModel.relationships}.
   * - Triggers an event via {@link DataEvents.onRelationshipCreated | DataEvents.onRelationshipCreated}.
   *
   * See {@link data | @xeokit/sdk/data} for usage
   *
   * @param relationshipParams - Configuration parameters for the new `Relationship`.
   * @returns A result containing the created `Relationship` on success, or an error message on failure.
   */
  createRelationship(relationshipParams: RelationshipParams): SDKResult<Relationship> {
    if (this.destroyed) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DataModel.createRelationship] Cannot create Relationship - DataModel already destroyed"
      });
    }
    const relatingObject = this.data.objects[relationshipParams.relatingObjectId];
    if (!relatingObject) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[DataModel.createRelationship] Cannot create Relationship - relating DataObject not found: ${relationshipParams.relatingObjectId}`
      });
    }
    const relatedObject = this.data.objects[relationshipParams.relatedObjectId];
    if (!relatedObject) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[DataModel.createRelationship] Cannot create Relationship - related DataObject not found: ${relationshipParams.relatedObjectId}`
      });
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
    this.data.events.onRelationshipCreated.dispatch(this.data, relation);
    return {
      ok: true,
      value: relation
    };
  }

  /**
   * Adds components from the specified `DataModelParams` to the `DataModel`.
   *

   * @param dataModelParams - Parameters to configure and populate the `DataModel`.
   * @returns A result indicating success or an error message on failure.
   */
  fromParams(dataModelParams: DataModelContentParams): SDKResult<any> {
    if (this.destroyed) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DataModel.fromParams] Cannot add components to DataModel - DataModel already destroyed"
      });
    }
    if (dataModelParams.propertySets) {
      for (let i = 0, len = dataModelParams.propertySets.length; i < len; i++) {
        const result = this.createPropertySet(dataModelParams.propertySets[i]);
        if (result.ok!== true) {
          return this.data.logError({
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `[DataModel.fromParams] Failed to create PropertySet: ${result.error}`
          });
        }
      }
    }
    if (dataModelParams.objects) {
      for (let i = 0, len = dataModelParams.objects.length; i < len; i++) {
        const result = this.createObject(dataModelParams.objects[i]);
        if (result.ok!== true) {
          return this.data.logError({
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `[DataModel.fromParams] Failed to create DataObject: ${result.error}`
          });
        }
      }
    }
    if (dataModelParams.relationships) {
      for (let i = 0, len = dataModelParams.relationships.length; i < len; i++) {
        const result = this.createRelationship(dataModelParams.relationships[i]);
        if (result.ok!== true) {
          return this.data.logError({
            ok: false,
          type: SDKErrorType.InvalidInput,
            error: `[DataModel.fromParams] Failed to create Relationship: ${result.error}`
          });
        }
      }
    }
    return {
      ok: true,
      value: undefined
    };
  }

  /**
   * Converts this `DataModel` to a `DataModelParams` object.
   *
   * @returns A result containing the `DataModelParams` on success, or an error message on failure.
   */
  toParams(): SDKResult<DataModelParams> {
    if (this.destroyed) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DataModel.toParams] DataModel already destroyed"
      });
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
    return {
      ok: true,
      value: dataModelParams
    };
  }

  /**
   * Destroys this `DataModel` and all its components.
   *
   * Fires the {@link DataEvents.onDataObjectDestroyed | DataEvents.onObjectDestroyed} event.
   *
   * @returns A result indicating success or an error message on failure.
   */
  destroy(): SDKResult<void> {
    if (this.destroyed) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DataModel.destroy] Cannot destroy DataModel - DataModel already destroyed"
      });
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
          this.data.events.onDataObjectDestroyed.dispatch(this.data, dataObject);
          for (const type in dataObject.relating) {
            const relations = dataObject.relating[type];
            for (let i = 0, len = relations.length; i < len; i++) {
              const relation = relations[i];
              const related = relation.relatedObject;
              const list = related.relating[type];
              for (let j = 0, k = 0, lenj = list.length; j < lenj; j++) {
                if (list[k].relatingObject === dataObject) {
                  list.splice(j, 1);
                  break;
                }
              }
            }
          }
        }
      }
    }
    this.destroyed = true;
    this.data._destroyModel(this);
    return {
      ok: true,
      value: undefined
    };
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

