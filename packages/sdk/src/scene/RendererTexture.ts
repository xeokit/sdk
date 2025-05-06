import type {SceneTexture} from "./SceneTexture";

/**
 * Interface through which a {@link SceneTexture | SceneTexture} loads content updates (ie. the texture itself)
 * into a {@link viewer!Viewer | Viewer's} {@link viewer!Renderer | Renderer}.
 *
 *  This exists at {@link SceneTexture.rendererTexture | SceneTexture.rendererTexture} when
 *  the {@link SceneModel | SceneModel} has been added to a {@link viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererTexture {

}
