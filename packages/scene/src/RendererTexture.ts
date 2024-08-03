import type {SceneTexture} from "./SceneTexture";

/**
 * Interface through which a {@link @xeokit/scene!SceneTexture | SceneTexture} loads content updates (ie. the texture itself)
 * into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/viewer!Renderer | Renderer}.
 *
 *  This exists at {@link @xeokit/scene!SceneTexture.rendererTexture | SceneTexture.rendererTexture} when
 *  the {@link @xeokit/scene!SceneModel | SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererTexture {

}
