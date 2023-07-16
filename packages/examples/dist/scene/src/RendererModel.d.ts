import type { RendererObject } from "./RendererObject";
/**
 *  Internal interface through which a {@link @xeokit/scene!SceneModel} can load property updates into a renderer.
 *
 *  This exists at {@link @xeokit/scene!SceneModel.rendererSceneModel} when the {@link @xeokit/scene!SceneModel} has been added
 *  to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererModel {
    /**
     *  Internal interface through which {@link @xeokit/scene!SceneObject | SceneObjects} can load property updates into a renderer.
     *
     *  This is defined when the owner {@link @xeokit/scene!SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererSceneObjects: {
        [key: string]: RendererObject;
    };
}
