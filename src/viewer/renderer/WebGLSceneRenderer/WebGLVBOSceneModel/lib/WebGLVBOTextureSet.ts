import {WebGLVBOTexture} from "./WebGLVBOTexture";

/**
 * Instantiated by Model#createTextureSet
 *
 * @private
 */
export class WebGLVBOTextureSet {

    public readonly id: number | string;
    public readonly colorTexture: WebGLVBOTexture;
    public readonly metallicRoughnessTexture: WebGLVBOTexture;
    public readonly normalsTexture: WebGLVBOTexture;
    public readonly emissiveTexture: WebGLVBOTexture;
    public readonly occlusionTexture: WebGLVBOTexture;

    constructor(cfg: {
        id: number | string;
        colorTexture: WebGLVBOTexture;
        metallicRoughnessTexture: WebGLVBOTexture;
        normalsTexture: WebGLVBOTexture;
        emissiveTexture: WebGLVBOTexture;
        occlusionTexture: WebGLVBOTexture;
    }) {
        this.id = cfg.id;
        this.colorTexture = cfg.colorTexture;
        this.metallicRoughnessTexture = cfg.metallicRoughnessTexture;
        this.normalsTexture = cfg.normalsTexture;
        this.emissiveTexture = cfg.emissiveTexture;
        this.occlusionTexture = cfg.occlusionTexture;
    }
}
