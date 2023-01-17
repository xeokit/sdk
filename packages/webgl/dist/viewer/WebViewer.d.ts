import { LocaleService } from "./localization/LocaleService";
import { Scene } from "./scene/index";
import { Data } from "./data/Data";
import { View } from "./view/View";
import type { Plugin } from "./Plugin";
import type * as math from "./math/index";
import type { Renderer } from "./scene/Renderer";
import type { WebViewerCapabilities } from "./WebViewerCapabilities";
import type { ViewParams } from "./ViewParams";
import { EventEmitter } from "./EventEmitter";
declare class TickParams {
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
export declare class WebViewer {
    #private;
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
    readonly views: {
        [key: string]: View;
    };
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
    readonly startTime: number;
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
    constructor(params?: {
        id?: string;
        units?: string;
        scale?: number;
        origin?: math.FloatArrayParam;
        localeService?: LocaleService;
        renderer?: Renderer;
    });
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
    createView(params: ViewParams): View | null;
    /**
     @private
     */
    registerPlugin(plugin: Plugin): void;
    /**
     @private
     */
    deregisterPlugin(plugin: Plugin): void;
    /**
     @private
     */
    sendToPlugins(name: string, value?: any): void;
    /**
     Trigger a redraw of all {@link View|Views} belonging to this WebViewer.

     @private
     */
    redraw(): void;
    /**
     Logs a console debugging message for this WebViewer.

     The console message will have this format: *````[LOG] [<component type> <component id>: <message>````*

     @private
     @param message - The message to log
     */
    log(message: string): void;
    /**
     Logs a warning for this WebViewer to the JavaScript console.

     The console message will have this format: *````[WARN] [<component type> =<component id>: <message>````*

     @private
     @param message - The warning message to log
     */
    warn(message: string): void;
    /**
     Logs an error for this WebViewer to the JavaScript console.

     The console message will have this format: *````[ERROR] [<component type> =<component id>: <message>````*

     @private
     @param message The error message to log
     */
    error(message: string): void;
    /**
     * Destroys this WebViewer and all {@link View|Views}, {@link SceneModel|SceneModels}, {@link DataModel|DataModels} and {@link Plugin}s we've created within it.
     */
    destroy(): void;
    /**
     * @private
     * @param params
     */
    render(params: any): void;
}
export {};
