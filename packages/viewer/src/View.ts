import {EventDispatcher} from "strongly-typed-events";
import {Component, EventEmitter, SDKError} from "@xeokit/core";
import {createUUID} from "@xeokit/utils";
import {FastRender, QualityRender} from "@xeokit/constants";
import type {FloatArrayParam, IntArrayParam} from "@xeokit/math";
import {createVec3} from "@xeokit/matrix";
import type {Scene, SceneModel} from "@xeokit/scene";

import {ViewObject} from "./ViewObject";
import {SectionPlane} from "./SectionPlane";
import type {Viewer} from "./Viewer";
import {Metrics} from "./Metriqs";
import {SAO} from "./SAO";
import {Texturing} from "./Texturing";
import {LinesMaterial} from "./LinesMaterial";
import {ViewLayer} from "./ViewLayer";
import type {ViewLayerParams} from "./ViewLayerParams";
import type {SectionPlaneParams} from "./SectionPlaneParams";
import {EmphasisMaterial} from "./EmphasisMaterial";
import {Edges} from "./Edges";
import {PointsMaterial} from "./PointsMaterial";
import {Camera} from "./Camera";
import type {PointLight} from "./PointLight";
import {CameraFlightAnimation} from "./CameraFlightAnimation";
import type {AmbientLight} from "./AmbientLight";
import type {DirLight} from "./DirLight";
import type {RendererObject} from "@xeokit/scene/src/RendererObject";
import type {PickParams} from "./PickParams";
import type {PickResult} from "./PickResult";
import {SnapshotResult} from "./SnapshotResult";
import type {SnapshotParams} from "./SnapshotParams";
import {ResolutionScale} from "./ResolutionScale";

/**
 * An independently-configurable view of the models in a {@link @xeokit/viewer!Viewer}.
 *
 * See {@link "@xeokit/viewer" | @xeokit/viewer} for usage.
 *
 * ## Overview
 *
 * A View is an independently-configurable view of the {@link RendererObject | ViewerObjects} existing within a Viewer, with
 * its own HTML canvas. A View automatically contains a {@link @xeokit/viewer!ViewObject} for each existing ViewerObject. ViewObjects
 * function as a kind of proxy for the ViewerObjects, through which we control their appearance
 * (show/hide/highlight etc.) within that particular View's canvas.
 *
 * Using Views, we can essentially have multiple canvases viewing the same model, each canvas perhaps showing a different subset
 * of the objects, with different visual effects, camera position etc.
 *
 * ## Quickstart
 *
 * * Create a View with {@link Viewer.createView}
 * * Control the View's viewpoint and projection with {@link View.camera}
 * * Create light sources with {@link View.createLightSource}
 * * Create slicing planes with {@link View createSectionPlane}
 * * Each View automatically has a {@link @xeokit/viewer!ViewObject} for every {@link RendererObject}
 * * Uses {@link @xeokit/viewer!ViewLayer | ViewLayers} to organize ViewObjects into layers
 * * Optionally uses ViewLayers to mask which ViewObjects are automatically maintained
 * * Control the visibility of ViewObjects with {@link View.setObjectsVisible}
 * * Emphasise ViewObjects with {@link View.setObjectsHighlighted}, {@link View.setObjectsSelected}, {@link View.setObjectsXRayed} and {@link View.setObjectsColorized}
 *
 * ## Examples
 *
 * Create a view in a given canvas, with three objects visible and a couple of object X-rayed (rendered translucent):
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *      id: "myView",
 *      canvasId: "myView1"
 * });
 *
 * view1.camera.eye = [-3.933, 2.855, 27.018];
 * view1.camera.look = [4.400, 3.724, 8.899];
 * view1.camera.up = [-0.018, 0.999, 0.039];
 *
 * view1.setObjectsVisible(["myObject1", "myObject2", "myObject3", ...], true);
 * view1.setObjectsXRayed(["myObject1", "myObject", ...], true);
 * ````
 *
 * Create a second view, using a different canvas, that shows two objects visible, with one of them highlighted:
 *
 * ```` javascript
 * const view2 = myViewer.createView({
 *      id: "myView2",
 *      canvasId: "myView2"
 * });
 *
 * view2.camera.eye = [-1.4, 1.5, 15.8];
 * view2.camera.look = [4.0, 3.7, 1.8];
 * view2.camera.up = [0.0, 0.9, 0.0];
 *
 * view2.setObjectsVisible(["myObject1", "myObject3", ...], true);
 * view2.setObjectsHighlighted(["myObject3", ...], true);
 * ````
 */
class View extends Component {

    /**
     ID of this View, unique within the {@link @xeokit/viewer!Viewer}.
     */
    declare viewId: string;

    /**
     * The Viewer to which this View belongs.
     */
    declare readonly viewer: Viewer;

    /**
     * The index of this View in {@link Viewer.viewList}.
     * @private
     */
    viewIndex: number;

    /**
     * Manages the Camera for this View.
     */
    readonly camera: Camera;

    /**
     * The HTML canvas.
     */
    public canvasElement: HTMLCanvasElement;

    /**
     * Indicates if this View is transparent.
     */
    public readonly transparent: boolean;

    /**
     * Boundary of the canvas in absolute browser window coordinates.
     * Format is ````[xmin, ymin, xwidth, ywidth]````.
     */
    public readonly boundary: number[];

    /**
     * Whether the logarithmic depth buffer is enabled for this View.
     */
    readonly logarithmicDepthBufferEnabled: boolean;

    /**
     * Configures Scalable Ambient Obscurance (SAO) for this View.
     */
    readonly sao: SAO;

    /**
     * Configures when textures are rendered for this View.
     */
    readonly texturing: Texturing;

    /**
     * Flies or jumps the View's {@link @xeokit/viewer!Camera}  to given positions.
     */
    readonly cameraFlight: CameraFlightAnimation;

    /**
     * Manages measurement units, origin and scale for this View.
     */
    readonly metrics: Metrics;

