import type {FloatArrayParam} from "@xeokit/math";

/**
 * Interface through which a {@link @xeokit/scene!Mesh | Mesh} loads attribute updates 
 * into a {@link @xeokit/viewer!Viewer | Viewer's} {@link @xeokit/viewer!Renderer | Renderer}.
 *
 *  This exists at each {@link @xeokit/scene!Mesh.rendererMesh | Mesh.rendererMesh} when the
 *  containing {@link @xeokit/scene!SceneModel} has been added
 *  to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererMesh {

    /**
     * Loads the {@link @xeokit/scene!Mesh | Mesh's} modeling matrix into the {@link @xeokit/viewer!Renderer}.
     *
     * {@link @xeokit/scene!Mesh} calls this when we update {@link @xeokit/scene!Mesh | Mesh.matrix}.
     *
     * @internal
     */
    setMatrix(matrix: FloatArrayParam): void;

    /**
     * Loads a material color value into the {@link @xeokit/viewer!Renderer}.
     *
     * {@link @xeokit/scene!Mesh} calls this when we update {@link @xeokit/scene!Mesh | Mesh.color}.
     *
     * @internal
     */
    setColor(color: FloatArrayParam): void;

    /**
     * Loads a material metalness value into the {@link @xeokit/viewer!Renderer}.
     *
     * {@link @xeokit/scene!Mesh} calls this when we update {@link @xeokit/scene!Mesh | Mesh.metalness}.
     *
     * @internal
     */
    setMetallic(metallic: number): void;

    /**
     * Loads a meterial roughness value into the {@link @xeokit/viewer!Renderer}.
     *
     * {@link @xeokit/scene!Mesh} calls this when we update {@link @xeokit/scene!Mesh | Mesh.roughness}.
     *
     * @internal
     */
    setRoughness(roughness: number): void;

    /**
     * Sends an opacity factor update to the renderer.
     */
  //  setOpacity(opacity: number): void;
}