import type { RendererTexture, SceneTexture } from "../scene";
import type { WebGLTexture } from "../webglutils";
/**
 * @private
 */
export declare class WebGLRendererTexture implements RendererTexture {
    texture: SceneTexture | null;
    texture2D: WebGLTexture;
    constructor(texture: SceneTexture | null, texture2D: WebGLTexture);
    destroy(): void;
}
//# sourceMappingURL=WebGLRendererTexture.d.ts.map