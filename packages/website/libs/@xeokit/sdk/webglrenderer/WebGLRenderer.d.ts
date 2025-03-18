import type { Renderer, View, Viewer } from "../viewer";
import { RenderContext } from "./RenderContext";
import type { Pickable } from "./Pickable";
import type { Capabilities, TextureTranscoder } from "../core";
import { EventEmitter, SDKError } from "../core";
import type { RendererObject, SceneModel } from "../scene";
import { WebGLTileManager } from "./WebGLTileManager";
import { RenderStats } from "./RenderStats";
import { PickParams, PickResult } from "../viewer";
/**
 * A WebGL-based rendering strategy for a Viewer.
 *
 * See {@link "webglrenderer" | @xeokit/webglrenderer} for usage.
 */
export declare class WebGLRenderer implements Renderer {
    #private;
    /**
     * Interfaces through which each {@link viewer!ViewObject | ViewObject} shows/hides/highlights/selects/xrays/colorizes
     * its {@link scene!SceneObject | SceneObject} within the WebGLRenderer that's
     * configured on its {@link viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererObjects: {
        [key: string]: RendererObject;
    };
    /**
     * @internal
     */
    renderStats: RenderStats;
    /**
     * @internal
     */
    tileManager: WebGLTileManager | null;
    renderContext: RenderContext;
    /**
     * @internal
     * @event
     */
    readonly onCompiled: EventEmitter<WebGLRenderer, boolean>;
    /**
     * @internal
     * @event
     */
    readonly onDestroyed: EventEmitter<WebGLRenderer, boolean>;
    /**
     * Creates a WebGLRenderer.
     *
     * @param params Configs
     * @param params.textureTranscoder Injects an optional transcoder that will be used internally by {@link rendererModel.createTexture}
     * to convert transcoded texture data. The transcoder is only required when we'll be providing transcoded data
     * to {@link rendererModel.createTexture}. We assume that all transcoded texture data added to a  ````rendererModel````
     * will then be in a format supported by this transcoder.
     */
    constructor(params: {
        textureTranscoder?: TextureTranscoder;
    });
    /**
     * The Viewer this WebGLRenderer is currently attached to, if any.
     */
    get viewer(): Viewer;
    /**
     * Gets the TextureTranscoder this WebGLRenderer was configured with, if any.
     *
     * @internal
     */
    get textureTranscoder(): void | TextureTranscoder;
    /**
     * Gets the capabilities of this WebGLRenderer.
     *
     * @param capabilities Returns the capabilities of this WebGLRenderer.
     * @internal
     */
    getCapabilities(capabilities: Capabilities): void;
    /**
     * Initializes this WebGLRenderer by attaching a {@link viewer!Viewer | Viewer}.
     *
     * @internal
     * @param viewer Viewer to attach.
     * @returns *void*
     * * Viewer successfully attached.
     * @returns *{@link core!SDKError | SDKError}*
     * * A Viewer is already attached to this Renderer.
     * * The given Viewer is already attached to another Renderer.
     */
    attachViewer(viewer: Viewer): void;
    /**
     * Detaches the {@link viewer!Viewer | Viewer} that is currently attached, if any.
     *
     * @internal
     * @returns *void*
     * * Viewer successfully detached.
     * @returns *{@link core!SDKError | SDKError}*
     * * No Viewer is currently attached to this WebGLRenderer.
     */
    detachViewer(): SDKError | void;
    /**
     * Attaches a {@link viewer!View} to this WebGLRenderer.
     *
     * The WebGLRenderer will then begin rendering each {@link scene!SceneModel | SceneModel} previously or subsequently
     * created with {@link scene!Scene.createModel | Scene.createModel}, for the new View.
     *
     * You can only attach as many Views as indicated in {@link  core!Capabilities.maxViews | Capabilities.maxViews}, as returned by
     * {@link WebGLRenderer.getCapabilities | WebGLRenderer.getCapabilities}.
     *
     * @internal
     * @param view The View to attach.
     * @returns *void*
     * * View successfully attached.
     * @returns *{@link core!SDKError | SDKError}*
     * * No Viewer is attached to this WebGLRenderer.
     * * Caller attempted to attach too many Views.
     * * The WebGLRenderer failed to get a WebGL2 context on the View's canvas.
     */
    attachView(view: View): void | SDKError;
    /**
     * Detaches the given {@link viewer!View} from this Renderer.
     *
     * The Renderer will then cease rendering for that View.
     *
     * @internal
     * @param view The View to detach.
     * @returns *void*
     * * View successfully detached.
     * @returns *{@link core!SDKError | SDKError}*
     * * No Viewer is attached to this WebGLRenderer.
     * * View is not currently attached to this WebGLRenderer.
     */
    detachView(view: View): SDKError | void;
    /**
     * Attaches a {@link scene!SceneModel | SceneModel} to this WebGLRenderer.
     *
     * This method attaches various hooks to the elements within the SceneModel, through which they can
     * upload state updates to the Renderer.
     *
     * * Sets a {@link scene!RendererModel} on {@link scene!SceneModel.rendererModel | SceneModel.rendererModel}
     * * Sets a {@link scene!RendererObject} on each {@link scene!SceneObject.rendererObject | SceneObject.rendererObject}
     * * Sets a {@link scene!RendererMesh} on each {@link scene!SceneMesh.rendererMesh | SceneMesh.rendererMesh}
     * * Sets a {@link scene!RendererTextureSet} on each {@link scene!SceneTextureSet.rendererTextureSet | SceneTextureSet.rendererTextureSet}
     * * Sets a {@link scene!RendererTexture} on each {@link scene!SceneTexture.rendererTexture | SceneTexture.rendererTexture}
     *
     * Then, when we make any state updates to those components, they will upload the updates into the Renderer.
     *
     * You must first attach a View with {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView} before you can attach a SceneModel.
     *
     * @param sceneModel
     * @internal
     * @returns *void*
     * * SceneModel successfully attached.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * SceneModel already attached to this WebGLRenderer, or to another Renderer.
     */
    attachSceneModel(sceneModel: SceneModel): SDKError | void;
    /**
     * Detaches a {@link scene!SceneModel | SceneModel} from this WebGLRenderer.
     *
     * Detaches and destroys the {@link scene!RendererModel}, {@link scene!RendererObject} and
     * {@link scene!RendererMesh},
     * {@link scene!RendererTexture} instances that were attached in {@link webglrenderer!WebGLRenderer.attachSceneModel}.
     *
     * @internal
     * @returns *void*
     * * SceneModel successfully detached.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * SceneModel is not attached to this WebGLRenderer.
     */
    detachSceneModel(sceneModel: SceneModel): SDKError | void;
    /**
     * @private
     */
    attachPickable(pickable: Pickable): number;
    /**
     * @private
     */
    detachPickable(pickId: number): void;
    /**
     * Indicates that the WebGLRenderer needs to draw a new frame.
     * @internal
     */
    setImageDirty(viewIndex?: number): void;
    /**
     * Sets whether the WebGLRenderer draws edges.
     * Triggers a new frame render.
     * @internal
     */
    setEdgesEnabled(viewIndex: number, enabled: boolean): void;
    /**
     * Sets whether the WebGLRenderer draws with physically-based rendering.
     * Triggers a new frame render.
     * @internal
     */
    setPBREnabled(viewIndex: number, enabled: boolean): void;
    getSAOSupported(): boolean;
    /**
     * Sets whether the WebGLRenderer draws with SAO.
     * Triggers a new frame render.
     * @internal
     */
    setSAOEnabled(viewIndex: number, enabled: boolean): void;
    /**
     * Enable/disable rendering of transparent objects for the given View.
     *
     * @param viewIndex Handle to the View, returned earlier by {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @param enabled Whether to enable or disable transparent objects for the View.
     * @internal
     * @returns *void*
     * * Success.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    setTransparentEnabled(viewIndex: number, enabled: boolean): void;
    /**
     * Clears this WebGLRenderer for the given view.
     *
     * @internal
     * @param viewIndex Handle to the View, returned earlier by {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @returns *void*
     * * Success.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * Can't find a View attached to this WebGLRenderer with the given handle.
     */
    clear(viewIndex: number): void | SDKError;
    /**
     * Triggers a rebuild of the shaders within this WebGLRenderer for the given View.
     * @internal
     * @param viewIndex Handle to the View, returned earlier by {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @returns *void*
     * * Success.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * Can't find a View attached to this WebGLRenderer with the given handle.
     */
    setNeedsRebuild(viewIndex?: number): void;
    /**
     * Gets if a new frame needs to be rendered for the given View.
     * @internal
     * @param viewIndex Handle to the View, returned earlier by {@link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @returns *boolean*
     * * True if a new frame needs to be rendered for the View.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this WebGLRenderer.
     * * Can't find a View attached to this WebGLRenderer with the given handle.
     */
    getNeedsRender(viewIndex?: number): boolean;
    /**
     * Renders a frame for a View.
     *
     * @internal
     * @param viewIndex Handle to the View, returned earlier by {@param params Rendering params.
     * @param [params.force=false] True to force a render, else only render if needed.
     * @link webglrenderer!WebGLRenderer.attachView | Renderer.attachView}.
     * @returns *{@link core!SDKError | SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    render(viewIndex: number, params?: {
        force: boolean;
        opaqueOnly: boolean;
    }): void | SDKError;
    /**
     * TODO
     * @internal
     */
    pick(viewIndex: number, pickParams: PickParams, pickResult?: PickResult): PickResult | null;
    beginSnapshot(viewIndex: number, params?: {
        width: number;
        height: number;
    }): void;
    renderSnapshot(): void;
    readSnapshot(): string;
    readSnapshotAsCanvas(): HTMLCanvasElement;
    /**
     * Exits snapshot mode.
     *
     * Switches rendering back to the main canvas.
     */
    endSnapshot(): void;
    destroy(): void;
}
//# sourceMappingURL=WebGLRenderer.d.ts.map