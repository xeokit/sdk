import {Component} from "../Component";
import {DataModel} from "./DataModel";
import type {DataObject} from "./DataObject";
import type {PropertySet} from "./PropertySet";
import type {Viewer} from "../Viewer";
import type {DataModelParams} from "./DataModelParams";
import {createUUID} from "../utils/index";
import {EventEmitter, SceneModel} from "@xeokit-viewer/viewer";
import {EventDispatcher} from "strongly-typed-events";
import type {SearchParams} from "./SearchParams";


/**
 * Contains semantic data about the models within a {@link Viewer}.
 *
 * Represents semantic data as a generic entity-relationship graph, with optional sets of properties to attach to
 * entities. This can be used to represent IFC models, as well as any other semantic model that can be represented
 * using an entity-relationship graph. We can also load and merge multiple models, and query them using custom
 * depth-first traversals.
 *
 * ## Summary
 *
 * * Located at {@link Viewer.data}
 * * Contains {@link DataModel}s to classify the {@link SceneModel|SceneModels} in the {@link Scene}
 * * Contains {@link DataObject}s to classify the {@link SceneObject|SceneObjects} in the Scene
 * * Use {@link Data.createModel} to create {@link DataModel|DataModels}
 * * Use {@link DataModel.createObject} to create {@link DataObject|DataObjects}
 * * Use {@link DataModel.createPropertySet} to create {@link PropertySet|PropertySets}
 * * Use {@link DataModel.createRelationship} to create {@link Relationship|Relationships} between the DataObjects
 *
 * <br>
 *
 * ## Examples
 *
 * ### Example 1. Creating a DataModel from JSON Data
 *
 * Creating a {@link DataModel} within our Data, from a JSON object:
 *
 * ````javascript
 * import {Viewer, constants} from "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/xeokit-viewer.es.min.js";
 *
 * const myViewer = new Viewer({
 *   id: "myViewer"
 * });
 * 
 * const myTypes = {
 *     FURNITURE_TYPE: 0,
 *     AGGREGATES_REL: 1
 * };
 *
 * myViewer.data.createModel({
 *     id: "myTableModel",
 *     projectId: "024120003",
 *     revisionId: "902344223",
 *     author: "xeolabs",
 *     createdAt: "Jan 26 2022",
 *     creatingApplication: "WebStorm",
 *     schema: "ifc4",
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
 *     ],
 *     objects: [
 *         {
 *             id: "table",
 *             originalSystemId: "table",
 *             type: myTypes.FURNITURE_TYPE,
 *             name: "Table",
 *             propertySetIds: ["tablePropertySet"]
 *         },
 *         {
 *             id: "redLeg",
 *             name: "Red table Leg",
 *             type: myTypes.FURNITURE_TYPE,
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "greenLeg",
 *             name: "Green table leg",
 *             type: myTypes.FURNITURE_TYPE,
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "blueLeg",
 *             name: "Blue table leg",
 *             type: myTypes.FURNITURE_TYPE,
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "yellowLeg",
 *             name: "Yellow table leg",
 *             type: myTypes.FURNITURE_TYPE,
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "tableTop",
 *             name: "Purple table top",
 *             type: myTypes.FURNITURE_TYPE,
 *             propertySetIds: ["tableTopPropertySet"]
 *         }
 *     ],
 *     relationships: [
 *         {
 *             type: myTypes.AGGREGATES_REL,
 *             relating: "table",
 *             related: "tableTop"
 *         },
 *         {
 *             type: myTypes.AGGREGATES_REL,
 *             relating: "tableTop",
 *             related: "redLeg"
 *         },
 *         {
 *             type: myTypes.AGGREGATES_REL,
 *             relating: "tableTop",
 *             related: "greenLeg"
 *         },
 *         {
 *             type: myTypes.AGGREGATES_REL,
 *             relating: "tableTop",
 *             related: "blueLeg"
 *         },
 *         {
 *             type: myTypes.AGGREGATES_REL,
 *             relating: "tableTop",
 *             related: "yellowLeg"
 *         }
 *     ]
 * });
 * ````
 *
 * ### Example 2. Creating a DataModel using Builder Methods
 *
 * In our second example, we'll create another {@link DataModel}, this time instantiating the {@link PropertySet},
 * {@link Property}, {@link DataObject} and {@link Relationship} components ourselves, using builder methods.
 *
 * ````javascript
 * import {Viewer, constants} from "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/xeokit-viewer.es.min.js";
 *
 * const myViewer = new Viewer({
 *   id: "myViewer"
 * });
 *
 * const view = myViewer.createView({
 *      canvas: myCanvas
 * });
 *
 * const myTypes = {
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
 *     type: myTypes.AGGREGATES_REL,
 *     relating: "table",
 *     related: "tableTop"
 * });
 *
 * myDataModel.createRelationship({
 *     type: myTypes.AGGREGATES_REL,
 *     relating: "tableTop",
 *     related: "redLeg"
 * });
 *
 * myDataModel.createRelationship({
 *     type: myTypes.AGGREGATES_REL,
 *     relating: "tableTop",
 *     related: "greenLeg"
 * });
 *
 * myDataModel.createRelationship({
 *     type: myTypes.AGGREGATES_REL,
 *     relating: "tableTop",
 *     related: "blueLeg"
 * });
 *
 * myDataModel.createRelationship({
 *     type: myTypes.AGGREGATES_REL,
 *     relating: "tableTop",
 *     related: "yellowLeg"
 * });
 *
 * * ### Example 3. Querying DataObjects
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
 *     includeObjects: [myTypes.FURNITURE_TYPE],
 *     includeRelated: [myTypes.AGGREGATES_REL],
 *     objectIds
 * });
 *
 * // objectIds == ["table", "tableTop", "redLeg", "greenLeg", "blueLeg", "yellowLeg"];
 *
 * view.setObjectsHighlighted(objectIds, true);
 * ````
 *
 * * ### Example 4. Querying DataObjects
 *
 * In our fourth example, we'll extend our previous example to use the {@link Data.searchDataObjects} method to
 * traverse our data graph and fetch the IDs of the {@link DataObject|DataObjects} we find on that path.
 *
 * One example of where we use this method is to query the aggregation hierarchy of the DataObjects for building
 * a tree view of an IFC element hierarchy.
 *
 * ````javascript
 * const table = myViewer.data.objects["table"];
 *
 * const tableTop = table.related[myTypes[myTypes.AGGREGATES_REL]["tableTop"];
 * const tableTop = myViewer.data.objects["tableTop"];
 *
 * const objectIds = [];
 *
 * myViewer.data.searchDataObjects({
 *     startObjectId: "table",
 *     includeObjects: [myTypes.FURNITURE_TYPE],
 *     includeRelated: [myTypes.AGGREGATES_REL],
 *     objectIds
 * });
 *
 * // objectIds == ["table", "tableTop", "redLeg", "greenLeg", "blueLeg", "yellowLeg"];
 *
 * view.setObjectsHighlighted(objectIds, true);
 * ````
 */
