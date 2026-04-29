import {
  ClampToEdgeWrapping,
  GIFMediaType,
  JPEGMediaType,
  LinearEncoding,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearMipMapLinearFilter,
  LinearMipMapNearestFilter,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipMapLinearFilter,
  NearestMipMapNearestFilter,
  PNGMediaType,
  RepeatWrapping,
  sRGBEncoding
} from "../constants";
import {createVec4Float64, type Vec4} from "../math/vector";
import type {
  SceneTextureImageSource,
  SceneTextureParams,
  SceneTexturePixelBuffer
} from "./SceneTextureParams";
import type {SceneModel} from "./SceneModel";
import {SDKErrorType, type SDKResult} from "../core";

/**
 * A texture in a {@link SceneModel | SceneModel}.
 *
 * * Stored in {@link SceneModel.textures | SceneModel.textures}
 * * Created with {@link SceneModel.createTexture | SceneModel.createTexture}
 * * Referenced by {@link SceneMaterial.colorTexture | SceneMaterial.colorTexture},
 * {@link SceneMaterial.metallicRoughnessTexture | SceneMaterial.metallicRoughnessTexture},
 * {@link SceneMaterial.occlusionTexture | SceneMaterial.occlusionTexture} and {@link SceneMaterial.emissiveTexture | SceneMaterial.emissiveTexture}
 *
 * See {@link scene | @xeokit/sdk/scene}   for usage.
 */
export class SceneTexture {

  /**
   * ID for the texture.
   */
  id: string;

  /**
   * URL to fetch the image from. Any URL form (`http(s):`, `blob:`,
   * `data:`). `toParams` writes serialised images here as data URLs.
   */
  src?: string;

  /**
   * Raw pixel buffer with explicit dimensions, normalised to a DOM
   * `ImageData` (see {@link imageData} getter / setter).
   *
   * @internal
   */
  private _imageData?: ImageData;

  /**
   * Transcoded / compressed texture data.
   */
  buffers?: ArrayBuffer[];

  /**
   * Already-decoded image source the renderer can hand straight to
   * `texSubImage2D` — `HTMLImageElement`, `HTMLCanvasElement`,
   * `ImageBitmap`, or `OffscreenCanvas`.
   */
  image?: SceneTextureImageSource;

  /**
   * Pixel height of the texture.
   */
  height: number;

  /**
   * Pixel width of the texture.
   */
  width: number;

  /**
   * True if the texture is compressed.
   */
  compressed: boolean;

  /**
   * Media type of this SceneTexture.
   *
   * Supported values are {@link constants!GIFMediaType}, {@link constants!PNGMediaType} and {@link constants!JPEGMediaType}.
   *
   * Ignored for compressed textures.
   */
  mediaType?: number;

  /**
   * How the texture is sampled when a texel covers more than one pixel.
   *
   * Supported values are {@link constants!LinearFilter} and {@link constants!NearestFilter}.
   */
  magFilter: number;

  /**
   * How the texture is sampled when a texel covers less than one pixel. Supported values
   * are {@link constants!LinearMipmapLinearFilter}, {@link constants!LinearMipMapNearestFilter},
   * {@link constants!NearestMipMapNearestFilter}, {@link constants!NearestMipMapLinearFilter}
   * and {@link constants!LinearMipMapLinearFilter}.
   *
   * Ignored for compressed textures.
   */
  minFilter: number;

  /**
   * S wrapping mode.
   *
   * Supported values are {@link constants!ClampToEdgeWrapping}, {@link constants!MirroredRepeatWrapping} and {@link constants!RepeatWrapping}.
   *
   * Ignored for compressed textures.
   */
  wrapS: number;

  /**
   * T wrapping mode.
   *
   * Supported values are {@link constants!ClampToEdgeWrapping}, {@link constants!MirroredRepeatWrapping} and {@link constants!RepeatWrapping}.
   *
   * Ignored for compressed textures.
   */
  wrapT: number;

  /**
   * R wrapping mode.
   *
   * Supported values are {@link constants!ClampToEdgeWrapping}, {@link constants!MirroredRepeatWrapping} and {@link constants!RepeatWrapping}.
   *
   * Ignored for compressed textures.
   */
  wrapR: number;

  /**
   * Flips this SceneTexture's source data along its vertical axis when ````true````.
   */
  flipY: boolean;

  /**
   * SceneTexture encoding format.
   *
   * Supported values are {@link constants!LinearEncoding} and {@link constants!sRGBEncoding}.
   */
  encoding: number;

