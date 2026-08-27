import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipMapLinearFilter,
  LinearMipmapLinearFilter,
  LinearMipMapNearestFilter,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipMapLinearFilter,
  NearestMipMapNearestFilter,
  RepeatWrapping,
} from "../../../../../base/constants";
import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import type {SceneTexture} from "../../../../../model/scene";
import type {WebGPUBindGroupLike, WebGPUSamplerLike, WebGPUTextureLike} from "../../core";
import {
  createSanitizedAlphaMaskedColorImageData,
  sanitizeAlphaMaskedColorImageData,
  type AlphaMaskedColorImageData
} from "../../../common/AlphaMaskedTexture";
import {GPU_TEXTURE_USAGE} from "../constants";
import {RenderContext} from "../RenderContext";
import {BindGroupLayoutManager} from "./BindGroupLayoutManager";

export interface WebGPUTextureBinding {
  sampler: WebGPUSamplerLike;
  textureView: unknown;
  key: string;
}

interface TextureResource {
  sceneTexture: SceneTexture | null;
  role: TextureRole | null;
  sanitizeAlphaMaskRGB: boolean;
  texture: WebGPUTextureLike;
  textureView: unknown;
  sampler: WebGPUSamplerLike;
  width: number;
  height: number;
  mipLevelCount: number;
}

export type TextureDefaultKind = "white" | "normal";
export type TextureRole = "color" | "metallicRoughness" | "normal" | "emissive" | "occlusion";

const DEFAULT_TEXTURE_KEY = "default";
const DEFAULT_NORMAL_TEXTURE_KEY = "default-normal";

/**
 * Caches material texture GPU resources for packed WebGPU triangle draws.
 *
 * @internal
 */
export class TextureBindGroupManager {

  private readonly _renderContext: RenderContext;
  private readonly _bindGroupLayoutManager: BindGroupLayoutManager;
  private readonly _resources = new Map<string, TextureResource>();
  private _defaultResource: TextureResource | null = null;
  private _defaultNormalResource: TextureResource | null = null;

  constructor(params: {
    renderContext: RenderContext;
    bindGroupLayoutManager: BindGroupLayoutManager;
  }) {
    this._renderContext = params.renderContext;
    this._bindGroupLayoutManager = params.bindGroupLayoutManager;
  }

  public getBinding(
    sceneTexture: SceneTexture | null | undefined,
    role: TextureRole = "color",
    defaultKind: TextureDefaultKind = role === "normal" ? "normal" : "white",
    sanitizeAlphaMaskRGB: boolean = false
  ): SDKResult<WebGPUTextureBinding> {
    if (!sceneTexture || sceneTexture.destroyed || sceneTexture.compressed) {
      return this._getDefaultBinding(defaultKind);
    }
    sanitizeAlphaMaskRGB = sanitizeAlphaMaskRGB && role === "color";
    const resourceKey = this._getResourceKey(sceneTexture, role, sanitizeAlphaMaskRGB);
    const existing = this._resources.get(resourceKey);
    if (existing) {
      return {
        ok: true,
        value: {
          sampler: existing.sampler,
          textureView: existing.textureView,
          key: this.getTextureKey(sceneTexture, role)
        }
      };
    }

    const resourceResult = this._createTextureResource(sceneTexture, role, sanitizeAlphaMaskRGB);
    if (resourceResult.ok === false) {
      return resourceResult;
    }
    const resource = resourceResult.value;
    this._resources.set(resourceKey, resource);
    return {
      ok: true,
      value: {
        sampler: resource.sampler,
        textureView: resource.textureView,
        key: this.getTextureKey(sceneTexture, role)
      }
    };
  }

  public getTextureKey(sceneTexture: SceneTexture | null | undefined, role: TextureRole = "color"): string {
    if (!sceneTexture || sceneTexture.destroyed || sceneTexture.compressed) {
      return DEFAULT_TEXTURE_KEY;
    }
    return `${role}:${sceneTexture.model.id}:${sceneTexture.id}:${sceneTexture.width}x${sceneTexture.height}`;
  }

  public getDefaultTextureKey(defaultKind: TextureDefaultKind = "white"): string {
    return defaultKind === "normal" ? DEFAULT_NORMAL_TEXTURE_KEY : DEFAULT_TEXTURE_KEY;
  }

  public sceneTextureImageDataChanged(sceneTexture: SceneTexture): void {
    const width = Math.max(1, sceneTexture.width | 0);
    const height = Math.max(1, sceneTexture.height | 0);
    const mipLevelCount = getMipLevelCount(sceneTexture, width, height);
    for (const [key, resource] of this._resources) {
      if (resource.sceneTexture !== sceneTexture) {
        continue;
      }
      if (
        resource.width === width &&
        resource.height === height &&
        resource.mipLevelCount === mipLevelCount &&
        this._uploadTexture(sceneTexture, resource.texture, width, height, mipLevelCount, resource.sanitizeAlphaMaskRGB)
      ) {
        continue;
      }
      resource.texture.destroy?.();
      this._resources.delete(key);
    }
  }

