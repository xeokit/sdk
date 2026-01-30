import {Scene, type SceneModelStats} from "../scene";
import {Data, type DataModelStats} from "../data";
import {View, Viewer} from "../viewer";
import {WebGLRenderer} from "../webglrenderer";
import {EventsLogger, SDKTask} from "../core";
import {SceneAABB3Index} from "../collision/aabb";
import {CameraFlightAnimation} from "../cameraflight";
import {type AABB3Float} from "../math/boundaries";


export interface DemoHelperConfig {
    makeComponents?: boolean;
    logging?: boolean;
    showOverlayButton?: boolean;
}

/**
 * Helper class to set up a basic 3D demo with a Scene, Data, Viewer, WebGLRenderer, and View.
 *
 * See {@link demo | @xeokit/sdk/demo} for usage.
 */
export class DemoHelper {

    /**
     * The Scene created by the DemoHelper. Holds all 3D objects.
     */
    public scene: Scene;

    /**
     * Dynamically tracks the 3D boundaries of the objects in the Scene.
     */
    public aabb3Index: SceneAABB3Index;

    /**
     * The Data created by the DemoHelper. Holds all data models.
     */
    public data: Data;

    /**
     * The Viewer created by the DemoHelper.
     */
    public viewer: Viewer;

    /**
     * The WebGLRenderer created by the DemoHelper.
     */
    public renderer: WebGLRenderer;

    /**
     * The View created by the DemoHelper.
     */
    public view: View;

    /**
     * The CameraFlightAnimation for the View.
     */
    public cameraFlight: CameraFlightAnimation;

    private makeComponents: boolean;
    private showOverlayButton: boolean;
    private overlayButton: HTMLButtonElement | null = null;
    private overlayDiv: HTMLDivElement | null = null;
    private overlayVisible: boolean = false;

    /**
     * Statistics about the demo, available after calling `finished()`.
     */
    public stats: {

        /**
         * 3D axis-aligned bounding box (AABB) that
         * encloses all objects in the Scene.
         */
        aabb: AABB3Float;

        /**
         * The time at which the demo initialization started.
         */
        startTime: number;

        /**
         * The time at which the demo initialization ended.
         */
        endTime: number;

        /**
         * The total time taken for demo initialization, in milliseconds.
         */
        elapsedTime: number;

        /**
         * The combined statistics of all SceneModels in the Scene.
         */
        scene: SceneModelStats;

        /**
         * Combined statistics of all DataModels in the Data.
         */
        data: DataModelStats;
    } ;

    /**
     * Creates a DemoHelper instance.
     * @param cfg
     */
    constructor(cfg: DemoHelperConfig = {}) {
        this.makeComponents = cfg.makeComponents !== false;
        this.showOverlayButton = cfg.showOverlayButton !== false;
        this.stats = {
            startTime: 0,
            endTime: 0,
            elapsedTime: 0,
            aabb: null,
            scene: null,
            data: null
        };
    }

    /**
     * Initializes the DemoHelper by creating the Scene, Data, Viewer, WebGLRenderer, and View.
     *
     * @param cfg Configuration options for initialization.
     * @returns A promise that resolves when initialization is complete.
     */
    public init(cfg: DemoHelperConfig = {}): Promise<any> {
        return new Promise((resolve, reject) => {

            this.stats.startTime = performance.now();

            if (this.makeComponents) {

                this.scene = new Scene();
                this.data = new Data();
                this.viewer = new Viewer();
                this.renderer = new WebGLRenderer();

                if (cfg.logging) {
                    new EventsLogger(this.scene.events,    { prefix: "[Scene        ]" });
                    new EventsLogger(this.data.events,     { prefix: "[Data         ]" });
                    new EventsLogger(this.viewer.events,   { prefix: "[Viewer       ]" });
                    new EventsLogger(this.renderer.events, { prefix: "[WebGLRenderer]" });
                }

                this.aabb3Index = new SceneAABB3Index(this.scene);

                this.viewer.attachScene(this.scene);
                this.renderer.attachViewer(this.viewer);

                const viewResult =  this.viewer.createView({
                    id: "mainView",
                    elementId: "demoCanvas"
                });

                if (viewResult.ok === false) {
                    reject(viewResult.error);
                    return;
                }

                this.view = viewResult.value;

                this.cameraFlight = new CameraFlightAnimation(this.view);

                // @ts-ignore
                window.demoHelper = this;

                if (this.showOverlayButton || cfg.showOverlayButton) {
                    this._createOverlayButton();
                }

                resolve({});
            } else {
                resolve({});
            }
        });
    }

    /**
     * Moves the camera to fit the entire scene within the view.
     */
    public viewFit(): void {
        if (this.cameraFlight) {
            this.cameraFlight.jumpTo({
                aabb: this.aabb3Index.getSceneAABB()
            });
        }
    }

