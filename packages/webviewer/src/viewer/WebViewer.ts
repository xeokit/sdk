import {LocaleService} from "./localization/LocaleService";
import {Scene} from "./scene/index";
import {Data} from "./data/Data";
import {View} from "./view/View";
import type {Plugin} from "./Plugin";
import type * as math from "./math/index";
import {scheduler} from "./scheduler";
import type {Renderer} from "./scene/Renderer";
import * as utils from "./utils/index";
import {apply, createUUID} from "./utils/index";
import type {WebViewerCapabilities} from "./WebViewerCapabilities";
import type {ViewParams} from "./ViewParams";
import {WebGLRenderer} from "../webgl/WebGLRenderer";
import {EventDispatcher} from "strongly-typed-events";
import {EventEmitter} from "./EventEmitter";

class TickParams {
}

/**
 * An extensible browser-based 3D viewer for AEC applications.
 *
 * ## Features
 *
 * * Fast, double precision 3D rendering, in all major browsers
 * * Multiple, federated models
 * * Multiple canvases
 * * Semantic ER data model
 * * Fast model loading from binary format
 * * Super low memory footprint
 * * Open architecture
 * * Written in TypeScript
 *
 * ## Overview
 *
 * A WebViewer has the following subsystems:
 *
 * ### WebViewer.scene
 *
 * A WebViewer's **scene** contains the geometry and materials for models currently in the WebViewer. The scene provides
 * builder methods that we can use to programmatically construct multiple models at once. Various loader plugins also
 * use these methods to construct models in the scene while they load their geometry from files.
 *
 * The scene is located at {@link WebViewer.scene} and is implemented by {@link Scene}.
 *
 * ### WebViewer.data
 *
 * A WebViewer's **data** subsystem contains a buildable entity-relationship graph that holds semantic information
 * about all the models currently in the WebViewer. The data subsystem provides builder methods that we can use to
 * programmatically construct ER graphs for multiple models at once. As with the WebViewer's scene, various loader plugins also
 * use these builder methods to construct data models while they load model files. We can create multiple data models,
 * and can have relationsips between objects in different models. The graph treats all object IDs as global, and automatically
 * merges models into the same, unified graph wherever they have objects that share the same IDs. This mechanism allows
 * us to load BIM models that have been split into multiple IFC models.
 *
 * The data is located at {@link WebViewer.data} and is implemented by {@link Data}.
 *
 * ### WebViewer.views
 *
 * A WebViewer can have one or more independent **views** of its models, each with its own HTML canvas, viewing parameters
 * and individual object visual states, that are unique to that View.
 *
 * The views are located at {@link WebViewer.views} and are implemented by {@link View}.
 *
 * ### Renderer
 *
 * We can also configure a WebViewer with a custom {@link Renderer}, in case we need to customize the way
 * the WebViewer uses the underlying browser graphics API (e.g. WebGL, WebGPU) to create and render models.
 *
 * ## Usage
 * 
 * ### Example #1
 *
 * Create a viewer:
 *
 * ````javascript
 * import {WebViewer, constants} from "@xeokit/webviewer";
 *
 * const myViewer = new WebViewer({
 *     id: "myViewer"
 * });
 * ````
 *
 * Create a view with its own HTML canvas:
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *     id: "myView",
 *     canvasId: "myCanvas1"
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 *
 * view1.camera.projection = PerspectiveProjectionType;
 *
 * view1.cameraControl.navMode = "orbit";
 * ````
 *
 * Create a geometric model representation with a couple of objects:
 *
 * ````javascript
 * const mySceneModel = myViewer.scene.createModel({
 *     id: "myModel"
 * });
 *
 * mySceneModel.createGeometry({
 *     id: "myGeometry",
 *     primitive: constants.TrianglesPrimitive,
 *     positions: [...],
 *     indices: [...]
 *     //...
 * });
 *
 * mySceneModel.createMesh({
 *     id: "myMesh",
 *     geometryId: "myGeometry",
 *     //...
 * });
 *
 * mySceneModel.createObject({
 *     id: "myObject1",
 *     meshIds: ["myMesh"],
 *     viewLayerId: "main"
 *     //...
 * });
 *
 * mySceneModel.createObject({
 *     id: "myObject2",
 *     meshIds: ["myMesh"],
 *     viewLayerId: "main"
 *     //...
 * });
 *
 * mySceneModel.build();
 * ````
 *
 * Create a semantic entity-relationship data model, with two objects and one relation between them:
 *
 * ````javascript
 * const mySchema = {
 *     MY_OBJECT_TYPE: 0,
 *     MY_RELATIONSHIP_TYPE: 1
 * }
 *
 * const myDataModel = myViewer.data.createModel({
 *     id: "myModel"
 * });
 *
 * myDataModel.createObject({
 *     id: "myObject1",
 *     name: "Some object",
 *     type: mySchema.MY_OBJECT_TYPE
 * });
 *
 * myDataModel.createObject({
 *     id: "myObject2",
 *     name: "Some object",
 *     type: mySchema.MY_OBJECT_TYPE
 * });
 *
 * myDataModel.createRelationship({
 *     relating: "myObject1",
 *     related: "myObject2",
 *     type: mySchema.MY_RELATION_TYPE
 * });
 *
 * myDataModel.build();
 * ````
 *
 * Customize the view - highlight one of the objects and reposition the camera:
 *
 * ````javascript
 * view1.viewObjects["myObject1"].highlighted = true;
 *
 * view1.camera.eye = [0, 0, 20];
 * view1.camera.look = [0, 0, 0];
 * view1.camera.up = [0, 1, 0];
 * ````
 */
