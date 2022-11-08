import * as utils from "../../viewer/utils/utils"
import {DataModelParams, Plugin, SceneModel, Viewer} from "../../viewer/index";
import {XKTDataSource} from "./XKTDataSource";
import {XKTDefaultDataSource} from "./XKTDefaultDataSource";
import {IFCObjectDefaults} from "./IFCObjectDefaults";
// import {ParserV1} from "./parsers/ParserV1.js";
// import {ParserV2} from "./parsers/ParserV2.js";
// import {ParserV3} from "./parsers/ParserV3.js";
// import {ParserV4} from "./parsers/ParserV4.js";
// import {ParserV5} from "./parsers/ParserV5.js";
// import {ParserV6} from "./parsers/ParserV6.js";
// import {ParserV7} from "./parsers/ParserV7";
// import {ParserV8} from "./parsers/ParserV8";
import {ParserV9} from "./parsers/ParserV9";


const parsers: { [key: string]: any } = {};

// parsers[ParserV1.version] = ParserV1;
// parsers[ParserV2.version] = ParserV2;
// parsers[ParserV3.version] = ParserV3;
// parsers[ParserV4.version] = ParserV4;
// parsers[ParserV5.version] = ParserV5;
// parsers[ParserV6.version] = ParserV6;
// parsers[ParserV7.version] = ParserV7;
// parsers[ParserV8.version] = ParserV8;
parsers[ParserV9.version] = ParserV9;

/**
 A {@link Viewer} {@link Plugin} that loads models from xeokit's native *````.XKT````* format.

 ## Overview

 - XKTLoaderPlugin is the most efficient way to load high-detail models into xeokit
 - An *````.XKT````* file is a single BLOB containing a model
 - Supports double-precision coordinates
 - Position, scale and rotate each model as you load it
 - Filter which IFC types get loaded
 - Configure initial default appearances for IFC types
 - Set a custom data source for *````.XKT````* and IFC metadata files
 - Option to load multiple copies of the same model, without object ID clashes

 */
class XKTLoaderPlugin extends Plugin {

    /**
     Customizable list of object types that are exclusively loaded by this XKTLoaderPlugin.

     When loading models with metadata, causes this XKTLoaderPlugin to only load objects whose types are in this list.

     An object's type is indicated by {@link DataObject.type}.

     Default value is ````null````.
     */
    public includeTypes: string[] = null;

    /**
     Customizable list of object types that are never loaded by this XKTLoaderPlugin.

     When loading models with metadata, causes this XKTLoaderPlugin to not load objects whose types are in this list.

     An object's type is indicated by {@link DataObject.type}.

     Default value is ````null````.
     */
    public excludeTypes: string[] = null;

    /**
     Customizable data source object through which the XKTLoaderPlugin can load models and metadata.

     Default value is an {@link XKTDefaultDataSource}, which loads via HTTP.
     */
    public dataSource: XKTDataSource = new XKTDefaultDataSource();

    /**
     Indicates whether we load objects that don't have types.

     When loading models with metadata and this is ````true````, XKTLoaderPlugin will not load objects that don't have types.

     Default value is ````false````.
     */
    public excludeUnclassifiedObjects: boolean = false;

    /**
     Map of initial default states for objects of the given types.

     Default value is {@link IFCObjectDefaults}.
     */
    public objectDefaults: any = IFCObjectDefaults;

    /**
     Indicates whether XKTLoaderPlugin globalizes the IDs of the objects of each model it loads.

     Set  this ````true```` when you need to load multiple instances of the same model, to avoid ID clashes
     between the objects in the different instances.

     When we load a model with this set ````true````, then each {@link SceneObject.id} and {@link DataObject.id} will be
     prefixed by the ID of the model, ie. ````<modelId>#<objectId>````.

     {@link DataObject.originalSystemId} will always hold the original, un-prefixed, ID values.

     Default value is ````false````.
     */
    public globalizeObjectIds: boolean = false;

