import type {View} from "./View";
import type {Viewer} from "./Viewer";
import {FloatArrayParam} from "@xeokit/math/math";
import {Capabilities, SceneModel} from "@xeokit/core/components";
import {ViewObject} from "./ViewObject";
import {AddModelParams} from "./AddModelParams";
import {RendererViewObject} from "./RendererViewObject";

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
     * A RenderObject for each object in the renderer.
     */
    rendererViewObjects: { [key: string]: RendererViewObject }

    /**
     * Initializes this Renderer.
     *
     * @param viewer
     */
    init(viewer: Viewer): void;

    /**
     * Gets the capabilities of this Renderer.
     */
    getCapabilities(capabilities: Capabilities): void;

    /**
     * Gets whether this Renderer supports SAO.
     */
    getSAOSupported(): boolean;

    /**
     * Registers a {@link @xeokit/viewer!View} with this Renderer.
     *
     * The Renderer will then begin rendering each {@link @xeokit/viewer!SceneModel | SceneModel} created with {@link SceneModel.createModel} for the new View.
     *
     * You can only register as many Views as indicated in {@link Capabilities.maxViews}, as returned by {@link Renderer.getCapabilities}.
     *
     * @param view The View.
     * @returns A handle for the View within this Renderer.
     */
    registerView(view: View): number;

    /**
     * Deregisters the {@link @xeokit/viewer!View} with the given handle.
     *
     * The Renderer will then cease rendering for that View.
     *
     * @param viewIndex
     */
    deregisterView(viewIndex: number): void;

    /**
     * Adds a {@link @xeokit/core/components!SceneModel | SceneModel} to this Renderer.
     *
     * @param params SceneModel addition params
     */
    addModel(params: AddModelParams): void;

    /**
     * Removes a {@link @xeokit/viewer!SceneModel | SceneModel} from this Renderer.
     *
     * @param id ID of the SceneModel to remove
     */
    removeModel(id: string);

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
     * Clears this renderer,
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
    render(viewIndex: number, params: { force?: boolean; }): void;

    /**
     * Picks a ViewerObject within a View.
     *
     * @param viewIndex Index of the View to render for.
     * @param params Picking params.
     */
    pickSceneObject(viewIndex: number, params: {}): ViewObject | null;
}
