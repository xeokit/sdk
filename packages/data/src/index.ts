/**
 *  #### Entity-relationship data model
 *
 * * Designed to be used optionally in conjunction with {@link Viewer}
 * * A single graph into which we can merge multiple ER data models - objects, properties and relationships
 * * Builder API to programmatically create data models in the graph
 * * Load and destroy data models at any time
 * * Find data objects with traversals
 * * Extensible entity and relationship types
 * * Supports IFC schema
 *
 * See {@link Data} for complete usage.
 *
 * ````javascript
 * import {Data} from "@xeokit/data";
 *
 * const myData = new Data();
 *
 * const mySchema = {
 *     MOUSE_TYPE: 0,
 *     CAT_TYPE: 1,
 *     CHASES_REL: 2
 * };
 *
 * const myDataModel = myData.createDataModel({
 *    id: "myModel"
 * });
 *
 * myDataModel.createObject({
 *     id: "tom",
 *     name: "Tom",
 *     type: mySchema.CAT_TYPE
 * });
 *
 * myDataModel.createObject({
 *     id: "jerry",
 *     name: "Jerry",
 *     type: mySchema.MOUSE_TYPE
 * });
 *
 * myDataModel.createRelationship({
 *     type: mySchema.CHASES_REL,
 *     relating: "tom",
 *     related: "jerry"
 * });
 *
 * myDataModel.build(); // Ready for use now
 * ````
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