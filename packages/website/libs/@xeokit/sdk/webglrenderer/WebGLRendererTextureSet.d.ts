import type { RendererTextureSet } from "../scene";
import type { WebGLRendererTexture } from "./WebGLRendererTexture";
/**
 * @private
 */
export declare class WebGLRendererTextureSet implements RendererTextureSet {
    readonly id: string;
    readonly colorRendererTexture: WebGLRendererTexture;
    readonly metallicRoughnessRendererTexture: WebGLRendererTexture;
    readonly emissiveRendererTexture: WebGLRendererTexture;
    readonly occlusionRendererTexture: WebGLRendererTexture;
    constructor(params: {
        id: string;
        colorRendererTexture: WebGLRendererTexture;
        metallicRoughnessRendererTexture: WebGLRendererTexture;
        emissiveRendererTexture: WebGLRendererTexture;
        occlusionRendererTexture: WebGLRendererTexture;
    });
}
//# sourceMappingURL=RendererTextureSet.d.ts.map
