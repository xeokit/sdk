import * as math from "../math/index";
import {SceneModel} from "./SceneModel";
import {SceneObject} from "./SceneObject";
import {FloatArrayType} from "../math/math";


export interface SceneRenderer {

    /**
     * The capabilities supported by this SceneRenderer.
     */
    readonly capabilities: {
        astcSupported: boolean;
        etc1Supported: boolean;
        pvrtcSupported: boolean;
        etc2Supported: boolean;
        dxtSupported: boolean;
        bptcSupported: boolean;
    };

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
     *
     * @param viewIndex
     * @param enabled
     */
    setTransparentEnabled(viewIndex: number, enabled: boolean): void;

    /**
     *
     * @param viewIndex
     * @param enabled
     */
    setEdgesEnabled(viewIndex: number, enabled: boolean): void;

    get saoSupported(): boolean;

    /**
     * Sets whether Scalable Ambient Obscurance (SAO) is enabled.
     * @param viewIndex
     * @param enabled
     */
    setSAOEnabled(viewIndex: number, enabled: boolean): void;

    /**
     *
     * @param viewIndex
     * @param enabled
     */
    setPBREnabled(viewIndex: number, enabled: boolean): void;

    /**
     *
     * @param viewIndex
     * @param color
     */
    setBackgroundColor(viewIndex: number, color: math.FloatArrayType): void;

    /**
     * Indicates that the renderer needs to render a new frame.
     */
    imageDirty(): void;

    /**
     * Renders a new frame.
     * @param viewIndex
     * @param params
     * @param [params.force=false]
     */
    render(viewIndex: number, params: { force?: boolean; }): void;

    /**
     * Picks a SceneObject.
     * @param viewIndex
     * @param params
     */
    pick(viewIndex: number, params: {}): SceneObject;
}
