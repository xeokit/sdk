import type { FloatArrayParam } from "@xeokit/math";
/**
 * Interface through which a {@link @xeokit/scene!SceneMesh | SceneMesh} loads attribute updates
 * into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/viewer!Renderer | Renderer}.
 *
 *  This exists at each {@link @xeokit/scene!SceneMesh.rendererMesh | SceneMesh.rendererMesh} when the
 *  containing {@link @xeokit/scene!SceneModel} has been added
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
     * Loads a material metalness value into the {@link @xeokit/viewer!Renderer}.
     *
     * {@link @xeokit/scene!SceneMesh} calls this when we update {@link @xeokit/scene!SceneMesh | SceneMesh.metalness}.
     *
     * @internal
     */
    setMetallic(metallic: number): void;
    /**
     * Loads a meterial roughness value into the {@link @xeokit/viewer!Renderer}.
     *
     * {@link @xeokit/scene!SceneMesh} calls this when we update {@link @xeokit/scene!SceneMesh | SceneMesh.roughness}.
     *
     * @internal
     */
    setRoughness(roughness: number): void;
}
