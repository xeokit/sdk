/**
 * <img style="padding:50px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_datamodel_icon.png"/>
 *
 * # Semantic Data Graph
 *
 * 📄 **[Cheatsheet — model/data at a glance](https://xeokit.github.io/sdk/docs/assets/cheatsheets/model_data.png)**
 *
 * The `data` module stores semantic model data separately from scene geometry.
 * It contains objects, property sets and typed relationships, grouped into one
 * or more {@link DataModel | DataModels}. A DataModel will often share its id
 * with a {@link model!scene.SceneModel | SceneModel}, but the two structures are
 * independent.
 *
 * Use it for non-geometric model data: object names and types, classification
 * links, decomposition trees, property sets, and similar metadata.
 *
 * ## Structure
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
 * ```
 *
 * Main types:
 *
 * - {@link Data} — root container and global index.
 * - {@link DataModel} — owns objects, property sets and relationships.
 * - {@link DataObject} — semantic object with an id, type, name and optional property sets.
 * - {@link PropertySet} — named collection of {@link Property | Properties}.
 * - {@link Relationship} — typed directed link between two objects.
 * - {@link DataEvents} — lifecycle and error events.
 *
 * ## Schemas
 *
 * A {@link DataModel} can declare a schema with {@link DataModelParams.schema}.
 * The schema is set when the model is created and is then read-only.
 *
 * When `schema` is defined, objects, property sets and relationships added to
 * the model must either use the same schema or omit their schema. Omitted
 * schemas inherit the model schema. Creation fails when a component has a
 * different explicit schema, or when a relationship links objects with schemas
 * that differ from the model schema.
 *
 * When `schema` is undefined, no schema checks are performed.
 *
 * ```ts
 * const data = new Data();
 *
 * const modelRes = data.createModel({ id: "tower", schema: "IFC4" });
 * if (!modelRes.ok) throw new Error(modelRes.error);
 * const model = modelRes.value;
 *
 * model.createObject({ id: "wall-1", type: "IfcWall" }); // schema is "IFC4"
 * model.createObject({ id: "wall-2", type: "IfcWall", schema: "IFC4" });
 *
 * const bad = model.createObject({
 *   id: "wall-3",
 *   type: "IfcWall",
 *   schema: "IFC2X3",
 * });
 * // bad.ok === false
 * ```
 *
 * ## Creating a DataModel
 *
 * Create a model from params:
 *
 * ```ts
 * import { Data } from "@xeokit/sdk/model/data";
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
 *   throw new Error(result.error);
 * }
 * ```
 *
 * Or build it incrementally:
 *
 * ```ts
 * const modelRes = data.createModel({ id: "my-model", schema: "MyApp/v1" });
 * if (!modelRes.ok) throw new Error(modelRes.error);
 *
 * const model = modelRes.value;
 *
 * model.createPropertySet({
 *   id: "material-props",
 *   name: "Material",
 *   type: "Physical",
 *   properties: [
 *     { name: "Color", value: "Red", description: "Primary color" },
 *   ],
 * });
 *
 * model.createObject({
 *   id: "wall-1",
 *   type: "Wall",
 *   name: "Exterior Wall",
 *   propertySetIds: ["material-props"],
 * });
 *
 * model.createRelationship({
 *   type: "contains",
 *   relatingObjectId: "building",
 *   relatedObjectId: "wall-1",
 * });
 * ```
 *
 * ## Traversal and Queries
 *
 * Objects and property sets are indexed on {@link Data}. Relationships are also
 * stored on the objects they connect.
 *
 * ```ts
 * const table = data.objects["table"];
 * const supportsRels = table.related["supports"] || [];
 *
 * for (const rel of supportsRels) {
 *   const leg = rel.relatedObject;
 *   console.log(`Table supports leg: ${leg.name}`);
 * }
 * ```
 *
 * Use {@link searchObjects} for traversal with type and relationship filters:
 *
 * ```ts
 * const resultIds: string[] = [];
 *
 * searchObjects(data, {
 *   startObjectId: "table",
 *   includeObjects: ["Component"],
 *   includeRelated: ["supports"],
 *   resultObjectIds: resultIds,
 * });
 * ```
 *
 * ## Serialization
 *
 * ```ts
 * const params = model.toParams();
 * const jsonStr = JSON.stringify(params);
 *
 * const restoredRes = data.createModel({ id: "restored" });
 * if (restoredRes.ok) {
 *   restoredRes.value.fromParams(params);
 * }
 * ```
 *
 * Format loaders can also populate a DataModel:
 *
 * ```ts
 * import { DotBIMLoader } from "@xeokit/sdk/formats/dotbim";
 *
 * const dataModelRes = data.createModel({ id: "loaded" });
 * if (!dataModelRes.ok) throw new Error(dataModelRes.error);
 *
 * const fileData = await fetch("model.json").then(r => r.json());
 * await new DotBIMLoader().load({
 *   fileData,
 *   dataModel: dataModelRes.value,
 * });
 * ```
 *
 * ## Events
 *
 * ```ts
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
 * ```
 *
 * ## Lifecycle
 *
 * ```ts
 * model.destroy();
 * data.destroy();
 * ```
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
