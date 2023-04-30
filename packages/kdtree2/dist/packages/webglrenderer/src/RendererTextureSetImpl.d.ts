import type { RendererTextureSet } from "@xeokit/scene";
import type { RendererTextureImpl } from "./RendererTextureImpl";
/**
 * @private
 */
export declare class RendererTextureSetImpl implements RendererTextureSet {
    readonly id: string;
    readonly colorTexture: RendererTextureImpl;
    readonly metallicRoughnessTexture: RendererTextureImpl;
    readonly emissiveTexture: RendererTextureImpl;
    readonly occlusionTexture: RendererTextureImpl;
    constructor(params: {
        id: string;
        colorTexture: RendererTextureImpl;
        metallicRoughnessTexture: RendererTextureImpl;
        emissiveTexture: RendererTextureImpl;
        occlusionTexture: RendererTextureImpl;
    });
}
