import type {SceneObject} from "./SceneObject";

/**
 * Interface through which a {@link @xeokit/scene!SceneObject | SceneObject} loads attribute updates (geometry, colors etc)
 * into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/viewer!Renderer | Renderer}.
 *
 *  An instance of this class is set on each {@link @xeokit/scene!SceneObject.rendererSceneObject | SceneObject.rendererSceneObject}
 *  when the SceneObject's {@link @xeokit/scene!SceneModel} has been added to a {@link @xeokit/viewer!Renderer | Renderer}.
 *
 *  These property updates are changes to the {@link @xeokit/scene!SceneObject} content itself, ie. not specific to any
 *  {@link @xeokit/viewer!View | View}. This interface is not to be confused with
 *  {@link @xeokit/viewer!RendererViewObject | RendererViewObject}, through which
 *  a {@link @xeokit/viewer!ViewObject | ViewObject} loads updates to the way the SceneObject
 *  *appears* in a target {@link @xeokit/viewer!View | View}.
 *
 * @internal
 */
export interface RendererSceneObject {
}