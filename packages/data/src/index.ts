/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdata.svg)](https://badge.fury.io/js/%40xeokit%2Fdata)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/data/badge)](https://www.jsdelivr.com/package/npm/@xeokit/data)
 *
 * <img style="padding:50px" src="media://images/xeokit_datamodel_icon.png"/>
 *
 * # Entity-Relationship Data Model
 *
 * * {@link @xeokit/data!Data | Data}, {@link @xeokit/data!DataModel | DataModel}
 * * Entity-relationship (ER) graph that can be used with a {@link @xeokit/viewer!Viewer} to classify models
 * * Extensible entity and relationship types - use with an external set of types (eg. {@link "@xeokit/datatypes/basicTypes" | basicTypes}, {@link "@xeokit/datatypes/ifcTypes" | ifcTypes})
 * * A single graph into which we can merge multiple ER data models - objects, properties and relationships
 * * Builder API to programmatically create data models
 * * Dynamically create and destroy data models
 * * Find data objects with traversals
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
 * Let's create a data model that describes the structure of a simple item of
 * furniture - a table, comprised of a tabletop with four legs attached. Then we'll query the data model to
 * find all the objects within it.
 *
 * To do this, we'll create a {@link @xeokit/data!DataModel | DataModel} containing six {@link DataObject | DataObjects}, one
 * for the table, one the tabletop, and one for each of the four legs. Our DataModel also gets
 * some {@link Relationship | Relationships}, to connect the DataObjects together into an aggregation hierarchy. We'll
 * also give our DataObjects some {@link PropertySet | PropertySets}, to give them height and weight attributes.
 *
 * To give our DataObjects and Relationships some semantic meaning, we'll assign them types from one of the SDK's bundled
 * data type sets, {@link "@xeokit/datatypes/basicTypes" | basicTypes}. This is a minimal set of types that simply classifies
 * each DataObject as a {@link @xeokit/datatypes/basicTypes!BasicEntity | BasicEntity}, and each Relationship as a
 * {@link @xeokit/datatypes/basicTypes!BasicAggregation | BasicAggregation}.
 *
 * When we've created our DataModel, we'll query it with {@link Data.searchDataObjects | Data.searchDataObjects}, which will
 * traverse our BasicAggregation Relationships and fetch all the BasicEntity DataObjects for us.
 *
 * ### Notes
 *
 * * In a real application, we'd likely use a more complex set of types, such as {@link "@xeokit/datatypes/ifcTypes" | ifcTypes}.
 * * We can't mix different sets of data types within our {@link Data}. That's because when we traverse the DataObjects
 * with Data.searchDataObjects, we need those traversals to be guided uniformly by the same set of types, for all the
 * DataObjects and Relationships in the graph.
 *
 * ### Example 1. Creating a DataModel from a single JSON object
 *
 * In our first example, we'll create our {@link @xeokit/data!DataModel | DataModel} from a single JSON object of
 * type {@link @xeokit/data!DataModelParams DataModelParams}.
 *
 * ````javascript
 * import {Data} from "@xeokit/data";
 * import * as basicTypes from "@xeokit/datatypes/basicTypes";
 * 
 * const myData = new Data({});
 *
 * const myDataModel = myData.createModel({ // DataModel
 *
 *     id: "myTableModel",
 *
 *     objects: [ // DataObject[]
 *         {
 *             id: "table",
 *             type: basicTypes.BasicEntity,
 *             name: "Table",
 *             propertySetIds: ["tablePropertySet"]
 *         },
 *         {
 *             id: "redLeg",
 *             name: "Red table Leg",
 *             type: basicTypes.BasicEntity,
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "greenLeg",
 *             name: "Green table leg",
 *             type: basicTypes.BasicEntity,
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "blueLeg",
 *             name: "Blue table leg",
 *             type: basicTypes.BasicEntity,
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "yellowLeg",
 *             name: "Yellow table leg",
 *             type: basicTypes.BasicEntity,
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "tableTop",
 *             name: "Purple table top",
 *             type: basicTypes.BasicEntity,
 *             propertySetIds: ["tableTopPropertySet"]
 *         }
 *     ],
 *
 *     relationships: [ // Relationship[]
 *         {
 *             type: basicTypes.BasicAggregation,
 *             relating: "table",
 *             related: "tableTop"
 *         },
 *         {
 *             type: basicTypes.BasicAggregation,
 *             relating: "tableTop",
 *             related: "redLeg"
 *         },
 *         {
 *             type: basicTypes.BasicAggregation,
 *             relating: "tableTop",
 *             related: "greenLeg"
 *         },
 *         {
 *             type: basicTypes.BasicAggregation,
 *             relating: "tableTop",
 *             related: "blueLeg"
 *         },
 *         {
 *             type: basicTypes.BasicAggregation,
 *             relating: "tableTop",
 *             related: "yellowLeg"
 *         }
 *     ],
 *
 *     propertySets: [ // PropertySet[]
 *         {
 *             id: "tablePropertySet",
 *             originalSystemId: "tablePropertySet",
 *             name: "Table properties",
 *             type: "",
 *             properties: [ // Property[]
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
 * myDataModel.build(); // Ready for action
 * ````
 *
 * ### Example 2. Creating a DataModel using builder methods
 *
 * In our second example, we'll create our {@link @xeokit/data!DataModel | DataModel} again, this time instantiating
 * each {@link PropertySet}, {@link Property}, {@link DataObject} and {@link Relationship} individually, using the
 * DataModel's builder methods.
 *
 * ````javascript
 * import {Data} from "@xeokit/data";
 * import * as basicTypes from "@xeokit/datatypes/basicTypes";
 *
 * const myData = new Data({
 * });
 *
 * const myDataModel = myData.createModel({
 *     id: "myTableModel"
 * });
 *
 * const tablePropertySet = myDataModel.createPropertySet({
 *     id: "tablePropertySet",
 *     name: "Table properties",
 *     type: ""
 * });
 *
 * tablePropertySet.createProperty({
 *     name: "Weight",
 *     value: 5,
 *     type: "",
 *     valueType: "",
 *     description: "Weight of the thing"
 * });
 *
 * tablePropertySet.createProperty({
 *     name: "Height",
 *     value: 12,
 *     type: "",
 *     valueType: "",
 *     description: "Height of the thing"
 * });
 *
 * const legPropertySet = myDataModel.createPropertySet({
 *     id: "legPropertySet",
 *     name: "Table leg properties",
 *     type: ""
 * });
 *
 * legPropertySet.createProperty({
 *     name: "Weight",
 *     value: 5,
 *     type: "",
 *     valueType: "",
 *     description: "Weight of the thing"
 * });
 *
 * legPropertySet.createProperty({
 *     name: "Height",
 *     value: 12,
 *     type: "",
 *     valueType: "",
 *     description: "Height of the thing"
 * });
 *
 * myDataModel.createObject({
 *     id: "table",
 *     type:  basicTypes.BasicEntity,
 *     name: "Table",
 *     propertySetIds: ["tablePropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "redLeg",
 *     name: "Red table Leg",
 *     type:  basicTypes.BasicEntity,
 *     propertySetIds: ["tableLegPropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "greenLeg",
 *     name: "Green table leg",
 *     type:  basicTypes.BasicEntity,
 *     propertySetIds: ["tableLegPropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "blueLeg",
 *     name: "Blue table leg",
 *     type:  basicTypes.BasicEntity,
 *     propertySetIds: ["tableLegPropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "yellowLeg",
 *     name: "Yellow table leg",
 *     type: "leg",
 *     propertySetIds: ["tableLegPropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "tableTop",
 *     name: "Purple table top",
 *     type:  basicTypes.BasicEntity,
 *     propertySetIds: ["tableTopPropertySet"]
 * });
 *
 * myDataModel.createRelationship({
 *     type: basicTypes.BasicAggregation,
 *     relating: "table",
 *     related: "tableTop"
 * });
 *
 * myDataModel.createRelationship({
 *     type: basicTypes.BasicAggregation,
 *     relating: "tableTop",
 *     related: "redLeg"
 * });
 *
 * myDataModel.createRelationship({
 *     type: basicTypes.BasicAggregation,
 *     relating: "tableTop",
 *     related: "greenLeg"
 * });
 *
 * myDataModel.createRelationship({
 *     type: basicTypes.BasicAggregation,
 *     relating: "tableTop",
 *     related: "blueLeg"
 * });
 *
 * myDataModel.createRelationship({
 *     type: basicTypes.BasicAggregation,
 *     relating: "tableTop",
 *     related: "yellowLeg"
 * });
 *
 * myDataModel.build(); // Ready for action
 * ````
 *
 * ### Example 3. Querying DataObjects
 *
 * In our third example, we'll extend our previous example to use the {@link Data.searchDataObjects} method to
 * traverse our data graph and fetch the IDs of the {@link DataObject | DataObjects} we find on that path.
 *
 * One example of where we use this method is to query the aggregation hierarchy of the DataObjects for building
 * a tree view of an IFC element hierarchy.
 *
 * ````javascript
 * const objectIds = [];
 *
 * myData.searchDataObjects({
 *     startObjectId: "table",
 *     includeObjects: [basicTypes.BasicEntity],
 *     includeRelated: [basicTypes.BasicAggregation],
 *     objectIds
 * });
 *
 * // objectIds == ["table", "tableTop", "redLeg", "greenLeg", "blueLeg", "yellowLeg"];
 *
 * view.setObjectsHighlighted(objectIds, true);
 * ````
 *
 * * ### Example 4. Traversing DataObjects
 *
 * In our fourth example, we'll demonstrate how to traverse the {@link DataObject | DataObjects} along their
 * {@link Relationship | Relationships}. We'll start at the root DataObject and highlight all the DataObjects
 * we encounter along the outgoing Relationships.
 *
 * ````javascript
 * const table = myData.objects["table"];
 *
 * const relations = table.related[basicTypes.BasicAggregation];
 *
 * for (let i = 0, len = relations.length; i < len; i++) {
 *
 *      const relation = relations[i];
 *      const dataObject = relation.related;
 *      const viewObject = view.objects[dataObject.id];
 *
 *      if (viewObject) {
 *          viewObject.highlighted = true;
 *      }
 * }
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