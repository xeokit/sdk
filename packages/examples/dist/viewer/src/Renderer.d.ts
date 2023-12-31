import type { View } from "./View";
import type { Viewer } from "./Viewer";
import type { FloatArrayParam } from "@xeokit/math";
import type { Capabilities } from "@xeokit/core";
import { SDKError } from "@xeokit/core";
import type { ViewObject } from "./ViewObject";
import type { RendererViewObject } from "./RendererViewObject";
import type { SceneModel } from "@xeokit/scene";
/**
 * Defines the contract for the rendering strategy used internally within a {@link @xeokit/viewer!Viewer}.
 *
 * A Viewer uses an implementation of this internally to allocate and render geometry and materials using an
 * available browser 3D graphics API, such as WebGL or WebGPU.
 *
 * ## Usage
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new WebGLRenderer({ }) // Or WebGPURenderer, MockRenderer etc.
 * });
 * ````
 *
 * @internal
 */
export interface Renderer {
    /**
     * Interfaces through which each {@link @xeokit/viewer!ViewObject | ViewObject} shows/hides/highlights/selects/xrays/colorizes
     * its {@link @xeokit/scene!SceneObject | SceneObject} within the {@link @xeokit/viewer!Renderer | Renderer} that's
     * configured on its {@link @xeokit/viewer!Viewer | Viewer}.
     */
    rendererViewObjects: {
        [key: string]: RendererViewObject;
    };
    /**
     * Initializes this Renderer by attaching a {@link @xeokit/viewer!Viewer}.
     *
     * @internal
     * @param viewer Viewer to attach..
     * @returns *void*
     * * Viewer successfully detached.
     * @returns *{@link @xeokit/core!SDKError}*
     * * A Viewer is already attached to this Renderer.
     */
    attachViewer(viewer: Viewer): void | SDKError;
    /**
     * Gets the capabilities of this Renderer.
     * @internal
     */
    getCapabilities(capabilities: Capabilities): void;
    /**
     * Gets whether this Renderer supports SAO.
     * @internal
     */
    getSAOSupported(): boolean;
    /**
     * Attaches a {@link @xeokit/viewer!View} to this Renderer.
     *
     * The Renderer will then begin rendering each {@link @xeokit/scene!SceneModel | SceneModel} previously or subsequently
     * created with {@link @xeokit/scene!Scene.createModel | Scene.createModel} , for the new View.
     *
     * You can only attach as many Views as indicated in {@link  @xeokit/core!Capabilities.maxViews | Capabilities.maxViews}, as returned by
     * {@link @xeokit/viewer!Renderer.getCapabilities | Renderer.getCapabilities}.
     *
     * You must attach a View before you can attach a SceneModel.
     *
     * @internal
     * @param view The View to attach.
     * @returns *number*
     * * Handle to the View within this Renderer. Use this handle to update Renderer state for the View.
     * @returns *{@link @xeokit/core!SDKError}*
     * * Caller attempted to attach too many Views.
     */
    attachView(view: View): SDKError | number;
    /**
     * Detaches the {@link @xeokit/viewer!View} with the given handle from this Renderer.
     *
     * The Renderer will then cease rendering for that View.
     *
     * @internal
     * @param viewHandle Handle to the View, which was returned by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @returns *void*
     * * View successfully detached.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached for the given handle.
     */
    detachView(viewHandle: number): SDKError | void;
    /**
     * Attaches a {@link @xeokit/scene!SceneModel | SceneModel} to this Renderer.
     *
     * This method attaches various "hook objects" to the elements within the SceneModel, through which they can
     * convey their state updates to the Renderer.
     *
     * * Sets a {@link @xeokit/scene!RendererModel} on {@link @xeokit/scene!SceneModel | SceneModel.rendererModel}
     * * Sets a {@link @xeokit/scene!RendererObject} on each {@link @xeokit/scene!SceneObject | SceneObject.rendererObject}
     * * Sets a {@link @xeokit/scene!RendererMesh} on each {@link @xeokit/scene!Mesh | Meshe.rendererMesh}
     * * Sets a {@link @xeokit/scene!RendererTextureSet} on each {@link @xeokit/scene!TextureSet | TextureSet.rendererTextureSet}
     * * Sets a {@link @xeokit/scene!RendererTexture} on each {@link @xeokit/scene!Texture | Texture.rendererTexture}
     *
     * Then, when we make any state updates to those components, they will transfer the updates though the hooks into the Renderer.
     *
     * You must first attach a View with {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView} before you can attach a SceneModel.
     *
     * @param sceneModel
     * @internal
     * @returns *void*
     * * SceneModel successfully attached.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * SceneModel already attached to this Renderer, or to another Renderer.
     */
    attachSceneModel(sceneModel: SceneModel): void | SDKError;
    /**
     * Detaches a {@link @xeokit/scene!SceneModel | SceneModel} from this Renderer.
     *
     * Detaches and destroys the {@link @xeokit/scene!RendererModel}, {@link @xeokit/scene!RendererObject} and
     * {@link @xeokit/scene!RendererMesh},
     * {@link @xeokit/scene!RendererTexture} instances that were attached in {@link @xeokit/viewer!Renderer.attachSceneModel}.
     *
     * @internal
     * @param sceneModel The SceneModel
     * @returns *void*
     * * SceneModel successfully detached.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * The SceneModel is not attached to this Renderer.
     */
    detachSceneModel(sceneModel: SceneModel): void | SDKError;
    /**
     * Enable/disable rendering of transparent objects for the given View.
     *
     * @param viewHandle Handle to the View, returned earlier by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @param enabled Whether to enable or disable transparent objects for the View.
     * @internal
     * @returns *void*
     * * Success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    setTransparentEnabled(viewHandle: number, enabled: boolean): void | SDKError;
    /**
     * Enable/disable edge enhancement for the given View.
     *
     * @param viewHandle Handle to the View, returned earlier by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @param enabled Whether to enable or disable edges for the View.
     * @internal
     * @returns *void*
     * * Success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    setEdgesEnabled(viewHandle: number, enabled: boolean): void | SDKError;
    /**
     * Enable/disable scaleable ambient obscurrance SAO for the given View.
     *
     * @param viewHandle Handle to the View, returned earlier by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @param enabled Whether to enable or disable SAO for the View.
     * @internal
     * @returns *void*
     * * Success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    setSAOEnabled(viewHandle: number, enabled: boolean): void | SDKError;
    /**
     * Enable/disable physically-based rendering (PBR) for the given View.
     *
     * @param viewHandle Handle to the View, returned earlier by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @param enabled Whether to enable or disable PBR for the View.
     * @internal
     * @returns *void*
     * * Success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    setPBREnabled(viewHandle: number, enabled: boolean): void | SDKError;
    /**
     * Set background color for the given View.
     *
     * @param viewHandle Handle to the View, returned earlier by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @param color RGB background color.
     * @internal
     * @returns *void*
     * * Success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    setBackgroundColor(viewHandle: number, color: FloatArrayParam): void | SDKError;
    /**
     * Indicates that the renderer needs to render a new frame for the given View.
     *
     * @internal
     * @param viewHandle Handle to the View, returned earlier by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @returns *void*
     * * Success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    setImageDirty(viewHandle?: number): void | SDKError;
    /**
     * Clears this renderer for the given view.
     *
     * @internal
     * @param viewHandle Handle to the View, returned earlier by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @returns *void*
     * * Success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    clear(viewHandle: number): void | SDKError;
    /**
     * Sets TODO.
     * @internal
     * @param viewHandle Handle to the View, returned earlier by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @returns *void*
     * * Success.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    needsRebuild(viewHandle: number): void | SDKError;
    /**
     * Gets if a new frame needs to be rendered for the given View.
     * @internal
     * @param viewHandle Handle to the View, returned earlier by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @returns *boolean*
     * * True if a new frame needs to be rendered for the View.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    needsRender(viewHandle: number): SDKError | boolean;
    /**
     * Renders a frame for a View.
     *
     * @param params Rendering params.
     * @param [params.force=false] True to force a render, else only render if needed.
     * @internal
     * @param viewHandle Handle to the View, returned earlier by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    render(viewHandle: number, params: {
        force?: boolean;
    }): void | SDKError;
    /**
     * Picks a ViewerObject within a View.
     *
     * @param viewHandle Handle to the View, returned earlier by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @param params Picking params.
     * @internal
     * @param viewHandle Handle to the View, returned earlier by {@link @xeokit/viewer!Renderer.attachView | Renderer.attachView}.
     * @returns *{@link @xeokit/core!SDKError}*
     * * No View is currently attached to this Renderer.
     * * Can't find a View attached to this Renderer with the given handle.
     */
    pickViewObject(viewHandle: number, params: {}): SDKError | ViewObject | null;
}