export class WebViewer {

    /**
     ID of this WebViewer.
     */
    readonly id: string;

    /**
     True once this WebViewer has been destroyed.

     Don't use this WebViewer if this is ````true````.
     */
    readonly destroyed: boolean;

    /**
     * Indicates the capabilities of this WebViewer.
     */
    readonly capabilities: WebViewerCapabilities;

    /**
     * Emits an event each time a WebViewer "tick" occurs (~10-60 times per second).
     *
     * @event
     */
    readonly onTick: EventEmitter<WebViewer, TickParams>;

    /**
     * Emits an event each time a {@link View} is created.
     *
     * @event
     */
    readonly onViewCreated: EventEmitter<WebViewer, View>;

    /**
     * Emits an event each time a {@link View} is destroyed.
     *
     * @event
     */
    readonly onViewDestroyed: EventEmitter<WebViewer, View>;

    /**
     Provides locale string translations for this WebViewer.

     This may be configured via the WebViewer's constructor.

     By default, this service will be an instance of {@link LocaleService}, which will just return
     null translations for all given strings and phrases.
     */
    readonly localeService: LocaleService;

    /**
     Contains semantic data about models in this WebViewer.
     */
    readonly data: Data;

    /**
     Contains geometry and materials for models in this viewer.
     */
    readonly scene: Scene;

    /**
     * Map of all the Views in this WebViewer.
     *
     * Each {@link View} is an independently configurable view of the WebViewer's models, with its own canvas, camera position, section planes, lights, and object visual states.
     */
    readonly views: { [key: string]: View };

    /**
     * List of all the Views in this WebViewer.
     *
     * Each {@link View} is an independently configurable view of the WebViewer's models, with its own canvas, camera position, section planes, lights, and object visual states.
     */
    readonly viewList: View[];

    /**
     *  The number of {@link View|Views} belonging to this WebViewer.
     */
    numViews: number;

    /**
     List of {@link Plugin}s installed in this WebViewer.
     @private
     */
    readonly pluginList: Plugin[];

    /**
     The time that this WebViewer was created.
     */
    readonly startTime: number = (new Date()).getTime();

    /**
     * @private
     */
    readonly renderer: Renderer;

    /**
     Creates a WebViewer.

     @param params - WebViewer configuration.
     @param params.id - ID for this WebViewer, automatically generated by default.
     @param params.units - The measurement unit type. Accepted values are ````"meters"````, ````"metres"````, , ````"centimeters"````, ````"centimetres"````, ````"millimeters"````,  ````"millimetres"````, ````"yards"````, ````"feet"```` and ````"inches"````.
     @param params.scale - The number of Real-space units in each World-space coordinate system unit.
     @param params.origin - The Real-space 3D origin, in current measurement units, at which the World-space coordinate origin ````[0,0,0]```` sits.
     @param params.localeService - Locale-based translation service.
     @param params.renderer - Configurable 3D renderer class. Will be a  {@link WebGLRenderer} by default.
     */
    constructor(params: {
        id?: string,
        units?: string,
        scale?: number,
        origin?: math.FloatArrayParam,
        localeService?: LocaleService,
        renderer?: Renderer
    } = {}) {

        this.onTick = new EventEmitter(new EventDispatcher<WebViewer, TickParams>());

        this.onViewCreated = new EventEmitter(new EventDispatcher<WebViewer, View>());

        this.onViewDestroyed = new EventEmitter(new EventDispatcher<WebViewer, View>());

        this.id = params.id || createUUID();
        this.localeService = params.localeService || new LocaleService();
        this.data = new Data(this);
        this.scene = new Scene(this, {});
        this.viewList = [];
        this.numViews = 0;
        this.pluginList = [];
        this.views = {};
        this.destroyed = false;

        this.capabilities = {
            maxViews: 0,
            astcSupported: false,
            etc1Supported: false,
            etc2Supported: false,
            dxtSupported: false,
            bptcSupported: false,
            pvrtcSupported: false
        };

        this.renderer = params.renderer || new WebGLRenderer({});
        this.renderer.getCapabilities(this.capabilities);
        this.renderer.init(this);

        scheduler.registerViewer(this);
    }