  public destroy(): void {
    for (const resource of this._resources.values()) {
      resource.texture.destroy?.();
    }
    this._resources.clear();
    this._defaultResource?.texture.destroy?.();
    this._defaultResource = null;
    this._defaultNormalResource?.texture.destroy?.();
    this._defaultNormalResource = null;
  }

  private _getDefaultBinding(defaultKind: TextureDefaultKind): SDKResult<WebGPUTextureBinding> {
    const resourceResult = this._getDefaultResource(defaultKind);
    if (resourceResult.ok === false) {
      return resourceResult;
    }
    return {
      ok: true,
      value: {
        sampler: resourceResult.value.sampler,
        textureView: resourceResult.value.textureView,
        key: this.getDefaultTextureKey(defaultKind)
      }
    };
  }

  private _getDefaultResource(defaultKind: TextureDefaultKind = "white"): SDKResult<TextureResource> {
    const existing = defaultKind === "normal" ? this._defaultNormalResource : this._defaultResource;
    if (existing) {
      return {
        ok: true,
        value: existing
      };
    }

    try {
      const pixel = defaultKind === "normal"
        ? new Uint8Array([128, 128, 255, 255])
        : new Uint8Array([255, 255, 255, 255]);
      const texture = this._renderContext.device.createTexture({
        label: defaultKind === "normal" ? "xeokit-webgpu-default-normal-texture" : "xeokit-webgpu-default-white-texture",
        size: {width: 1, height: 1, depthOrArrayLayers: 1},
        format: "rgba8unorm",
        usage: GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.COPY_DST | GPU_TEXTURE_USAGE.RENDER_ATTACHMENT
      });
      this._renderContext.device.queue.writeTexture?.(
        {texture},
        pixel,
        {bytesPerRow: 4, rowsPerImage: 1},
        {width: 1, height: 1, depthOrArrayLayers: 1}
      );
      const sampler = this._renderContext.device.createSampler?.({
        label: defaultKind === "normal" ? "xeokit-webgpu-default-normal-texture-sampler" : "xeokit-webgpu-default-texture-sampler",
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "repeat",
        addressModeV: "repeat"
      }) ?? {};
      const resource = {sceneTexture: null, role: null, sanitizeAlphaMaskRGB: false, texture, textureView: texture.createView(), sampler, width: 1, height: 1, mipLevelCount: 1};
      if (defaultKind === "normal") {
        this._defaultNormalResource = resource;
      } else {
        this._defaultResource = resource;
      }
      return {
        ok: true,
        value: resource
      };
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TextureBindGroupManager._getDefaultResource] Failed to create default WebGPU texture: ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  private _createTextureResource(sceneTexture: SceneTexture, role: TextureRole, sanitizeAlphaMaskRGB: boolean): SDKResult<TextureResource> {
    const width = Math.max(1, sceneTexture.width | 0);
    const height = Math.max(1, sceneTexture.height | 0);
    let mipLevelCount = getMipLevelCount(sceneTexture, width, height);
    let texture: WebGPUTextureLike | null = null;
    try {
      texture = this._renderContext.device.createTexture({
        label: `xeokit-webgpu-scene-texture:${sceneTexture.model.id}:${sceneTexture.id}`,
        size: {width, height, depthOrArrayLayers: 1},
        mipLevelCount,
        format: getTextureFormat(role),
        usage: GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.COPY_DST | GPU_TEXTURE_USAGE.RENDER_ATTACHMENT
      });
      let uploaded = this._uploadTexture(sceneTexture, texture, width, height, mipLevelCount, sanitizeAlphaMaskRGB);
      if (!uploaded && mipLevelCount > 1) {
        texture.destroy?.();
        mipLevelCount = 1;
        texture = this._renderContext.device.createTexture({
          label: `xeokit-webgpu-scene-texture:${sceneTexture.model.id}:${sceneTexture.id}`,
          size: {width, height, depthOrArrayLayers: 1},
          mipLevelCount,
          format: getTextureFormat(role),
          usage: GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.COPY_DST | GPU_TEXTURE_USAGE.RENDER_ATTACHMENT
        });
        uploaded = this._uploadTexture(sceneTexture, texture, width, height, mipLevelCount, sanitizeAlphaMaskRGB);
      }
      if (!uploaded) {
        texture.destroy?.();
        const defaultResult = this._getDefaultResource();
        if (defaultResult.ok === false) {
          return defaultResult;
        }
        return {
          ok: true,
          value: defaultResult.value
        };
      }
      const minFilter = getMinFilter(sceneTexture.minFilter);
      const mipmapFilter = mipLevelCount > 1 ? (getMipmapFilter(sceneTexture.minFilter) ?? "linear") : undefined;
      const samplerDescriptor = withAnisotropy({
        label: `xeokit-webgpu-scene-texture-sampler:${sceneTexture.model.id}:${sceneTexture.id}`,
        magFilter: sceneTexture.magFilter === NearestFilter ? "nearest" : "linear",
        minFilter,
        mipmapFilter,
        addressModeU: getAddressMode(sceneTexture.wrapS),
        addressModeV: getAddressMode(sceneTexture.wrapT)
      });
      const sampler = this._renderContext.device.createSampler?.(samplerDescriptor) ?? {};
      return {
        ok: true,
        value: {sceneTexture, role, sanitizeAlphaMaskRGB, texture, textureView: texture.createView(), sampler, width, height, mipLevelCount}
      };
    } catch (e) {
      texture?.destroy?.();
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[TextureBindGroupManager._createTextureResource] Failed to create WebGPU texture '${sceneTexture.id}': ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  private _uploadTexture(
    sceneTexture: SceneTexture,
    texture: WebGPUTextureLike,
    width: number,
    height: number,
    mipLevelCount: number,
    sanitizeAlphaMaskRGB: boolean
  ): boolean {
    const imageData = sceneTexture.imageData;
    if (imageData && this._renderContext.device.queue.writeTexture) {
      const uploadImageData = sanitizeAlphaMaskRGB
        ? sanitizeAlphaMaskedColorImageData(imageData)
        : imageData;
      this._renderContext.device.queue.writeTexture(
        {texture},
        uploadImageData.data,
        {bytesPerRow: width * 4, rowsPerImage: height},
        {width, height, depthOrArrayLayers: 1}
      );
      if (mipLevelCount > 1) {
        uploadImageDataMipmaps(this._renderContext, texture, uploadImageData, mipLevelCount);
      }
      return true;
    }
    if (sceneTexture.image && this._renderContext.device.queue.copyExternalImageToTexture) {
      if (sanitizeAlphaMaskRGB && this._renderContext.device.queue.writeTexture) {
        const uploadImageData = createSanitizedAlphaMaskedColorImageData(sceneTexture.image, sceneTexture.flipY, width, height);
        if (uploadImageData) {
          this._renderContext.device.queue.writeTexture(
            {texture},
            uploadImageData.data,
            {bytesPerRow: width * 4, rowsPerImage: height},
            {width, height, depthOrArrayLayers: 1}
          );
          if (mipLevelCount > 1) {
            uploadImageDataMipmaps(this._renderContext, texture, uploadImageData, mipLevelCount);
          }
          return true;
        }
      }
      this._renderContext.device.queue.copyExternalImageToTexture(
        {source: sceneTexture.image, flipY: sceneTexture.flipY},
        {texture},
        {width, height, depthOrArrayLayers: 1}
      );
      if (mipLevelCount > 1) {
        if (!uploadExternalImageMipmaps(this._renderContext, texture, sceneTexture.image, sceneTexture.flipY, width, height, mipLevelCount)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  private _getResourceKey(sceneTexture: SceneTexture, role: TextureRole, sanitizeAlphaMaskRGB: boolean): string {
    return `${role}:${sceneTexture.model.id}:${sceneTexture.id}${sanitizeAlphaMaskRGB ? ":alphaMaskRGB" : ""}`;
  }
}

function getMipLevelCount(sceneTexture: SceneTexture, width: number, height: number): number {
  if (sceneTexture.mipmap !== true) {
    return 1;
  }
  if (!sceneTexture.imageData && (!sceneTexture.image || !canCreateMipmapCanvas())) {
    return 1;
  }
  return Math.floor(Math.log2(Math.max(width, height))) + 1;
}

function withAnisotropy<T extends {
  magFilter?: string;
  minFilter?: string;
  mipmapFilter?: string;
}>(descriptor: T): T & { maxAnisotropy?: number } {
  if (
    descriptor.magFilter === "linear" &&
    descriptor.minFilter === "linear" &&
    descriptor.mipmapFilter === "linear"
  ) {
    return {
      ...descriptor,
      maxAnisotropy: 8
    };
  }
  return descriptor;
}

function uploadExternalImageMipmaps(
  renderContext: RenderContext,
  texture: WebGPUTextureLike,
  image: unknown,
  flipY: boolean,
  width: number,
  height: number,
  mipLevelCount: number
): boolean {
  let source: unknown = image;
  let srcWidth = width;
  let srcHeight = height;
  for (let mipLevel = 1; mipLevel < mipLevelCount; mipLevel++) {
    const dstWidth = Math.max(1, srcWidth >> 1);
    const dstHeight = Math.max(1, srcHeight >> 1);
    const canvas = createMipmapCanvas(dstWidth, dstHeight);
    if (!canvas) {
      return false;
    }
    const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) {
      return false;
    }
    try {
      if (flipY && mipLevel === 1) {
        context.save();
        context.translate(0, dstHeight);
        context.scale(1, -1);
        context.drawImage(source as CanvasImageSource, 0, 0, srcWidth, srcHeight, 0, 0, dstWidth, dstHeight);
        context.restore();
      } else {
        context.drawImage(source as CanvasImageSource, 0, 0, srcWidth, srcHeight, 0, 0, dstWidth, dstHeight);
      }
      const imageData = context.getImageData(0, 0, dstWidth, dstHeight);
      renderContext.device.queue.writeTexture?.(
        {texture, mipLevel},
        imageData.data,
        {bytesPerRow: dstWidth * 4, rowsPerImage: dstHeight},
        {width: dstWidth, height: dstHeight, depthOrArrayLayers: 1}
      );
    } catch {
      return false;
    }
    source = canvas;
    srcWidth = dstWidth;
    srcHeight = dstHeight;
  }
  return true;
}

function uploadImageDataMipmaps(renderContext: RenderContext, texture: WebGPUTextureLike, imageData: AlphaMaskedColorImageData, mipLevelCount: number): void {
  let src: Uint8Array | Uint8ClampedArray = imageData.data;
  let srcWidth = imageData.width;
  let srcHeight = imageData.height;
  for (let mipLevel = 1; mipLevel < mipLevelCount; mipLevel++) {
    const dstWidth = Math.max(1, srcWidth >> 1);
    const dstHeight = Math.max(1, srcHeight >> 1);
    const dst = new Uint8Array(dstWidth * dstHeight * 4);
    for (let y = 0; y < dstHeight; y++) {
      for (let x = 0; x < dstWidth; x++) {
        const dstOffset = (y * dstWidth + x) * 4;
        const sx0 = Math.min(srcWidth - 1, x * 2);
        const sy0 = Math.min(srcHeight - 1, y * 2);
        const sx1 = Math.min(srcWidth - 1, sx0 + 1);
        const sy1 = Math.min(srcHeight - 1, sy0 + 1);
        const offsets = [
          (sy0 * srcWidth + sx0) * 4,
          (sy0 * srcWidth + sx1) * 4,
          (sy1 * srcWidth + sx0) * 4,
          (sy1 * srcWidth + sx1) * 4
        ];
        for (let c = 0; c < 4; c++) {
          dst[dstOffset + c] = (
            src[offsets[0] + c] +
            src[offsets[1] + c] +
            src[offsets[2] + c] +
            src[offsets[3] + c] +
            2
          ) >> 2;
        }
      }
    }
    renderContext.device.queue.writeTexture?.(
      {texture, mipLevel},
      dst,
      {bytesPerRow: dstWidth * 4, rowsPerImage: dstHeight},
      {width: dstWidth, height: dstHeight, depthOrArrayLayers: 1}
    );
    src = dst;
    srcWidth = dstWidth;
    srcHeight = dstHeight;
  }
}

function canCreateMipmapCanvas(): boolean {
  return typeof OffscreenCanvas !== "undefined" ||
    (typeof document !== "undefined" && typeof document.createElement === "function");
}

function createMipmapCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement | null {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
}

function getAddressMode(wrap: number): "clamp-to-edge" | "repeat" | "mirror-repeat" {
  if (wrap === ClampToEdgeWrapping) {
    return "clamp-to-edge";
  }
  if (wrap === MirroredRepeatWrapping) {
    return "mirror-repeat";
  }
  if (wrap === RepeatWrapping) {
    return "repeat";
  }
  return "repeat";
}

function getMinFilter(filter: number): "nearest" | "linear" {
  return filter === NearestFilter ||
    filter === NearestMipMapNearestFilter ||
    filter === NearestMipMapLinearFilter
    ? "nearest"
    : "linear";
}

function getMipmapFilter(filter: number): "nearest" | "linear" | undefined {
  if (
    filter === LinearMipMapNearestFilter ||
    filter === NearestMipMapNearestFilter
  ) {
    return "nearest";
  }
  if (
    filter === LinearMipMapLinearFilter ||
    filter === LinearMipmapLinearFilter ||
    filter === NearestMipMapLinearFilter
  ) {
    return "linear";
  }
  return undefined;
}

function getTextureFormat(role: TextureRole): "rgba8unorm" | "rgba8unorm-srgb" {
  return role === "color" || role === "emissive" ? "rgba8unorm-srgb" : "rgba8unorm";
}