    /**
     The ````.xkt```` format versions supported by this XKTLoaderPlugin.
     */
    public static readonly supportedXKTVersions: string[] = Object.keys(parsers);

    /**
     @constructor

     @param viewer - The Viewer.
     @param cfg  - Plugin configuration.
     @param cfg.id - ID for this plugin, so that we can find it within {@link Viewer.plugins}. default value is "XKTLoader".
     @param cfg.objectDefaults - Map of initial default states for each loaded object.  Default to an instance of {@link IFCObjectDefaults}.
     @param cfg.dataSource - A custom data source through which to load model and metadata files. Defaults to an instance of {@link XKTDefaultDataSource}, which loads uover HTTP.
     @param cfg.includeTypes - Only load objects of these types.
     @param cfg.excludeTypes - Never load objects of these types.
     @param cfg.excludeUnclassifiedObjects - Whether to exclude objects that don't have types. Default is ````false````.
     */
    constructor(viewer: Viewer, cfg: {
        includeTypes?: string[];
        excludeTypes?: string[];
        objectDefaults?: { [key: string]: any };
        dataSource?: XKTDataSource;
        excludeUnclassifiedObjects?: boolean;
    } = {}) {
        super("XKTLoader", viewer, cfg);
        if (cfg.dataSource) {
            this.dataSource = cfg.dataSource;
        }
        if (cfg.objectDefaults) {
            this.objectDefaults = cfg.objectDefaults;
        }
        this.includeTypes = cfg.includeTypes;
        this.excludeTypes = cfg.excludeTypes;
        this.excludeUnclassifiedObjects = !!cfg.excludeUnclassifiedObjects;
    }

