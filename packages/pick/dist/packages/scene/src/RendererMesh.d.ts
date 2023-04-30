import type { FloatArrayParam } from "@xeokit/math";
/**
 *  Internal interface through which a {@link Mesh} can load property updates into a renderer.
 *
 *  This exists at each {@link Mesh.rendererMesh} when the owner {@link SceneModel} has been added
 *  to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererMesh {
    /**
     * Sends an updated modeling matrix to the renderer.
     */
    setMatrix(matrix: FloatArrayParam): void;
    /**
     * Sends an RGB base color update to the renderer.
     */
    setColor(color: FloatArrayParam): void;
    /**
     * Sends a PBR metallic factor update to the renderer.
     */
    setMetallic(metallic: number): void;
    /**
     * Sends a PBR rougness factor update to the renderer.
     */
    setRoughness(roughness: number): void;
}
