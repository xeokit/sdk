/**
 * SceneTexture transcoder.
 */
import type {Capabilities} from "./Capabilities";
import type {TextureCompressedParams} from "./TextureCompressedParams";


/**
 * Defines the interface for xeokit texture decompression strategies.
 */
export interface TextureTranscoder {

    /**
     * Initializes this transcoder.
     *
     * @param capabilities A set of flags indicating the capabilities of this TextureTranscoder.
     */
    init(capabilities: Capabilities): void;

    /**
     * Transcodes texture data from transcoded buffers.
     *
     * @param {ArrayBuffer[]} buffers Transcoded input texture data. Given as an array of buffers so that we can
     * support multi-image textures, such as cube maps.
     * @param {*} config Transcoding options.
     * @returns {Promise<TextureCompressedParams>} Transcoded output texture data.
     */
    transcode(buffers: ArrayBuffer[], config?: {}): Promise<TextureCompressedParams>;

    /**
     * Destroys this transcoder.
     */
    destroy(): void;
}