    /**
     * Creates a new {@link View} within this WebViewer.
     *
     * * The maximum number of views you're allowed to create is provided in {@link WebViewerCapabilities.maxViews}. This
     * will be determined by the {@link Renderer} implementation the WebViewer is configured with.
     * * To destroy the View after use, call {@link View.destroy}.
     * * You must add a View to the WebViewer before you can create or load content into the WebViewer's Scene.
     *
     * ### Usage
     *
     * ````javascript
     * const view1 = myViewer.createView({
     *      id: "myView",
     *      canvasId: "myCanvas1"
     *  });
     *
     * view1.camera.eye = [-3.933, 2.855, 27.018];
     * view1.camera.look = [4.400, 3.724, 8.899];
     * view1.camera.up = [-0.018, 0.999, 0.039];
     *
     * //...
     * ````
     *
     * @param params
     */
    createView(params: ViewParams): View | null {
        if (this.viewList.length >= this.capabilities.maxViews) {
            this.error(`Attempted to create too many Views with View.createView() - maximum of ${this.capabilities.maxViews} is allowed`);
            return null;
        }
        let id = params.id || createUUID();
        if (this.views[id]) {
            this.error(`View with ID "${id}" already exists - will randomly-generate ID`);
            id = createUUID();
        }
        // @ts-ignore
        const canvasElement = params.canvasElement || document.getElementById(params.canvasId);
        if (!(canvasElement instanceof HTMLCanvasElement)) {
            throw "Mandatory View config expected: valid canvasId or canvasElement";
        }
        const view = new View(apply({id, viewer: this}, params));
        this.#registerView(view);
        view.viewIndex = this.renderer.registerView(view);
        view.onDestroyed.one( () => {
            this.#deregisterView(view);
            this.renderer.deregisterView(view.viewIndex);
            this.onViewDestroyed.dispatch(this, view);
        });
        this.onViewCreated.dispatch(this, view);
        this.log(`View created: ${view.id}`);
        return view;
    }


    /**
     @private
     */
    registerPlugin(plugin: Plugin): void {
        this.pluginList.push(plugin);
    }

    /**
     @private
     */
    deregisterPlugin(plugin: Plugin): void {
        for (let i = 0, len = this.pluginList.length; i < len; i++) {
            const p = this.pluginList[i];
            if (p === plugin) {
                p.clear();
                this.pluginList.splice(i, 1);
                return;
            }
        }
    }

    /**
     @private
     */
    sendToPlugins(name: string, value?: any) {
        for (let i = 0, len = this.pluginList.length; i < len; i++) {
            const p = this.pluginList[i];
            if (p.send) {
                p.send(name, value);
            }
        }
    }

    /**
     Trigger a redraw of all {@link View|Views} belonging to this WebViewer.

     @private
     */
    redraw(): void {
        for (let id in this.views) {
            this.views[id].redraw();
        }
    }

    /**
     Logs a console debugging message for this WebViewer.

     The console message will have this format: *````[LOG] [<component type> <component id>: <message>````*

     @private
     @param message - The message to log
     */
    log(message: string): void {
        message = `[LOG] ${this.#prefixMessageWithID(message)}`;
        window.console.log(message);
    }

    /**
     Logs a warning for this WebViewer to the JavaScript console.

     The console message will have this format: *````[WARN] [<component type> =<component id>: <message>````*

     @private
     @param message - The warning message to log
     */
    warn(message: string): void {
        message = `[WARN] ${this.#prefixMessageWithID(message)}`;
        window.console.warn(message);
    }

    /**
     Logs an error for this WebViewer to the JavaScript console.

     The console message will have this format: *````[ERROR] [<component type> =<component id>: <message>````*

     @private
     @param message The error message to log
     */
    error(message: string): void {
        message = `[ERROR] ${this.#prefixMessageWithID(message)}`;
        window.console.error(message);
    }

    /**
     * Destroys this WebViewer and all {@link View|Views}, {@link SceneModel|SceneModels}, {@link DataModel|DataModels} and {@link Plugin}s we've created within it.
     */
    destroy(): void {
        if (this.destroyed) {
            return;
        }
        scheduler.deregisterViewer(this);
        const pluginList = this.pluginList.slice(); // Array will modify as we delete plugins
        for (let i = 0, len = pluginList.length; i < len; i++) {
            const plugin = pluginList[i];
            plugin.destroy();
        }
        for (let id in this.views) {
            this.views[id].destroy();
        }
        this.scene.destroy();
        this.onTick.clear();
        this.onViewCreated.clear();
        this.onViewDestroyed.clear();
    }

    #prefixMessageWithID(message: string): string {
        return ` [${this.constructor.name} "${utils.inQuotes(this.id)}"]: ${message}`;
    }

    #registerView(view: View): void {
        if (this.views[view.id]) {
            return;
        }
        this.views[view.id] = view;
        for (let viewIndex = 0; ; viewIndex++) {
            if (!this.viewList[viewIndex]) {
                this.viewList[viewIndex] = view;
                this.numViews++;
                view.viewIndex = viewIndex;
                return;
            }
        }
    }

    #deregisterView(view: View): void {
        if (!this.views[view.id]) {
            return;
        }
        delete this.views[view.id];
        delete this.viewList[view.viewIndex];
        this.numViews--;
    }

    /**
     * @private
     * @param params
     */
    render(params: any) {
        for (let viewIndex = 0; viewIndex < this.viewList.length; viewIndex++) {
            this.renderer.render(viewIndex, {force: true});
        }
    }
}