export class Data extends Component {

    /**
     * The {@link Viewer} to which this Data belongs.
     *
     * The Data is located at {@link Viewer.data}.
     */
    declare public readonly viewer: Viewer;

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
     * The {@link DataModel}s belonging to this Data, each keyed to its {@link DataModel.id}.
     */
    public readonly models: { [key: string]: DataModel };

    /**
     * The {@link PropertySet}s belonging to this Data, each keyed to its {@link PropertySet.id}.
     */
    public readonly propertySets: { [key: string]: PropertySet };

    /**
     * All {@link DataObject}s belonging to this Data, each keyed to its {@link DataObject.id}.
     */
    public readonly objects: { [key: string]: DataObject };

    /**
     * The root {@link DataObject}s belonging to this Data, each keyed to its {@link DataObject.id}.
     *
     * Root DataObjects are those with {@link DataObject.parent} set to ````null````.
     */
    public readonly rootObjects: { [key: string]: DataObject };

    /**
     * The {@link DataObject}s belonging to this Data, each map keyed to {@link DataObject.type}, containing {@link DataObject}s keyed to {@link DataObject.id}.
     */
    public readonly objectsByType: { [key: string]: { [key: string]: DataObject } };

    /**
     * Tracks number of {@link DataObject}s of each type.
     */
    readonly typeCounts: { [key: string]: number };

    /**
     * @private
     */
    constructor(viewer: Viewer) {

        super(null, {});

        this.viewer = viewer;
        this.models = {};
        this.propertySets = {};
        this.objects = {};
        this.rootObjects = {};
        this.objectsByType = {};
        this.typeCounts = {};

        this.onModelCreated = new EventEmitter(new EventDispatcher<Data, DataModel>());
        this.onModelDestroyed = new EventEmitter(new EventDispatcher<Data, DataModel>());
        this.onObjectCreated = new EventEmitter(new EventDispatcher<Data, DataObject>());
        this.onObjectDestroyed = new EventEmitter(new EventDispatcher<Data, DataObject>());
    }

