import {SDKErrorType, type SDKResult} from "../../base/core";
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
 * For detailed usage, refer to {@link data | @xeokit/sdk/model/data}.
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
   * The data format / schema this DataModel conforms to (e.g.
   * `"IFC4"`, `"AP214"`, `"MyApp/v1"`).
   *
   * Set once at construction time via {@link DataModelParams.schema}
   * and **immutable thereafter**. Whether schema homogeneity is enforced
   * depends on this value:
   *
   * - **Defined** — the DataModel runs in *enforced* mode. Every
   *   {@link DataObject}, {@link PropertySet}, and {@link Relationship}
   *   added must either match this value or omit its own `schema` field
   *   (in which case it inherits this one).
   *   {@link DataModel.createObject}, {@link DataModel.createPropertySet}
   *   and {@link DataModel.createRelationship} reject components with a
   *   mismatching schema, including reused components that already belong
   *   to another DataModel with a different schema, and reject
   *   relationships whose endpoints carry a different schema.
   *
   * - **Undefined** — the DataModel runs in *free* mode. No schema
   *   checks are performed; components may carry any (or no) schema tag,
   *   freely mix, and freely interrelate. The caller's per-component
   *   `schema` value is preserved as-is.
   *
   * Set the schema when you care about homogeneity (e.g. a strict IFC4
   * model). Leave it undefined when you want a heterogeneous bag of
   * components — for example, federated data assembled from several
   * sources before classification.
   */
  public readonly schema?: string;

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
    this.schema = dataModelParams.schema;
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
   * See {@link data | @xeokit/sdk/model/data} for usage.
   *
   * @param propertySetCfg - Configuration parameters for the new `PropertySet`.
   * @returns A result containing the created `PropertySet` on success, or an error message on failure.
   */
  createPropertySet(propertySetCfg: PropertySetParams): SDKResult<PropertySet> {
    if (this.destroyed) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DataModel.createPropertySet] DataModel already destroyed"
      });
    }
    if (this.propertySets[propertySetCfg.id]) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[DataModel.createPropertySet] PropertySet with same ID already created in this DataModel. It's OK to have duplicates shared between DataModels, but they must be unique within each DataModel."
      });
    }
    if (this.schema !== undefined && propertySetCfg.schema !== undefined && propertySetCfg.schema !== this.schema) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[DataModel.createPropertySet] PropertySet schema "${propertySetCfg.schema}" does not match DataModel schema "${this.schema}" — a DataModel with a defined schema enforces single-schema homogeneity for all its components`
      });
    }
    let propertySet = this.data.propertySets[propertySetCfg.id];
    if (propertySet) {
      if (this.schema !== undefined && propertySet.schema !== this.schema) {
        return this.data.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[DataModel.createPropertySet] PropertySet "${propertySetCfg.id}" already exists with schema "${propertySet.schema}", which does not match this DataModel's schema "${this.schema}"`
        });
      }
      this.propertySets[propertySetCfg.id] = propertySet;
      propertySet.models.push(this);
      return {
        ok: true,
        value: propertySet
      };
    }
    const propertySetSchema = this.schema ?? propertySetCfg.schema;
    propertySet = new PropertySet(this, { ...propertySetCfg, schema: propertySetSchema });
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
   * See {@link data | @xeokit/sdk/model/data} for usage.
   *
   * @param dataObjectParams - Configuration parameters for the new `DataObject`.
   * @returns A result containing the created `DataObject` on success, or an error message on failure.
   */
  createObject(dataObjectParams: DataObjectParams): SDKResult<DataObject> {
    if (this.destroyed) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DataModel.createObject] DataModel already destroyed"
      });
    }

    const id = dataObjectParams.id;

    if (this.objects[id]) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[DataModel.createObject] DataObject with same ID already created in this DataModel. It's OK to have duplicates shared between DataModels, but they must be unique within each DataModel."
      });
    }

    if (this.schema !== undefined && dataObjectParams.schema !== undefined && dataObjectParams.schema !== this.schema) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[DataModel.createObject] DataObject schema "${dataObjectParams.schema}" does not match DataModel schema "${this.schema}" — a DataModel with a defined schema enforces single-schema homogeneity for all its components`
      });
    }

    const type = dataObjectParams.type;
    let dataObject = this.data.objects[id];

    if (dataObject && this.schema !== undefined && dataObject.schema !== this.schema) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[DataModel.createObject] DataObject "${id}" already exists with schema "${dataObject.schema}", which does not match this DataModel's schema "${this.schema}"`
      });
    }

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
              error: `[DataModel.createObject] PropertySet not found: "${propertySetId}"`
            });
          }

          propertySets.push(propertySet);
        }
      }

      const dataObjectSchema = this.schema ?? dataObjectParams.schema;
      dataObject = new DataObject(
        this.data,
        this,
        id,
        dataObjectParams.originalSystemId,
        dataObjectParams.name,
        dataObjectParams.description,
        dataObjectParams.type,
        dataObjectSchema,
        propertySets
      );

      this.data.objects[id] = dataObject;

      if (!this.data.objectsByType[type]) {
        this.data.objectsByType[type] = {};
      }
      this.data.objectsByType[type][id] = dataObject;

      this.data.typeCounts[type] = (this.data.typeCounts[type] === undefined) ? 1 : this.data.typeCounts[type] + 1;

      this.data.events.onDataObjectCreated.dispatch(this.data, dataObject);
    }

    this.objects[id] = dataObject;

    if (!this.objectsByType[type]) {
      this.objectsByType[type] = {};
    }
    this.objectsByType[type][id] = dataObject;

    this.typeCounts[type] = (this.typeCounts[type] === undefined) ? 1 : this.typeCounts[type] + 1;

    dataObject.models.push(this);

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
   * See {@link data | @xeokit/sdk/model/data} for usage
   *
   * @param relationshipParams - Configuration parameters for the new `Relationship`.
   * @returns A result containing the created `Relationship` on success, or an error message on failure.
   */
  createRelationship(relationshipParams: RelationshipParams): SDKResult<Relationship> {
    if (this.destroyed) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DataModel.createRelationship] DataModel already destroyed"
      });
    }
    const relatingObject = this.data.objects[relationshipParams.relatingObjectId];
    if (!relatingObject) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[DataModel.createRelationship] Relating DataObject not found: ${relationshipParams.relatingObjectId}`
      });
    }
    const relatedObject = this.data.objects[relationshipParams.relatedObjectId];
    if (!relatedObject) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[DataModel.createRelationship] Related DataObject not found: ${relationshipParams.relatedObjectId}`
      });
    }
    if (this.schema !== undefined) {
      if (relationshipParams.schema !== undefined && relationshipParams.schema !== this.schema) {
        return this.data.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[DataModel.createRelationship] Relationship schema "${relationshipParams.schema}" does not match DataModel schema "${this.schema}" — a DataModel with a defined schema enforces single-schema homogeneity for all its components`
        });
      }
      if (relatingObject.schema !== this.schema) {
        return this.data.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[DataModel.createRelationship] Relating DataObject "${relatingObject.id}" has schema "${relatingObject.schema}", which does not match this DataModel's schema "${this.schema}"`
        });
      }
      if (relatedObject.schema !== this.schema) {
        return this.data.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: `[DataModel.createRelationship] Related DataObject "${relatedObject.id}" has schema "${relatedObject.schema}", which does not match this DataModel's schema "${this.schema}"`
        });
      }
    }
    const relationshipSchema = this.schema ?? relationshipParams.schema ?? relatingObject.schema;
    const relation = new Relationship(relationshipParams.type, relationshipSchema, relatingObject, relatedObject);
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
   * Adds components from the specified `DataModelContentParams` to the `DataModel`.
   *
   * @param dataModelParams - Parameters to configure and populate the `DataModel`.
   * @returns A result indicating success or an error message on failure.
   */
  fromParams(dataModelParams: DataModelContentParams): SDKResult<any> {
    if (this.destroyed) {
      return this.data.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DataModel.fromParams] DataModel already destroyed"
      });
    }
    if (dataModelParams.propertySets) {
      for (let i = 0, len = dataModelParams.propertySets.length; i < len; i++) {
        const result = this.createPropertySet(dataModelParams.propertySets[i]);
        if (result.ok!== true) {
          return this.data.logError({
            ok: false,
            type: SDKErrorType.InvalidInput,
            error: `[DataModel.fromParams] Failed to create PropertySet -> ${result.error}`
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
            error: `[DataModel.fromParams] Failed to create DataObject -> ${result.error}`
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
            error: `[DataModel.fromParams] Failed to create Relationship -> ${result.error}`
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
    if (this.projectId           !== undefined) dataModelParams.projectId           = this.projectId;
    if (this.revisionId          !== undefined) dataModelParams.revisionId          = this.revisionId;
    if (this.author              !== undefined) dataModelParams.author              = this.author;
    if (this.createdAt           !== undefined) dataModelParams.createdAt           = this.createdAt;
    if (this.creatingApplication !== undefined) dataModelParams.creatingApplication = this.creatingApplication;
    if (this.schema              !== undefined) dataModelParams.schema              = this.schema;
    for (const id in this.propertySets) {
      const propertySet = this.propertySets[id];
      const propertySetParams = <PropertySetParams>{
        id,
        name: propertySet.name,
        properties: [],
        type: propertySet.type,
        schema: propertySet.schema,
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
        schema: dataObject.schema,
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
        schema: relationship.schema,
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
        error: "[DataModel.destroy] DataModel already destroyed"
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
         dataObject.models.splice(i, 1);
        break;
      }
    }
  }
}

