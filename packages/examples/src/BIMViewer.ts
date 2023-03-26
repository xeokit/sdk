import {View, Viewer, ViewLayer} from "@xeokit/viewer";
import {WebGLRenderer} from "@xeokit/webglrenderer";
import {KTX2TextureTranscoder} from "@xeokit/ktx2";
import {saveXKT} from "@xeokit/xkt";
import {CameraControl} from "@xeokit/cameracontrol";
import {BCFViewpoint, loadBCFViewpoint, saveBCFViewpoint} from "@xeokit/bcf";
import {LocaleService} from "@xeokit/locale";
import {Data, DataModel} from "@xeokit/data";
import {SceneModel} from "@xeokit/scene";
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
export class BIMViewer extends Viewer {

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

    /**
     * TODO
     * @param cfg
     */
    constructor(cfg: {
        canvasElement: HTMLCanvasElement;
    }) {
        super({
            id: "myViewer",
            renderer: new WebGLRenderer({
                textureTranscoder: new KTX2TextureTranscoder({
                    //  transcoderPath: "./../dist/basis/" // Optional, path to BasisU transcoder module
                })
            })
        });

        this.data = new Data();

        const view = this.createView({
            canvasElement: cfg.canvasElement
        });

        if (view instanceof SDKError) {

        } else {
            this.view = view;
        }

        this.modelsViewLayer = this.view.createLayer({
            id: "models"
        });

        this.backgroundViewLayer = this.view.createLayer({
            id: "background"
        });

        this.cameraControl = new CameraControl(this.view, {});

        this.localeService = new LocaleService({});

        this.options = {};

        this.project = null;
    }

    /**
     * TODO
     * @param project
     */
    loadProject(project: LoadProjectParams) {

        // if (this.project) {
        //     // this.project.destroy();
        // }
        //
        // this.project = new Project({
        //
        // });
        //
        // return this.project;
    }

    /**
     *
     * @param cfg
     */
    loadDataModel(cfg: {
        id: string;
        src: string;
    }) {

    }

    /**
     * TODO
     * @param cfg
     */
    loadModel(cfg: {
        id: string;
        src: string;
    }) {
        return new Promise<void>((resolve, reject) => {

            // const model = this.createModel({
            //     id: cfg.id
            // });
            // const dataModel = this.data.createModel({
            //     id: cfg.id
            // })
            // fetch(cfg.src)
            //     .then(response => {
            //         if (response.ok) {
            //             response.arrayBuffer()
            //                 .then(data => {
            //                     loadXKT({data, model, dataModel})
            //                         .then(() => {
            //                             model.build();
            //                             dataModel.build();
            //                             resolve();
            //                         });
            //                 })
            //         }
            //     });
        });

    }

    /**
     * TODO
     * @param id
     */
    unloadModel(id: string) {

    }

    /**
     * Save a model as an XKT ArrayBuffer.
     * @param id
     */
    saveModel(id: string): ArrayBuffer {
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
    loadBCF(bcfViewpoint: BCFViewpoint) {
        loadBCFViewpoint({
            bcfViewpoint,
            view: this.view,
            includeViewLayerIds: [this.modelsViewLayer.id]
        });
    }

    /**
     * TODO
     */
    saveBCF(): BCFViewpoint {
        return saveBCFViewpoint({
            view: this.view,
            includeViewLayerIds: [this.modelsViewLayer.id]
        });
    }
}