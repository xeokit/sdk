import type {RendererObject} from "./RendererObject";

/**
 *  Internal interface through which a {@link SceneModel} can load property updates into a renderer.
 *
 *  This exists at {@link SceneModel.rendererModel} when the {@link SceneModel} has been added
 *  to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererModel {

    /**
     *  Internal interface through which {@link SceneObject | SceneObjects} can load property updates into a renderer.
     *
     *  This is defined when the owner {@link SceneModel} has been added to a {@link @xeokit/viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererObjects: { [key:string]: RendererObject}


}