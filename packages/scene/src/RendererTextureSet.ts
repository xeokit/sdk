import type {RendererTexture} from "./RendererTexture";

/**
 *  Internal interface through which a {@link TextureSet} can load property updates into a renderer.
 *
 *  This exists at {@link TextureSet.rendererTextureSet} when the {@link SceneModel} has been added
 *  to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererTextureSet {
    /**
     * TODO
     */
    readonly colorRendererTexture: RendererTexture;

    /**
     * TODO
     */
    readonly metallicRoughnessRendererTexture: RendererTexture;

    /**
     * TODO
     */
    readonly emissiveRendererTexture: RendererTexture;

    /**
     * TODO
     */
    readonly occlusionRendererTexture: RendererTexture;
}