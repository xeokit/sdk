import type {SceneObject} from "./SceneObject";

/**
 *  Internal interface through which a {@link SceneObject} can load property updates into a renderer.
 *
 *  This exists at each {@link SceneObject.rendererObject} when the ownder {@link SceneModel} has been added
 *  to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererObject {
}