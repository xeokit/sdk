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
import type {ViewerCapabilities} from "./ViewerCapabilities";
import type {ViewParams} from "./ViewParams";
import {WebGLRenderer} from "../webgl/WebGLRenderer";
import {EventDispatcher, IEvent} from "strongly-typed-events";
import {EventEmitter} from "./EventEmitter";

class TickParams {
}

/**
 * An extensible browser-based 3D viewer for AECO applications.
 *
 * ## Summary
 *
 * * Fast, double precision 3D rendering, in all major browsers
 * * Fast model loading from binary format
 * * Multiple canvases
 * * Super low memory footprint
 * * Semantic data model
 * * Open architecture
 *
 * ## Overview
 *
 * A ````Viewer```` has three main components:
 *
 *  * {@link Scene} - Contains geometric representations of models, with materials, textures, transforms etc.
 *  * {@link Data} - Contains optional semantic data models (e.g. IFC elements and property sets).
 *  * {@link View|Views} - One or more independently-configurable canvases viewing the models in {@link Scene}.
 *
 * We can also configure a ````Viewer```` with a custom {@link Renderer} strategy, in case we need to customize the way
 * the Viewer uses the underlying browser graphics API (e.g. WebGL, WebGPU) to create and render models.
 *
 * ## Examples
 *
 * ### Example 1: Basic Viewer
 *
 * Create a viewer:
 *
 * ````javascript
 * import {Viewer, constants} from "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-viewer/dist/xeokit-viewer.es.min.js";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer"
 * });
 * ````
 *
 * Create a view:
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
 * view1.camera.projection = PerspectiveProjectionType;
 * view1.cameraControl.navMode = "orbit";
 * ````
 *
 * Create a geometric model representation:
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
 *     id: "myObject",
 *     meshIds: ["myMesh"],
 *     viewLayerId: "main"
 *     //...
 * });
 *
 * mySceneModel.build();
 * ````
 *
 * Define optional semantic representation for the model:
 *
 * ````javascript
 * const myDataModel = myViewer.data.createModel({
 *     id: "myModel"
 * });
 *
 * myDataModel.createObject({
 *     id: "myObject",
 *     name: "Some object",
 *     type: "MyType"
 * });
 * ````
 *
 * Customize the view:
 *
 * ````javascript
 * view1.viewObjects["myObject"].highlighted = true;
 * ````
 */
export class Viewer {

    /**
     ID of this Viewer.
     */
    readonly id: string;

    /**
     True once this Viewer has been destroyed.

     Don't use this Viewer if this is ````true````.
     */
    readonly destroyed: boolean;

    /**
     * Indicates the capabilities of this Viewer.
     */
    readonly capabilities: ViewerCapabilities;

    /**
     * Emits an event each time a Viewer "tick" occurs (~10-60 times per second).
     *
     * @event
     */
    readonly onTick: EventEmitter<Viewer, TickParams>;

    /**
     * Emits an event each time a {@link View} is created.
     *
     * @event
     */
    readonly onViewCreated: EventEmitter<Viewer, View>;

    /**
     * Emits an event each time a {@link View} is destroyed.
     *
     * @event
     */
    readonly onViewDestroyed: EventEmitter<Viewer, View>;

    /**
     Provides locale string translations for this Viewer.

     This may be configured via the Viewer's constructor.

     By default, this service will be an instance of {@link LocaleService}, which will just return
     null translations for all given strings and phrases.
     */
    readonly localeService: LocaleService;

    /**
     Contains semantic data about models in this Viewer.
     */
    readonly data: Data;

    /**
     Contains geometry and materials for models in this viewer.
     */
    readonly scene: Scene;

    /**
     * Map of all the Views in this Viewer.
     *
     * Each {@link View} is an independently configurable view of the Viewer's models, with its own canvas, camera position, section planes, lights, and object visual states.
     */
    readonly views: { [key: string]: View };

    /**
     * List of all the Views in this Viewer.
     *
     * Each {@link View} is an independently configurable view of the Viewer's models, with its own canvas, camera position, section planes, lights, and object visual states.
     */
    readonly viewList: View[];

    /**
     *  The number of {@link View|Views} belonging to this Viewer.
     */
    numViews: number;

    /**
     List of {@link Plugin}s installed in this Viewer.
     @private
     */
    readonly pluginList: Plugin[];

    /**
     The time that this Viewer was created.
     */
    readonly startTime: number = (new Date()).getTime();

    /**
     * @private
     */
    readonly renderer: Renderer;

    /**
     Creates a Viewer.

     @param params - Viewer configuration.
     @param params.id - ID for this Viewer, automatically generated by default.
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

        this.onTick = new EventEmitter(new EventDispatcher<Viewer, TickParams>());

        this.onViewCreated = new EventEmitter(new EventDispatcher<Viewer, View>());

        this.onViewDestroyed = new EventEmitter(new EventDispatcher<Viewer, View>());

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
     * Creates a new {@link View} within this Viewer.
     *
     * * The maximum number of views you're allowed to create is provided in {@link ViewerCapabilities.maxViews}. This
     * will be determined by the {@link Renderer} implementation the Viewer is configured with.
     * * To destroy the View after use, call {@link View.destroy}.
     * * You must add a View to the Viewer before you can create or load content into the Viewer's Scene.
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
     Trigger a redraw of all {@link View|Views} belonging to this Viewer.

     @private
     */
    redraw(): void {
        for (let id in this.views) {
            this.views[id].redraw();
        }
    }

    /**
     Logs a console debugging message for this Viewer.

     The console message will have this format: *````[LOG] [<component type> <component id>: <message>````*

     @private
     @param message - The message to log
     */
    log(message: string): void {
        message = `[LOG] ${this.#prefixMessageWithID(message)}`;
        window.console.log(message);
    }

    /**
     Logs a warning for this Viewer to the JavaScript console.

     The console message will have this format: *````[WARN] [<component type> =<component id>: <message>````*

     @private
     @param message - The warning message to log
     */
    warn(message: string): void {
        message = `[WARN] ${this.#prefixMessageWithID(message)}`;
        window.console.warn(message);
    }

    /**
     Logs an error for this Viewer to the JavaScript console.

     The console message will have this format: *````[ERROR] [<component type> =<component id>: <message>````*

     @private
     @param message The error message to log
     */
    error(message: string): void {
        message = `[ERROR] ${this.#prefixMessageWithID(message)}`;
        window.console.error(message);
    }

    /**
     * Destroys this Viewer and all {@link View|Views}, {@link SceneModel|SceneModels}, {@link DataModel}s and {@link Plugin}s we've created within it.
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