  /**
   * RGBA color to preload the texture with.
   */
  preloadColor: Vec4;

  /**
   * @private
   */
  channel: number;

  /**
   * The SceneModel that this texture belongs to.
   */
  public model: SceneModel;

  /**
   * The count of {@link SceneMaterial | SceneMaterials} that
   * reference this SceneTexture (in any of the colour, normals,
   * metallic-roughness, occlusion, or emissive slots). Maintained by
   * `SceneModel.createMaterial` / `SceneModel._destroyMaterial`. Used
   * by {@link destroy} to refuse destruction while at least one
   * material still references the texture (the same guard
   * {@link SceneGeometry.destroy} and {@link SceneMaterial.destroy}
   * carry).
   */
  numMaterials: number;

  /**
   * True if this SceneTexture has been destroyed.
   */
  public destroyed: boolean = false;

  /**
   * @private
   */
  constructor(sceneModel: SceneModel, params: SceneTextureParams) {
    this.model = sceneModel;
    this.id = params.id;
    this.src = params.src;
    this.image = params.image;
    // Direct field assignment — the setter would fire the change event,
    // which is incorrect during construction (no listeners are attached
    // yet, and the renderer learns about new textures via the
    // `onSceneTextureCreated` path the SceneModel fires on createTexture).
    this._imageData = normalizeImageData(params.imageData);
    this.buffers = params.buffers;
    this.mediaType = params.mediaType;
    this.minFilter = params.minFilter || LinearMipMapNearestFilter;
    this.magFilter = params.magFilter || LinearMipMapNearestFilter;
    this.wrapS = params.wrapS || RepeatWrapping;
    this.wrapT = params.wrapT || RepeatWrapping;
    this.wrapR = params.wrapR || RepeatWrapping
    this.encoding = params.encoding || LinearEncoding;
    this.preloadColor = createVec4Float64(params.preloadColor || [1, 1, 1, 1]);
    this.channel = 0;
    this.numMaterials = 0;
  }

  /**
   * Returns a JSON-serializable object containing this SceneTexture's
   * parameters.
   *
   * `image` (canvas / HTMLImage / ImageBitmap / OffscreenCanvas) isn't
   * JSON-serialisable, so it gets rendered through a 2D canvas and
   * folded into `src` as a PNG data URL — `src` is the one canonical
   * field for "encoded image, please decode it." `imageData` (raw
   * pixels) is emitted as a `{ data, width, height }` plain object so
   * the typed array survives `JSON.stringify`. `buffers` and the rest
   * of the sampler state pass straight through.
   */
  toParams(): SDKResult<SceneTextureParams> {
    return {
      ok: true, value: {
        id: this.id,
        // Prefer an existing src; only synthesize from `image` when
        // there isn't one already so we don't quietly drop the user's
        // own URL on a round-trip.
        src: this.src ?? serializeImageToDataURL(this.image),
        imageData: serializeImageData(this.imageData),
        buffers: this.buffers,
        mediaType: this.mediaType,
        minFilter: this.minFilter,
        magFilter: this.magFilter,
        wrapS: this.wrapS,
        wrapT: this.wrapT,
        wrapR: this.wrapR,
        encoding: this.encoding,
        preloadColor: this.preloadColor
      }
    };
  }

  /**
   * The raw pixel buffer backing this SceneTexture, or `undefined` for
   * image-element / encoded-buffer textures.
   */
  get imageData(): ImageData | undefined {
    return this._imageData;
  }

