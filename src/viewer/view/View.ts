import {Component} from '../Component';
import {Camera, CameraFlightAnimation} from "./camera/index";
import {Viewport} from "./Viewport.js";
import {Canvas} from "./Canvas";
import {CameraControl} from "./CameraControl/index";
import {Input} from "./Input.js";
import * as utils from "../utils/index";
import {ViewObject} from "./ViewObject";
import {SectionPlane} from "./SectionPlane";
import {AmbientLight, DirLight, PointLight} from "./lights/index";
import {EdgeMaterial, EmphasisMaterial, PointsMaterial} from "./materials/index";
import {Viewer} from "../Viewer";
import {PickResult} from "./PickResult";
import {Metrics} from "./Metriqs";
import {Scene, SceneModel} from "../scene/index";
import {PickParams} from "./PickParams";
import {SAO} from "./SAO";
import {LinesMaterial} from "./materials/LinesMaterial";
import * as math from "../math/index";
import {FastRender, QualityRender} from "../constants";

/**
 * An independently-configurable view of the models within a {@link Viewer}.
 */
class View extends Component {

    /**
     ID of this View, unique within the {@link Viewer}.
     */
    declare public id: string;

    /**
     * The Viewer to which this View belongs.
     */
    declare public readonly viewer: Viewer;

    /**
     * The index of this View in {@link Viewer.viewList}.
     * @private
     */
    public viewIndex: number;

    /**
     * Manages the Camera for this View.
     */
    public readonly camera: Camera;

    /**
     * Manages the HTML canvas for this View.
     */
    public readonly canvas: Canvas;

    /**
     * Whether the logarithmic depth buffer is enabled for this View.
     */
    public readonly logarithmicDepthBufferEnabled: boolean;

    /**
     * Configures Scalable Ambient Obscurance (SAO) for this View.
     */
    public readonly sao: SAO;

    /**
     * Publishes input events that occur on this View's canvas.
     */
    public readonly input: Input;

    /**
     * Controls the View's {@link Camera} from user input.
     */
    public readonly cameraControl: CameraControl;

    /**
     * Flies or jumps the View's {@link Camera} to given positions.
     */
    public readonly cameraFlight: CameraFlightAnimation;

    /**
     * Manages the 2D viewpoint for this View.
     */
    public readonly viewport: Viewport;

    /**
     * Manages measurement units, origin and scale for this View.
     */
    public readonly metrics: Metrics;

    /**
     * Configures the X-rayed appearance of {@link ViewObject}s in this View.
     */
    public readonly xrayMaterial: EmphasisMaterial;

    /**
     * Configures the highlighted appearance of {@link ViewObject}s in this View.
     */
    public readonly highlightMaterial: EmphasisMaterial;

    /**
     * Configures the appearance of {@link ViewObject}s in this View.
     */
    public readonly selectedMaterial: EmphasisMaterial;

    /**
     * Configures the appearance of edges belonging to {@link ViewObject} in this View.
     */
    public readonly edgeMaterial: EdgeMaterial;

    /**
     * Configures the appearance of point primitives belonging to {@link ViewObject}s in this View .
     */
    public readonly pointsMaterial: PointsMaterial;

    /**
     * Configures the appearance of lines belonging to {@link ViewObject}s in this View.
     */
    public readonly linesMaterial: LinesMaterial;

    /**
     * Map of the all {@link ViewObject}s in this View.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     *
     * The View automatically ensures that there is a {@link ViewObject} here for
     * each {@link SceneObject} in the {@link Viewer}'s {@link Scene}.
     */
    public readonly viewObjects: { [key: string]: ViewObject };

