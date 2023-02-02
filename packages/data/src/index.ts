/**
 * ## Entity-Relationship Data Model
 *
 * * {@link DataModel}
 * * Can be used with a {@link Viewer} to classify models
 * * A single graph into which we can merge multiple ER data models - objects, properties and relationships
 * * Builder API to programmatically create data models in the graph
 * * Load and destroy data models at any time
 * * Find data objects with traversals
 * * Extensible entity and relationship types
 * * Supports IFC schema
 *
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/data
 * ````
 *
 *
 * ## Usage
 *
 * See {@link Data} for more info.
 *
 * ````javascript
 * import {Data} from "@xeokit/data";
 *
 * const myData = new Data({
 * });
 *
 * const mySchema = {
 *     FURNITURE_TYPE: 0,
 *     AGGREGATES_REL: 1
 * };
 *
 * const myDataModel = myData.createModel({
 *
 *     id: "myTableModel",
 *
 *     objects: [
 *         {
 *             id: "table",
 *             type: mySchema.FURNITURE_TYPE,
 *             name: "Table",
 *             propertySetIds: ["tablePropertySet"]
 *         },
 *         {
 *             id: "redLeg",
 *             name: "Red table Leg",
 *             type: mySchema.FURNITURE_TYPE,
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "greenLeg",
 *             name: "Green table leg",
 *             type: mySchema.FURNITURE_TYPE,
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "blueLeg",
 *             name: "Blue table leg",
 *             type: mySchema.FURNITURE_TYPE,
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "yellowLeg",
 *             name: "Yellow table leg",
 *             type: mySchema.FURNITURE_TYPE,
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "tableTop",
 *             name: "Purple table top",
 *             type: mySchema.FURNITURE_TYPE,
 *             propertySetIds: ["tableTopPropertySet"]
 *         }
 *     ],
 *
 *     relationships: [
 *         {
 *             type: mySchema.AGGREGATES_REL,
 *             relating: "table",
 *             related: "tableTop"
 *         },
 *         {
 *             type: mySchema.AGGREGATES_REL,
 *             relating: "tableTop",
 *             related: "redLeg"
 *         },
 *         {
 *             type: mySchema.AGGREGATES_REL,
 *             relating: "tableTop",
 *             related: "greenLeg"
 *         },
 *         {
 *             type: mySchema.AGGREGATES_REL,
 *             relating: "tableTop",
 *             related: "blueLeg"
 *         },
 *         {
 *             type: mySchema.AGGREGATES_REL,
 *             relating: "tableTop",
 *             related: "yellowLeg"
 *         }
 *     ],
 *
 *     propertySets: [
 *         {
 *             id: "tablePropertySet",
 *             originalSystemId: "tablePropertySet",
 *             name: "Table properties",
 *             type: "",
 *             properties: [
 *                 {
 *                     name: "Weight",
 *                     value: 5,
 *                     type: "",
 *                     valueType: "",
 *                     description: "Weight of the thing"
 *                 },
 *                 {
 *                     name: "Height",
 *                     value: 12,
 *                     type: "",
 *                     valueType: "",
 *                     description: "Height of the thing"
 *                 }
 *             ]
 *         },
 *         {
 *             id: "legPropertySet",
 *             originalSystemId: "legPropertySet",
 *             name: "Table leg properties",
 *             type: "",
 *             properties: [
 *                 {
 *                     name: "Weight",
 *                     value: 5,
 *                     type: "",
 *                     valueType: "",
 *                     description: "Weight of the thing"
 *                 },
 *                 {
 *                     name: "Height",
 *                     value: 12,
 *                     type: "",
 *                     valueType: "",
 *                     description: "Height of the thing"
 *                 }
 *             ]
 *         }
 *     ]
 * });
 *
 * myDataModel.build();
 *
 * const objectIds = [];
 *
 * myData.searchDataObjects({
 *     startObjectId: "table",
 *     includeObjects: [mySchema.FURNITURE_TYPE],
 *     includeRelated: [mySchema.AGGREGATES_REL],
 *     objectIds
 * });
 *
 * // objectIds == ["table", "tableTop", "redLeg", "greenLeg", "blueLeg", "yellowLeg"];
 * ````
 *
 * @module @xeokit/data
 */
export * from "./Data";
export * from "./DataModel";
export * from "./DataObject";
export * from "./Relationship";
export * from "./RelationshipParams";
export * from "./Property";
export * from "./PropertySet";
export * from "./DataModelParams";
export * from "./DataObjectParams";
export * from "./PropertyParams";
export * from "./PropertySetParams";
export * from "./SearchParams";