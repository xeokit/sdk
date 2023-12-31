import type { Capabilities, TextureCompressedParams, TextureTranscoder } from "@xeokit/core";
/**
 * [KTX2](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ktx2) texture decompression strategy.
 *
 * See {@link @xeokit/ktx2} for usage.
 */
export declare class KTX2TextureTranscoder implements TextureTranscoder {
    #private;
    /**
     * Creates a new KTX2TextureTranscoder.
     *
     * @param {String} [params.transcoderPath="https://cdn.jsdelivr.net/npm/@xeokit/sdk/dist/basis/"] Path to the Basis
     * transcoder module that internally does the heavy lifting for our KTX2TextureTranscoder. If we omit this configuration,
     * then our KTX2TextureTranscoder will load it from ````https://cdn.jsdelivr.net/npm/@xeokit/sdk/dist/basis/```` by
     * default. Therefore, make sure your application is connected to the internet if you wish to use the default transcoder path.
     * @param {Number} [params.workerLimit] The maximum number of Workers to use for transcoding.
     */
    constructor(params: {
        transcoderPath?: string;
        workerLimit?: number;
    });
    /**
     * Initializes this transcoder.
     *
     * @param capabilities A set of flags indicating the capabilities of this TextureTranscoder.
     */
    init(capabilities: Capabilities): void;
    /**
     * Transcodes texture data from transcoded buffers.
     *
     * @param {ArrayBuffer[]} buffers Transcoded input texture data. Given as an array of buffers so that we can support multi-image textures, such as cube maps.
     * @param {*} config Transcoding options.
     * @returns {Promise<TextureCompressedParams>} Transcoded output texture data.
     */
    transcode(buffers: ArrayBuffer[], config?: {}): Promise<TextureCompressedParams>;
    /**
     * Destroys this KTX2TextureTranscoder
     */
    destroy(): void;
}
