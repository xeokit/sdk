import {View, Viewer, ViewLayer} from "@xeokit/viewer";
import {CameraControl} from "@xeokit/cameracontrol";
import {LocaleService} from "@xeokit/locale";
import {Data, DataModel} from "@xeokit/data";
import {Scene, SceneModel} from "@xeokit/scene";
import {SDKError} from "@xeokit/core";
import {createSceneObjectsKdTree3, SceneObjectsKdTree3} from "@xeokit/kdtree3";
import {WebGLRenderer} from "@xeokit/webglrenderer";
import {TreeView} from "@xeokit/treeview";
import {loadCityJSON} from "@xeokit/cityjson";

//import {Picker} from "@xeokit/collision/pick";

export interface Layer {

    readonly id: String;

    readonly data: Data;

    readonly viewLayer: ViewLayer;

    // readonly treeViews: { [key: number]: TreeView };
}

/**
 * Minimal proof-of-concept CityJSON model viewer built from various xeokit SDK components.
 *
 * Demonstrates how the SDK components are designed to be used together in our applications.
 *
 * See {@link "@xeokit/cityjsonviewer"} for usage.
 */
export class MultiSchemaViewer {

    /**
     * Provides locale-specific string translations.
     */
    readonly localeService: LocaleService;

    /**
     * Scene representation.
     */
    readonly scene: Scene;

    /**
     * HTML CityObjects aggregation explorer.
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
     *
     */
    readonly layers: {
        [key: string]: Layer
    };

    /**
     * View layer that contains background objects.
     */
    readonly backgroundLayer: ViewLayer;

    /**
     * Select objects and primitives using rays and boundaries.
     *
     * Use this with {@link MultiSchemaViewer.objectsKdTree3}.
     */
        //readonly picker: Picker;

    #objectsKdTree3: SceneObjectsKdTree3 | null;

    /**
     * Creates a CityJSON model viewer.
     *
     * @param cfg
     */
    constructor(cfg: {
        canvasElement: HTMLCanvasElement;
    }) {

        this.localeService = new LocaleService({});

        this.scene = new Scene();

        this.layers = {};

        this.viewer = new Viewer({
            id: "myViewer",
            renderer: new WebGLRenderer({}),
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

        this.backgroundLayer = this.view.createLayer({ // TODO: Create ground plane, skybox etc in this layer
            id: "background"
        });

        this.cameraControl = new CameraControl(this.view, {});

        this.#objectsKdTree3 = null;

        this.scene.onModelCreated.subscribe(() => {
            this.#objectsKdTree3 = null;
        });

        this.scene.onModelDestroyed.subscribe(() => {
            this.#objectsKdTree3 = null;
        });
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

    createSchema(params: {
        id: string
    }) {
        const data = new Data();
        const schema: Schema = {
            id: params.id,
            data
        };
        this.schemas[params.id] = schema;
        return schema;
    }

    createLayer(params: {
        id: string,
        viewId: string,
        schemaId: string
    }) {
        const data = new Data();
        const layer: Layer = {
            id: params.id,
            data,
            viewLayer: this.view.createLayer({
                id: params.id
            })
        };
        this.layers[params.id] = layer;
        return layer;
    }

    /**
     * Loads a model.
     *
     * @param cfg
     */
    loadModel(cfg: {
        id: string,
        layerId,
        src: string
    }): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const {id, layerId, src} = cfg;
            if (this.scene.models[id]) {
                reject(`Model with this ID is already loaded: "${cfg.id}"`);
                return;
            }
            const layer = this.layers[cfg.layerId];
            if (!layer) {
                reject(`Layer not found: "${cfg.layerId}"`);
                return;
            }
            fetch(src).then(response => {
                if (response.ok) {
                    response.arrayBuffer().then(async fileData => {
                        const dataModel: (SDKError | DataModel) = layer.data.createModel({
                            id
                        });
                        if (dataModel instanceof SDKError) {
                            reject(dataModel.message);
                            return;
                        }
                        const sceneModel: (SDKError | SceneModel) = this.scene.createModel({
                            id,
                            layerId: layer.viewLayer.id
                        });
                        if (sceneModel instanceof SDKError) {
                            dataModel.destroy();
                            reject(sceneModel.message);
                            return;
                        }
                        loadCityJSON({
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
}