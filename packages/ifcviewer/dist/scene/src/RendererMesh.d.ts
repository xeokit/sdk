import type { FloatArrayParam } from "@xeokit/math";
/**
 *  Internal interface through which a {@link @xeokit/scene!SceneMesh} can load property updates into a renderers.
 *
 *  This exists at each {@link @xeokit/scene!SceneMesh.rendererMesh} when the owner {@link @xeokit/viewer!Renderer} has been added
 *  to a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * @internal
 */
export interface RendererMesh {
    /**
     * Sends an updated modeling matrix to the renderers.
     */
    setMatrix(matrix: FloatArrayParam): void;
    /**
     * Sends an RGB base color update to the renderers.
     */
    setColor(color: FloatArrayParam): void;
    /**
     * Sends a PBR metallic factor update to the renderers.
     */
    setMetallic(metallic: number): void;
    /**
     * Sends a PBR rougness factor update to the renderers.
     */
    setRoughness(roughness: number): void;
}