    /**
     * Configures the X-rayed appearance of {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    readonly xrayMaterial: EmphasisMaterial;

    /**
     * Configures the highlighted appearance of {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    readonly highlightMaterial: EmphasisMaterial;

    /**
     * Configures the appearance of {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    readonly selectedMaterial: EmphasisMaterial;

    /**
     * Configures the appearance of edges belonging to {@link @xeokit/viewer!ViewObject} in this View.
     */
    readonly edges: Edges;

    /**
     * Configures resolution scaling for this View.
     */
    readonly resolutionScale: ResolutionScale;

    /**
     * Configures the appearance of point primitives belonging to {@link @xeokit/viewer!ViewObject | ViewObjects} in this View .
     */
    readonly pointsMaterial: PointsMaterial;

    /**
     * Configures the appearance of lines belonging to {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    readonly linesMaterial: LinesMaterial;

    /**
     * Map of the all {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     *
     * The View automatically ensures that there is a {@link @xeokit/viewer!ViewObject} here for
     * each {@link RendererObject} in the {@link @xeokit/viewer!Viewer}
     */
    readonly objects: { [key: string]: ViewObject };

    /**
     * Map of the currently visible {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * A ViewObject is visible when {@link @xeokit/viewer!ViewObject.visible} is true.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     */
    readonly visibleObjects: { [key: string]: ViewObject };