    /**
     Loads an ````.xkt```` model into this XKTLoaderPlugin's {@link Viewer}.

     @param params - Loading parameters.
     @param params.id - ID to assign to the root {@link Entity.id}, unique among all components in the Viewer's {@link Scene}, generated automatically by default.
     @param params.src - Path to a *````.xkt````* file, as an alternative to the ````xkt```` parameter.
     @param params.xkt - The *````.xkt````* file data, as an alternative to the ````src```` parameter.
     @param params.modelDataSrc - Path to an optional metadata file, as an alternative to the ````modelDataData```` parameter.
     @param params.modelDataData - JSON model metadata, as an alternative to the ````modelDataSrc```` parameter.
     @param params.objectDefaults - Map of initial default states for each loaded {@link Entity} that represents an object. Default value is {@link IFCObjectDefaults}.
     @param params.includeTypes - When loading metadata, only loads objects that have {@link DataObject}s with {@link DataObject.type} values in this list.
     @param params.excludeTypes - When loading metadata, never loads objects that have {@link DataObject}s with {@link DataObject.type} values in this list.
     @param params.edges - Whether or not xeokit renders the model with edges emphasized. Default is ````false````.
     @param params.position - The model World-space 3D position.
     @param params.scale - The model's World-space scale.
     @param params.rotation - The model's World-space rotation, as Euler angles given in degrees, for each of the X, Y and Z axis.
     @param params.matrix - The model's world transform matrix. Overrides the position, scale and rotation parameters.
     @param params.edges - Indicates if the model's edges are initially emphasized.  Default is ````false````.
     @param params.saoEnabled - Indicates if Scalable Ambient Obscurance (SAO) will apply to the model. SAO is configured by the Scene's {@link SAO} component. Only works when {@link SAO.enabled} is also ````true````
     @param params.pbrEnabled - Indicates if physically-based rendering (PBR) will apply to the model. Only works when {@link Scene.pbrEnabled} is also ````true````.  Default is ````false````.
     @param params.backfaces - When we set this ````true````, then we force rendering of backfaces for the model. When we leave this ````false````, then we allow the Viewer to decide when to render backfaces. In that case, the Viewer will hide backfaces on watertight meshes, show backfaces on open meshes, and always show backfaces on meshes when we slice them open with {@link SectionPlane}s.  Default is ````false````.
     @param params.excludeUnclassifiedObjects - When loading metadata and this is ````true````, will only load objects that have types (that are not excluded).  Default is ````false````.
     @param params.globalizeObjectIds - Indicates whether to globalize object IDs, in case you need to prevent ID clashes with other models. Default is ````false````.
     @returns {SceneModel} - SceneModel representing the model, which will be registered by {@link SceneModel.id} in {@link SceneData.sceneModels}.
     */
    load(params: {
        objectDefaults?: { [key: string]: any };
        excludeUnclassifiedObjects?: boolean;
        globalizeObjectIds?: boolean;
        dataModelData?: DataModelParams;
        dataModelSrc?: string;
        id: string,
        src?: string,
        xkt?: ArrayBuffer,
        includeTypes?: string[],
        excludeTypes?: string[]
    }) {

        if (params.id && this.viewer.scene.sceneModels[params.id]) {
            this.error("Model with this ID already exists in viewer: " + params.id + " - will autogenerate this ID");
            delete params.id;
        }

        const sceneModel = this.viewer.scene.createModel(utils.apply(params, {}));

        const modelId = sceneModel.id;  // In case ID was auto-generated

        if (!params.src && !params.xkt) {
            this.error("load() param expected: src or xkt");
            return sceneModel; // Return new empty model
        }

        const options: { [key: string]: any } = {};
        const includeTypes = params.includeTypes || this.includeTypes;
        const excludeTypes = params.excludeTypes || this.excludeTypes;
        const objectDefaults = params.objectDefaults || this.objectDefaults;

        if (includeTypes) {
            options.includeTypesMap = {};
            for (let i = 0, len = includeTypes.length; i < len; i++) {
                options.includeTypesMap[includeTypes[i]] = true;
            }
        }

        if (excludeTypes) {
            options.excludeTypesMap = {};
            for (let i = 0, len = excludeTypes.length; i < len; i++) {
                options.excludeTypesMap[excludeTypes[i]] = true;
            }
        }

        if (objectDefaults) {
            options.objectDefaults = objectDefaults;
        }

        options.excludeUnclassifiedObjects = (params.excludeUnclassifiedObjects !== undefined) ? (!!params.excludeUnclassifiedObjects) : this.excludeUnclassifiedObjects;
        options.globalizeObjectIds = (params.globalizeObjectIds !== undefined) ? (!!params.globalizeObjectIds) : this.globalizeObjectIds;

        if (params.dataModelSrc || params.dataModelData) {

            const processModelDataData = (dataModelData: any) => {
                dataModelData.id = modelId;
                const dataModel = this.viewer.data.createModel(dataModelData, {
                    includeTypes: includeTypes,
                    excludeTypes: excludeTypes,
                    globalizeObjectIds: this.globalizeObjectIds
                });
                if (!dataModel) {
                    return false;
                }
                if (params.src) {
                    this.#loadModel(params.src, params, options, sceneModel);
                } else {
                    this.#parseModel(params.xkt, params, options, sceneModel);
                }
                sceneModel.events.once("destroyed", () => {
                    const dataModel = this.viewer.data.models[sceneModel.id];
                    if (dataModel) {
                        dataModel.destroy();
                    }
                });
                return true;
            };

            if (params.dataModelSrc) {
                const dataModelSrc = params.dataModelSrc;
                //   this.viewer.scene.canvas.spinner.processes++;
                this.dataSource.getModelData(dataModelSrc, (dataModelData: any) => {
                    if (sceneModel.destroyed) {
                        return;
                    }
                    if (!processModelDataData(dataModelData)) {
                        this.error(`load(): Failed to load model metadata for model '${modelId} from '${dataModelSrc}' - metadata not valid`);
                        sceneModel.events.fire("error", "Metadata not valid");
                    }
                    //      this.viewer.scene.canvas.spinner.processes--;
                }, (errMsg: string) => {
                    this.error(`load(): Failed to load model metadata for model '${modelId} from  '${dataModelSrc}' - ${errMsg}`);
                    sceneModel.events.fire("error", `Failed to load model metadata from  '${dataModelSrc}' - ${errMsg}`);
                    //     this.viewer.scene.canvas.spinner.processes--;
                });
            } else if (params.dataModelData) {
                if (!processModelDataData(params.dataModelData)) {
                    this.error(`load(): Failed to load model metadata for model '${modelId} from '${params.dataModelSrc}' - metadata not valid`);
                    sceneModel.events.fire("error", "Metadata not valid");
                }
            }
        } else {
            if (params.src) {
                this.#loadModel(params.src, params, options, sceneModel);
            } else {
                this.#parseModel(params.xkt, params, options, sceneModel);
            }
        }
        return sceneModel;
    }

