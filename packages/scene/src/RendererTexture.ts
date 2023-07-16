import type {Texture} from "./Texture";

/**
 * Interface through which a {@link @xeokit/scene!Texture | Texture} loads content updates (ie. the texture itself)
 * into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/viewer!Renderer | Renderer}.
 *
 *  This exists at {@link @xeokit/scene!Texture.rendererTexture | Texture.rendererTexture} when
 *  the {@link @xeokit/scene!SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererTexture {

}