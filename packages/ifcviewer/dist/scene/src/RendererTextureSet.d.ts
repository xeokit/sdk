import type { RendererTexture } from "./RendererTexture";
/**
 *  Internal interface through which a {@link @xeokit/scene!SceneTextureSet} can load property updates into a renderers.
 *
 *  This exists at {@link @xeokit/scene!SceneTextureSet.rendererTextureSet} when the {@link @xeokit/viewer!Renderer} has been added
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
