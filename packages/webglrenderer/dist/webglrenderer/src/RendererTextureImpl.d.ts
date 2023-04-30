import type { RendererTexture, Texture } from "@xeokit/scene";
import type { GLTexture } from "@xeokit/webglutils";
/**
 * @private
 */
export declare class RendererTextureImpl implements RendererTexture {
    texture: Texture | null;
    texture2D: GLTexture;
    constructor(texture: Texture | null, texture2D: GLTexture);
    destroy(): void;
}
