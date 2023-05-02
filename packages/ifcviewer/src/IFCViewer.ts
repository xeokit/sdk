import {View, Viewer, ViewLayer} from "@xeokit/viewer";

import {KTX2TextureTranscoder} from "@xeokit/ktx2";
import {loadXKT, saveXKT} from "@xeokit/xkt";
import {CameraControl} from "@xeokit/cameracontrol";
import {BCFViewpoint, loadBCFViewpoint, saveBCFViewpoint} from "@xeokit/bcf";
import {LocaleService} from "@xeokit/locale";
import {Data} from "@xeokit/data";
import {Scene} from "@xeokit/scene";
import {SDKError} from "@xeokit/core";
import {createSceneObjectsKdTree3, SceneObjectsKdTree3} from "@xeokit/kdtree3";
import {WebGLRenderer} from "@xeokit/webglrenderer";
//import {Picker} from "@xeokit/collision/pick";

/**
 * Minimal proof-of-concept IFC model viewer built from various xeokit SDK components.
 *
 * Demonstrates how the SDK components are designed to be used together in our applications.
 *
 * See {@link "@xeokit/ifcviewer"} for usage.
 */
export class IFCViewer {

    /**
     * The actual xeokit viewer.
     */
    readonly viewer: Viewer;

    /**
     * Scene representation.
     */
    readonly scene: Scene;

    /**
     * Semantic data model.
     */
    readonly data: Data;

    /**
     * Controls camera with user input.
     */
    readonly cameraControl: CameraControl;

    /**
     * An independently-configurable view.
     */
    readonly view: View;

    /**
     * Provides locale-specific string translations.
     */
    readonly localeService: LocaleService;

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
     * Use this with {@link IFCViewer.objectsKdTree3}.
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
    }) {

        this.localeService = new LocaleService({});

        this.scene = new Scene();

        this.data = new Data();

        this.viewer = new Viewer({
            id: "myViewer",
            renderer: new WebGLRenderer({
                textureTranscoder: new KTX2TextureTranscoder({
                    //  transcoderPath: "./../dist/basis/" // Optional, path to BasisU transcoder module
                })
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

        this.backgroundLayer = this.view.createLayer({
            id: "background"
        });

        this.cameraControl = new CameraControl(this.view, {});

        // this.treeView = new TreeView({
        //     view: this.view,
        //     data: this.data,
        //     containerElement: document.getElementById("myTreeViewContainer"),
        //     hierarchy: TreeView.GroupsHierarchy,
        //     linkType: IfcRelAggregates,
        //     groupTypes: [IfcBuilding, IfcBuildingStorey]
        // });

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
     *
     * Use this with {@link IFCViewer.picker}.
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
    loadModel(cfg: { id: string, src: string }): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const {id, src} = cfg;
            if (this.scene.models[id]) {
                reject(`Model with this ID is already loaded: "${cfg.id}"`);
                return;
            }
            fetch(src)
                .then(response => {
                    if (response.ok) {
                        response.arrayBuffer()
                            .then(async data => {
                                const dataModel = this.data.createModel({id});
                                if (dataModel instanceof SDKError) {
                                    reject(dataModel.message);
                                    return;
                                }
                                const sceneModel = this.scene.createModel({
                                    id,
                                    layerId: this.modelsLayer.id
                                });
                                if (sceneModel instanceof SDKError) {
                                    dataModel.destroy();
                                    reject(sceneModel.message);
                                    return;
                                }
                                await loadXKT({data, sceneModel, dataModel});
                                await sceneModel.build();
                                dataModel.build();
                                resolve();
                            });
                    }
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
     * Saves a model.
     *
     * @param id
     */
    saveModel(id: string): ArrayBuffer {
        const sceneModel = this.scene.models[id];
        if (!sceneModel) {
            throw new Error(`Model not found: '$id'`);
        }
        const dataModel = this.data.models[id];
        return saveXKT({
            sceneModel,
            dataModel
        });
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