import * as math from "../math";
import {SceneModel} from "./SceneModel";


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
        bptcSupported: boolean
    };

    /**
     * Creates a {@link SceneModel} that can be rendered by this SceneRenderer.
     * @param cfg
     */
    createSceneModel(cfg: { id?: string | number, [key: string]: any }): SceneModel;

    set transparentEnabled(enabled: boolean);

    set edgesEnabled(enabled: boolean);

    get saoSupported(): boolean;

    set saoEnabled(enabled: boolean);

    set pbrEnabled(enabled: boolean);

    set backgroundColor(color: math.FloatArrayType)

    needStateSort(): void;

    imageDirty(): void;
    //
    // addDrawable(id: string | number, drawable: WebGLSceneRendererDrawable): void;
    //
    // removeDrawable(id: string | number): void;
    //
    // getPickID(pickable: WebGLSceneRendererPickable): number;
    //
    // putPickID(pickId: number): void;
    //
    // clear(params: { pass?: number; }): void;

    needsRender(): boolean;

    render(params: { force?: boolean; }): void;

   // pick(): SceneObject;
}
