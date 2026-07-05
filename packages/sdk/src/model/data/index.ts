/**
 * <img style="padding:50px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_datamodel_icon.png"/>
 *
 * # xeokit Semantic Data Graph
 *
 * ---
 *
 * ***A buildable, queryable, importable, and exportable semantic graph for describing model meaning.***
 *
 * ---
 *
 * 📄 **[Cheatsheet — model/data at a glance](https://xeokit.github.io/sdk/docs/assets/cheatsheets/model_data.png)**
 *
 * ---
 *
 * ## Overview
 *
 * The `data` module represents semantic information (entities, properties, relationships) as a generic **entity-relationship graph**
 * that works in browsers and Node.js. It provides a structure-independent layer for managing model metadata and topology
 * alongside rendered content.
 *
 * **Core capabilities:**
 * - Build semantic graphs programmatically or import from structured formats
 * - Query and traverse hierarchies, classifications, and arbitrary relationships
 * - Serialize/deserialize semantic data independently of geometry
 * - Load data via format converters ({@link formats | @xeokit/sdk/formats})
 * - Keep semantic information synced with a {@link model!scene.SceneModel | SceneModel} in the viewer
 *
 * <br>
 *
 * ## Architecture
 *
 * ```mermaid
 * classDiagram
 * direction LR
 *    Data "1" *--> "*" DataModel
 *    Data:models
 *    Data:objects
 *    Data:propertySets
 *    Data:events
 *    Data:createModel()
 *    Data:destroy()
 *    DataModel "1" *--> "*" DataObject
 *    DataModel:schema
 *    DataModel:objects
 *    DataModel "1" *--> "*" PropertySet
 *    DataModel:propertySets
 *    DataModel "1" *--> "*" Property
 *    DataModel "1" *--> "*" Relationship
 *    DataModel:relationships
 *    DataModel:createObject()
 *    DataModel:createPropertySet()
 *    DataModel:createRelationship()
 *    DataModel:toParams()
 *    DataModel:fromParams()
 *    DataModel:destroy()
 *    DataObject:name
 *    DataObject:type
 *    DataObject:schema
 *    DataObject "1" o-- "*" PropertySet : has
 *    DataObject "1" <-- "*" Relationship : relating
 *    DataObject "1" <-- "*" Relationship : related
 *    DataObject:destroy()
 *    PropertySet "1" o-- "*" Property : has
 *    PropertySet:properties
 *    PropertySet:schema
 *    Relationship:relatingObject
 *    Relationship:relatedObject
 *    Relationship:type
 *    Relationship:schema
 *    Relationship:destroy()
 *    Property:name
 *    Property:value
 *    Property:type
 *    DataEvents <-- Data : emits
 *    DataEvents:onDataModelCreated
 *    DataEvents:onDataModelDestroyed
 *    DataEvents:onDataObjectCreated
 *    DataEvents:onDataObjectDestroyed
 *    DataEvents:onPropertySetCreated
 *    DataEvents:onPropertySetDestroyed
 *    DataEvents:onRelationshipCreated
 *    DataEvents:onRelationshipDestroyed
 *    DataEvents:onError
 *    DataEvents:onDataDestroyed
 * ```
 *
 * **Key components:**
 *
 * - {@link Data} — Root container that owns {@link DataModel | DataModels} and indexes all entities globally
 * - {@link model!data.DataModel | DataModel} — Schema container holding objects, relationships, and property sets
 * - {@link model!data.DataObject | DataObject} — Entity with identity, type, and attributes (e.g., a wall, a room, a component)
 * - {@link PropertySet} — Named collection of typed {@link Property | Properties} that describe an object
 * - {@link Relationship} — Typed connection between two objects (e.g., aggregation, composition, reference)
 * - {@link DataEvents} — Event emitter for lifecycle notifications
 *
 * <br>
 *
 * ## Design Principles
 *
 * 1. **Global indexing** — All {@link DataObject | DataObjects} and {@link PropertySet | PropertySets} are registered
 *    globally in {@link Data}, enabling O(1) lookups regardless of hierarchy structure.
 *
 * 2. **Model sharing** — Multiple {@link DataModel | DataModels} can reference the same entity if IDs match,
 *    allowing efficient multi-perspective representations.
 *
 * 3. **Relationship freedom** — {@link Relationship | Relationships} can connect objects across different models
 *    as long as they share the same parent {@link Data} instance.
 *
 * 4. **Opt-in schema enforcement** — {@link DataModel.schema} is fixed at construction
 *    time and immutable thereafter. When set, the DataModel enforces single-schema
 *    homogeneity across every {@link DataObject}, {@link PropertySet}, and
 *    {@link Relationship} it owns. When left undefined, no schema checks run and the
 *    DataModel may freely mix and interrelate components of different schemas.
 *    See [Schemas](#schemas) below.
 *
 * 5. **Result-based error handling** — All operations return {@link base!core.SDKResult | SDKResult<T>} for
 *    functional error handling without exceptions.
 *
 * <br>
 *
 * ## Schemas
 *
 * Each {@link DataModel} optionally declares a **schema** (e.g. `"IFC4"`,
 * `"AP214"`, `"MyApp/v1"`) at construction. The schema is set once via
 * {@link DataModelParams.schema} and is **readonly**. Its presence (or
 * absence) selects one of two behaviour modes:
 *
 * ### Enforced mode — `schema` is defined
 *
 * When the DataModel has a defined schema, it enforces single-schema homogeneity
 * across everything it owns. Every {@link DataObject}, {@link PropertySet}, and
 * {@link Relationship} added afterwards must either match this value or omit
 * its own `schema` field (in which case it inherits the DataModel's). The three
 * `create*` calls reject:
 *
 * - components whose `schema` field is set to a different value;
 * - reused components (DataObjects or PropertySets that already exist in
 *   another DataModel) whose schema differs;
 * - relationships whose relating or related DataObject carries a different
 *   schema — cross-schema links are not allowed in this mode.
 *
 * Use this mode when you care about schema homogeneity within the DataModel
 * (e.g. a strict IFC4 model, or a model that downstream tooling validates
 * against a specific schema id).
 *
 * ### Free mode — `schema` is undefined
 *
 * When the DataModel's schema is left undefined (the default), the DataModel
 * runs in *free mode* and **performs no schema checks**. Components may carry
 * any (or no) schema tag, freely mix, and freely interrelate:
 *
 * - components keep whatever `schema` value the caller provided — nothing is
 *   coerced, nothing is rejected;
 * - DataObjects and PropertySets from other DataModels with different schemas
 *   can be reused here without complaint;
 * - {@link Relationship | Relationships} can connect DataObjects of different
 *   schemas.
 *
 * Use this mode when you want a heterogeneous bag of components — for example,
 * federated data assembled from several sources before classification, or
 * scratch models used as staging.
 *
 * ### Examples
 *
 * Enforced mode:
 *
 * ````ts
 * const data = new Data();
 *
 * const modelRes = data.createModel({ id: "tower", schema: "IFC4" });
 * if (!modelRes.ok) throw new Error(modelRes.error);
 * const model = modelRes.value;
 *
 * // OK — no schema given, inherits "IFC4".
 * model.createObject({ id: "wall-1", type: "Wall", name: "Exterior" });
 *
 * // OK — explicit schema matches.
 * model.createObject({ id: "wall-2", type: "Wall", name: "Interior", schema: "IFC4" });
 *
 * // Rejected — explicit schema does not match the DataModel's schema.
 * const bad = model.createObject({
 *   id:    "wall-3",
 *   type:  "Wall",
 *   name:  "Mystery",
 *   schema:"IFC2X3"
 * });
 * // bad.ok === false
 * // bad.error → "DataObject schema \"IFC2X3\" does not match DataModel schema \"IFC4\" — ..."
 * ````
 *
 * Free mode:
 *
 * ````ts
 * const data = new Data();
 *
 * // No `schema` field — DataModel runs in free mode.
 * const modelRes = data.createModel({ id: "scratch" });
 * if (!modelRes.ok) throw new Error(modelRes.error);
 * const model = modelRes.value;
 *
 * // All accepted — schemas may freely mix.
 * model.createObject({ id: "a", type: "Wall", name: "IFC wall", schema: "IFC4" });
 * model.createObject({ id: "b", type: "Pipe", name: "AP214 pipe", schema: "AP214" });
 * model.createObject({ id: "c", type: "Note", name: "Untagged" });
 *
 * // Cross-schema relationships are fine in free mode.
 * model.createRelationship({
 *   type: "annotates",
 *   relatingObjectId: "c",
 *   relatedObjectId:  "a"
 * });
 * ````
 *
 * <br>
 *
 * ## Quick Start
 *
 * ### Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ### Creating a DataModel
 *
 * Build a simple semantic model with objects, properties, and relationships:
 *
 * ````ts
 * import { Data, type DataModel } from "@xeokit/sdk/model/data";
 *
 * const data = new Data();
 *
 * const result = data.createModel({
 *   id: "table-model",
 *   schema: "MyApp/v1",
 *   objects: [
 *     { id: "table", type: "Furniture", name: "Dining Table", propertySetIds: ["dims"] },
 *     { id: "leg-1", type: "Component", name: "Front Left Leg", propertySetIds: ["dims"] },
 *     { id: "leg-2", type: "Component", name: "Front Right Leg", propertySetIds: ["dims"] },
 *   ],
 *   relationships: [
 *     { type: "supports", relatingObjectId: "table", relatedObjectId: "leg-1" },
 *     { type: "supports", relatingObjectId: "table", relatedObjectId: "leg-2" },
 *   ],
 *   propertySets: [
 *     {
 *       id: "dims",
 *       name: "Dimensions",
 *       type: "Physical",
 *       properties: [
 *         { name: "Height", value: 0.75, valueType: "number", description: "In meters" },
 *         { name: "Material", value: "Wood", valueType: "string" },
 *       ],
 *     },
 *   ],
 * });
 *
 * if (!result.ok) {
 *   console.error(result.error);
 * } else {
 *   console.log("Model created:", result.value.id);
 * }
 * ````
 *
 * <br>
 *
 * ## Usage Patterns
 *
 * ### Building a Model Incrementally
 *
 * Use builder methods for step-by-step construction:
 *
 * ````ts
 * const modelRes = data.createModel({ id: "my-model", schema: "MyApp/v1" });
 * if (!modelRes.ok) throw new Error(modelRes.error);
 *
 * const model = modelRes.value;
 * // model.schema === "MyApp/v1" and is now readonly.
 *
 * // Create a property set
 * const propsRes = model.createPropertySet({
 *   id: "material-props",
 *   name: "Material",
 *   type: "Physical",
 *   properties: [
 *     { name: "Color", value: "Red", description: "Primary color" },
 *   ],
 * });
 *
 * // Create objects
 * const objRes = model.createObject({
 *   id: "wall-1",
 *   type: "Wall",
 *   name: "Exterior Wall",
 *   propertySetIds: ["material-props"],
 * });
 *
 * // Create a relationship
 * const relRes = model.createRelationship({
 *   type: "contains",
 *   relatingObjectId: "building",
 *   relatedObjectId: "wall-1",
 * });
 * ````
 *
 * ### Traversing the Graph
 *
 * Access objects and follow relationships directly:
 *
 * ````ts
 * // Get an object by ID
 * const table = data.objects["table"];
 *
 * // Get all "supports" relationships where table is the source
 * const supportsRels = table.related["supports"] || [];
 *
 * for (const rel of supportsRels) {
 *   const leg = rel.relatedObject;
 *   console.log(`Table supports leg: ${leg.name}`);
 * }
 *
 * // Get incoming relationships (what relates to this leg)
 * const relatingRels = leg.relating["supports"] || [];
 * ````
 *
 * ### Querying Objects
 *
 * Use {@link searchObjects} to traverse and filter hierarchies:
 *
 * ````ts
 * const resultIds: string[] = [];
 *
 * searchObjects(data, {
 *   startObjectId: "table",
 *   includeObjects: ["Component"],
 *   includeRelated: ["supports"],
 *   resultObjectIds: resultIds,
 * });
 *
 * console.log("Found components:", resultIds);
 * ````
 *
 * ### Serializing a Model
 *
 * Export model structure to JSON:
 *
 * ````ts
 * const params = model.toParams();
 * const jsonStr = JSON.stringify(params);
 * ````
 *
 * Import from JSON:
 *
 * ````ts
 * const modelRes = data.createModel({ id: "restored" });
 * if (modelRes.ok) {
 *   modelRes.value.fromParams(params);
 * }
 * ````
 *
 * ### Loading from Files
 *
 * Use format-specific loaders to populate data from standard formats:
 *
 * ````ts
 * import { dotBIMLoader } from "@xeokit/sdk/formats";
 *
 * const dataRes = data.createModel({ id: "loaded" });
 * if (!dataRes.ok) throw new Error(dataRes.error);
 *
 * const fileData = await fetch("model.json").then(r => r.json());
 * await dotBIMLoader.load({
 *   fileData,
 *   dataModel: dataRes.value,
 * });
 * ````
 *
 * ### Listening to Events
 *
 * React to model lifecycle changes:
 *
 * ````ts
 * data.events.onModelCreated.subscribe((data, model) => {
 *   console.log(`Model created: ${model.id}`);
 * });
 *
 * data.events.onObjectCreated.subscribe((data, obj) => {
 *   console.log(`Object created: ${obj.name}`);
 * });
 *
 * data.events.onError.subscribe((data, error) => {
 *   console.error("Data error:", error);
 * });
 * ````
 *
 * <br>
 *
 * ## Managing Lifecycle
 *
 * Clean up resources explicitly:
 *
 * ````ts
 * // Destroy a single model
 * model.destroy();
 *
 * // Destroy all models and data
 * data.destroy();
 * ````
 *
 * @module data
 */

export * from "./Data";
export * from "./DataEvents";
export * from "./DataModel";
export * from "./DataObject";
export * from "./Relationship";
export * from "./RelationshipParams";
export * from "./Property";
export * from "./PropertySet";
export * from "./DataModelParams";
export * from "./DataModelContentParams";
export * from "./DataObjectParams";
export * from "./PropertyParams";
export * from "./PropertySetParams";
export * from "./SearchParams";
export * from "./searchObjects";
export * from "./DataModelStats";
