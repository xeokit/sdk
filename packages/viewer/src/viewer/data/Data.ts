import {Component} from "../Component";
import {DataModel} from "./DataModel";
import type {DataObject} from "./DataObject";
import type {PropertySet} from "./PropertySet";
import type {Viewer} from "../Viewer";
import type {DataModelParams} from "./DataModelParams";
import {createUUID} from "../utils/index";
import {EventEmitter, SceneModel} from "@xeokit-viewer/viewer";
import {EventDispatcher} from "strongly-typed-events";


/**
 * Contains semantic data about the models within a {@link Viewer}.
 *
 * ## Summary
 *
 * * Located at {@link Viewer.data}
 * * Contains {@link DataModel}s to classify the {@link SceneModel|SceneModels} in the {@link Scene}
 * * Contains {@link DataObject}s to classify the {@link SceneObject|SceneObjects} in the Scene
 * * Use {@link Data.createModel} to create {@link DataModel|DataModels}
 * * Use {@link DataModel.createObject} to create {@link DataObject|DataObjects}
 * * Use {@link DataModel.createPropertySet} to create {@link PropertySet|PropertySets}
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
 *             type: "furniture",
 *             name: "Table",
 *             propertySetIds: ["tablePropertySet"]
 *         },
 *         {
 *             id: "redLeg",
 *             name: "Red table Leg",
 *             type: "leg",
 *             relations: {
 *                 [Relation.AggregatedBy]: "table
 *             },
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "greenLeg",
 *             name: "Green table leg",
 *             type: "leg",
 *             relations: {
 *                 [Relation.AggregatedBy]: "table
 *             },
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "blueLeg",
 *             name: "Blue table leg",
 *             type: "leg",
 *             relations: {
 *                 [Relation.AggregatedBy]: "table
 *             },
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "yellowLeg",
 *             name: "Yellow table leg",
 *             type: "leg"
 *             relations: {
 *                 [Relation.AggregatedBy]: "table
 *             },
 *             propertySetIds: ["tableLegPropertySet"]
 *         },
 *         {
 *             id: "tableTop",
 *             name: "Purple table top",
 *             type: "surface"
 *             relations: {
 *                 [Relation.AggregatedBy]: "table
 *             },
 *             propertySetIds: ["tableTopPropertySet"]
 *         }
 *     ]
 * });
 * ````
 *
 * ### Example 2. Creating a DataModel using Builder Methods
 *
 * In our second example, we'll create another {@link DataModel}, this time instantiating the {@link PropertySet},
 * {@link Property} and {@link DataObject} components ourselves, using builder methods.
 *
 * ````javascript
 * import {Viewer, constants} from "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/xeokit-viewer.es.min.js";
 *
 * const myViewer = new Viewer({
 *   id: "myViewer"
 * });
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
 *     originalSystemId: "tablePropertySet",
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
 *     originalSystemId: "legPropertySet",
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
 *     originalSystemId: "table",
 *     type: "furniture",
 *     name: "Table",
 *     propertySetIds: ["tablePropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "redLeg",
 *     name: "Red table Leg",
 *     type: "leg",
 *     parentId: "table",
 *     propertySetIds: ["tableLegPropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "greenLeg",
 *     name: "Green table leg",
 *     type: "leg",
 *     parentId: "table",
 *     propertySetIds: ["tableLegPropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "blueLeg",
 *     name: "Blue table leg",
 *     type: "leg",
 *     parentId: "table",
 *     propertySetIds: ["tableLegPropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "yellowLeg",
 *     name: "Yellow table leg",
 *     type: "leg",
 *     parentId: "table",
 *     propertySetIds: ["tableLegPropertySet"]
 * });
 *
 * myDataModel.createObject({
 *     id: "tableTop",
 *     name: "Purple table top",
 *     type: "surface",
 *     parentId: "table",
 *     propertySetIds: ["tableTopPropertySet"]
 * });
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
     * @private
     */
    destroy(): void {
        this.onModelCreated.clear();
        this.onModelDestroyed.clear();
        super.destroy();
    }
}
