import type {RendererSceneObject} from "./RendererSceneObject";

/**
 *  Internal interface through which a {@link @xeokit/scene!Scene} can load content updates into a renderer.
 *
 *  An instance of this class is set on {@link @xeokit/scene!SceneModel.rendererSceneModel | SceneModel.rendererSceneModel} when
 *  the {@link @xeokit/scene!SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererSceneModel {

    /**
     * Interface through which each of the SceneModel's {@link @xeokit/scene!SceneObject | SceneObjects} loads attribute
     * updates (geometry, colors etc) into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/viewer!Renderer | Renderer}.
     *
     *  This is defined when the owner {@link @xeokit/scene!SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererSceneObjects: { [key:string]: RendererSceneObject};
}