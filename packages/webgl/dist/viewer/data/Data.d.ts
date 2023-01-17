import { Component } from "../Component";
import { DataModel } from "./DataModel";
import type { DataObject } from "./DataObject";
import type { PropertySet } from "./PropertySet";
import type { WebViewer } from "../WebViewer";
import type { DataModelParams } from "./DataModelParams";
import { EventEmitter } from "../EventEmitter";
import type { SearchParams } from "./SearchParams";
/**
 * Contains semantic data for the models in a {@link WebViewer}.
 *
 * ## Features
 *
 * * Generic entity-relationship graph
 * * Supports multiple, federated data models
 * * Supports any schema that's expressable as an ER graph
 * * Supports IFC models
 * * Graph traversals to query objects
 *
 * ## Quickstart
 *
 * * Located at {@link WebViewer.data}
 * * Create {@link DataModel|DataModels} with {@link Data.createModel}
 * * Create {@link DataObject|DataObjects} with {@link DataModel.createObject}
 * * Create {@link PropertySet|PropertySets} with {@link DataModel.createPropertySet}
 * * Create {@link Relationship|Relationships} with {@link DataModel.createRelationship}
 * * Query with {@link Data.searchDataObjects}
 * * When built, be sure to finalize each DataModel with {@link DataModel.build}
 * * When no longer needed, be sure to destroy each DataModel with {@link DataModel.destroy}
 *
 * <br>
 *
 * ## Examples
 *
 * ### Example 1. Creating a DataModel from a JSON object
 *
 * In this example, we'll create a {@link DataModel} from a JSON object which conforms to the schema defined by
 * {@link DataModelParams}.
 *
 * ````javascript
 * import {WebViewer, constants} from "@xeokit/webviewer";
 *
 * const myViewer = new WebViewer({
 *   id: "myViewer"
 * });
 *
 * const mySchema = {
 *     FURNITURE_TYPE: 0,
 *     AGGREGATES_REL: 1
 * };
 *
 * const myDataModel = myViewer.data.createModel({
 *
 *     id: "myTableModel",
 *
 *     projectId: "024120003",
 *     revisionId: "902344223",
 *     author: "xeolabs",
 *     createdAt: "Jan 26 2022",
 *     creatingApplication: "WebStorm",
 *     schema: "ifc4",
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
 * ````
 *
 * ### Example 2. Creating a DataModel using builder methods
 *
 * In our second example, we'll create another {@link DataModel}, this time instantiating the {@link PropertySet},
 * {@link Property}, {@link DataObject} and {@link Relationship} components ourselves, using the DataModel's builder methods.
 *
 * ````javascript
 * import {WebViewer, constants} from "@xeokit/webviewer";
 *
 * const myViewer = new WebViewer({
 *   id: "myViewer"
 * });
 *
 * const view = myViewer.createView({
 *      canvas: myCanvas
 * });
 *
 * const mySchema = {
 *     FURNITURE_TYPE: 0,
 *     AGGREGATES_REL: 1
 * };
 *
 * const myDataModel = myViewer.data.createModel({
 *     id: "myTableModel",
 *     projectId: "024120003",
 *     revisionId: "902344223",
 *     author: "xeolabs",
 *     createdAt: "Jan 26 2022",
 *     creatingApplication: "WebStorm",
 *     schema: "ifc4"
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
 *     type: "furniture",
 *     name: "Table",
 *     propertySetIds: ["tablePropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "redLeg",
 *     name: "Red table Leg",
 *     type: "leg",
 *     propertySetIds: ["tableLegPropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "greenLeg",
 *     name: "Green table leg",
 *     type: "leg",
 *     propertySetIds: ["tableLegPropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "blueLeg",
 *     name: "Blue table leg",
 *     type: "leg",
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
 *     type: "surface",
 *     propertySetIds: ["tableTopPropertySet"]
 * });
 *
 * myDataModel.createRelationship({
 *     type: mySchema.AGGREGATES_REL,
 *     relating: "table",
 *     related: "tableTop"
 * });
 *
 * myDataModel.createRelationship({
 *     type: mySchema.AGGREGATES_REL,
 *     relating: "tableTop",
 *     related: "redLeg"
 * });
 *
 * myDataModel.createRelationship({
 *     type: mySchema.AGGREGATES_REL,
 *     relating: "tableTop",
 *     related: "greenLeg"
 * });
 *
 * myDataModel.createRelationship({
 *     type: mySchema.AGGREGATES_REL,
 *     relating: "tableTop",
 *     related: "blueLeg"
 * });
 *
 * myDataModel.createRelationship({
 *     type: mySchema.AGGREGATES_REL,
 *     relating: "tableTop",
 *     related: "yellowLeg"
 * });
 * ````
 *
 * ### Example 3. Querying DataObjects
 *
 * In our third example, we'll extend our previous example to use the {@link Data.searchDataObjects} method to
 * traverse our data graph and fetch the IDs of the {@link DataObject|DataObjects} we find on that path.
 *
 * One example of where we use this method is to query the aggregation hierarchy of the DataObjects for building
 * a tree view of an IFC element hierarchy.
 *
 * ````javascript
 * const objectIds = [];
 *
 * myViewer.data.searchDataObjects({
 *     startObjectId: "table",
 *     includeObjects: [mySchema.FURNITURE_TYPE],
 *     includeRelated: [mySchema.AGGREGATES_REL],
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
 * TODO
 *
 * ````javascript
 * const table = myViewer.data.objects["table"];
 *
 * const relations = table.related[mySchema.AGGREGATES_REL];
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
 * ### Example 5. Handling data events
 *
 * TODO
 *
 *
 */