    /**
     * Map of the currently visible {@link ViewObject}s in this View.
     *
     * A ViewObject is visible when {@link ViewObject.visible} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly visibleViewObjects: { [key: string]: ViewObject };

    /**
     * Map of currently x-rayed {@link ViewObject}s in this View.
     *
     * A ViewObject is x-rayed when {@link ViewObject.xrayed} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly xrayedViewObjects: { [key: string]: ViewObject };

    /**
     * Map of currently highlighted {@link ViewObject}s in this View.
     *
     * A ViewObject is highlighted when {@link ViewObject.highlighted} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly highlightedViewObjects: { [key: string]: ViewObject };

    /**
     * Map of currently selected {@link ViewObject}s in this View.
     *
     * A ViewObject is selected when {@link ViewObject.selected} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly selectedViewObjects: { [key: string]: ViewObject };

    /**
     * Map of currently colorized {@link ViewObject}s in this View.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly colorizedViewObjects: { [key: string]: ViewObject };

    /**
     * Map of {@link ViewObject}s in this View whose opacity has been updated.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly opacityViewObjects: { [key: string]: ViewObject };

    /**
     * Map of {@link SectionPlane}s in this View.
     *
     * Each {@link SectionPlane} is mapped here by {@link SectionPlane.id}.
     */
    public readonly sectionPlanes: { [key: string]: SectionPlane };

    /**
     * List of {@link SectionPlane}s in this View.
     */
    public readonly sectionPlanesList: SectionPlane[] = [];
    /**
     * Map of light sources in this View.
     */
    public readonly lights: { [key: string]: (AmbientLight | PointLight | DirLight) };
    /**
     * List of light sources in this View.
     */
    public readonly lightsList: (AmbientLight | PointLight | DirLight)[] = [];
    #sectionPlanesHash: string | null = null;
    #numViewObjects: number;
    #viewObjectIds: string[] | null;
    #numVisibleViewObjects: number;
    #visibleViewObjectIds: string[] | null;
    #numXRayedViewObjects: number;
    #xrayedViewObjectIds: string[] | null;
    #numHighlightedViewObjects: number;
    #highlightedViewObjectIds: string[] | null;
    #numSelectedViewObjects: number;
    #selectedViewObjectIds: string[] | null;
    #numColorizedViewObjects: number;
    #colorizedViewObjectIds: string[] | null;
    #numOpacityViewObjects: number;
    #opacityViewObjectIds: string[] | null;
    #lightsHash: string | null = null;

