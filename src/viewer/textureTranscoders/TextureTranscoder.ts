import {ViewerCapabilities} from "../ViewerCapabilities";
import {CompressedTextureParams} from "./CompressedTextureParams";

/**
 * Texture data transcoding strategy.
 *
 * * Used internally by {@link SceneModel.createTexture} to convert transcoded texture data (eg KTX2).
 */
export interface TextureTranscoder {

    /**
     * Called by the {@link Viewer} to initialize this transcoder.
     *
     * @param viewerCapabilities
     */
    init(viewerCapabilities: ViewerCapabilities): void;

    /**
     * Transcodes texture data from transcoded buffers.
     *
     * @param {ArrayBuffer[]} buffers Transcoded input texture data. Given as an array of buffers so that we can support multi-image textures, such as cube maps.
     * @param {*} config Transcoding options.
     * @returns {Promise<CompressedTextureParams>} Transcoded output texture data.
     */
    transcode(buffers: ArrayBuffer[], config?: {}): Promise<CompressedTextureParams>;

    /**
     * Destroys this transcoder.
     */
    destroy(): void;
}
