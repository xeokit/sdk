/**
 * <img style="padding:50px" src="media://images/xeokit_datamodel_icon.png"/>
 *
 * ## Data Model Representation
 *
 * * {@link @xeokit/datamodel!DataModel | DataModel}
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
 * npm install @xeokit/datamodel
 * ````
 *
 *
 * ## Usage
 *
 * Let's create a data model that describes the structure of a simple item of
 * furniture - a table, comprised of a tabletop with four legs attached. Then we'll query the data model to
 * find all the objects within it.
 *
 * To do this, we'll create a {@link @xeokit/datamodel!DataModel | DataModel} containing six {@link DataObject | DataObjects}, one
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
 * ````javascript
 * import {Data} from "@xeokit/datamodel";
 * import * as basicTypes from "@xeokit/datatypes/basicTypes";
 * 
 * const myData = new Data({
 * });
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
 * myDataModel.build();
 *
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
 * ````
 *
 * @module @xeokit/datamodel
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