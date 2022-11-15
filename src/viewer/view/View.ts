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
import {ViewLayer} from "./ViewLayer";

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
    public readonly objects: { [key: string]: ViewObject };

    /**
     * Map of the currently visible {@link ViewObject}s in this View.
     *
     * A ViewObject is visible when {@link ViewObject.visible} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly visibleObjects: { [key: string]: ViewObject };

    /**
     * Map of currently x-rayed {@link ViewObject}s in this View.
     *
     * A ViewObject is x-rayed when {@link ViewObject.xrayed} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly xrayedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently highlighted {@link ViewObject}s in this View.
     *
     * A ViewObject is highlighted when {@link ViewObject.highlighted} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly highlightedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently selected {@link ViewObject}s in this View.
     *
     * A ViewObject is selected when {@link ViewObject.selected} is true.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly selectedObjects: { [key: string]: ViewObject };

    /**
     * Map of currently colorized {@link ViewObject}s in this View.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly colorizedObjects: { [key: string]: ViewObject };

    /**
     * Map of {@link ViewObject}s in this View whose opacity has been updated.
     *
     * Each {@link ViewObject} is mapped here by {@link ViewObject.id}.
     */
    public readonly opacityObjects: { [key: string]: ViewObject };

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

    /**
     * Map of the all {@link ViewLayer}s in this View.
     *
     * Each {@link ViewLayer} is mapped here by {@link ViewLayer.id}.
     */
    public readonly layers: { [key: string]: ViewLayer };

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

        this.#qualityRender = !!options.qualityRender;

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
        scene.events.on("sceneModelCreated", (sceneModel) => {
            this.#createObjects(sceneModel);
        });
        scene.events.on("sceneModelDestroyed", (sceneModel) => {
            this.#destroyObjects(sceneModel);
        });
    }

    #createObjects(sceneModel: SceneModel) {
        const sceneObjects = sceneModel.objects;
        for (let id in sceneObjects) {
            const sceneObject = sceneObjects[id];

            const viewLayerId = sceneObject.viewLayer || "main";
            let viewLayer = this.layers[viewLayerId];
            if (!viewLayer) {
                viewLayer = new ViewLayer({
                    id: viewLayerId,
                    view: this,
                    viewer: this.viewer
                });
                this.layers[viewLayerId] = viewLayer;
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
            const viewLayerId = sceneObject.viewLayer || "main";
            let viewLayer = this.layers[viewLayerId];
            if (!viewLayer) {
                viewLayer = new ViewLayer({
                    id: viewLayerId,
                    view: this,
                    viewer: this.viewer
                });
                this.layers[viewLayerId] = viewLayer;
            }
            const viewObject = this.objects[sceneObject.id];
            viewLayer.deregisterViewObject(viewObject);
            this.deregisterViewObject(viewObject);
            if (viewLayer.numObjects === 0) {
                // TODO: Delete ViewLayer?
            }
        }
    }

    getAmbientColorAndIntensity(): math.FloatArrayType {
        return [0, 0, 0, 1];
    }
}

export {View};
