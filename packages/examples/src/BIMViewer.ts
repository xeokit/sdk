import {View, Viewer, ViewLayer} from "@xeokit/viewer";
import {WebGLRenderer} from "@xeokit/webglrenderer";
import {KTX2TextureTranscoder} from "@xeokit/ktx2";
import {loadXKT, saveXKT} from "@xeokit/xkt";
import {CameraControl} from "@xeokit/cameracontrol";
import {BCFViewpoint, loadBCFViewpoint, saveBCFViewpoint} from "@xeokit/bcf";
import {LocaleService} from "@xeokit/locale";
import {Data, DataModel} from "@xeokit/data";
import {Scene, SceneModel} from "@xeokit/scene";
import {SDKError} from "@xeokit/core/components";



/**
 *
 */
export interface LoadProjectParams {
    models: string[];
    dataModels: string[];
}

/**
 * TODO
 */
export class Project {
    dataModels: { [key: string]: DataModel };
    models: { [key: string]: SceneModel };
}

/**
 * TODO
 */
export class BIMViewer {

    /**
     * TODO
     */
    readonly options: {}

    /**
     * TODO
     */
    readonly data: Data;

    /**
     * TODO
     */
    readonly cameraControl: CameraControl;

    /**
     * TODO
     */
    readonly view: View;

    /**
     * TODO
     */
    readonly localeService: LocaleService;

    /**
     * TODO
     */
    project?: Project;

    /**
     *
     */
    readonly modelsViewLayer: ViewLayer;

    /**
     *
     */
    readonly backgroundViewLayer: ViewLayer;
    private viewer: Viewer;
    private scene: Scene;

    /**
     * TODO
     * @param cfg
     */
    constructor(cfg: {
        canvasElement: HTMLCanvasElement;
    }) {
        this.scene = new Scene();
        this.viewer = new Viewer({
            id: "myViewer",
            renderer: new WebGLRenderer({
                textureTranscoder: new KTX2TextureTranscoder({
                    //  transcoderPath: "./../dist/basis/" // Optional, path to BasisU transcoder module
                })
            }),
            scene: this.scene
        });
        this.data = new Data();
        const view = this.viewer.createView({canvasElement: cfg.canvasElement});
        if (view instanceof SDKError) {
        } else {
            this.view = view;
        }
        this.modelsViewLayer = this.view.createLayer({id: "models"});
        this.backgroundViewLayer = this.view.createLayer({id: "background"});
        this.cameraControl = new CameraControl(this.view, {});
        this.localeService = new LocaleService({});

        this.options = {};


    }


    /**
     * Loads a model from XKT format.
     *
     * @param cfg
     */
    loadModel(cfg
                  :
                  {
                      id: string;
                      src: string;
                  }
    ) {
        const id = cfg.id;
        return new Promise<void>((resolve, reject) => {
            const sceneModel = this.scene.createModel({id});
            const dataModel = this.data.createModel({id});
            if (dataModel instanceof SDKError) {
                reject(dataModel.message);
            } else if (sceneModel instanceof SDKError) {
                reject(sceneModel.message);
            } else {
                fetch(cfg.src).then(response => {
                    if (response.ok) {
                        response.arrayBuffer().then(data => {
                            loadXKT({data, sceneModel, dataModel}).then(() => {
                                sceneModel.build().then(() => {
                                    dataModel.build();
        //                            this.#viewObjectsKDTree = null;
                                    resolve();
                                });
                            });
                        })
                    }
                });
            }
        });
    }

    /**
     * Unloads the model with the given ID.
     * @param id
     */
    unloadModel(id
                    :
                    string
    ) {

    }

    /**
     * Save a model as an XKT ArrayBuffer.
     * @param id
     */
    saveModel(id
                  :
                  string
    ):
        ArrayBuffer {
        const sceneModel = this.scene.models[id];
        if (!sceneModel) {
            throw new Error(`Model not found: '$id'`);
        }
        return saveXKT({sceneModel});
    }

    /**
     * TODO
     */
    clearModels() {

    }

    /**
     * TODO
     * @param bcfViewpoint
     */
    loadBCF(bcfViewpoint
                :
                BCFViewpoint
    ) {
        loadBCFViewpoint({
            bcfViewpoint,
            view: this.view,
            includeLayerIds: [this.modelsViewLayer.id]
        });
    }

    /**
     * TODO
     */
    saveBCF()
        :
        BCFViewpoint {
        return saveBCFViewpoint({
            view: this.view,
            includeLayerIds: [this.modelsViewLayer.id]
        });
    }
}