    #loadModel(src: string, params: {}, options: {}, sceneModel: SceneModel) {
        //      const spinner = this.viewer.scene.canvas.spinner;
        //  spinner.processes++;
        this.dataSource.getXKT(src,
            (arrayBuffer: ArrayBuffer) => {
                this.#parseModel(arrayBuffer, params, options, sceneModel);
                //  spinner.processes--;
            },
            (errMsg: string): void => {
                //   spinner.processes--;
                this.error(errMsg);
                sceneModel.events.fire("error", errMsg);
            });
    }

    #parseModel(arrayBuffer: ArrayBuffer, params: {}, options: {}, sceneModel: SceneModel) {
        if (sceneModel.destroyed) {
            return;
        }
        const dataView = new DataView(arrayBuffer);
        const dataArray = new Uint8Array(arrayBuffer);
        const xktVersion = dataView.getUint32(0, true);
        const parser = parsers[xktVersion];
        if (!parser) {
            this.error("Unsupported .XKT file version: " + xktVersion + " - this XKTLoaderPlugin supports versions " + Object.keys(parsers));
            return;
        }
        this.log("Loading .xkt V" + xktVersion);
        const numElements = dataView.getUint32(4, true);
        const elements = [];
        let byteOffset = (numElements + 2) * 4;
        for (let i = 0; i < numElements; i++) {
            const elementSize = dataView.getUint32((i + 2) * 4, true);
            elements.push(dataArray.subarray(byteOffset, byteOffset + elementSize));
            byteOffset += elementSize;
        }
        parser.parse(this.viewer, options, elements, sceneModel);
        sceneModel.finalize();
        this.#createDefaultModelDataIfNeeded(sceneModel, params, options);
        sceneModel.scene.events.once("tick", () => {
            if (sceneModel.events.destroyed) {
                return;
            }
            sceneModel.scene.events.fire("modelLoaded", sceneModel.id); // FIXME: Assumes listeners know order of these two events
            sceneModel.events.fire("loaded", true, false); // Don't forget the event, for late subscribers
        });
    }

    #createDefaultModelDataIfNeeded(sceneModel: SceneModel, params: {}, options: {
        globalizeObjectIds?: boolean;
        excludeTypes?: string[];
        includeTypes?: string[];
    }) {
        const modelDataId = sceneModel.id;
        if (!this.viewer.data.models[modelDataId]) {
            const dataModelData: DataModelParams = {
                id: sceneModel.id,
                objects: []
            };
            dataModelData.objects.push({
                id: modelDataId,
                type: "default",
                name: modelDataId,
                parentId: null
            });
            const sceneObjects = sceneModel.sceneObjects;
            for (let id in sceneObjects) {
                const sceneObject = sceneObjects[id];
                dataModelData.objects.push({
                    id: "" + sceneObject.id,
                    type: "default",
                    name: "" + sceneObject.id,
                    parentId: modelDataId
                });
            }
            const dataModel = this.viewer.data.createModel(dataModelData, {
                includeTypes: options.includeTypes,
                excludeTypes: options.excludeTypes,
                globalizeObjectIds: options.globalizeObjectIds
            });
            sceneModel.events.once("destroyed", () => {
                dataModel.destroy();
            });
        }
    }
}

export {XKTLoaderPlugin}