    /**
     * Creates a {@link DataModel} in this Data.
     *
     * @param  dataModelParams Data for the {@link DataModel}.
     * @param [options] Options for creating the {@link DataModel}.
     * @param [options.includeRelating] When provided, only create {@link DataObject}s with types in this list.
     * @param  [options.excludeRelating] When provided, never create {@link DataObject}s with types in this list.
     * @param [options.globalizeObjectIds=false] Whether to globalize each {@link DataObject.id}. Set this ````true```` when you need to load multiple instances of the same meta model, to avoid ID clashes between the meta objects in the different instances.
     * @returns The new DataModel.
     * @see {@link Scene.createModel}
     */
    createModel(
        dataModelParams: DataModelParams,
        options?: {
            includeRelating?: string[],
            excludeRelating?: string[],
            globalizeObjectIds?: boolean
        }
    ): DataModel {
        let id = dataModelParams.id || createUUID();
        if (this.models[id]) {
            this.error(`DataModel with ID "${id}" already exists - will randomly-generate ID`);
            id = createUUID();
        }
        const dataModel = new DataModel(this, id, dataModelParams, options);
        this.models[dataModel.id] = dataModel;
        dataModel.onDestroyed.one(() => { // DataModel#destroy() called
            delete this.models[dataModel.id];
            this.onModelDestroyed.dispatch(this, dataModel);
        });
        this.onModelCreated.dispatch(this, dataModel);
        return dataModel;
    }

    /**
     * Gets the {@link DataObject.id}s of the {@link DataObject}s that have the given {@link DataObject.type}.
     *
     * @param type The type.
     * @returns Array of {@link DataObject.id}s.
     */
    getObjectIdsByType(type: string) {
        const objects = this.objectsByType[type];
        return objects ? Object.keys(objects) : [];
    }

    /**
     * Finds {@link DataObject|DataObjects} using a depth-first traversal.
     *
     * @param searchParams
     */
    searchDataObjects(searchParams: SearchParams) {

        const includeObjects = (searchParams.includeObjects && searchParams.includeObjects.length > 0) ? arrayToMap(searchParams.includeObjects) : null;
        const excludeObjects = (searchParams.excludeObjects && searchParams.excludeObjects.length > 0) ? arrayToMap(searchParams.excludeObjects) : null;

        const includeRelating = (searchParams.includeRelating && searchParams.includeRelating.length > 0) ? arrayToMap(searchParams.includeRelating) : null;
        const excludeRelating = (searchParams.excludeRelating && searchParams.excludeRelating.length > 0) ? arrayToMap(searchParams.excludeRelating) : null;

        function visit(dataObject: DataObject) {
            if (!dataObject) {
                return;
            }
            let includeObject = true;
            // @ts-ignore
            if (excludeObjects && excludeObjects[dataObject.type]) {
                includeObject = false;
            } else { // @ts-ignore
                if (includeObjects && (!includeObjects[dataObject.type])) {
                    includeObject = false;
                }
            }
            if (includeObject) {
                if (searchParams.resultObjectIds) {
                    searchParams.resultObjectIds.push(dataObject.id);
                } else if (searchParams.resultObjects) {
                    searchParams.resultObjects.push(dataObject);
                } else if (searchParams.resultCallback) {
                    if (searchParams.resultCallback(dataObject)) {
                        return;
                    }
                }
            }
            // const relations = dataObject.related[searchParams.type];
            // if (relations) {
            //     for (let i = 0, len = relations.length; i < len; i++) {
            //         let includeRelation = true;
            //         // @ts-ignore
            //         if (excludeRelating && excludeRelating[dataObject.type]) {
            //             includeRelation = false;
            //         } else { // @ts-ignore
            //             if (includeRelating && (!includeRelating[dataObject.type])) {
            //                 includeRelation = false;
            //             }
            //         }
            //         if (includeRelation) {
            //             visit(relations[i].related);
            //         }
            //     }
            // }
        }

        if (searchParams.startObjectId) {
            const startObject = this.objects[searchParams.startObjectId];
            if (startObject) {
                visit(startObject);
            }
        } else if (searchParams.startObject) {
            if (searchParams.startObject) {
                visit(searchParams.startObject);
            }
        } else {
            for (let id in this.rootObjects) {
                visit(this.rootObjects[id]);
            }
        }
    }

    /**
     * @private
     */
    destroy(): void {
        this.onModelCreated.clear();
        this.onModelDestroyed.clear();
        super.destroy();
    }
}

function arrayToMap(array: any[]): { [key: string]: any } {
    const map: { [key: string]: any } = {};
    for (let i = 0, len = array.length; i < len; i++) {
        map[array[i]] = true;
    }
    return map;
}

