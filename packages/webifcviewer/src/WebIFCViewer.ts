import {View, Viewer, ViewLayer} from "@xeokit/viewer";
import {CameraControl} from "@xeokit/cameracontrol";
import {BCFViewpoint, loadBCFViewpoint, saveBCFViewpoint} from "@xeokit/bcf";
import {LocaleService} from "@xeokit/locale";
import {Data, DataModel} from "@xeokit/data";
import {Scene, SceneModel} from "@xeokit/scene";
import {SDKError} from "@xeokit/core";
import {createSceneObjectsKdTree3, SceneObjectsKdTree3} from "@xeokit/kdtree3";
import {loadWebIFC} from "@xeokit/webifc";
import {WebGLRenderer} from "@xeokit/webglrenderer";
import type * as WebIFC from "web-ifc/web-ifc-api";
import {TreeView} from "@xeokit/treeview";
import {IfcBuilding, IfcBuildingStorey, IfcRelAggregates} from "@xeokit/ifctypes";

//import {Picker} from "@xeokit/collision/pick";

/**
 * Minimal proof-of-concept IFC model viewer built from various xeokit SDK components.
 *
 * Demonstrates how the SDK components are designed to be used together in our applications.
 *
 * See {@link "@xeokit/webifcviewer"} for usage.
 */
export class WebIFCViewer {

    /**
     * The WebIFC API.
     */
    readonly ifcAPI: WebIFC.IfcAPI;

    /**
     * Provides locale-specific string translations.
     */
    readonly localeService: LocaleService;

    /**
     * Semantic data model.
     */
    readonly data: Data;

    /**
     * Scene representation.
     */
    readonly scene: Scene;

    /**
     * HTML tree view explorer.
     */
    readonly treeView: TreeView;

    /**
     * The xeokit viewer.
     */
    readonly viewer: Viewer;

    /**
     * Controls viewer's camera with user input.
     */
    readonly cameraControl: CameraControl;

    /**
     * An independently-configurable view within the viewer.
     */
    readonly view: View;

    /**
     * View layer that contains model objects.
     */
    readonly modelsLayer: ViewLayer;

    /**
     * View layer that contains background objects.
     */
    readonly backgroundLayer: ViewLayer;

    /**
     * HTML tree view to navigate scene objects.
     */
    // readonly treeView: TreeView;

    /**
     * Select objects and primitives using rays and boundaries.
     *
     * Use this with {@link WebIFCViewer.objectsKdTree3}.
     */
        //readonly picker: Picker;

    #objectsKdTree3: SceneObjectsKdTree3 | null;

    /**
     * Creates an IFC model viewer.
     *
     * @param cfg
     */
    constructor(cfg: {
        canvasElement: HTMLCanvasElement;
        treeViewContainerElement: HTMLElement;
        ifcAPI: WebIFC.IfcAPI;
    }) {

        this.ifcAPI = cfg.ifcAPI;

        this.localeService = new LocaleService({});

        this.scene = new Scene();

        this.data = new Data();

        this.viewer = new Viewer({
            id: "myViewer",
            renderer: new WebGLRenderer({
                // textureTranscoder: new KTX2TextureTranscoder({
                //     //  transcoderPath: "./../dist/basis/" // Optional, path to BasisU transcoder module
                // })
            }),
            scene: this.scene
        });

        const view = this.viewer.createView({
            canvasElement: cfg.canvasElement
        });

        if (view instanceof SDKError) {
            throw view;
        } else {
            this.view = view;
        }

        this.modelsLayer = this.view.createLayer({
            id: "models"
        });

        this.backgroundLayer = this.view.createLayer({ // TODO: Create ground plane, skybox etc in this layer
            id: "background"
        });

        this.cameraControl = new CameraControl(this.view, {});

        this.treeView = new TreeView({
            view: this.view,
            data: this.data,
            // @ts-ignore
            containerElement: treeViewContainerElement,
            hierarchy: TreeView.GroupsHierarchy,
            linkType: IfcRelAggregates,
            groupTypes: [IfcBuilding, IfcBuildingStorey]
        });

        this.#objectsKdTree3 = null;

        this.scene.onModelCreated.subscribe(() => {
            this.#objectsKdTree3 = null;
        });

        this.scene.onModelDestroyed.subscribe(() => {
            this.#objectsKdTree3 = null;
        });

        //  this.picker = new Picker();
    }

    /**
     * 3D spatial index for scene objects.
     */
    get objectsKdTree3() {
        if (this.#objectsKdTree3 === null) {
            this.#objectsKdTree3 = createSceneObjectsKdTree3(Object.values(this.scene.objects));
        }
        return this.#objectsKdTree3;
    }

    /**
     * Loads an IFC model.
     *
     * @param cfg
     */
    loadModel(cfg: {
        id: string,
        src: string
    }): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const {id, src} = cfg;
            if (this.scene.models[id]) {
                reject(`Model with this ID is already loaded: "${cfg.id}"`);
                return;
            }
            fetch(src).then(response => {
                if (response.ok) {
                    response.arrayBuffer().then(async fileData => {
                        const dataModel: (SDKError | DataModel) = this.data.createModel({
                            id
                        });
                        if (dataModel instanceof SDKError) {
                            reject(dataModel.message);
                            return;
                        }
                        const sceneModel: (SDKError | SceneModel) = this.scene.createModel({
                            id,
                            layerId: this.modelsLayer.id
                        });
                        if (sceneModel instanceof SDKError) {
                            dataModel.destroy();
                            reject(sceneModel.message);
                            return;
                        }
                        loadWebIFC({
                            ifcAPI: this.ifcAPI,
                            fileData,
                            sceneModel,
                            dataModel
                        }).then(() => {
                            sceneModel.build().then(() => {
                                dataModel.build();
                                resolve();
                            }).catch((sdkError: SDKError) => {
                                sceneModel.destroy();
                                dataModel.destroy();
                                reject(sdkError.message);
                            });
                        }).catch((sdkError: SDKError) => {
                            sceneModel.destroy();
                            dataModel.destroy();
                            reject(sdkError.message);
                        });
                    }).catch(errMsg => {
                        reject(errMsg);
                    });
                }
            }).catch(errMsg => {
                reject(errMsg);
            });
        });
    }

    /**
     * Unloads a model.
     *
     * @param id
     */
    unloadModel(id: string) {
        const sceneModel = this.scene.models[id];
        if (sceneModel) {
            sceneModel.destroy();
        }
        const dataModel = this.data.models[id];
        if (dataModel) {
            dataModel.destroy();
        }
    }

    /**
     * Unloads all models.
     */
    clearModels() {
        this.data.clear();
        this.scene.clear();
    }

    /**
     * Loads a BCF viewpoint.
     *
     * @param bcfViewpoint
     */
    loadBCF(bcfViewpoint: BCFViewpoint) {
        loadBCFViewpoint({
            bcfViewpoint,
            view: this.view,
            includeLayerIds: [
                this.modelsLayer.id
            ]
        });
    }

    /**
     * Saves a BCF viewpoint.
     */
    saveBCF(): BCFViewpoint {
        return saveBCFViewpoint({
            view: this.view,
            includeLayerIds: [
                this.modelsLayer.id
            ]
        });
    }
}