
import type {Vec4} from "../math/vector";

/**
 * {@link SceneTexture} creation parameters for {@link SceneModel.createTexture | SceneModel.createTexture}.
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
   * Supported values are {@link constants!LinearFilter} and {@link constants!NearestFilter}.
   */
  magFilter?: number;

  /**
   * How the texture is sampled when a texel covers less than one pixel.
   *
   * Supported values are {@link constants!LinearMipmapLinearFilter}, {@link constants!LinearMipMapNearestFilter},
   * {@link constants!NearestMipMapNearestFilter}, {@link constants!NearestMipMapLinearFilter}
   * and {@link constants!LinearMipMapLinearFilter}.
   */
  minFilter?: number;

  /**
   * Wrap parameter for texture coordinate *S*.
   *
   * Supported values are {@link constants!ClampToEdgeWrapping},
   * {@link constants!MirroredRepeatWrapping} and {@link constants!RepeatWrapping}.
   */
  wrapS?: number;

  /**
   * Wrap parameter for texture coordinate *T*.
   *
   * Supported values are {@link constants!ClampToEdgeWrapping},
   * {@link constants!MirroredRepeatWrapping} and {@link constants!RepeatWrapping}.
   */
  wrapT?: number;

  /**
   * Wrap parameter for texture coordinate *R*.
   *
   * Supported values are {@link constants!ClampToEdgeWrapping},
   * {@link constants!MirroredRepeatWrapping} and {@link constants!RepeatWrapping}.
   */
  wrapR?: number;

  /**
   * Flips this SceneTexture's source data along its vertical axis when ````true````.
   */
  flipY?: boolean;

  /**
   * SceneTexture encoding format.
   *
   * Supported values are {@link constants!LinearEncoding} and {@link constants!sRGBEncoding}.
   */
  encoding?: number;

  /**
   * RGBA color to preload the texture with.
   */
  preloadColor?: Vec4;
}
