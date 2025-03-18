import { LinearEncoding, LinearMipMapNearestFilter, RepeatWrapping } from "../constants";
import { createVec4 } from "../matrix";
/**
 * A texture in a {@link scene!SceneModel | SceneModel}.
 *
 * * Stored in {@link scene!SceneModel.textures | SceneModel.textures}
 * * Created with {@link scene!SceneModel.createTexture | SceneModel.createTexture}
 * * Referenced by {@link scene!SceneTextureSet.colorTexture | SceneTextureSet.colorTexture},
 * {@link scene!SceneTextureSet.metallicRoughnessTexture | SceneTextureSet.metallicRoughnessTexture},
 * {@link scene!SceneTextureSet.occlusionTexture | SceneTextureSet.occlusionTexture} and {@link scene!SceneTextureSet.emissiveTexture | SceneTextureSet.emissiveTexture}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneTexture {
    /**
     *  Internal interface through which this {@link scene!SceneTexture} can load property updates into a renderers.
     *
     *  This is defined when the owner {@link scene!SceneModel | SceneModel} has been added to a {@link viewer!Viewer | Viewer}.
     *
     * @internal
     */
    rendererTexture;
    /**
     * ID for the texture.
     */
    id;
    /**
     * Path to an image file.
     */
    src;
    /**
     * Image file data.
     */
    imageData;
    /**
     * Transcoded texture data.
     */
    buffers;
    /**
     * HTMLImage containing the texture image.
     */
    image;
    /**
     * Pixel height of the texture.
     */
    height;
    /**
     * Pixel width of the texture.
     */
    width;
    /**
     * True if the texture is compressed.
     */
    compressed;
    /**
     * Media type of this SceneTexture.
     *
     * Supported values are {@link constants!GIFMediaType}, {@link constants!PNGMediaType} and {@link constants!JPEGMediaType}.
     *
     * Ignored for compressed textures.
     */
    mediaType;
    /**
     * How the texture is sampled when a texel covers more than one pixel.
     *
     * Supported values are {@link constants!LinearFilter} and {@link constants!NearestFilter}.
     */
    magFilter;
    /**
     * How the texture is sampled when a texel covers less than one pixel. Supported values
     * are {@link constants!LinearMipmapLinearFilter}, {@link constants!LinearMipMapNearestFilter},
     * {@link constants!NearestMipMapNearestFilter}, {@link constants!NearestMipMapLinearFilter}
     * and {@link constants!LinearMipMapLinearFilter}.
     *
     * Ignored for compressed textures.
     */
    minFilter;
    /**
     * S wrapping mode.
     *
     * Supported values are {@link constants!ClampToEdgeWrapping}, {@link constants!MirroredRepeatWrapping} and {@link constants!RepeatWrapping}.
     *
     * Ignored for compressed textures.
     */
    wrapS;
    /**
     * T wrapping mode.
     *
     * Supported values are {@link constants!ClampToEdgeWrapping}, {@link constants!MirroredRepeatWrapping} and {@link constants!RepeatWrapping}.
     *
     * Ignored for compressed textures.
     */
    wrapT;
    /**
     * R wrapping mode.
     *
     * Supported values are {@link constants!ClampToEdgeWrapping}, {@link constants!MirroredRepeatWrapping} and {@link constants!RepeatWrapping}.
     *
     * Ignored for compressed textures.
     */
    wrapR;
    /**
     * Flips this SceneTexture's source data along its vertical axis when ````true````.
     */
    flipY;
    /**
     * SceneTexture encoding format.
     *
     * Supported values are {@link constants!LinearEncoding} and {@link constants!sRGBEncoding}.
     */
    encoding;
    /**
     * RGBA color to preload the texture with.
     */
    preloadColor;
    /**
     * @private
     */
    channel;
    /**
     * @private
     */
    constructor(params) {
        this.id = params.id;
        this.imageData = params.imageData;
        this.src = params.src;
        this.mediaType = params.mediaType;
        this.minFilter = params.minFilter || LinearMipMapNearestFilter;
        this.magFilter = params.magFilter || LinearMipMapNearestFilter;
        this.wrapS = params.wrapS || RepeatWrapping;
        this.wrapT = params.wrapT || RepeatWrapping;
        this.wrapR = params.wrapR || RepeatWrapping;
        this.encoding = params.encoding || LinearEncoding;
        this.preloadColor = createVec4(params.preloadColor || [1, 1, 1, 1]);
        this.channel = 0;
        this.rendererTexture = null;
    }
}
//# sourceMappingURL=SceneTexture.js.map