    #qualityRender: boolean;
    gammaOutput: boolean;

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
     * @param options.transparent -  Whether or not the canvas is transparent.
     * @param options.premultipliedAlpha -  Whether or not you want alpha composition with premultiplied alpha. Highlighting and selection works best when this is ````false````.
     * @param options.backgroundColor=[1,1,1] - Sets the canvas background color to use when ````transparent```` is false.
     * @param options.backgroundColorFromAmbientLight - When ````transparent```` is false, set this ````true````
     * to derive the canvas background color from {@link AmbientLight.color}, or ````false```` to set the canvas background to ````backgroundColor````.
     * @param options.qualityRender - Whether or not quality rendering is enabled for this View. Default is ````false````.
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
    }) {

        super(null, options);

        this.viewer = options.viewer;

        const canvas = options.canvasElement || document.getElementById(options.canvasId);

        if (!(canvas instanceof HTMLCanvasElement)) {
            throw "Mandatory View config expected: valid canvasId or canvasElement";
        }

        this.viewIndex = 0;

        this.canvas = new Canvas(this, {
            canvas: canvas,
            transparent: options.transparent,
            backgroundColor: options.backgroundColor,
            backgroundColorFromAmbientLight: options.backgroundColorFromAmbientLight,
            premultipliedAlpha: options.premultipliedAlpha
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

        this.viewObjects = {};
        this.visibleViewObjects = {};
        this.xrayedViewObjects = {};
        this.highlightedViewObjects = {};
        this.selectedViewObjects = {};
        this.colorizedViewObjects = {};
        this.opacityViewObjects = {};

        this.#numViewObjects = 0;
        this.#numVisibleViewObjects = 0;
        this.#numXRayedViewObjects = 0
        this.#numHighlightedViewObjects = 0;
        this.#numSelectedViewObjects = 0;
        this.#numColorizedViewObjects = 0;
        this.#numOpacityViewObjects = 0;

        this.#qualityRender = !!options.qualityRender ;

        this.logarithmicDepthBufferEnabled = !!options.logarithmicDepthBufferEnabled;

        this.#initViewObjects();
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
    get numViewObjects(): number {
        return this.#numViewObjects;
    }

    /**
     * Gets the IDs of the {@link ViewObject}s in this View.
     */
    get viewObjectIds(): string[] {
        if (!this.#viewObjectIds) {
            this.#viewObjectIds = Object.keys(this.viewObjects);
        }
        return this.#viewObjectIds;
    }

    /**
     * Gets the number of visible {@link ViewObject}s in this View.
     */
    get numVisibleViewObjects(): number {
        return this.#numVisibleViewObjects;
    }

    /**
     * Gets the IDs of the visible {@link ViewObject}s in this View.
     */
    get visibleViewObjectIds(): string[] {
        if (!this.#visibleViewObjectIds) {
            this.#visibleViewObjectIds = Object.keys(this.visibleViewObjects);
        }
        return this.#visibleViewObjectIds;
    }

    /**
     * Gets the number of X-rayed {@link ViewObject}s in this View.
     */
    get numXRayedViewObjects(): number {
        return this.#numXRayedViewObjects;
    }

    /**
     * Gets the IDs of the X-rayed {@link ViewObject}s in this View.
     */
    get xrayedViewObjectIds(): string[] {
        if (!this.#xrayedViewObjectIds) {
            this.#xrayedViewObjectIds = Object.keys(this.xrayedViewObjects);
        }
        return this.#xrayedViewObjectIds;
    }

    /**
     * Gets the number of highlighted {@link ViewObject}s in this View.
     */
    get numHighlightedViewObjects(): number {
        return this.#numHighlightedViewObjects;
    }

    /**
     * Gets the IDs of the highlighted {@link ViewObject}s in this View.
     */
    get highlightedViewObjectIds(): string[] {
        if (!this.#highlightedViewObjectIds) {
            this.#highlightedViewObjectIds = Object.keys(this.highlightedViewObjects);
        }
        return this.#highlightedViewObjectIds;
    }

    /**
     * Gets the number of selected {@link ViewObject}s in this View.
     */
    get numSelectedViewObjects(): number {
        return this.#numSelectedViewObjects;
    }

    /**
     * Gets the IDs of the selected {@link ViewObject}s in this View.
     */
    get selectedViewObjectIds(): string[] {
        if (!this.#selectedViewObjectIds) {
            this.#selectedViewObjectIds = Object.keys(this.selectedViewObjects);
        }
        return this.#selectedViewObjectIds;
    }

    /**
     * Gets the number of colorized {@link ViewObject}s in this View.
     */
    get numColorizedViewObjects(): number {
        return this.#numColorizedViewObjects;
    }

    /**
     * Gets the IDs of the colorized {@link ViewObject}s in this View.
     */
    get colorizedViewObjectIds(): string[] {
        if (!this.#colorizedViewObjectIds) {
            this.#colorizedViewObjectIds = Object.keys(this.colorizedViewObjects);
        }
        return this.#colorizedViewObjectIds;
    }

    /**
     * Gets the IDs of the {@link ViewObject}s in this View that have updated opacities.
     */
    get opacityViewObjectIds(): string[] {
        if (!this.#opacityViewObjectIds) {
            this.#opacityViewObjectIds = Object.keys(this.opacityViewObjects);
        }
        return this.#opacityViewObjectIds;
    }

    /**
     * Gets the number of {@link ViewObject}s in this View that have updated opacities.
     */
    get numOpacityViewObjects(): number {
        return this.#numOpacityViewObjects;
    }

    /**
     * Gets the ambient light color and intensity.
     */
    getAmbientColorAndIntensity(): math.FloatArrayType { // TODO
        return new Float32Array([0.3, 0.3, 0.3, 1.0]);
    }

    /**
     * @private
     */
    registerViewObject(viewObject: ViewObject) {
        this.viewObjects[viewObject.id] = viewObject;
        this.#numViewObjects++;
        this.#viewObjectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    deregisterViewObject(viewObject: ViewObject) {
        delete this.viewObjects[viewObject.id];
        this.#numViewObjects--;
        this.#viewObjectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    public getSectionPlanesHash() {
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
     * Destroys the {@link SectionPlane}s in this View.
     */
    public clearSectionPlanes(): void {
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

    /**
     * Destroys the light sources in this View.
     */
    public clearLights(): void {
        const ids = Object.keys(this.lights);
        for (let i = 0, len = ids.length; i < len; i++) {
            this.lights[ids[i]].destroy();
        }
    }

    /**
     * @private
     */
    public getLightsHash() {
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
     * @private
     */
    objectVisibilityUpdated(viewObject: ViewObject, visible: boolean, notify: boolean = true) {
        if (visible) {
            this.visibleViewObjects[viewObject.id] = viewObject;
            this.#numVisibleViewObjects++;
        } else {
            delete this.visibleViewObjects[viewObject.id];
            this.#numVisibleViewObjects--;
        }
        this.#visibleViewObjectIds = null; // Lazy regenerate
        if (notify) {
            this.events.fire("objectVisibility", viewObject, true);
        }
    }

    /**
     * @private
     */
    objectXRayedUpdated(viewObject: ViewObject, xrayed: boolean) {
        if (xrayed) {
            this.xrayedViewObjects[viewObject.id] = viewObject;
            this.#numXRayedViewObjects++;
        } else {
            delete this.xrayedViewObjects[viewObject.id];
            this.#numXRayedViewObjects--;
        }
        this.#xrayedViewObjectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    objectHighlightedUpdated(viewObject: ViewObject, highlighted: boolean) {
        if (highlighted) {
            this.highlightedViewObjects[viewObject.id] = viewObject;
            this.#numHighlightedViewObjects++;
        } else {
            delete this.highlightedViewObjects[viewObject.id];
            this.#numHighlightedViewObjects--;
        }
        this.#highlightedViewObjectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    objectSelectedUpdated(viewObject: ViewObject, selected: boolean) {
        if (selected) {
            this.selectedViewObjects[viewObject.id] = viewObject;
            this.#numSelectedViewObjects++;
        } else {
            delete this.selectedViewObjects[viewObject.id];
            this.#numSelectedViewObjects--;
        }
        this.#selectedViewObjectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    objectColorizeUpdated(viewObject: ViewObject, colorized: boolean) {
        if (colorized) {
            this.colorizedViewObjects[viewObject.id] = viewObject;
            this.#numColorizedViewObjects++;
        } else {
            delete this.colorizedViewObjects[viewObject.id];
            this.#numColorizedViewObjects--;
        }
        this.#colorizedViewObjectIds = null; // Lazy regenerate
    }

    /**
     * @private
     */
    objectOpacityUpdated(viewObject: ViewObject, opacityUpdated: boolean) {
        if (opacityUpdated) {
            this.opacityViewObjects[viewObject.id] = viewObject;
            this.#numOpacityViewObjects++;
        } else {
            delete this.opacityViewObjects[viewObject.id];
            this.#numOpacityViewObjects--;
        }
        this.#opacityViewObjectIds = null; // Lazy regenerate
    }

    /**
     * Updates the visibility of the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.visible} on the ViewObjects with the given IDs.
     * - Updates {@link View.visibleViewObjects} and {@link View.numVisibleViewObjects}.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param visible Whether or not to cull.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setViewObjectsVisible(ids: string[] | string, visible: boolean): boolean {
        return this.withViewObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.visible !== visible);
            viewObject.visible = visible;
            return changed;
        });
    }

    /**
     * Updates the collidability of the given {@link ViewObject}s in this View.
     *
     * Updates {@link ViewObject.collidable} on the ViewObjects with the given IDs.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param collidable Whether or not to cull.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setViewObjectsCollidable(ids: string[] | string, collidable: boolean): boolean {
        return this.withViewObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.collidable !== collidable);
            viewObject.collidable = collidable;
            return changed;
        });
    }

    /**
     * Updates the culled status of the given {@link ViewObject}s in this View.
     *
     * Updates {@link ViewObject.culled} on the ViewObjects with the given IDs.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param culled Whether or not to cull.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setViewObjectsCulled(ids: string[] | string, culled: boolean): boolean {
        return this.withViewObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.culled !== culled);
            viewObject.culled = culled;
            return changed;
        });
    }

    /**
     * Selects or deselects the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.selected} on the ViewObjects with the given IDs.
     * - Updates {@link View.selectedViewObjects} and {@link View.numSelectedViewObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param selected Whether or not to select.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setViewObjectsSelected(ids: string[] | string, selected: boolean): boolean {
        return this.withViewObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.selected !== selected);
            viewObject.selected = selected;
            return changed;
        });
    }

    /**
     * Highlights or un-highlights the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.highlighted} on the ViewObjects with the given IDs.
     * - Updates {@link View.highlightedViewObjects} and {@link View.numHighlightedViewObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param highlighted Whether or not to highlight.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setViewObjectsHighlighted(ids: string[] | string, highlighted: boolean): boolean {
        return this.withViewObjects(ids, (viewObject: ViewObject) => {
            const changed = (viewObject.highlighted !== highlighted);
            viewObject.highlighted = highlighted;
            return changed;
        });
    }

    /**
     * Applies or removes X-ray rendering for the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.xrayed} on the ViewObjects with the given IDs.
     * - Updates {@link View.xrayedViewObjects} and {@link View.numXRayedViewObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param xrayed Whether or not to xray.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setViewObjectsXRayed(ids: string[] | string, xrayed: boolean): boolean {
        return this.withViewObjects(ids, (viewObject: ViewObject) => {
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
     * - Updates {@link ViewObject.colorize} on the ViewObjects with the given IDs.
     * - Updates {@link View.colorizedViewObjects} and {@link View.numColorizedViewObjects}.
     *
     * @param  ids One or more {@link ViewObject.id} values.
     * @param colorize - RGB colorize factors in range ````[0..1,0..1,0..1]````.
     * @returns True if any {@link ViewObject}s changed opacity, else false if all updates were redundant and not applied.
     */
    setViewObjectsColorized(ids: string[] | string, colorize: number[]) {
        return this.withViewObjects(ids, (viewObject: ViewObject) => {
            viewObject.colorize = colorize;
        });
    }

    /**
     * Sets the opacity of the given {@link ViewObject}s in this View.
     *
     * - Updates {@link ViewObject.opacity} on the ViewObjects with the given IDs.
     * - Updates {@link View.opacityViewObjects} and {@link View.numOpacityViewObjects}.
     *
     * @param  ids - One or more {@link ViewObject.id} values.
     * @param opacity - Opacity factor in range ````[0..1]````.
     * @returns True if any {@link ViewObject}s changed opacity, else false if all updates were redundant and not applied.
     */
    setViewObjectsOpacity(ids: string[] | string, opacity: number): boolean {
        return this.withViewObjects(ids, (viewObject: ViewObject) => {
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
     * - Updates {@link ViewObject.pickable} on the ViewObjects with the given IDs.
     * - Enables or disables the ability to pick the given ViewObjects with {@link View.pick}.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param pickable Whether or not to set pickable.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setViewObjectsPickable(ids: string[] | string, pickable: boolean): boolean {
        return this.withViewObjects(ids, (viewObject: ViewObject) => {
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
     * - Updates {@link ViewObject.clippable} on the ViewObjects with the given IDs.
     * - Enables or disables the ability to pick the given ViewObjects with {@link View.pick}.
     *
     * @param {String[]} ids Array of {@link ViewObject.id} values.
     * @param clippable Whether or not to set clippable.
     * @returns True if any {@link ViewObject}s were updated, else false if all updates were redundant and not applied.
     */
    setViewObjectsClippable(ids: string[] | string, clippable: boolean): boolean {
        return this.withViewObjects(ids, (viewObject: ViewObject) => {
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
    withViewObjects(ids: string[] | string, callback: Function): boolean {
        if (utils.isString(ids)) {
            // @ts-ignore
            ids = [ids];
        }
        let changed = false;
        for (let i = 0, len = ids.length; i < len; i++) {
            const id = ids[i];
            let viewObject = this.viewObjects[id];
            if (viewObject) {
                changed = callback(viewObject) || changed;
            }
        }
        return changed;
    }

    /**
     * Attempts to pick a {@link ViewObject} in this View.
     *
     * - Ignores {@link ViewObject}s that have {@link ViewObject.pickable} set ````false````.
     * - When a {@link ViewObject} is picked, fires a "pick" event on the {@link ViewObject}, with the pick result as parameters.
     *
     * ### Usage
     *
     * Attempting to pick a {@link ViewObject} at the given canvas coordinates:

     * ````javascript
     * const pickResult = myView.pick({
     *     canvasPos: [23, 131]
     * });
     *
     * if (pickResult) {
     *
     *     // Picked a ViewObject
     *
     *     const viewObject = pickResult.viewObject;
     *
     *     // Get geometry of the picked ViewObject
     *
     *     const sceneObject = myView.viewer.scene.sceneObjects[viewObject.id];
     *     const aabb = sceneObject.aabb; // 3D axis-aligned boundary
     *     const center = sceneObject.center; // 3D center
     *
     *     // Get metadata for the picked ViewObject
     *
     *     const objectData = myView.viewer.sceneData.objects[viewObject.id];
     *
     *     if (objectData) {
     *
     *          const name = objectData.name;
     *          const type = objectData.type; // Eg. "IfcWall", "IfcBuildingStorey"
     *
     *          for (let propertySet of objectData.propertySets) {
     *
     *              const propertySetId = propertySet.id;
     *              const propertySetName = propertySet.name;
     *              const propertySetType = propertySet.type;
     *
     *              for (let property of propertySet) {
     *
     *                  const propertyId = property.id;
     *                  const propertyName = property.name;
     *                  const propertyType = property.type;
     *
     *                  //...
     *              }
     *          }
     *
     *          const dataModel = DataObject.dataModel;
     *
     *          const projectId = dataModel.projectId;
     *          const revisionId = dataModel.revisionId;
     *          const author = dataModel.author;
     *          const createdAt = dataModel.createdAt;
     *          const creatingApplication = dataModel.creatingApplication;
     *          const schema = dataModel.schema;
     *
     *          //...
     *     }
     * }
     * ````
     *
     * Attempting to pick a 3D position on the surface of a {@link ViewObject}, at the given canvas coordinates:
     *
     * ````javascript
     * const pickResult = myView.pick({
     *     pickSurface: true,
     *     canvasPos: [23, 131]
     *  });
     *
     * if (pickResult) {
     *
     *     // Picked a ViewObject
     *
     *     const viewObject = pickResult.viewObject;
     *
     *     if (pickResult.worldPos && pickResult.worldNormal) {
     *
     *         // Picked a point and normal on the ViewObject's surface
     *
     *         const worldPos = pickResult.worldPos;
     *         const worldNormal = pickResult.worldNormal;
     *     }
     * }
     * ````
     *
     * Picking the {@link ViewObject} that intersects an arbitrarily-aligned World-space ray:
     *
     * ````javascript
     * const pickResult = myView.pick({
     *     pickSurface: true,   // Picking with arbitrarily-positioned ray
     *     origin: [0,0,-5],    // Ray origin
     *     direction: [0,0,1]   // Ray direction
     * });
     *
     * if (pickResult) {
     *
     *     // Picked a ViewObject
     *
     *     const viewObject = pickResult.viewObject;
     *
     *     if (pickResult.worldPos && pickResult.worldNormal) {
     *
     *         // Picked a point and normal on the ViewObject's surface
     *
     *         const worldPos = pickResult.worldPos;
     *         const worldNormal = pickResult.worldNormal;
     *     }
     * }
     *  ````
     *
     * @param params Picking parameters.
     * @param pickResult Holds the results of the pick attempt.
     * @returns Results when a {@link ViewObject} is successfully picked, else null.
     */
    pick(params: PickParams, pickResult?: PickResult): PickResult {

        if (this.canvas.boundary[2] === 0 || this.canvas.boundary[3] === 0) {
            this.error("Picking not allowed while canvas has zero width or height");
            return null;
        }

        params.pickSurface = params.pickSurface || params.rayPick; // Backwards compatibility

        if (!params.canvasPos && !params.matrix && (!params.origin || !params.direction)) {
            this.warn("picking without canvasPos, matrix, or ray origin and direction");
        }

        const includeViewObjectIds = params.includeViewObjectIds; // Backwards compat
        if (includeViewObjectIds) {
            //   params.includeViewViewObjectIds = getViewObjectIDMap(this.viewer.scene, includeViewObjectIds);
        }

        const excludeViewObjectIds = params.excludeViewObjectIds; // Backwards compat
        if (excludeViewObjectIds) {
            //  params.excludeViewViewObjectIds = getViewObjectIDMap(this.viewer.scene, excludeViewObjectIds);
        }

        // if (this._needRecompile) {
        //     this._recompile();
        //     this._renderer.setImageDirty();
        //     this._needRecompile = false;
        // }
        //
        // pickResult = this._renderer.pick(params, pickResult);
        //
        // if (pickResult) {
        //     if (pickResult.viewObject && pickResult.viewObject.fire) {
        //         pickResult.viewObject.fire("picked", pickResult); // TODO: PerformanceModelNode doesn't fire events
        //     }
        //     return pickResult;
        // }
    }

    /**
     * Destroys this View.
     *
     * Causes {@link Viewer} to fire a "viewDestroyed" event.
     */
    destroy() {
        super.destroy();
    }

    #initViewObjects() {
        const scene = this.viewer.scene;
        const sceneModels = scene.sceneModels;
        for (const id in sceneModels) {
            const sceneModel = sceneModels[id];
            this.#createViewObjects(sceneModel);
        }
        scene.events.on("sceneModelCreated", (sceneModel) => {
            this.#createViewObjects(sceneModel);
        });
        scene.events.on("sceneModelDestroyed", (sceneModel) => {
            this.#destroyViewObjects(sceneModel);
        });
    }

    #createViewObjects(sceneModel: SceneModel) {
        const sceneObjects = sceneModel.sceneObjects;
        for (let id in sceneObjects) {
            const sceneObject = sceneObjects[id];
            const viewObject = new ViewObject(this, sceneObject, {});
            this.viewObjects[viewObject.id] = viewObject;
            this.#numViewObjects++;
            this.#viewObjectIds = null; // Lazy regenerate
        }
    }

    #destroyViewObjects(sceneModel: SceneModel) {
        const sceneObjects = sceneModel.sceneObjects;
        for (let id in sceneObjects) {
            const sceneObject = sceneObjects[id];
            const viewObject = this.viewObjects[sceneObject.id];
            viewObject._destroy();
            this.#numViewObjects--;
            this.#viewObjectIds = null; // Lazy regenerate
        }
    }
}

export {View};
