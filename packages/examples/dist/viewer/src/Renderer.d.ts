import type { View } from "./View";
import type { Viewer } from "./Viewer";
import type { FloatArrayParam } from "@xeokit/math";
import type { Capabilities } from "@xeokit/core";
import type { ViewObject } from "./ViewObject";
import type { RendererViewObject } from "./RendererViewObject";
import type { SceneModel } from "@xeokit/scene";
/**
 * Defines the contract for the rendering strategy used internally within a {@link @xeokit/viewer!Viewer}.
 *
 * A Viewer uses an implementation of this to allocate and render geometry and materials using an
 * available browser 3D graphics API, such as WebGL or WebGPU.
 *
 * ## Usage
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 *
 * const myViewer = new Viewer({
 *     id: "myViewer",
 *     renderer: new MyRenderer({ })
 * });
 * ````
 *
 * @internal
 */
export interface Renderer {
    /**
     * For each {@link @xeokit/viewer!ViewObject | ViewObject} an interface through which it can issue commands at a {@link @xeokit/viewer!Renderer | Renderer} to
     * show/hide/highlight/select/xray/colorize its representation within each {@link @xeokit/viewer!View | View}.
     */
    rendererViewObjects: {
        [key: string]: RendererViewObject;
    };
    /**
     * Initializes this Renderer by attaching a {@link @xeokit/viewer!Viewer}.
     *
     * @param viewer
     */
    attachViewer(viewer: Viewer): void;
    /**
     * Gets the capabilities of this Renderer.
     */
    getCapabilities(capabilities: Capabilities): void;
    /**
     * Gets whether this Renderer supports SAO.
     */
    getSAOSupported(): boolean;
    /**
     * Attaches a {@link @xeokit/viewer!View} to this Renderer.
     *
     * The Renderer will then begin rendering each {@link @xeokit/scene!SceneModel | SceneModel} created with
     * {@link SceneModel.createModel} for the new View.
     *
     * You can only attach as many Views as indicated in {@link Capabilities.maxViews}, as returned by
     * {@link Renderer.getCapabilities}.
     *
     * You must attach a View before you can attach a SceneModel.
     *
     * @param view The View.
     * @returns A handle for the View within this Renderer.
     */
    attachView(view: View): number;
    /**
     * Deattachs the {@link @xeokit/viewer!View} with the given handle.
     *
     * The Renderer will then cease rendering for that View.
     *
     * @param viewIndex
     */
    detachView(viewIndex: number): void;
    /**
     * Attaches a {@link @xeokit/scene!SceneModel | SceneModel} to this Renderer.
     *
     * This method attaches various "hook objects" to the elements within the SceneModel, through which they can
     * convey their state updates to the Renderer.
     *
     * * Attaches a {@link @xeokit/scene!RendererModel} to the {@link @xeokit/scene!SceneModel}
     * * Attaches a {@link @xeokit/scene!RendererObject} to each of the SceneModel's {@link @xeokit/scene!SceneObject | SceneObjects}
     * * Attaches a {@link @xeokit/scene!RendererMesh} to each of the SceneModel's {@link @xeokit/scene!Mesh | Meshes}
     * * Attaches a {@link @xeokit/scene!RendererTextureSet} to each of the SceneModel's {@link @xeokit/scene!TextureSet | TextureSets}
     * * Attaches a {@link @xeokit/scene!RendererTexture} to each of the SceneModel's {@link @xeokit/scene!Texture | Textures}
     *
     * Then, when we make any state updates to the elements, the hooks will transfer those updates though to the Renderer.
     *
     * You must first attach a View with {@link @xeokit/viewer!Renderer.attachView} before you can attach a SceneModel.
     *
     * @param sceneModel
     */
    attachSceneModel(sceneModel: SceneModel): void;
    /**
     * Detaches a {@link @xeokit/scene!SceneModel | SceneModel} from this Renderer.
     *
     * Detaches and destroys the {@link @xeokit/scene!RendererModel}, {@link @xeokit/scene!RendererObject} and
     * {@link @xeokit/scene!RendererMesh},
     * {@link @xeokit/scene!RendererTexture} instances that were attached in {@link @xeokit/viewer!Renderer.attachSceneModel}.
     *
     * @param sceneModel
     */
    detachSceneModel(sceneModel: SceneModel): void;
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
    setBackgroundColor(viewIndex: number, color: FloatArrayParam): void;
    /**
     * Indicates that the renderer needs to render a new frame for the given View.
     */
    setImageDirty(viewIndex?: number): void;
    /**
     * Clears this renderer for the given view.
     * @param viewIndex
     */
    clear(viewIndex: number): any;
    /**
     * Sets TODO.
     */
    needsRebuild(viewIndex: number): void;
    /**
     * Gets if a new frame needs to be rendered for the given View.
     */
    needsRender(viewIndex: number): boolean;
    /**
     * Renders a frame for a View.
     *
     * @param viewIndex Index of the View to render for.
     * @param params Rendering params.
     * @param [params.force=false] True to force a render, else only render if needed.
     */
    render(viewIndex: number, params: {
        force?: boolean;
    }): void;
    /**
     * Picks a ViewerObject within a View.
     *
     * @param viewIndex Index of the View to render for.
     * @param params Picking params.
     */
    pickSceneObject(viewIndex: number, params: {}): ViewObject | null;
}
