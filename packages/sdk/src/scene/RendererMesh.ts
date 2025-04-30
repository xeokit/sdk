import type { FloatArrayParam } from "../math";

/**
 * Internal interface through which a {@link SceneMesh | SceneMesh} loads attribute updates
 * into a {@link viewer!Viewer | Viewer's} {@link viewer!Renderer | Renderer}.
 *
 *  This exists at each {@link SceneMesh.rendererMesh | SceneMesh.rendererMesh} when the
 *  containing {@link SceneModel | SceneModel} has been added
 *  to a {@link viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererMesh {

  /**
     * Loads the {@link SceneMesh | SceneMesh's} modeling matrix into the {@link viewer!Renderer}.
     *
     * {@link SceneMesh} calls this when we update {@link SceneMesh | SceneMesh.matrix}.
     *
     * @internal
     */
  setMatrix(matrix: FloatArrayParam): void;

  /**
     * Loads a material color value into the {@link viewer!Renderer}.
     *
     * {@link SceneMesh} calls this when we update {@link SceneMesh | SceneMesh.color}.
     *
     * @internal
     */
  setColor(color: FloatArrayParam): void;

  /**
     * Sends an opacity factor update to the renderers.
     */
  //  setOpacity(opacity: number): void;
}
