import { View, Viewer, ViewLayer } from "@xeokit/viewer";
import { CameraControl } from "@xeokit/cameracontrol";
import { BCFViewpoint } from "@xeokit/bcf";
import { LocaleService } from "@xeokit/locale";
import { Data } from "@xeokit/data";
import { Scene } from "@xeokit/scene";
import { SceneObjectsKdTree3 } from "@xeokit/kdtree3";
/**
 * Minimal proof-of-concept IFC model viewer built from various xeokit SDK components.
 *
 * Demonstrates how the SDK components are designed to be used together in our applications.
 *
 * See {@link "@xeokit/ifcviewer"} for usage.
 */
export declare class IFCViewer {
    #private;
    /**
     * The actual xeokit viewer.
     */
    readonly viewer: Viewer;
    /**
     * Scene representation.
     */
    readonly scene: Scene;
    /**
     * Semantic data model.
     */
    readonly data: Data;
    /**
     * Controls camera with user input.
     */
    readonly cameraControl: CameraControl;
    /**
     * An independently-configurable view.
     */
    readonly view: View;
    /**
     * Provides locale-specific string translations.
     */
    readonly localeService: LocaleService;
    /**
     * View layer that contains model objects.
     */
    readonly modelsLayer: ViewLayer;
    /**
     * View layer that contains background objects.
     */
    readonly backgroundLayer: ViewLayer;
    /**
     * Creates an IFC model viewer.
     *
     * @param cfg
     */
    constructor(cfg: {
        canvasElement: HTMLCanvasElement;
    });
    /**
     * 3D spatial index for scene objects.
     *
     * Use this with {@link IFCViewer.picker}.
     */
    get objectsKdTree3(): SceneObjectsKdTree3;
    /**
     * Loads an IFC model.
     *
     * @param cfg
     */
    loadModel(cfg: {
        id: string;
        src: string;
    }): Promise<void>;
    /**
     * Unloads a model.
     *
     * @param id
     */
    unloadModel(id: string): void;
    /**
     * Saves a model.
     *
     * @param id
     */
    saveModel(id: string): ArrayBuffer;
    /**
     * Unloads all models.
     */
    clearModels(): void;
    /**
     * Loads a BCF viewpoint.
     *
     * @param bcfViewpoint
     */
    loadBCF(bcfViewpoint: BCFViewpoint): void;
    /**
     * Saves a BCF viewpoint.
     */
    saveBCF(): BCFViewpoint;
}
