import { View, Viewer, ViewLayer } from "@xeokit/viewer";
import { CameraControl } from "@xeokit/cameracontrol";
import { BCFViewpoint } from "@xeokit/bcf";
import { LocaleService } from "@xeokit/locale";
import { Data } from "@xeokit/data";
import { Scene } from "@xeokit/scene";
import { SceneObjectsKdTree3 } from "@xeokit/kdtree3";
import type * as WebIFC from "web-ifc/web-ifc-api";
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
     * The WebIFC API.
     */
    readonly ifcAPI: WebIFC.IfcAPI;
    /**
     * Provides locale-specific string translations.
     */
    readonly localeService: LocaleService;
    /**
     * Semantic data model.
     */
    readonly data: Data;
    /**
     * Scene representation.
     */
    readonly scene: Scene;
    /**
     * HTML tree view explorer.
     */
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
        treeViewContainerElement: HTMLElement;
        ifcAPI: WebIFC.IfcAPI;
    });
    /**
     * 3D spatial index for scene objects.
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