    /**
     * Orbits the camera around the scene.
     */
    public orbit(): void {
        new SDKTask({
            name: "Orbit Camera",
            repeat: true,
            stage: SDKTask.CollectInputStage,
            task: () => {
           if (this.view) {
               this.view.camera.orbitYaw(-0.5);
           }
            }
        });
    }

    public finished(): void {
        const stats = this.stats;
        stats.scene = this._getCombinedSceneModelStats();
        stats.data = this._getCombinedDataModelStats();
        stats.aabb = this.aabb3Index.getSceneAABB();
        stats.endTime = performance.now();
        stats.elapsedTime = stats.endTime - (stats.startTime ?? stats.endTime);
        this.signalFinished();
    }

    private signalFinished(): void {
        const div = document.createElement("div");
        div.id = "ExampleLoaded";
        document.body.appendChild(div);
    }

    private _getCombinedSceneModelStats(): SceneModelStats {

        const combinedStats: SceneModelStats = {
            numTransforms:0,
            numObjects:0,
            numMeshes: 0,
            numGeometries: 0,
            numTextures: 0,
            numTextureSets: 0,
            numTriangles: 0,
            numLines: 0,
            numPoints: 0,
            numVertices: 0,
            textureBytes: 0,
        };

        for (const modelId in this.scene.models) {
            const model = this.scene.models[modelId];
            const stats = model.stats;
            combinedStats.numObjects += stats.numObjects;
            combinedStats.numGeometries += stats.numGeometries;
            combinedStats.numTextures += stats.numTextures;
            combinedStats.numTriangles += stats.numTriangles;
            combinedStats.numPoints += stats.numPoints;
            combinedStats.numLines += stats.numLines;
            combinedStats.numVertices += stats.numVertices;
            combinedStats.numMeshes += stats.numMeshes;
            combinedStats.numTextureSets += stats.numTextureSets;
            combinedStats.textureBytes += stats.textureBytes;
        }

        return combinedStats;
    }

    private _getCombinedDataModelStats(): DataModelStats {

        const combinedStats: DataModelStats = {
            numObjects: 0,
            numRelationships: 0,
            numPropertySets: 0
        };

        for (const modelId in this.data.models) {
            const model = this.data.models[modelId];
            const stats = model.stats;
            combinedStats.numObjects += stats.numObjects;
            combinedStats.numRelationships += stats.numRelationships;
            combinedStats.numPropertySets += stats.numPropertySets;
        }
        return combinedStats;
    }

    private _createOverlayButton(): void {
        if (typeof document === "undefined") return;
        if (this.overlayButton) return; // Already created

        // Create button
        const button = document.createElement("button");
        button.innerText = "☰ Debug";
        button.style.position = "fixed";
        button.style.top = "16px";
        button.style.right = "16px";
        button.style.zIndex = "100001";
        button.style.padding = "8px 16px";
        button.style.background = "#222";
        button.style.color = "#fff";
        button.style.border = "none";
        button.style.borderRadius = "4px";
        button.style.cursor = "pointer";
        button.style.fontSize = "16px";
        button.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        button.style.opacity = "0.85";
        button.style.transition = "background 0.2s, opacity 0.2s";
        button.onmouseenter = () => { button.style.background = "#444"; button.style.opacity = "1"; };
        button.onmouseleave = () => { button.style.background = "#222"; button.style.opacity = "0.85"; };

        // Create overlay
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.paddingTop = "48px";
        overlay.style.top = "0";
        overlay.style.right = "0";
        overlay.style.width = "400px";
        overlay.style.height = "100%";
        overlay.style.background = "rgba(30, 30, 40, 0.97)";
        overlay.style.zIndex = "100000";
        overlay.style.display = "none";
        overlay.style.boxShadow = "2px 0 12px rgba(0,0,0,0.25)";
        overlay.style.overflowY = "auto";
        overlay.style.transition = "transform 0.2s";
        overlay.style.color = "#fff";
        overlay.style.fontFamily = "sans-serif";
        overlay.innerHTML = `<div style="padding:24px 16px 16px 24px;font-size:18px;font-weight:bold;">Overlay Panel</div>
        <div style="padding:0 16px 16px 24px;font-size:14px;">You can put any content here.</div>`;

        // Button click toggles overlay
        button.onclick = () => {
            this.overlayVisible = !this.overlayVisible;
            overlay.style.display = this.overlayVisible ? "block" : "none";
        };

        // Add to DOM
        document.body.appendChild(button);
        document.body.appendChild(overlay);

        this.overlayButton = button;
        this.overlayDiv = overlay;
    }
}