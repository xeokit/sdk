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
 * # Overview
 *
 * The xeokit SDK represents “meaning” (entities, properties, and relationships) as a generic **entity-relationship graph**
 * that works in both browsers and Node.js. Use this module to:
 *
 * - build semantic graphs programmatically,
 * - load and export semantic data via {@link formats | @xeokit/sdk/formats},
 * - query and traverse semantic structures (eg. hierarchies and classifications), and
 * - keep semantic information alongside renderable content (eg. a {@link scene!SceneModel | SceneModel} shown in the Viewer).
 *
 * The class diagram below summarizes the main classes in this module and their relationships:
 *
 * <br>
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
 * At the top level is {@link Data}, which owns one or more {@link DataModel | DataModels}. Each {@link DataModel} contains:
 *
 * - {@link DataObject | DataObjects} (entities),
 * - {@link PropertySet | PropertySets} (grouped attributes), and
 * - {@link Relationship | Relationships} (typed edges between objects).
 *
 * To construct DataModels in code, use builder methods such as {@link Data.createModel}, {@link DataModel.createObject},
 * {@link DataModel.createPropertySet}, and {@link DataModel.createRelationship}. To traverse/query the graph, use
 * {@link searchObjects} and the relationship links on {@link DataObject}.
 *
 * <br>
 *
 * ### Notes
 *
 * * {@link DataObject | DataObjects} and {@link PropertySet | PropertySets} are created via a {@link DataModel}, but are indexed globally on {@link Data} for fast lookup.
 * * {@link DataModel | DataModels} may reuse existing {@link DataObject | DataObjects} and {@link PropertySet | PropertySets} when those IDs already exist in the owning {@link Data}.
 * * {@link Relationship | Relationships} may connect DataObjects across different DataModels, as long as they share the same owning {@link Data}.
 *
 * <br>
 *
 * # Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * <br>
 *
 * # Usage
 *
 * <br>
 *
 * ## Creating a DataModel from JSON
 *
 * This example creates a {@link DataModel} from a {@link DataModelParams} object that describes a simple table:
 * a tabletop and four legs. After building the model, you can traverse it to collect the IDs of contained
 * {@link DataObject | DataObjects}.
 *
 * The DataModel defines:
 *
 * * six DataObjects (table, tabletop, four legs),
 * * aggregation Relationships that connect them into a hierarchy, and
 * * PropertySets with Properties that describe attributes such as height and weight.
 *
 * All methods in this example return {@link core!SDKResult | SDKResult} values, which should be checked for errors.
 *
 * ````ts
 * import type { SDKResult } from "@xeokit/sdk/core";
 * import { Data, type DataModel } from "@xeokit/sdk/data";
 *
 * const data = new Data();
 *
 * const result: SDKResult<DataModel> = data.createModel({
 *   id: "myTableModel",
 *   objects: [
 *     { id: "table",    type: "BasicEntity", name: "Table",           propertySetIds: ["tablePropertySet"] },
 *     { id: "tableTop", type: "BasicEntity", name: "Purple tabletop", propertySetIds: ["tableTopPropertySet"] },
 *     { id: "redLeg",   type: "BasicEntity", name: "Red leg",         propertySetIds: ["legPropertySet"] },
 *     { id: "greenLeg", type: "BasicEntity", name: "Green leg",       propertySetIds: ["legPropertySet"] },
 *     { id: "blueLeg",  type: "BasicEntity", name: "Blue leg",        propertySetIds: ["legPropertySet"] },
 *     { id: "yellowLeg",type: "BasicEntity", name: "Yellow leg",      propertySetIds: ["legPropertySet"] },
 *   ],
 *   relationships: [
 *     { type: "BasicAggregation", relatingObjectId: "table",    relatedObjectId: "tableTop" },
 *     { type: "BasicAggregation", relatingObjectId: "tableTop", relatedObjectId: "redLeg" },
 *     { type: "BasicAggregation", relatingObjectId: "tableTop", relatedObjectId: "greenLeg" },
 *     { type: "BasicAggregation", relatingObjectId: "tableTop", relatedObjectId: "blueLeg" },
 *     { type: "BasicAggregation", relatingObjectId: "tableTop", relatedObjectId: "yellowLeg" },
 *   ],
 *   propertySets: [
 *     {
 *       id: "tablePropertySet",
 *       originalSystemId: "tablePropertySet",
 *       name: "Table properties",
 *       type: "",
 *       properties: [
 *         { name: "Weight", value: 5,  type: "", valueType: "", description: "Weight" },
 *         { name: "Height", value: 12, type: "", valueType: "", description: "Height" },
 *       ],
 *     },
 *     {
 *       id: "tableTopPropertySet",
 *       originalSystemId: "tableTopPropertySet",
 *       name: "Tabletop properties",
 *       type: "",
 *       properties: [
 *         { name: "Weight", value: 2,  type: "", valueType: "", description: "Weight" },
 *         { name: "Thickness", value: 0.5, type: "", valueType: "", description: "Thickness" },
 *       ],
 *     },
 *     {
 *       id: "legPropertySet",
 *       originalSystemId: "legPropertySet",
 *       name: "Leg properties",
 *       type: "",
 *       properties: [
 *         { name: "Weight", value: 1,  type: "", valueType: "", description: "Weight" },
 *         { name: "Height", value: 12, type: "", valueType: "", description: "Height" },
 *       ],
 *     },
 *   ],
 * });
 *
 * if (!result.ok) {
 *   console.error(result.error);
 * } else {
 *   console.log("DataModel created:", result.value.id);
 * }
 * ````
 *
 * <br>
 *
 * ## Creating a DataModel using Builder Methods
 *
 * This example recreates the same model, but constructs each {@link PropertySet}, {@link DataObject}, and
 * {@link Relationship} individually using {@link DataModel} builder methods.
 *
 *
 * ````ts
 * import { SDKResult } from "@xeokit/sdk/core";
 * import { Data, searchObjects } from "@xeokit/sdk/data";
 *
 * const data = new Data();
 *
 * const modelRes: SDKResult<DataModel> = data.createModel({
 *   id: "myTableModel",
 * });
 *
 * if (!modelRes.ok) {
 *   console.error(modelRes.error);
 * } else {
 *   const dataModel = modelRes.value;
 *
 *   const tablePSRes: SDKResult<PropertySet> = dataModel.createPropertySet({
 *     id: "tablePropertySet",
 *     name: "Table properties",
 *     type: "",
 *     properties: [
 *       { name: "Weight", value: 5, type: "", valueType: "", description: "Weight of the thing" },
 *       { name: "Height", value: 12, type: "", valueType: "", description: "Height of the thing" },
 *     ],
 *   });
 *   if (!tablePSRes.ok) console.error(tablePSRes.error);
 *
 *   const legPSRes: SDKResult<PropertySet> = dataModel.createPropertySet({
 *     id: "legPropertySet",
 *     name: "Table leg properties",
 *     type: "",
 *     properties: [
 *       { name: "Weight", value: 5, type: "", valueType: "", description: "Weight of the thing" },
 *       { name: "Height", value: 12, type: "", valueType: "", description: "Height of the thing" },
 *     ],
 *   });
 *   if (!legPSRes.ok) console.error(legPSRes.error);
 *
 *   const tableTopPSRes: SDKResult<PropertySet> = dataModel.createPropertySet({
 *     id: "tableTopPropertySet",
 *     name: "Table top properties",
 *     type: "",
 *     properties: [
 *       { name: "Weight", value: 5, type: "", valueType: "", description: "Weight of the thing" },
 *       { name: "Thickness", value: 1, type: "", valueType: "", description: "Thickness of the thing" },
 *     ],
 *   });
 *   if (!tableTopPSRes.ok) console.error(tableTopPSRes.error);
 *
 *   const tableRes: SDKResult<DataObject> = dataModel.createObject({
 *     id: "table",
 *     type: "BasicEntity"",
 *     name: "Table",
 *     propertySetIds: ["tablePropertySet"],
 *   });
 *   if (!tableRes.ok) console.error(tableRes.error);
 *
 *   const redLegRes = dataModel.createObject({
 *     id: "redLeg",
 *     name: "Red table leg",
 *     type: "BasicEntity",
 *     propertySetIds: ["legPropertySet"],
 *   });
 *   if (!redLegRes.ok) console.error(redLegRes.error);
 *
 *   const greenLegRes = dataModel.createObject({
 *     id: "greenLeg",
 *     name: "Green table leg",
 *     type: "BasicEntity",
 *     propertySetIds: ["legPropertySet"],
 *   });
 *   if (!greenLegRes.ok) console.error(greenLegRes.error);
 *
 *   const blueLegRes = dataModel.createObject({
 *     id: "blueLeg",
 *     name: "Blue table leg",
 *     type: "BasicEntity",
 *     propertySetIds: ["legPropertySet"],
 *   });
 *   if (!blueLegRes.ok) console.error(blueLegRes.error);
 *
 *   const yellowLegRes = dataModel.createObject({
 *     id: "yellowLeg",
 *     name: "Yellow table leg",
 *     type: "BasicEntity",
 *     propertySetIds: ["legPropertySet"],
 *   });
 *   if (!yellowLegRes.ok) console.error(yellowLegRes.error);
 *
 *   const tableTopRes = dataModel.createObject({
 *     id: "tableTop",
 *     name: "Purple table top",
 *     type: "BasicEntity",
 *     propertySetIds: ["tableTopPropertySet"],
 *   });
 *   if (!tableTopRes.ok) console.error(tableTopRes.error);
 *
 *   const rel1Res: SDKResult<Relationship> = dataModel.createRelationship({
 *     type: "BasicAggregation",
 *     relatingObjectId: "table",
 *     relatedObjectId: "tableTop",
 *   });
 *   if (!rel1Res.ok) console.error(rel1Res.error);
 *
 *   const rel2Res = dataModel.createRelationship({
 *     type: "BasicAggregation",
 *     relatingObjectId: "tableTop",
 *     relatedObjectId: "redLeg",
 *   });
 *   if (!rel2Res.ok) console.error(rel2Res.error);
 *
 *   const rel3Res = dataModel.createRelationship({
 *     type: "BasicAggregation",
 *     relatingObjectId: "tableTop",
 *     relatedObjectId: "greenLeg",
 *   });
 *   if (!rel3Res.ok) console.error(rel3Res.error);
 *
 *   const rel4Res = dataModel.createRelationship({
 *     type: "BasicAggregation",
 *     relatingObjectId: "tableTop",
 *     relatedObjectId: "blueLeg",
 *   });
 *   if (!rel4Res.ok) console.error(rel4Res.error);
 *
 *   const rel5Res = dataModel.createRelationship({
 *     type: "BasicAggregation",
 *     relatingObjectId: "tableTop",
 *     relatedObjectId: "yellowLeg",
 *   });
 *   if (!rel5Res.ok) console.error(rel5Res.error);
 * }
 * ````
 *
 * <br>
 *
 * ## Reading DataObjects
 *
 * With a {@link DataModel} built, {@link searchObjects} can traverse the graph and collect IDs of visited
 * {@link DataObject | DataObjects}. A common use case is building a tree view by following aggregation relationships.
 *
 * ````ts
 * const resultObjectIds: string[] = [];
 *
 * searchObjects(data, {
 *   startObjectId: "table",
 *   includeObjects: ["BasicEntity"],
 *   includeRelated: ["BasicAggregation"],
 *   resultObjectIds,
 * });
 *
 * // resultObjectIds == ["table", "tableTop", "redLeg", "greenLeg", "blueLeg", "yellowLeg"];
 * ````
 *
 * <br>
 *
 * ## Traversing Relationships Directly
 *
 * This example follows outgoing {@link Relationship | Relationships} from a root {@link DataObject}:
 *
 * ````ts
 * const table = data.objects["table"];
 * const relations = table.related["BasicAggregation"] || [];
 *
 * for (let i = 0, len = relations.length; i < len; i++) {
 *   const relation = relations[i];
 *   const child = relation.related;
 *   // ...
 * }
 * ````
 *
 * <br>
 *
 * ## Serializing a DataModel to JSON
 *
 * ````ts
 * const dataModelParams = dataModel.toParams();
 * ````
 *
 * <br>
 *
 * ## Deserializing a DataModel from JSON
 *
 * ````ts
 * const dataModel2Res = data.createModel({ id: "myDataModel2" });
 * if (dataModel2Res.ok) {
 *   dataModel2Res.value.fromParams(dataModelParams);
 * } else {
 *   console.error(dataModel2Res.error);
 * }
 * ````
 *
 * <br>
 *
 * ## Destroying a DataModel
 *
 * ````ts
 * dataModel2.destroy();
 * ````
 *
 * <br>
 *
 * ## Loading a DataModel from a File
 *
 * DataModels can be loaded from supported file formats via loaders in {@link formats | @xeokit/sdk/formats}.
 * For example, a DotBIM loader can populate both a {@link scene!SceneModel | SceneModel} (geometry) and a {@link DataModel}
 * (semantics) from the same source data:
 *
 * ````ts
 * // Pseudocode (loader API depends on the format module you use)
 * const sceneModelRes = scene.createModel({ id: "myModel3" });
 * const dataModelRes  = data.createModel({ id: "myModel3" });
 *
 * if (!sceneModelRes.ok) throw new Error(sceneModelRes.error);
 * if (!dataModelRes.ok)  throw new Error(dataModelRes.error);
 *
 * const sceneModel3 = sceneModelRes.value;
 * const dataModel3  = dataModelRes.value;
 *
 * fetch("model.json")
 *   .then(r => r.json())
 *   .then(fileData => {
 *     // eg: return dotBIMLoader.load({ fileData, sceneModel: sceneModel3, dataModel: dataModel3 });
 *   })
 *   .catch(err => {
 *     sceneModel3.destroy();
 *     dataModel3.destroy();
 *     console.error(err);
 *   });
 * ````
 *
 * <br>
 *
 * ## Handling Events
 *
 * All events for a {@link Data} are emitted through {@link DataEvents} at {@link Data.events}. For example, you can listen
 * for model creation and destruction:
 *
 * ````ts
 * data.events.onModelCreated.subscribe((data, dataModel) => {
 *   console.log(`New DataModel created with ID: ${dataModel.id}`);
 * });
 *
 * data.events.onModelDestroyed.subscribe((data, dataModel) => {
 *   console.log(`DataModel destroyed with ID: ${dataModel.id}`);
 * });
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
