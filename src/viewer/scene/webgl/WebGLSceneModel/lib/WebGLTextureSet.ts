import {WebGLTexture} from "./WebGLTexture";

/**
 * Instantiated by Model#createTextureSet
 *
 * @private
 */
export class WebGLTextureSet {

    public readonly id: number | string;
    public readonly colorTexture: WebGLTexture;
    public readonly metallicRoughnessTexture: WebGLTexture;
    public readonly normalsTexture: WebGLTexture;
    public readonly emissiveTexture: WebGLTexture;
    public readonly occlusionTexture: WebGLTexture;

    constructor(cfg: {
        id: number | string;
        colorTexture: WebGLTexture;
        metallicRoughnessTexture: WebGLTexture;
        normalsTexture: WebGLTexture;
        emissiveTexture: WebGLTexture;
        occlusionTexture: WebGLTexture;
    }) {
        this.id = cfg.id;
        this.colorTexture = cfg.colorTexture;
        this.metallicRoughnessTexture = cfg.metallicRoughnessTexture;
        this.normalsTexture = cfg.normalsTexture;
        this.emissiveTexture = cfg.emissiveTexture;
        this.occlusionTexture = cfg.occlusionTexture;
    }
}
