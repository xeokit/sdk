import type {FloatArrayParam} from "@xeokit/math";

/**
 * Interface through which a {@link @xeokit/scene!SceneMesh | SceneMesh} loads attribute updates
 * into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/viewer!Renderer | Renderer}.
 *
 *  This exists at each {@link @xeokit/scene!SceneMesh.rendererMesh | SceneMesh.rendererMesh} when the
 *  containing {@link @xeokit/scene!SceneModel | SceneModel} has been added
 *  to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererMesh {

    /**
     * Loads the {@link @xeokit/scene!SceneMesh | SceneMesh's} modeling matrix into the {@link @xeokit/viewer!Renderer}.
     *
     * {@link @xeokit/scene!SceneMesh} calls this when we update {@link @xeokit/scene!SceneMesh | SceneMesh.matrix}.
     *
     * @internal
     */
    setMatrix(matrix: FloatArrayParam): void;

    /**
     * Loads a material color value into the {@link @xeokit/viewer!Renderer}.
     *
     * {@link @xeokit/scene!SceneMesh} calls this when we update {@link @xeokit/scene!SceneMesh | SceneMesh.color}.
     *
     * @internal
     */
    setColor(color: FloatArrayParam): void;

    /**
     * Sends an opacity factor update to the renderers.
     */
  //  setOpacity(opacity: number): void;
}