    /**
     * Map of currently x-rayed {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * A ViewObject is x-rayed when {@link @xeokit/viewer!ViewObject.xrayed} is true.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     */
    readonly xrayedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently highlighted {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * A ViewObject is highlighted when {@link @xeokit/viewer!ViewObject.highlighted} is true.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     */
    readonly highlightedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently selected {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * A ViewObject is selected when {@link @xeokit/viewer!ViewObject.selected} is true.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     */
    readonly selectedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently colorized {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     */
    readonly colorizedObjects: { [key: string]: ViewObject };

    /**
     * Map of {@link @xeokit/viewer!ViewObject | ViewObjects} in this View whose opacity has been updated.
     *
     * Each {@link @xeokit/viewer!ViewObject} is mapped here by {@link @xeokit/viewer!ViewObject.id}.
     */
    readonly opacityObjects: { [key: string]: ViewObject };

    /**
     * Map of {@link SectionPlane}s in this View.
     *
     * Each {@link SectionPlane} is mapped here by {@link SectionPlane.id}.
     */
    readonly sectionPlanes: { [key: string]: SectionPlane };

    /**
     * List of {@link SectionPlane}s in this View.
     */
    readonly sectionPlanesList: SectionPlane[] = [];

    /**
     * Map of light sources in this View.
     */
    readonly lights: { [key: string]: AmbientLight | PointLight | DirLight };

    /**
     * List of light sources in this View.
     */
    readonly lightsList: (AmbientLight | PointLight | DirLight)[] = [];

    gammaOutput: boolean;

    /**
     * Map of the all {@link @xeokit/viewer!ViewLayer}s in this View.
     *
     * Each {@link @xeokit/viewer!ViewLayer} is mapped here by {@link @xeokit/viewer!ViewLayer.id}.
     */
    readonly layers: { [key: string]: ViewLayer };

    /**
     * Whether the View will automatically create {@link @xeokit/viewer!ViewLayer | ViewLayers} on-demand
     * as {@link RendererObject | ViewerObjects} are created.
     *
     * When ````true```` (default), the View will automatically create {@link @xeokit/viewer!ViewLayer | ViewLayers} as needed for each new
     * {@link RendererObject.layerId} encountered, including a "default" ViewLayer for ViewerObjects that have no
     * layerId. This default setting therefore ensures that a ViewObject is created in the View for every SceneObject that is created.
     *
     * If you set this ````false````, however, then the View will only create {@link @xeokit/viewer!ViewObject | ViewObjects} for {@link RendererObject | ViewerObjects} that have
     * a {@link RendererObject.layerId} that matches the ID of a {@link @xeokit/viewer!ViewLayer} that you have explicitly created previously with {@link View.createLayer}.
     *
     * Setting this parameter false enables Views to contain only the ViewObjects that they actually need to show, i.e. to represent only
     * ViewerObjects that they need to view. This enables a View to avoid wastefully creating and maintaining ViewObjects for ViewerObjects
     * that it never needs to show.
     */
    readonly autoLayers: boolean;

    /**
     * Emits an event each time the canvas boundary changes.
     *
     * @event
     */
    readonly onBoundary: EventEmitter<View, IntArrayParam>;

    /**
     * Emits an event each time a {@link @xeokit/viewer!ViewObject} is created in this View.
     *
     * @event
     */
    readonly onObjectCreated: EventEmitter<View, ViewObject>;

    /**
     * Emits an event each time a {@link @xeokit/viewer!ViewObject} is destroyed in this View.
     *
     * @event
     */
    readonly onObjectDestroyed: EventEmitter<View, ViewObject>;

    /**
     * Emits an event each time the visibility of a {@link @xeokit/viewer!ViewObject} changes in this View.
     *
     * ViewObjects are shown and hidden with {@link View.setObjectsVisible}, {@link @xeokit/viewer!ViewLayer.setObjectsVisible} or {@link @xeokit/viewer!ViewObject.visible}.
     *
     * @event
     */
    readonly onObjectVisibility: EventEmitter<View, ViewObject>;

    /**
     * Emits an event each time the X-ray state of a {@link @xeokit/viewer!ViewObject} changes in this View.
     *
     * ViewObjects are X-rayed with {@link View.setObjectsXRayed}, {@link @xeokit/viewer!ViewLayer.setObjectsXRayed} or {@link @xeokit/viewer!ViewObject.xrayed}.
     *
     * @event
     */
    readonly onObjectXRayed: EventEmitter<View, ViewObject>;

    /**
     * Emits an event each time a {@link @xeokit/viewer!ViewLayer} is created in this View.
     *
     * Layers are created explicitly with {@link View.createLayer}, or implicitly with {@link View.createModel} and {@link CreateModelParams.layerId}.
     *
     * @event
     */
    readonly onLayerCreated: EventEmitter<View, ViewLayer>;

    /**
     * Emits an event each time a {@link @xeokit/viewer!ViewLayer} in this View is destroyed.
     *
     * ViewLayers are destroyed explicitly with {@link @xeokit/viewer!ViewLayer.destroy}, or implicitly when they become empty and {@link View.autoLayers} is false.
     *
     * @event
     */
    readonly onLayerDestroyed: EventEmitter<View, ViewLayer>;

    /**
     * Emits an event each time a {@link SectionPlane} is created in this View.
     *
     * @event
     */
    readonly onSectionPlaneCreated: EventEmitter<View, SectionPlane>;

    /**
     * Emits an event each time a {@link SectionPlane} in this View is destroyed.
     *
     * @event
     */
    readonly onSectionPlaneDestroyed: EventEmitter<View, SectionPlane>;

    #onTick: () => void;

    #renderMode: number = QualityRender;

    #backgroundColor: FloatArrayParam;
    #backgroundColorFromAmbientLight: boolean;
    #numObjects: number;
    #objectIds: string[] | null;
    #numVisibleObjects: number;
    #visibleObjectIds: string[] | null;
    #numXRayedObjects: number;
    #xrayedObjectIds: string[] | null;
    #numHighlightedObjects: number;
    #highlightedObjectIds: string[] | null;
    #numSelectedObjects: number;
    #selectedObjectIds: string[] | null;
    #numColorizedObjects: number;
    #colorizedObjectIds: string[] | null;
    #numOpacityObjects: number;
    #opacityObjectIds: string[] | null;
    #qualityRender: boolean;
    #lightsHash: string | null = null;
    #sectionPlanesHash: string | null = null;

    /**
     * @private
     */
    constructor(options: {
        viewer: Viewer;
        origin?: number[];
        scale?: number;
        units?: number;
        canvasId?: string;
        canvasElement: HTMLCanvasElement;
        backgroundColor?: any[];
        backgroundColorFromAmbientLight?: boolean;
        premultipliedAlpha?: boolean;
        transparent?: boolean;
        qualityRender?: boolean;
        logarithmicDepthBufferEnabled?: boolean;
        autoLayers?: boolean;
    }) {
        super(null, options);

        this.viewer = options.viewer;

        const canvas =
            options.canvasElement ||
            document.getElementById(<string>options.canvasId);

        if (!(canvas instanceof HTMLCanvasElement)) {
            throw "Mandatory View config expected: valid canvasId or canvasElement";
        }

        this.canvasElement = canvas;
        this.viewIndex = 0;
        this.objects = {};
        this.visibleObjects = {};
        this.xrayedObjects = {};
        this.highlightedObjects = {};
        this.selectedObjects = {};
        this.colorizedObjects = {};
        this.opacityObjects = {};
        this.sectionPlanes = {};
        this.sectionPlanesList = [];
        this.lights = {};
        this.lightsList = [];
        this.layers = {};

        this.#numObjects = 0;
        this.#objectIds = null;
        this.#numVisibleObjects = 0;
        this.#visibleObjectIds = null;
        this.#numXRayedObjects = 0;
        this.#xrayedObjectIds = null;
        this.#numHighlightedObjects = 0;
        this.#highlightedObjectIds = null;
        this.#numSelectedObjects = 0;
        this.#selectedObjectIds = null;
        this.#numColorizedObjects = 0;
        this.#colorizedObjectIds = null;
        this.#numOpacityObjects = 0;
        this.#opacityObjectIds = null;
        this.#qualityRender = !!options.qualityRender;
        this.gammaOutput = true;

        this.#sectionPlanesHash = null;
        this.#lightsHash = null;

        // this.canvas = new View(this, {
        //     canvas: canvas,
        //     transparent: !!options.transparent,
        //     backgroundColor: options.backgroundColor,
        //     backgroundColorFromAmbientLight: !!options.backgroundColorFromAmbientLight,
        //     premultipliedAlpha: !!options.premultipliedAlpha
        // });
        //
        // this.canvas.onBoundary.subscribe(() => {
        //     this.redraw();
        // });

        this.onBoundary = new EventEmitter(
            new EventDispatcher<View, IntArrayParam>()
        );

        this.#backgroundColor = createVec3([
            options.backgroundColor ? options.backgroundColor[0] : 1,
            options.backgroundColor ? options.backgroundColor[1] : 1,
            options.backgroundColor ? options.backgroundColor[2] : 1,
        ]);
        this.#backgroundColorFromAmbientLight =
            !!options.backgroundColorFromAmbientLight;
        this.transparent = !!options.transparent;
        this.canvasElement.width = this.canvasElement.clientWidth;
        this.canvasElement.height = this.canvasElement.clientHeight;
        this.boundary = [
            this.canvasElement.offsetLeft,
            this.canvasElement.offsetTop,
            this.canvasElement.clientWidth,
            this.canvasElement.clientHeight,
        ];

        // Publish canvasElement size and position changes on each scene tick

        let lastWindowWidth = 0;
        let lastWindowHeight = 0;
        let lastViewWidth = 0;
        let lastViewHeight = 0;
        let lastViewOffsetLeft = 0;
        let lastViewOffsetTop = 0;
        let lastParent: null | HTMLElement = null;

        let lastResolutionScale: null | number = null;

        this.#onTick = this.viewer.onTick.subscribe(() => {
            const canvasElement = this.canvasElement;
            const newResolutionScale = this.resolutionScale.resolutionScale !== lastResolutionScale;
            const newWindowSize =
                window.innerWidth !== lastWindowWidth ||
                window.innerHeight !== lastWindowHeight;
            const newViewSize =
                canvasElement.clientWidth !== lastViewWidth ||
                canvasElement.clientHeight !== lastViewHeight;
            const newViewPos =
                canvasElement.offsetLeft !== lastViewOffsetLeft ||
                canvasElement.offsetTop !== lastViewOffsetTop;
            const parent = canvasElement.parentElement;
            const newParent = parent !== lastParent;

            if (
                newResolutionScale ||
                newWindowSize ||
                newViewSize ||
                newViewPos ||
                newParent
            ) {
                //   this._spinner._adjustPosition();
                if (newResolutionScale || newViewSize || newViewPos) {
                    const newWidth = canvasElement.clientWidth;
                    const newHeight = canvasElement.clientHeight;
                    if (newResolutionScale || newViewSize) {
                        //////////////////////////////////////////////////////////////////////////////////////
                        // TODO: apply resolutionscale properly
                        //////////////////////////////////////////////////////////////////////////////////////
                        canvasElement.width = Math.round(
                            canvasElement.clientWidth * this.resolutionScale.resolutionScale
                        );
                        canvasElement.height = Math.round(
                            canvasElement.clientHeight * this.resolutionScale.resolutionScale
                        );
                    }
                    const boundary = this.boundary;
                    boundary[0] = canvasElement.offsetLeft;
                    boundary[1] = canvasElement.offsetTop;
                    boundary[2] = newWidth;
                    boundary[3] = newHeight;
                    if (!newResolutionScale || newViewSize) {
                        this.onBoundary.dispatch(this, boundary);
                    }
                    lastViewWidth = newWidth;
                    lastViewHeight = newHeight;
                }

                if (newResolutionScale) {
                    //   lastResolutionScale = this.#resolutionScale;
                }
                if (newWindowSize) {
                    lastWindowWidth = window.innerWidth;
                    lastWindowHeight = window.innerHeight;
                }
                if (newViewPos) {
                    lastViewOffsetLeft = canvasElement.offsetLeft;
                    lastViewOffsetTop = canvasElement.offsetTop;
                }
                lastParent = parent;
            }
        });

