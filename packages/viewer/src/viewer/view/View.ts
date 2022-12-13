import {Component} from '../Component';
import {Camera, CameraFlightAnimation} from "./camera/index";
import {Viewport} from "./Viewport";
import {Canvas} from "./Canvas";
import {CameraControl} from "./CameraControl/index";
import {Input} from "./Input";
import {ViewObject} from "./ViewObject";
import type {SectionPlane} from "./SectionPlane";
import type {AmbientLight, DirLight, PointLight} from "./lights/index";
import {EdgeMaterial, EmphasisMaterial, PointsMaterial} from "./materials/index";
import type {Viewer} from "../Viewer";
import {PickResult} from "./PickResult";
import {Metrics} from "./Metriqs";
import type {Scene, SceneModel} from "../scene/index";
import {PickParams} from "./PickParams";
import {SAO} from "./SAO";
import {LinesMaterial} from "./materials/LinesMaterial";
import type * as math from "../math/index";
import {FastRender, QualityRender} from "../constants";
import {ViewLayer} from "./ViewLayer";
import * as utils from "../utils/index";
import type {ViewLayerParams} from "./ViewLayerParams";
import {SectionPlaneParams} from "./SectionPlaneParams";


/**
 * An independently-configurable view of the {@link SceneObject | SceneObjects} in a {@link Viewer | Viewer's} {@link Scene}.
 *
 * ## Summary
 *
 * * Created with {@link Viewer.createView}
 * * Registered in {@link Viewer.views}
 * * Has own HTML canvas, {@link Camera}, {@link SectionPlane|SectionPlanes} and light sources
 * * Automatically maintains {@link ViewObject|ViewObjects} that represent and control the appearance of {@link SceneObject|SceneObjects} in its canvas
 * * Uses {@link ViewLayer|ViewLayers} to organize the ViewObjects into layers
 * * Optionally uses ViewLayers to mask which ViewObjects are automatically maintained
 *
 * ## Overview
 *
 * A View is an independently-configurable view of the {@link SceneObject|SceneObjects} existing within a Viewer, with
 * its own HTML canvas. A View automatically contains a {@link ViewObject} for each existing SceneObject. ViewObjects
 * function as a kind of proxy for the SceneObjects, through which we control their appearance
 * (show/hide/highlight etc.) within that particular View's canvas.
 *
 * Using Views, we can essentially have multiple canvases viewing the same model, each canvas perhaps showing a different subset
 * of the objects, with different visual effects, camera position etc.
 *
 * ## Examples
 *
 * Create a view in a given canvas, with three objects visible and a couple of object X-rayed (rendered translucent):
 *
 * ````javascript
 * const view1 = myViewer.createView({
 *      id: "myView",
 *      canvasId: "myCanvas1"
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
 *      canvasId: "myCanvas2"
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
     ID of this View, unique within the {@link Viewer}.
     */
    declare id: string;

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
     * Manages the HTML canvas for this View.
     */
    readonly canvas: Canvas;

    /**
     * Whether the logarithmic depth buffer is enabled for this View.
     */
    readonly logarithmicDepthBufferEnabled: boolean;

    /**
     * Configures Scalable Ambient Obscurance (SAO) for this View.
     */
    readonly sao: SAO;

    /**
     * Publishes input events that occur on this View's canvas.
     */
    readonly input: Input;

    /**
     * Controls the View's {@link Camera} from user input.
     */
    readonly cameraControl: CameraControl;

    /**
     * Flies or jumps the View's {@link Camera} to given positions.
     */
    readonly cameraFlight: CameraFlightAnimation;

    /**
     * Manages the 2D viewpoint for this View.
     */
    readonly viewport: Viewport;

    /**
     * Manages measurement units, origin and scale for this View.
     */
    readonly metrics: Metrics;

    /**
     * Configures the X-rayed appearance of {@link ViewObject}s in this View.
     */
    readonly xrayMaterial: EmphasisMaterial;

    /**
     * Configures the highlighted appearance of {@link ViewObject}s in this View.
     */
    readonly highlightMaterial: EmphasisMaterial;

    /**
     * Configures the appearance of {@link ViewObject}s in this View.
     */
    readonly selectedMaterial: EmphasisMaterial;

    /**
     * Configures the appearance of edges belonging to {@link ViewObject} in this View.
     */
    readonly edgeMaterial: EdgeMaterial;

    /**
     * Configures the appearance of point primitives belonging to {@link ViewObject}s in this View .
     */
    readonly pointsMaterial: PointsMaterial;

    /**
     * Configures the appearance of lines belonging to {@link ViewObject}s in this View.
     */
    readonly linesMaterial: LinesMaterial;

    /**
     * Map of the all {@link ViewObject}s in this View.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     *
     * The View automatically ensures that there is a {@link ViewObject} here for
     * each {@link SceneObject} in the {@link Viewer}'s {@link Scene}.
     */
    readonly objects: { [key: string]: ViewObject };

    /**
     * Map of the currently visible {@link ViewObject}s in this View.
     *
     * A ViewObject is visible when {@link ViewObject.visible} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    readonly visibleObjects: { [key: string]: ViewObject };

    /**
     * Map of currently x-rayed {@link ViewObject}s in this View.
     *
     * A ViewObject is x-rayed when {@link ViewObject.xrayed} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    readonly xrayedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently highlighted {@link ViewObject}s in this View.
     *
     * A ViewObject is highlighted when {@link ViewObject.highlighted} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    readonly highlightedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently selected {@link ViewObject}s in this View.
     *
     * A ViewObject is selected when {@link ViewObject.selected} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    readonly selectedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently colorized {@link ViewObject}s in this View.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    readonly colorizedObjects: { [key: string]: ViewObject };

    /**
     * Map of {@link ViewObject}s in this View whose opacity has been updated.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
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
    readonly lights: { [key: string]: (AmbientLight | PointLight | DirLight) };
    /**
     * List of light sources in this View.
     */
    readonly lightsList: (AmbientLight | PointLight | DirLight)[] = [];

    gammaOutput: boolean;

    /**
     * Map of the all {@link ViewLayer}s in this View.
     *
     * Each {@link ViewLayer} is mapped here by {@link ViewLayer.id}.
     */
    readonly layers: { [key: string]: ViewLayer };

    /**
     * Whether the View will automatically create {@link ViewLayer|ViewLayers} on-demand
     * as {@link SceneObject|SceneObjects} are created.
     *
     * When ````true```` (default), the View will automatically create {@link ViewLayer|ViewLayers} as needed for each new
     * {@link SceneObject.viewLayerId} encountered, including a "default" ViewLayer for SceneObjects that have no
     * viewLayerId. This default setting therefore ensures that a ViewObject is created in the View for every SceneObject that is created.
     *
     * If you set this ````false````, however, then the View will only create {@link ViewObject|ViewObjects} for {@link SceneObject|SceneObjects} that have
     * a {@link SceneObject.viewLayerId} that matches the ID of a {@link ViewLayer} that you have explicitly created previously with {@link View.createLayer}.
     *
     * Setting this parameter false enables Views to contain only the ViewObjects that they actually need to show, i.e. to represent only
     * SceneObjects that they need to view. This enables a View to avoid wastefully creating and maintaining ViewObjects for SceneObjects
     * that it never needs to show.
     */
    readonly autoLayers: boolean;

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
     * Creates a new View within a Viewer.
     *
     * The View will then be registered by {@link View.id} in {@link Viewer.views}.
     *
     * @private
     * @param options.viewer The Viewer that owns this View.
     * @param options View configuration.
     * @param options.id Optional ID for this View.
     * @param options.canvasId -  ID of an existing HTML canvas for the View - either this or canvasElement is mandatory. When both values are given, the element reference is always preferred to the ID.
     * @param options.canvasElement - Reference of an existing HTML canvas. Either this or canvasId is mandatory. When both values are given, the element reference is always preferred to the ID.
     * @param options.transparent -  Whether the canvas is transparent.
     * @param options.premultipliedAlpha -  Whether you want alpha composition with premultiplied alpha. Highlighting and selection works best when this is ````false````.
     * @param options.backgroundColor=[1,1,1] - Sets the canvas background color to use when ````transparent```` is false.
     * @param options.backgroundColorFromAmbientLight - When ````transparent```` is false, set this ````true````
     * to derive the canvas background color from {@link AmbientLight.color}, or ````false```` to set the canvas background to ````backgroundColor````.
     * @param options.qualityRender - Whether quality rendering is enabled for this View. Default is ````false````.
     * @param options.logarithmicDepthBufferEnabled - Whether to enable logarithmic depth buffer for this View. This is ````false```` by default.
     */
    constructor(options: {
        viewer: Viewer;
        origin?: number[];
        scale?: number;
        units?: string;
        canvasId?: string;
        canvasElement?: HTMLCanvasElement;
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

        const canvas = options.canvasElement || document.getElementById(<string>options.canvasId);
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw "Mandatory View config expected: valid canvasId or canvasElement";
        }

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

        this.canvas = new Canvas(this, {
            canvas: canvas,
            transparent: !!options.transparent,
            backgroundColor: options.backgroundColor,
            backgroundColorFromAmbientLight: !!options.backgroundColorFromAmbientLight,
            premultipliedAlpha: !!options.premultipliedAlpha
        });

        this.canvas.events.on("boundary", () => {
            this.redraw();
        });

        this.input = new Input(this, {
            element: this.canvas.canvas
        });

        this.viewport = new Viewport(this, {});

        this.camera = new Camera(this);

        this.sao = new SAO(this, {});

        this.cameraControl = new CameraControl(this, this.canvas, this.camera, {
            doublePickFlyTo: true
        });

        this.cameraFlight = new CameraFlightAnimation(this, {
            duration: 0.5
        });

        this.metrics = new Metrics(this, {
            units: options.units,
            scale: options.scale,
            origin: options.origin
        });

        this.xrayMaterial = new EmphasisMaterial(this, {
            fill: true,
            fillColor: [0.9, 0.7, 0.6],
            fillAlpha: 0.4,
            edges: true,
            edgeColor: [0.5, 0.4, 0.4],
            edgeAlpha: 1.0,
            edgeWidth: 1
        });

        this.highlightMaterial = new EmphasisMaterial(this, {
            fill: true,
            fillColor: [1.0, 1.0, 0.0],
            fillAlpha: 0.5,
            edges: true,
            edgeColor: [0.5, 0.4, 0.4],
            edgeAlpha: 1.0,
            edgeWidth: 1
        });

        this.selectedMaterial = new EmphasisMaterial(this, {
            fill: true,
            fillColor: [0.0, 1.0, 0.0],
            fillAlpha: 0.5,
            edges: true,
            edgeColor: [0.4, 0.5, 0.4],
            edgeAlpha: 1.0,
            edgeWidth: 1
        });

        this.edgeMaterial = new EdgeMaterial(this, {
            edgeColor: [0.0, 0.0, 0.0],
            edgeAlpha: 1.0,
            edgeWidth: 1,
            edges: true,
            renderModes: [QualityRender]
        });

        this.pointsMaterial = new PointsMaterial(this, {
            pointSize: 1,
            roundPoints: true,
            perspectivePoints: true,
            minPerspectivePointSize: 1,
            maxPerspectivePointSize: 6,
            filterIntensity: false,
            minIntensity: 0,
            maxIntensity: 1
        });

        this.linesMaterial = new LinesMaterial(this, {
            lineWidth: 1
        });

        this.lights = {};

        this.#qualityRender = !!options.qualityRender;

        this.autoLayers = (options.autoLayers !== false);

        this.logarithmicDepthBufferEnabled = !!options.logarithmicDepthBufferEnabled;

        this.#initObjects();
    }

    /**
     * Gets the gamma factor.
     */
    get gammaFactor() { // TODO
        return 1.0;
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
     * Gets whether quality rendering is enabled for this View.
     *
     * Default is ````false````.
     */
    get qualityRender(): boolean {
        return this.#qualityRender;
    }

    /**
     * Gets the number of {@link ViewObject}s in this View.
     */
    get numObjects(): number {
        return this.#numObjects;
    }

    /**
     * Gets the IDs of the {@link ViewObject}s in this View.
     */
    get objectIds(): string[] {
        if (!this.#objectIds) {
            this.#objectIds = Object.keys(this.objects);
        }
        return this.#objectIds;
    }

    /**
     * Gets the number of visible {@link ViewObject}s in this View.
     */
    get numVisibleObjects(): number {
        return this.#numVisibleObjects;
    }

    /**
     * Gets the IDs of the visible {@link ViewObject}s in this View.
     */
    get visibleObjectIds(): string[] {
        if (!this.#visibleObjectIds) {
            this.#visibleObjectIds = Object.keys(this.visibleObjects);
        }
        return this.#visibleObjectIds;
    }

    /**
     * Gets the number of X-rayed {@link ViewObject}s in this View.
     */
    get numXRayedObjects(): number {
        return this.#numXRayedObjects;
    }

    /**
     * Gets the IDs of the X-rayed {@link ViewObject}s in this View.
     */
    get xrayedObjectIds(): string[] {
        if (!this.#xrayedObjectIds) {
            this.#xrayedObjectIds = Object.keys(this.xrayedObjects);
        }
        return this.#xrayedObjectIds;
    }

    /**
     * Gets the number of highlighted {@link ViewObject}s in this View.
     */
    get numHighlightedObjects(): number {
        return this.#numHighlightedObjects;
    }

    /**
     * Gets the IDs of the highlighted {@link ViewObject}s in this View.
     */
    get highlightedObjectIds(): string[] {
        if (!this.#highlightedObjectIds) {
            this.#highlightedObjectIds = Object.keys(this.highlightedObjects);
        }
        return this.#highlightedObjectIds;
    }

    /**
     * Gets the number of selected {@link ViewObject}s in this View.
     */
    get numSelectedObjects(): number {
        return this.#numSelectedObjects;
    }

    /**
     * Gets the IDs of the selected {@link ViewObject}s in this View.
     */
    get selectedObjectIds(): string[] {
        if (!this.#selectedObjectIds) {
            this.#selectedObjectIds = Object.keys(this.selectedObjects);
        }
        return this.#selectedObjectIds;
    }

    /**
     * Gets the number of colorized {@link ViewObject}s in this View.
     */
    get numColorizedObjects(): number {
        return this.#numColorizedObjects;
    }

    /**
     * Gets the IDs of the colorized {@link ViewObject}s in this View.
     */
    get colorizedObjectIds(): string[] {
        if (!this.#colorizedObjectIds) {
            this.#colorizedObjectIds = Object.keys(this.colorizedObjects);
        }
        return this.#colorizedObjectIds;
    }

    /**
     * Gets the IDs of the {@link ViewObject}s in this View that have updated opacities.
     */
    get opacityObjectIds(): string[] {
        if (!this.#opacityObjectIds) {
            this.#opacityObjectIds = Object.keys(this.opacityObjects);
        }
        return this.#opacityObjectIds;
    }

    /**
     * Gets the number of {@link ViewObject}s in this View that have updated opacities.
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
    objectVisibilityUpdated(viewObject: ViewObject, visible: boolean, notify: boolean = true) {
        if (visible) {
            this.visibleObjects[viewObject.id] = viewObject;
            this.#numVisibleObjects++;
        } else {
            delete this.visibleObjects[viewObject.id];
            this.#numVisibleObjects--;
        }
        this.#visibleObjectIds = null; // Lazy regenerate
        if (notify) {
            this.events.fire("objectVisibility", viewObject, true);
        }
    }

    /**
     * @private
     */
    objectXRayedUpdated(viewObject: ViewObject, xrayed: boolean) {
        if (xrayed) {
            this.xrayedObjects[viewObject.id] = viewObject;
            this.#numXRayedObjects++;
        } else {
            delete this.xrayedObjects[viewObject.id];
            this.#numXRayedObjects--;
        }
        this.#xrayedObjectIds = null; // Lazy regenerate
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
     * @private
     */
    getSectionPlanesHash() {
        if (this.#sectionPlanesHash) {
            return this.#sectionPlanesHash;
        }
        if (this.sectionPlanesList.length === 0) {
            return this.#sectionPlanesHash = ";";
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
    };

    /**
     *
     * @param sectionPlaneParams
     */
    // createSectionPlane(sectionPlaneParams: SectionPlaneParams) : SectionPlane {
    //
    // }

    /**
     * Destroys the {@link SectionPlane}s in this View.
     */
    clearSectionPlanes(): void {
        const ids = Object.keys(this.sectionPlanes);
        for (let i = 0, len = ids.length; i < len; i++) {
            this.sectionPlanes[ids[i]].destroy();
        }
        this.sectionPlanesList.length = 0;
        this.#sectionPlanesHash = null;
    }

    /**
     * @private
     */
    registerSectionPlane(sectionPlane: SectionPlane) {
        this.sectionPlanesList.push(sectionPlane);
        this.sectionPlanes[sectionPlane.id] = sectionPlane;
        this.#sectionPlanesHash = null;
        this.recompile();
    }

    /**
     * @private
     */
    deregisterSectionPlane(sectionPlane: SectionPlane) {
        for (let i = 0, len = this.sectionPlanesList.length; i < len; i++) {
            if (this.sectionPlanesList[i].id === sectionPlane.id) {
                this.sectionPlanesList.splice(i, 1);
                this.#sectionPlanesHash = null;
                delete this.sectionPlanes[sectionPlane.id];
                this.recompile();
                return;
            }
        }
    }

    /**
     * @private
     */
    registerLight(light: PointLight | DirLight | AmbientLight) {
        this.lightsList.push(light);
        this.lights[light.id] = light;
        this.#lightsHash = null;
        this.recompile();
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
                this.recompile();
                return;
            }
        }
    }

    //createLight(lightParams) {
    //
    // }

    /**
     * Destroys the light sources in this View.
     */
    clearLights(): void {
        const ids = Object.keys(this.lights);
        for (let i = 0, len = ids.length; i < len; i++) {
            this.lights[ids[i]].destroy();
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
            return this.#lightsHash = ";";
        }
        const hashParts = [];
        const lights = this.lightsList;
        for (let i = 0, len = lights.length; i < len; i++) {
            const light: any = lights[i];
            hashParts.push("/");
            hashParts.push(light.type);
            hashParts.push((light.space === "world") ? "w" : "v");
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
    };

    /**
     * @private
     */
    redraw() {
        this.viewer.renderer.setImageDirty(this.viewIndex);
    }

    /**
     * @private
     */
    recompile() {
        this.viewer.events.once("tick", () => {
            this.events.fire("compile", this);
        });
    }

    /**
     * Destroys this View.
     *
     * Causes {@link Viewer} to fire a "viewDestroyed" event.
     */
    destroy() {
        super.destroy();
    }

    #initObjects() {
        const scene = this.viewer.scene;
        const sceneModels = scene.models;
        for (const id in sceneModels) {
            const sceneModel = sceneModels[id];
            this.#createObjects(sceneModel);
        }
        scene.events.on("sceneModelCreated", (sceneModel:SceneModel) => {
            this.#createObjects(sceneModel);
        });
        scene.events.on("sceneModelDestroyed", (sceneModel:SceneModel) => {
            this.#destroyObjects(sceneModel);
        });
    }

    #createObjects(sceneModel: SceneModel) {
        const sceneObjects = sceneModel.objects;
        for (let id in sceneObjects) {
            const sceneObject = sceneObjects[id];
            const viewLayerId = sceneObject.viewLayerId || "default";
            let viewLayer = this.layers[viewLayerId];
            if (!viewLayer) {
                if (!this.autoLayers) {
                    continue;
                }
                viewLayer = new ViewLayer({
                    id: viewLayerId,
                    view: this,
                    viewer: this.viewer
                });
                this.layers[viewLayerId] = viewLayer;
                viewLayer.events.on("destroyed", (viewLayer) => {
                    delete this.layers[viewLayer.id];
                });
            }
            const viewObject = new ViewObject(viewLayer, sceneObject, {});
            viewLayer.registerViewObject(viewObject);
            this.registerViewObject(viewObject);
        }
    }

    #destroyObjects(sceneModel: SceneModel) {
        const sceneObjects = sceneModel.objects;
        for (let id in sceneObjects) {
            const sceneObject = sceneObjects[id];
            const viewLayerId = sceneObject.viewLayerId || "main";
            let viewLayer = this.layers[viewLayerId];
            const viewObject = this.objects[sceneObject.id];
            this.deregisterViewObject(viewObject);
            if (viewLayer) {
                viewLayer.deregisterViewObject(viewObject);
                if (viewLayer.autoDestroy && viewLayer.numObjects === 0) {
                    viewLayer.destroy();
                }
            }
        }
    }

    /**
     * @private
     */
    getAmbientColorAndIntensity(): math.FloatArrayParam {
        return [0, 0, 0, 1];
    }

    /**
     * Updates the visibility of the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.visible} on the Objects with the given IDs.
     * - Updates {@link View.visibleObjects} and {@link View.numVisibleObjects}.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param visible Whether or not to cull.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsVisible(ids: string[] | string, visible: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.visible !== visible);
            viewObject.visible = visible;
            return changed;
        });
    }

    /**
     * Updates the collidability of the given {@link ViewObject}s in this View.
     *
     * Updates {@link ViewObject.collidable} on the Objects with the given IDs.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param collidable Whether or not to cull.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCollidable(ids: string[] | string, collidable: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.collidable !== collidable);
            viewObject.collidable = collidable;
            return changed;
        });
    }

    /**
     * Updates the culled status of the given {@link ViewObject}s in this View.
     *
     * Updates {@link ViewObject.culled} on the Objects with the given IDs.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param culled Whether or not to cull.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsCulled(ids: string[] | string, culled: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.culled !== culled);
            viewObject.culled = culled;
            return changed;
        });
    }

    /**
     * Selects or deselects the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.selected} on the Objects with the given IDs.
     * - Updates {@link View.selectedObjects} and {@link View.numSelectedObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param selected Whether or not to select.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsSelected(ids: string[] | string, selected: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.selected !== selected);
            viewObject.selected = selected;
            return changed;
        });
    }

    /**
     * Highlights or un-highlights the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.highlighted} on the Objects with the given IDs.
     * - Updates {@link View.highlightedObjects} and {@link View.numHighlightedObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param highlighted Whether or not to highlight.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsHighlighted(ids: string[] | string, highlighted: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.highlighted !== highlighted);
            viewObject.highlighted = highlighted;
            return changed;
        });
    }

    /**
     * Applies or removes X-ray rendering for the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.xrayed} on the Objects with the given IDs.
     * - Updates {@link View.xrayedObjects} and {@link View.numXRayedObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param xrayed Whether or not to xray.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsXRayed(ids: string[] | string, xrayed: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.xrayed !== xrayed);
            if (changed) {
                viewObject.xrayed = xrayed;
            }
            return changed;
        });
    }

    /**
     * Colorizes the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.colorize} on the Objects with the given IDs.
     * - Updates {@link View.colorizedObjects} and {@link View.numColorizedObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param colorize - RGB colorize factors in range ````[0..1,0..1,0..1]````.
     * @returns True if any {@link ViewObject}s changed opacity, else false if all updates were redundant and not applied.
     */
    setObjectsColorized(ids: string[] | string, colorize: number[]) {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            viewObject.colorize = colorize;
        });
    }

    /**
     * Sets the opacity of the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.opacity} on the Objects with the given IDs.
     * - Updates {@link View.opacityObjects} and {@link View.numOpacityObjects}.
     *
     * @param  ids - One or more {@link ViewObject.id} values.
     * @param opacity - Opacity factor in range ````[0..1]````.
     * @returns True if any {@link ViewObject}s changed opacity, else false if all updates were redundant and not applied.
     */
    setObjectsOpacity(ids: string[] | string, opacity: number): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.opacity !== opacity);
            if (changed) {
                viewObject.opacity = opacity;
            }
            return changed;
        });
    }

    /**
     * Sets the pickability of the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.pickable} on the Objects with the given IDs.
     * - Enables or disables the ability to pick the given Objects with {@link View.pick}.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param pickable Whether or not to set pickable.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsPickable(ids: string[] | string, pickable: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.pickable !== pickable);
            if (changed) {
                viewObject.pickable = pickable;
            }
            return changed;
        });
    }

    /**
     * Sets the clippability of the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.clippable} on the Objects with the given IDs.
     * - Enables or disables the ability to pick the given Objects with {@link View.pick}.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param clippable Whether or not to set clippable.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setObjectsClippable(ids: string[] | string, clippable: boolean): boolean {
        return this.withObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.clippable !== clippable);
            if (changed) {
                viewObject.clippable = clippable;
            }
            return changed;
        });
    }

    /**
     * Iterates with a callback over the given {@link ViewObject}s in this View.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param callback Callback to execute on each {@link ViewObject}.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    withObjects(ids: string[] | string, callback: Function): boolean {
        if (utils.isString(ids)) {
            // @ts-ignore
            ids = [ids];
        }
        let changed = false;
        for (let i = 0, len = ids.length; i < len; i++) {
            const id = ids[i];
            let viewObject = this.objects[id];
            if (viewObject) {
                changed = callback(viewObject) || changed;
            }
        }
        return changed;
    }

    /**
     * Creates a {@link ViewLayer} in this View.
     *
     * The ViewLayer is then registered in {@link View.layers}.
     *
     * Since the ViewLayer is created explicitly by this method, the ViewLayer will persist until {@link ViewLayer.destroy}
     * is called, or the {@link View} itself is destroyed. If a ViewLayer with the given ID already exists, then the method
     * returns that existing ViewLayer. The method will also ensure that the existing ViewLayer likewise persists.
     *
     * @param viewLayerParams
     * @returns The new ViewLayer
     */
    createLayer(viewLayerParams: ViewLayerParams): ViewLayer {
        let viewLayer = this.layers[viewLayerParams.id];
        if (!viewLayer) {
            viewLayer = new ViewLayer({ // Automatically creates ViewObjects
                id: viewLayerParams.id,
                view: this,
                viewer: this.viewer
            });
            this.layers[viewLayerParams.id] = viewLayer;
        }
        viewLayer.autoDestroy = false;
        return viewLayer;
    }
}

export {View};
