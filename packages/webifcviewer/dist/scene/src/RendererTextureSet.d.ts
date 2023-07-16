import type { RendererTexture } from "./RendererTexture";
/**
 *  Internal interface through which a {@link @xeokit/scene!TextureSet} can load property updates into a renderer.
 *
 *  This exists at {@link @xeokit/scene!TextureSet.rendererTextureSet} when the {@link @xeokit/viewer!Renderer} has been added
 *  to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererTextureSet {
    readonly colorTexture: RendererTexture;
    readonly metallicRoughnessTexture: RendererTexture;
    readonly emissiveTexture: RendererTexture;
    readonly occlusionTexture: RendererTexture;
}
