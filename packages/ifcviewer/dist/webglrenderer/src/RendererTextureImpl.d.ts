import type { RendererTexture, SceneTexture } from "@xeokit/scene";
import type { WebGLTexture } from "@xeokit/webglutils";
/**
 * @private
 */
export declare class RendererTextureImpl implements RendererTexture {
    texture: SceneTexture | null;
    texture2D: WebGLTexture;
    constructor(texture: SceneTexture | null, texture2D: WebGLTexture);
    destroy(): void;
}
