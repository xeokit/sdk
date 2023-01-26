import type { WebViewerCapabilities } from "../WebViewerCapabilities";
import type { CompressedTextureParams } from "./CompressedTextureParams";
/**
 * Texture data transcoding strategy.
 *
 * A {@link Renderer} implementation usually has one of these, so that it can create compressed textures from transcoded
 * texture data (eg KTX2) via {@link ViewerModel.createTexture}.
 */
export interface TextureTranscoder {
    /**
     * Called by the {@link Renderer} to initialize this transcoder.
     *
     * @param viewerCapabilities
     */
    init(viewerCapabilities: WebViewerCapabilities): void;
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
