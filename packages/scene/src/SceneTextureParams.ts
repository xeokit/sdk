import type { LinearEncoding } from "@xeokit/constants";
import type {FloatArrayParam} from "@xeokit/math";

/**
 * {@link @xeokit/scene!SceneTexture} creation parameters for {@link @xeokit/scene!SceneModel.createTexture | SceneModel.createTexture}.
 */
export interface SceneTextureParams {

    /**
     * ID for the texture.
     */
    id: string;

    /**
     * Path to an image file.
     */
    src?: string;

    /**
     * Image file data.
     */
    imageData?: any;

    /**
     * Transcoded texture data.
     */
    buffers?: ArrayBuffer[];

    /**
     * HTMLImage containing the texture image.
     */
    image?: HTMLImageElement;

    /**
     * Media type.
     */
    mediaType?: any;

    /**
     * How the texture is sampled when a texel covers more than one pixel.
     *
     * Supported values are {@link @xeokit/constants!LinearFilter} and {@link @xeokit/constants!NearestFilter}.
     */
    magFilter?: number;

    /**
     * How the texture is sampled when a texel covers less than one pixel.
     *
     * Supported values are {@link @xeokit/constants!LinearMipmapLinearFilter}, {@link @xeokit/constants!LinearMipMapNearestFilter},
     * {@link @xeokit/constants!NearestMipMapNearestFilter}, {@link @xeokit/constants!NearestMipMapLinearFilter}
     * and {@link @xeokit/constants!LinearMipMapLinearFilter}.
     */
    minFilter?: number;

    /**
     * Wrap parameter for texture coordinate *S*.
     *
     * Supported values are {@link @xeokit/constants!ClampToEdgeWrapping},
     * {@link @xeokit/constants!MirroredRepeatWrapping} and {@link @xeokit/constants!RepeatWrapping}.
     */
    wrapS?: number;

    /**
     * Wrap parameter for texture coordinate *T*.
     *
     * Supported values are {@link @xeokit/constants!ClampToEdgeWrapping},
     * {@link @xeokit/constants!MirroredRepeatWrapping} and {@link @xeokit/constants!RepeatWrapping}.
     */
    wrapT?: number;

    /**
     * Wrap parameter for texture coordinate *R*.
     *
     * Supported values are {@link @xeokit/constants!ClampToEdgeWrapping},
     * {@link @xeokit/constants!MirroredRepeatWrapping} and {@link @xeokit/constants!RepeatWrapping}.
     */
    wrapR?: number;

    /**
     * Flips this SceneTexture's source data along its vertical axis when ````true````.
     */
    flipY?: boolean;

    /**
     * SceneTexture encoding format.
     *
     * Supported values are {@link @xeokit/constants!LinearEncoding} and {@link @xeokit/constants!sRGBEncoding}.
     */
    encoding?: number;

    /**
     * RGBA color to preload the texture with.
     */
    preloadColor?: FloatArrayParam;
}