        this.camera = new Camera(this);

        this.sao = new SAO(this, {});

        this.texturing = new Texturing(this, {});

        this.cameraFlight = new CameraFlightAnimation(this, {
            duration: 0.5,
        });

        this.metrics = new Metrics(this, {
            units: options.units,
            scale: options.scale,
            origin: options.origin,
        });

        this.xrayMaterial = new EmphasisMaterial(this, {
            fill: true,
            fillColor: [0.9, 0.7, 0.6],
            fillAlpha: 0.4,
            edges: true,
            edgeColor: [0.5, 0.4, 0.4],
            edgeAlpha: 1.0,
            edgeWidth: 1,
        });

        this.highlightMaterial = new EmphasisMaterial(this, {
            fill: true,
            fillColor: [1.0, 1.0, 0.0],
            fillAlpha: 0.5,
            edges: true,
            edgeColor: [0.5, 0.4, 0.4],
            edgeAlpha: 1.0,
            edgeWidth: 1,
        });

        this.selectedMaterial = new EmphasisMaterial(this, {
            fill: true,
            fillColor: [0.0, 1.0, 0.0],
            fillAlpha: 0.5,
            edges: true,
            edgeColor: [0.4, 0.5, 0.4],
            edgeAlpha: 1.0,
            edgeWidth: 1,
        });

        this.edges = new Edges(this, {
            edgeColor: [0.0, 0.0, 0.0],
            edgeAlpha: 1.0,
            edgeWidth: 1,
            enabled: true,
            renderModes: [QualityRender],
        });

        this.resolutionScale = new ResolutionScale(this, {
            enabled: true,
            renderModes: [FastRender],
            resolutionScale: 0.5
        });

        this.pointsMaterial = new PointsMaterial(this, {
            pointSize: 1,
            roundPoints: true,
            perspectivePoints: true,
            minPerspectivePointSize: 1,
            maxPerspectivePointSize: 6,
            filterIntensity: false,
            minIntensity: 0,
            maxIntensity: 1,
        });

        this.linesMaterial = new LinesMaterial(this, {
            lineWidth: 1,
        });

        this.lights = {};

        this.#qualityRender = !!options.qualityRender;

        this.autoLayers = options.autoLayers !== false;

        this.logarithmicDepthBufferEnabled =
            !!options.logarithmicDepthBufferEnabled;

        this.onObjectCreated = new EventEmitter(
            new EventDispatcher<View, ViewObject>()
        );

        this.onObjectDestroyed = new EventEmitter(
            new EventDispatcher<View, ViewObject>()
        );

        this.onObjectVisibility = new EventEmitter(
            new EventDispatcher<View, ViewObject>()
        );

        this.onObjectXRayed = new EventEmitter(
            new EventDispatcher<View, ViewObject>()
        );

        this.onLayerCreated = new EventEmitter(
            new EventDispatcher<View, ViewLayer>()
        );

        this.onLayerDestroyed = new EventEmitter(
            new EventDispatcher<View, ViewLayer>()
        );

        this.onSectionPlaneCreated = new EventEmitter(
            new EventDispatcher<View, SectionPlane>()
        );

