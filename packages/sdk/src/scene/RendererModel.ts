import type { RendererObject } from "./RendererObject";

/**
 *  Internal interface through which a {@link SceneModel | SceneModel} can load content updates
 *  into a {@link viewer!Viewer | Viewer's} {@link viewer!Renderer | Renderer}.
 *
 *  While a Scene is attached to a Viewer, an instance of this class is set
 *  on {@link SceneModel.rendererModel | SceneModel.rendererModel} of each of the
 *  Scene's SceneModels.
 *
 * @internal
 */
export interface RendererModel {

  /**
     * Interfaces through which {@link viewer!ViewObject | ViewObjects} control the appearance of
     * their {@link SceneObject | SceneObjects} in a {@link viewer!Viewer | Viewer}.
     */
  rendererObjects: { [key:string]: RendererObject };
}
