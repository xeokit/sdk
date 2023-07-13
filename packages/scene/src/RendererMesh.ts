import type {FloatArrayParam} from "@xeokit/math";

/**
 *  Internal interface through which a {@link Mesh} can load state updates into a renderer.
 *
 *  This exists at each {@link Mesh.rendererMesh} when the owner {@link SceneModel} has been added
 *  to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererMesh {

    /**
     * Loads a modeling matrix into the {@link WebGLRenderer}.
     *
     * {@link @xeokit/scene!Mesh} calls this when we update {@link @xeokit/scene!Mesh | Mesh.matrix}.
     *
     * @internal
     */
    setMatrix(matrix: FloatArrayParam): void;

    /**
     * Loads a material color value into the {@link WebGLRenderer}.
     *
     * {@link @xeokit/scene!Mesh} calls this when we update {@link @xeokit/scene!Mesh | Mesh.color}.
     *
     * @internal
     */
    setColor(color: FloatArrayParam): void;

    /**
     * Loads a material metalness value into the {@link Renderer}.
     *
     * {@link @xeokit/scene!Mesh} calls this when we update {@link @xeokit/scene!Mesh | Mesh.metalness}.
     *
     * @internal
     */
    setMetallic(metallic: number): void;

    /**
     * Loads a meterial roughness value into the {@link WebGLRenderer}.
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