  /**
   * Replace this SceneTexture's pixel buffer.
   *
   * Accepts either a DOM `ImageData` or the JSON-friendly
   * `{data, width, height}` form (normalised to `ImageData` here).
   * Once the SceneModel is finalized (or is in streaming mode), every
   * assignment fires `Scene.events.onSceneTextureImageDataChanged` so
   * the renderer can re-upload the pixels into its atlas sub-rect via
   * `texSubImage2D` — no batch / mesh / material rebuild.
   *
   * The setter fires unconditionally on every assignment (no identity
   * skip), so callers that mutate the bytes of an existing `ImageData`
   * in place can re-trigger the upload by reassigning the same buffer:
   * `texture.imageData = texture.imageData`.
   */
  set imageData(value: ImageData | SceneTexturePixelBuffer | undefined) {
    if (this.destroyed) {
      this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTexture.imageData] Cannot set imageData on destroyed SceneTexture '${this.id}'`,
      });
      return;
    }
    this._imageData = normalizeImageData(value);
    if (this._imageData && (this.model.streamingEnabled || this.model.finalized)) {
      this.model.scene.events.onSceneTextureImageDataChanged.dispatch(this.model.scene, this);
    }
  }

  /**
   * Destroy this SceneTexture.
   *
   * Refuses to destroy while at least one {@link SceneMaterial} in
   * the SceneModel still references this texture (in any slot —
   * colour, normals, metallic-roughness, occlusion, or emissive).
   * Destroy or replace those materials first. Mirrors
   * {@link SceneGeometry.destroy} and {@link SceneMaterial.destroy}.
   */
  destroy(): SDKResult<void> {
    if (this.destroyed) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTexture.destroy] SceneTexture '${this.id}' already destroyed`
      });
    }
    if (this.numMaterials > 0) {
      return this.model.scene.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[SceneTexture.destroy] Cannot destroy SceneTexture '${this.id}' - ` +
               `still referenced by ${this.numMaterials} SceneMaterial(s), which you need to destroy first`
      });
    }
    this.image = undefined;
    // Direct backing-field write — the setter would dispatch a change
    // event on what's about to become a destroyed texture.
    this._imageData = undefined;
    this.buffers = undefined;
    this.model._destroyTexture(this);
    this.destroyed = true;
    return {ok: true, value: undefined};
  }
}

/**
 * Normalise the `imageData` argument to a DOM `ImageData`.
 *
 * Callers may pass either an actual `ImageData` (already in canonical
 * form) or a JSON-friendly `{ data, width, height }` object — the
 * shape that survives `JSON.stringify` and round-trips through
 * `toParams`. Plain objects are wrapped into an `ImageData` here so
 * the renderer's `texSubImage2D` call site sees one type.
 *
 * Returns the input unchanged outside a browser (no `ImageData`
 * constructor) — the renderer is browser-only anyway.
 *
 * @internal
 */
function normalizeImageData(
  input: ImageData | SceneTexturePixelBuffer | undefined
): ImageData | undefined {
  if (input == null) {
    return undefined;
  }
  if (typeof ImageData !== "undefined" && input instanceof ImageData) {
    return input;
  }
  if (typeof ImageData === "undefined") {
    // Non-browser environment — leave as-is; the renderer won't run here.
    return input as any;
  }
  const buf = input as SceneTexturePixelBuffer;
  if (!buf.data || !buf.width || !buf.height) {
    return undefined;
  }
  // ImageData specifically wants Uint8ClampedArray; accept the looser
  // forms our params type advertises and convert.
  const clamped = buf.data instanceof Uint8ClampedArray
    ? buf.data
    : new Uint8ClampedArray(buf.data instanceof Uint8Array
        ? buf.data.buffer.slice(buf.data.byteOffset, buf.data.byteOffset + buf.data.byteLength)
        : buf.data);
  try {
    return new ImageData(clamped, buf.width, buf.height);
  } catch {
    return undefined;
  }
}

/**
 * Serialise a raw-pixel `ImageData` to a JSON-friendly plain object
 * `{ data: number[], width, height }`. The `data` field becomes a
 * regular array so it survives `JSON.stringify` (typed arrays
 * serialise as objects with numeric keys, which can't be parsed back).
 *
 * @internal
 */
function serializeImageData(
  imageData: ImageData | undefined
): SceneTexturePixelBuffer | undefined {
  if (!imageData) {
    return undefined;
  }
  return {
    data: Array.from(imageData.data),
    width: imageData.width,
    height: imageData.height
  };
}

/**
 * Render a runtime image source (canvas / HTMLImage / ImageBitmap /
 * OffscreenCanvas) through a 2D canvas and return a PNG data URL.
 * Returns `undefined` outside a browser, when the source has no
 * dimensions, or when the source is tainted (cross-origin without
 * CORS — `drawImage`/`toDataURL` throw a `SecurityError`).
 *
 * @internal
 */
function serializeImageToDataURL(image: SceneTextureImageSource | undefined): string | undefined {
  if (image == null) {
    return undefined;
  }
  if (typeof document === "undefined") {
    return undefined;
  }
  if (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) {
    try {
      return image.toDataURL("image/png");
    } catch {
      return undefined;
    }
  }
  const w = (image as any).width || (image as any).naturalWidth || 0;
  const h = (image as any).height || (image as any).naturalHeight || 0;
  if (w <= 0 || h <= 0) {
    return undefined;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return undefined;
  }
  try {
    ctx.drawImage(image as CanvasImageSource, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
}