export declare class Data extends Component {
    /**
     * The {@link WebViewer} to which this Data belongs.
     *
     * The Data is located at {@link WebViewer.data}.
     */
    readonly viewer: WebViewer;
    /**
     * Emits an event each time a {@link DataModel} is created.
     *
     * @event
     */
    readonly onModelCreated: EventEmitter<Data, DataModel>;
    /**
     * Emits an event each time a {@link DataModel} is destroyed.
     *
     * @event
     */
    readonly onModelDestroyed: EventEmitter<Data, DataModel>;
    /**
     * Emits an event each time a {@link DataObject} is created.
     *
     * @event
     */
    readonly onObjectCreated: EventEmitter<Data, DataObject>;
    /**
     * Emits an event each time a {@link DataObject} is destroyed.
     *
     * @event
     */
    readonly onObjectDestroyed: EventEmitter<Data, DataObject>;
    /**
     * The {@link DataModel|DataModels} belonging to this Data, each keyed to its {@link DataModel.id}.
     */
    readonly models: {
        [key: string]: DataModel;
    };
    /**
     * The {@link PropertySet|PropertySets} belonging to this Data, each keyed to its {@link PropertySet.id}.
     */
    readonly propertySets: {
        [key: string]: PropertySet;
    };
    /**
     * All {@link DataObject|DataObjects} belonging to this Data, each keyed to its {@link DataObject.id}.
     */
    readonly objects: {
        [key: string]: DataObject;
    };
    /**
     * The root {@link DataObject|DataObjects} belonging to this Data, each keyed to its {@link DataObject.id}.
     *
     * Root DataObjects are those with {@link DataObject.parent} set to ````null````.
     */
    readonly rootObjects: {
        [key: string]: DataObject;
    };
    /**
     * The {@link DataObject|DataObjects} belonging to this Data, each map keyed to {@link DataObject.type}, containing {@link DataObject|DataObjects} keyed to {@link DataObject.id}.
     */
    readonly objectsByType: {
        [key: string]: {
            [key: string]: DataObject;
        };
    };
    /**
     * Tracks number of {@link DataObject|DataObjects} of each type.
     */
    readonly typeCounts: {
        [key: string]: number;
    };
    /**
     * @private
     */
    constructor(viewer: WebViewer);
    /**
     * Creates a {@link DataModel} in this Data.
     *
     * @param  dataModelParams Data for the {@link DataModel}.
     * @param [options] Options for creating the {@link DataModel}.
     * @param [options.includeRelating] When provided, only create {@link DataObject|DataObjects} with types in this list.
     * @param  [options.excludeRelating] When provided, never create {@link DataObject|DataObjects} with types in this list.
    * @returns The new DataModel.
     * @see {@link Scene.createModel}
     */
    createModel(dataModelParams: DataModelParams, options?: {
        includeRelating?: string[];
        excludeRelating?: string[];
    }): DataModel;
    /**
     * Gets the {@link DataObject.id}s of the {@link DataObject|DataObjects} that have the given {@link DataObject.type}.
     *
     * @param type The type.
     * @returns Array of {@link DataObject.id}s.
     */
    getObjectIdsByType(type: string): string[];
    /**
     * Finds {@link DataObject|DataObjects} using a customized depth-first traversal.
     *
     * Usually we use this method to recursively find DataObjects of specific {@link DataObject.type|types} within
     * a hierarchy.
     *
     * See {@link Data} for usage examples.
     *
     * @param searchParams
     */
    searchDataObjects(searchParams: SearchParams): void;
    /**
     * @private
     */
    destroy(): void;
}
