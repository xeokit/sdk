import * as math from "../math/index";
import {SceneModel} from "./SceneModel";
import {SceneObject} from "./SceneObject";
import {FloatArrayType} from "../math/math";
import {View} from "../view/View";
import {ViewerCapabilities} from "../ViewerCapabilities";

/**
 * The renderer within a {@link Viewer}.
 */
export interface SceneRenderer {

    /**
     * The capabilities supported by this SceneRenderer.
     */
    readonly capabilities: ViewerCapabilities;

    /**
     * Adds a {@link View} to this SceneRenderer.
     *
     * Returns the index of the View within this SceneRenderer.
     *
     * @param view
     */
    registerView(view: View) : number;

    /**
     * Deregisters the {@link View} at the given index.
     *
     * @param viewIndex
     */
    deregisterView(viewIndex: number) : void;

    /**
     * Creates a {@link SceneModel} within this SceneRenderer.
     *
     * The SceneModel is removed from the SceneRenderer when we call {@link SceneModel#destroy}.
     *
     * @param cfg
     */
    createSceneModel(cfg: {
        id?: string;
        pbrEnabled?: boolean;
        saoEnabled?: boolean;
        matrix?: FloatArrayType;
        scale?: FloatArrayType;
        quaternion?: FloatArrayType;
        rotation?: FloatArrayType;
        position?: FloatArrayType;
        origin?: FloatArrayType;
    }): SceneModel;

    /**
     * Gets whether this SceneRenderer supports SAO.
     */
    getSAOSupported(): boolean;

    /**
     * Enable/disable rendering of transparent objects for the given View.
     *
     * @param viewIndex Index of the View.
     * @param enabled Whether to enable or disable transparent objects for the View.
     */
    setTransparentEnabled(viewIndex: number, enabled: boolean): void;

    /**
     * Enable/disable edge enhancement for the given View.
     *
     * @param viewIndex Index of the View.
     * @param enabled Whether to enable or disable edges for the View.
     */
    setEdgesEnabled(viewIndex: number, enabled: boolean): void;

    /**
     * Enable/disable SAO for the given View.
     *
     * @param viewIndex Index of the View.
     * @param enabled Whether to enable or disable SAO for the View.
     */
    setSAOEnabled(viewIndex: number, enabled: boolean): void;

    /**
     * Enable/disable PBR for the given View.
     *
     * @param viewIndex Index of the View.
     * @param enabled Whether to enable or disable PBR for the View.
     */
    setPBREnabled(viewIndex: number, enabled: boolean): void;

    /**
     * Set background color for the given View.
     *
     * @param viewIndex Index of the View.
     * @param color RGB background color.
     */
    setBackgroundColor(viewIndex: number, color: math.FloatArrayType): void;

    /**
     * Indicates that the renderer needs to render a new frame for the given View.
     */
    imageDirty(viewIndex: number): void;

    /**
     * Renders a new frame.
     * @param viewIndex
     * @param params
     * @param [params.force=false]
     */
    render(viewIndex: number, params: { force?: boolean; }): void;

    /**
     * Picks a SceneObject.
     *
     * @param viewIndex
     * @param params
     */
    pick(viewIndex: number, params: {}): SceneObject;
}