        this.onSectionPlaneDestroyed = new EventEmitter(
            new EventDispatcher<View, SectionPlane>()
        );
    }

    /**
     * @private
     */
    initViewObjects() {
        for (const id in this.viewer.scene.models) {
            this.#createViewObjectsForSceneModel(this.viewer.scene.models[id]);
        }
        this.viewer.scene.onModelCreated.subscribe((scene: Scene, sceneModel: SceneModel) => {
                this.#createViewObjectsForSceneModel(sceneModel);
            }
        );
        this.viewer.scene.onModelDestroyed.subscribe((scene: Scene, sceneModel: SceneModel) => {
                this.#destroyViewObjectsForSceneModel(sceneModel);
            }
        );
    }

    #createViewObjectsForSceneModel(sceneModel: SceneModel) {
        // The Renderer has a RendererObject for each object, through which a ViewObject can
        // push state changes into the Renderer for its object.
        // The RendererObject
        const sceneObjects = sceneModel.objects;
        const rendererObjects = this.viewer.renderer.rendererObjects;
        for (let id in sceneObjects) {
            const sceneObject = sceneObjects[id];
            const rendererObject = rendererObjects[id];
            const layerId = sceneObject.layerId || "default";
            let viewLayer = this.layers[layerId];
            if (!viewLayer) {
                if (!this.autoLayers) {
                    continue;
                }
                viewLayer = new ViewLayer({
                    id: layerId,
                    view: this,
                    viewer: this.viewer,
                });
                this.layers[layerId] = viewLayer;
                viewLayer.onDestroyed.one(() => {
                    delete this.layers[viewLayer.id];
                    this.onLayerDestroyed.dispatch(this, viewLayer);
                });
                this.onLayerCreated.dispatch(this, viewLayer);
            }
            const viewObject = new ViewObject(viewLayer, sceneObject, rendererObject);
            viewLayer.registerViewObject(viewObject);
            this.registerViewObject(viewObject);
            this.onObjectCreated.dispatch(this, viewObject);
        }
    }

    /**
     * Sets which rendering mode this View is in.
     *
     * Supported rendering modes are:
     *
     * * {@link @xeokit/constants!FastRender | FastRender} - Fast rendering mode for smooth interactivity.
     * * {@link @xeokit/constants!QualityRender | QualityRender} - Quality rendering mode for maximum image fidelity.
     *
     * Default value is {@link @xeokit/constants!QualityRender | QualityRender}.
     *
     * @param renderMode The rendering mode
     * @returns *{@link @xeokit/core!SDKError}*
     * * Rendering mode not supported.
     */
    setRenderMode(renderMode: number): SDKError | void {
        if (renderMode !== QualityRender && renderMode !== FastRender) {
            return new SDKError(`Failed to set render mode for View - unsupported mode - supported modes are FastRender and QualityRender`);
        }
        this.#renderMode = renderMode;
    }

    /**
     * Gets which rendering mode this View is in.
     *
     * Supported rendering modes are:
     *
     * * {@link @xeokit/constants!FastRender | FastRender} - Fast rendering mode for smooth interactivity.
     * * {@link @xeokit/constants!QualityRender | QualityRender} - Quality rendering mode for maximum image fidelity.
     *
     * Default value is {@link @xeokit/constants!QualityRender | QualityRender}.
     */
    get renderMode(): number {
        return this.#renderMode;
    }

    /**
     *
     */
    get aabb(): FloatArrayParam {
        return this.viewer.scene.aabb;
    }

    /**
     * Gets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     */
    get backgroundColor(): FloatArrayParam {
        return this.#backgroundColor;
    }

    /**
     * Sets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     */
    set backgroundColor(value: FloatArrayParam) {
        if (value) {
            this.#backgroundColor[0] = value[0];
            this.#backgroundColor[1] = value[1];
            this.#backgroundColor[2] = value[2];
        } else {
            this.#backgroundColor[0] = 1.0;
            this.#backgroundColor[1] = 1.0;
            this.#backgroundColor[2] = 1.0;
        }
        this.redraw();
    }

    /**
     * Gets whether the canvas clear color will be derived from {@link AmbientLight} or {@link View#backgroundColor}
     * when {@link View#transparent} is ```true```.
     *
     * When {@link View#transparent} is ```true``` and this is ````true````, then the canvas clear color will
     * be taken from the ambient light color.
     *
     * When {@link View#transparent} is ```true``` and this is ````false````, then the canvas clear color will
     * be taken from {@link View#backgroundColor}.
     *
     * Default value is ````true````.
     */
    get backgroundColorFromAmbientLight(): boolean {
        return this.#backgroundColorFromAmbientLight;
    }

    /**
     * Sets if the canvas background color is derived from an {@link AmbientLight}.
     *
     * This only has effect when the canvas is not transparent. When not enabled, the background color
     * will be the canvas element's HTML/CSS background color.
     *
     * Default value is ````true````.
     */
    set backgroundColorFromAmbientLight(
        backgroundColorFromAmbientLight: boolean
    ) {
        this.#backgroundColorFromAmbientLight =
            backgroundColorFromAmbientLight !== false;
    }

    /**
     * Gets the gamma factor.
     */
    get gammaFactor() {
        // TODO
        return 1.0;
    }

    /**
     * Gets whether quality rendering is enabled for this View.
     *
     * Default is ````false````.
     */
    get qualityRender(): boolean {
        return this.#qualityRender;
    }

    /**
     * Sets whether quality rendering is enabled for this View.
     *
     * Default is ````false````.
     */
    set qualityRender(value: boolean) {
        if (this.#qualityRender === value) {
            return;
        }
        this.#qualityRender = value;
        this.redraw();
    }

    /**
     * Gets the number of {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    get numObjects(): number {
        return this.#numObjects;
    }

    /**
     * Gets the IDs of the {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    get objectIds(): string[] {
        if (!this.#objectIds) {
            this.#objectIds = Object.keys(this.objects);
        }
        return this.#objectIds;
    }

    /**
     * Gets the number of visible {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    get numVisibleObjects(): number {
        return this.#numVisibleObjects;
    }

    /**
     * Gets the IDs of the visible {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    get visibleObjectIds(): string[] {
        if (!this.#visibleObjectIds) {
            this.#visibleObjectIds = Object.keys(this.visibleObjects);
        }
        return this.#visibleObjectIds;
    }

    /**
     * Gets the number of X-rayed {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    get numXRayedObjects(): number {
        return this.#numXRayedObjects;
    }

    /**
     * Gets the IDs of the X-rayed {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    get xrayedObjectIds(): string[] {
        if (!this.#xrayedObjectIds) {
            this.#xrayedObjectIds = Object.keys(this.xrayedObjects);
        }
        return this.#xrayedObjectIds;
    }

    /**
     * Gets the number of highlighted {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    get numHighlightedObjects(): number {
        return this.#numHighlightedObjects;
    }

    /**
     * Gets the IDs of the highlighted {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    get highlightedObjectIds(): string[] {
        if (!this.#highlightedObjectIds) {
            this.#highlightedObjectIds = Object.keys(this.highlightedObjects);
        }
        return this.#highlightedObjectIds;
    }

    /**
     * Gets the number of selected {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    get numSelectedObjects(): number {
        return this.#numSelectedObjects;
    }

    /**
     * Gets the IDs of the selected {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    get selectedObjectIds(): string[] {
        if (!this.#selectedObjectIds) {
            this.#selectedObjectIds = Object.keys(this.selectedObjects);
        }
        return this.#selectedObjectIds;
    }

    /**
     * Gets the number of colorized {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    get numColorizedObjects(): number {
        return this.#numColorizedObjects;
    }

    /**
     * Gets the IDs of the colorized {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     */
    get colorizedObjectIds(): string[] {
        if (!this.#colorizedObjectIds) {
            this.#colorizedObjectIds = Object.keys(this.colorizedObjects);
        }
        return this.#colorizedObjectIds;
    }

    /**
     * Gets the IDs of the {@link @xeokit/viewer!ViewObject | ViewObjects} in this View that have updated opacities.
     */
    get opacityObjectIds(): string[] {
        if (!this.#opacityObjectIds) {
            this.#opacityObjectIds = Object.keys(this.opacityObjects);
        }
        return this.#opacityObjectIds;
    }

    /**
     * Gets the number of {@link @xeokit/viewer!ViewObject | ViewObjects} in this View that have updated opacities.
     */
    get numOpacityObjects(): number {
        return this.#numOpacityObjects;
    }

    /**
     * @private
     */
    registerViewObject(viewObject: ViewObject) {
        this.objects[viewObject.id] = viewObject;
        this.#numObjects++;
        this.#objectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    deregisterViewObject(viewObject: ViewObject) {
        delete this.objects[viewObject.id];
        delete this.visibleObjects[viewObject.id];
        delete this.xrayedObjects[viewObject.id];
        delete this.highlightedObjects[viewObject.id];
        delete this.selectedObjects[viewObject.id];
        delete this.colorizedObjects[viewObject.id];
        delete this.opacityObjects[viewObject.id];
        this.#numObjects--;
        this.#objectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    objectVisibilityUpdated(
        viewObject: ViewObject,
        visible: boolean,
        notify: boolean = true
    ) {
        if (visible) {
            this.visibleObjects[viewObject.id] = viewObject;
            this.#numVisibleObjects++;
        } else {
            delete this.visibleObjects[viewObject.id];
            this.#numVisibleObjects--;
        }
        this.#visibleObjectIds = null; // Lazy regenerate
        if (notify) {
            this.onObjectVisibility.dispatch(this, viewObject);
        }
    }

    /**
     * @private
     */
    objectXRayedUpdated(
        viewObject: ViewObject,
        xrayed: boolean,
        notify: boolean = true
    ) {
        if (xrayed) {
            this.xrayedObjects[viewObject.id] = viewObject;
            this.#numXRayedObjects++;
        } else {
            delete this.xrayedObjects[viewObject.id];
            this.#numXRayedObjects--;
        }
        this.#xrayedObjectIds = null; // Lazy regenerate
        if (notify) {
            this.onObjectXRayed.dispatch(this, viewObject);
        }
    }

    /**
     * @private
     */
    objectHighlightedUpdated(viewObject: ViewObject, highlighted: boolean) {
        if (highlighted) {
            this.highlightedObjects[viewObject.id] = viewObject;
            this.#numHighlightedObjects++;
        } else {
            delete this.highlightedObjects[viewObject.id];
            this.#numHighlightedObjects--;
        }
        this.#highlightedObjectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    objectSelectedUpdated(viewObject: ViewObject, selected: boolean) {
        if (selected) {
            this.selectedObjects[viewObject.id] = viewObject;
            this.#numSelectedObjects++;
        } else {
            delete this.selectedObjects[viewObject.id];
            this.#numSelectedObjects--;
        }
        this.#selectedObjectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    objectColorizeUpdated(viewObject: ViewObject, colorized: boolean) {
        if (colorized) {
            this.colorizedObjects[viewObject.id] = viewObject;
            this.#numColorizedObjects++;
        } else {
            delete this.colorizedObjects[viewObject.id];
            this.#numColorizedObjects--;
        }
        this.#colorizedObjectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    objectOpacityUpdated(viewObject: ViewObject, opacityUpdated: boolean) {
        if (opacityUpdated) {
            this.opacityObjects[viewObject.id] = viewObject;
            this.#numOpacityObjects++;
        } else {
            delete this.opacityObjects[viewObject.id];
            this.#numOpacityObjects--;
        }
        this.#opacityObjectIds = null; // Lazy regenerate
    }

    /**
     * Creates a {@link SectionPlane} in this View.
     *
     * @param sectionPlaneParams
     */
    createSectionPlane(sectionPlaneParams: SectionPlaneParams): SectionPlane {
        let id = sectionPlaneParams.id || createUUID();
        if (this.sectionPlanes[id]) {
            this.error(
                `SectionPlane with ID "${id}" already exists - will randomly-generate ID`
            );
            id = createUUID();
        }
        const sectionPlane = new SectionPlane(this, sectionPlaneParams);
        this.#registerSectionPlane(sectionPlane);
        sectionPlane.onDestroyed.one(() => {
            this.#deregisterSectionPlane(sectionPlane);
        });
        return sectionPlane;
    }

    /**
     * Destroys the {@link SectionPlane}s in this View.
     */
    clearSectionPlanes(): void {
        const objectIds = Object.keys(this.sectionPlanes);
        for (let i = 0, len = objectIds.length; i < len; i++) {
            this.sectionPlanes[objectIds[i]].destroy();
        }
        this.sectionPlanesList.length = 0;
        this.#sectionPlanesHash = null;
    }

    /**
     * @private
     */
    getSectionPlanesHash() {
        if (this.#sectionPlanesHash) {
            return this.#sectionPlanesHash;
        }
        if (this.sectionPlanesList.length === 0) {
            return (this.#sectionPlanesHash = ";");
        }
        let sectionPlane;
        const hashParts = [];
        for (let i = 0, len = this.sectionPlanesList.length; i < len; i++) {
            sectionPlane = this.sectionPlanesList[i];
            hashParts.push("cp");
        }
        hashParts.push(";");
        this.#sectionPlanesHash = hashParts.join("");
        return this.#sectionPlanesHash;
    }

    /**
     * @private
     */
    registerLight(light: PointLight | DirLight | AmbientLight) {
        this.lightsList.push(light);
        this.lights[light.id] = light;
        this.#lightsHash = null;
        this.rebuild();
    }

    /**
     * @private
     */
    deregisterLight(light: PointLight | DirLight | AmbientLight) {
        for (let i = 0, len = this.lightsList.length; i < len; i++) {
            if (this.lightsList[i].id === light.id) {
                this.lightsList.splice(i, 1);
                this.#lightsHash = null;
                delete this.lights[light.id];
                this.rebuild();
                return;
            }
        }
    }

    /**
     * Destroys the light sources in this View.
     */
    clearLights(): void {
        const objectIds = Object.keys(this.lights);
        for (let i = 0, len = objectIds.length; i < len; i++) {
            this.lights[objectIds[i]].destroy();
        }
    }

    /**
     * @private
     */
    getLightsHash() {
        if (this.#lightsHash) {
            return this.#lightsHash;
        }
        if (this.lightsList.length === 0) {
            return (this.#lightsHash = ";");
        }
        const hashParts = [];
        const lights = this.lightsList;
        for (let i = 0, len = lights.length; i < len; i++) {
            const light: any = lights[i];
            hashParts.push("/");
            hashParts.push(light.type);
            hashParts.push(light.space === "world" ? "w" : "v");
            if (light.castsShadow) {
                hashParts.push("sh");
            }
        }
        // if (this.lightMaps.length > 0) {
        //     hashParts.push("/lm");
        // }
        // if (this.reflectionMaps.length > 0) {
        //     hashParts.push("/rm");
        // }
        hashParts.push(";");
        this.#lightsHash = hashParts.join("");
        return this.#lightsHash;
    }

    //createLight(lightParams) {
    //
    // }

    /**
     * @private
     */
    rebuild() {
        this.viewer.renderer.setNeedsRebuild(this.viewIndex);
    }

    /**
     * @private
     */
    redraw() {
        this.viewer.renderer.setImageDirty(this.viewIndex);
    }


    /**
     * @private
     */
    getAmbientColorAndIntensity(): FloatArrayParam {
        return [0, 0, 0, 1];
    }

    /**
     * Updates the visibility of the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.visible} on the Objects with the given IDs.
     * - Updates {@link View.visibleObjects} and {@link View.numVisibleObjects}.
     *
     * @param {String[]} objectIds Array of {@link @xeokit/viewer!ViewObject.id} values.
     * @param visible Whether or not to cull.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsVisible(objectIds: string[], visible: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = viewObject.visible !== visible;
            viewObject.visible = visible;
            return changed;
        });
    }

    /**
     * Updates the collidability of the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * Updates {@link @xeokit/viewer!ViewObject.collidable} on the Objects with the given IDs.
     *
     * @param {String[]} objectIds Array of {@link @xeokit/viewer!ViewObject.id} values.
     * @param collidable Whether or not to cull.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCollidable(objectIds: string[], collidable: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = viewObject.collidable !== collidable;
            viewObject.collidable = collidable;
            return changed;
        });
    }

    /**
     * Updates the culled status of the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * Updates {@link @xeokit/viewer!ViewObject.culled} on the Objects with the given IDs.
     *
     * @param {String[]} objectIds Array of {@link @xeokit/viewer!ViewObject.id} values.
     * @param culled Whether or not to cull.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCulled(objectIds: string[], culled: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = viewObject.culled !== culled;
            viewObject.culled = culled;
            return changed;
        });
    }

    /**
     * Selects or deselects the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.selected} on the Objects with the given IDs.
     * - Updates {@link View.selectedObjects} and {@link View.numSelectedObjects}.
     *
     * @param  objectIds One or more {@link @xeokit/viewer!ViewObject.id} values.
     * @param selected Whether or not to select.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsSelected(objectIds: string[], selected: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = viewObject.selected !== selected;
            viewObject.selected = selected;
            return changed;
        });
    }

    /**
     * Highlights or un-highlights the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.highlighted} on the Objects with the given IDs.
     * - Updates {@link View.highlightedObjects} and {@link View.numHighlightedObjects}.
     *
     * @param  objectIds One or more {@link @xeokit/viewer!ViewObject.id} values.
     * @param highlighted Whether or not to highlight.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsHighlighted(objectIds: string[], highlighted: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = viewObject.highlighted !== highlighted;
            viewObject.highlighted = highlighted;
            return changed;
        });
    }

    /**
     * Applies or removes X-ray rendering for the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.xrayed} on the Objects with the given IDs.
     * - Updates {@link View.xrayedObjects} and {@link View.numXRayedObjects}.
     *
     * @param  objectIds One or more {@link @xeokit/viewer!ViewObject.id} values.
     * @param xrayed Whether or not to xray.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsXRayed(objectIds: string[], xrayed: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = viewObject.xrayed !== xrayed;
            if (changed) {
                viewObject.xrayed = xrayed;
            }
            return changed;
        });
    }

    /**
     * Colorizes the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.colorize} on the Objects with the given IDs.
     * - Updates {@link View.colorizedObjects} and {@link View.numColorizedObjects}.
     *
     * @param  objectIds One or more {@link @xeokit/viewer!ViewObject.id} values.
     * @param colorize - RGB colorize factors in range ````[0..1,0..1,0..1]````.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
     */
    setObjectsColorized(objectIds: string[], colorize: number[]) {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            viewObject.colorize = colorize;
        });
    }

    /**
     * Sets the opacity of the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.opacity} on the Objects with the given IDs.
     * - Updates {@link View.opacityObjects} and {@link View.numOpacityObjects}.
     *
     * @param  objectIds - One or more {@link @xeokit/viewer!ViewObject.id} values.
     * @param opacity - Opacity factor in range ````[0..1]````.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} changed opacity, else false if all updates were redundant and not applied.
     */
    setObjectsOpacity(objectIds: string[], opacity: number): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = viewObject.opacity !== opacity;
            if (changed) {
                viewObject.opacity = opacity;
            }
            return changed;
        });
    }

    /**
     * Sets the pickability of the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.pickable} on the Objects with the given IDs.
     * - Enables or disables the ability to pick the given Objects with {@link View.pick}.
     *
     * @param {String[]} objectIds Array of {@link @xeokit/viewer!ViewObject.id} values.
     * @param pickable Whether or not to set pickable.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsPickable(objectIds: string[], pickable: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = viewObject.pickable !== pickable;
            if (changed) {
                viewObject.pickable = pickable;
            }
            return changed;
        });
    }

    /**
     * Sets the clippability of the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * - Updates {@link @xeokit/viewer!ViewObject.clippable} on the Objects with the given IDs.
     * - Enables or disables the ability to clip the given Objects with {@link SectionPlane}.
     *
     * @param {String[]} objectIds Array of {@link @xeokit/viewer!ViewObject.id} values.
     * @param clippable Whether or not to set clippable.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    setObjectsClippable(objectIds: string[], clippable: boolean): boolean {
        return this.withObjects(objectIds, (viewObject: ViewObject) => {
            const changed = viewObject.clippable !== clippable;
            if (changed) {
                viewObject.clippable = clippable;
            }
            return changed;
        });
    }

    /**
     * Iterates with a callback over the given {@link @xeokit/viewer!ViewObject | ViewObjects} in this View.
     *
     * @param objectIds One or more {@link @xeokit/viewer!ViewObject.id} values.
     * @param callback Callback to execute on each {@link @xeokit/viewer!ViewObject}.
     * @returns True if any {@link @xeokit/viewer!ViewObject | ViewObjects} were updated, else false if all updates were redundant and not applied.
     */
    withObjects(objectIds: string[], callback: Function): boolean {
        let changed = false;
        for (let i = 0, len = objectIds.length; i < len; i++) {
            const id = objectIds[i];
            let viewObject = this.objects[id];
            if (viewObject) {
                changed = callback(viewObject) || changed;
            }
        }
        return changed;
    }

    /**
     * Creates a {@link @xeokit/viewer!ViewLayer} in this View.
     *
     * The ViewLayer is then registered in {@link View.layers}.
     *
     * Since the ViewLayer is created explicitly by this method, the ViewLayer will persist until {@link @xeokit/viewer!ViewLayer.destroy}
     * is called, or the {@link @xeokit/viewer!View} itself is destroyed. If a ViewLayer with the given ID already exists, then the method
     * returns that existing ViewLayer. The method will also ensure that the existing ViewLayer likewise persists.
     *
     * @param viewLayerParams
     * @returns The new ViewLayer
     */
    createLayer(viewLayerParams: ViewLayerParams): ViewLayer {
        let viewLayer = this.layers[viewLayerParams.id];
        if (!viewLayer) {
            viewLayer = new ViewLayer({
                // Automatically creates ViewObjects
                id: viewLayerParams.id,
                view: this,
                viewer: this.viewer,
            });
            this.layers[viewLayerParams.id] = viewLayer;
            this.onLayerCreated.dispatch(this, viewLayer);
            viewLayer.onDestroyed.one(() => {
                delete this.layers[viewLayer.id];
                this.onLayerDestroyed.dispatch(this, viewLayer);
            });
        }
        viewLayer.autoDestroy = false;
        return viewLayer;
    }

    /**
     * Attempts to pick a {@link ViewObject} in this View.
     *
     * @param pickParams
     * @param pickResult
     */
    pick(pickParams: PickParams, pickResult?: PickResult): PickResult | null {
        return null;

    }

    /**
     * Captures a snapshot image of this View.
     *
     * @param snapshotParams
     * @param snapshotResult
     */
    getSnapshot(snapshotParams: SnapshotParams, snapshotResult?: SnapshotResult): SnapshotResult {
        return new SnapshotResult();
    }

    #registerSectionPlane(sectionPlane: SectionPlane) {
        this.sectionPlanesList.push(sectionPlane);
        this.sectionPlanes[sectionPlane.id] = sectionPlane;
        this.#sectionPlanesHash = null;
        this.rebuild();
        this.onSectionPlaneCreated.dispatch(this, sectionPlane);
    }

    #deregisterSectionPlane(sectionPlane: SectionPlane) {
        for (let i = 0, len = this.sectionPlanesList.length; i < len; i++) {
            if (this.sectionPlanesList[i].id === sectionPlane.id) {
                this.sectionPlanesList.splice(i, 1);
                this.#sectionPlanesHash = null;
                delete this.sectionPlanes[sectionPlane.id];
                this.rebuild();
                this.onSectionPlaneDestroyed.dispatch(this, sectionPlane);
                return;
            }
        }
    }

    /**
     * Destroys this View.
     *
     * Causes {@link @xeokit/viewer!Viewer} to fire a "viewDestroyed" event.
     */
    destroy() {
        this.viewer.onTick.unsubscribe(this.#onTick);
        this.#destroyViewLayers();
        this.#destroyViewObjects();
        this.onObjectCreated.clear();
        this.onObjectDestroyed.clear();
        this.onObjectVisibility.clear();
        this.onObjectXRayed.clear();
        this.onLayerCreated.clear();
        this.onLayerDestroyed.clear();
        this.onSectionPlaneCreated.clear();
        this.onSectionPlaneDestroyed.clear();
        super.destroy();
    }

    #destroyViewObjectsForSceneModel(sceneModel: SceneModel) {
        const objects = sceneModel.objects;
        for (let id in objects) {
            const object = objects[id];
            const layerId = object.layerId || "default";
            let viewLayer = this.layers[layerId];
            const viewObject = this.objects[object.id];
            this.deregisterViewObject(viewObject);
            if (viewLayer) {
                viewLayer.deregisterViewObject(viewObject);
                if (viewLayer.autoDestroy && viewLayer.numObjects === 0) {
                    viewLayer.destroy();
                }
            }
            this.onObjectDestroyed.dispatch(this, viewObject);
        }
    }

    #destroyViewLayers() {
        const viewLayers = this.layers;
        for (let id in viewLayers) {
            const viewLayer = viewLayers[id];
            viewLayer.destroy();
        }
    }

    #destroyViewObjects() {
        const objects = this.objects;
        for (let id in objects) {
            const object = objects[id];
            const sceneObject = object.sceneObject;
            const layerId = sceneObject.layerId || "default";
            let viewLayer = this.layers[layerId];
            const viewObject = this.objects[object.id];
            this.deregisterViewObject(viewObject);
            if (viewLayer) {
                viewLayer.deregisterViewObject(viewObject);
                if (viewLayer.autoDestroy && viewLayer.numObjects === 0) {
                    viewLayer.destroy();
                }
            }
            this.onObjectDestroyed.dispatch(this, viewObject);
        }
    }
}

export {View};
