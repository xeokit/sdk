import type {RendererObject} from "./RendererObject";

/**
 *  Internal interface through which a {@link @xeokit/scene!Scene | Scene} can load content updates into a renderers.
 *
 *  An instance of this class is set on {@link @xeokit/scene!SceneModel.rendererModel | SceneModel.rendererModel} when
 *  the {@link @xeokit/scene!SceneModel | SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererModel {

    /**
     * Interface through which each of the SceneModel's {@link @xeokit/scene!SceneObject | SceneObjects} loads attribute
     * updates (geometry, colors etc) into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/viewer!Renderer | Renderer}.
     *
     *  This is defined when the owner {@link @xeokit/scene!SceneModel | SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererObjects: { [key:string]: RendererObject};
}
