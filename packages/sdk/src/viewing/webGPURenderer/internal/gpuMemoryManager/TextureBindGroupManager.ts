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
  sRGBEncoding
} from "../../../../base/constants";
import {SDKErrorType, type SDKResult} from "../../../../base/core";
import type {SceneTexture} from "../../../../model/scene";
import type {WebGPUBindGroupLike, WebGPUSamplerLike, WebGPUTextureLike} from "../../core";
import {GPU_TEXTURE_USAGE} from "../constants";
import {RenderContext} from "../RenderContext";
import {BindGroupLayoutManager} from "./BindGroupLayoutManager";

export interface WebGPUTextureBinding {
  sampler: WebGPUSamplerLike;
  textureView: unknown;
  key: string;
}

interface TextureResource {
  texture: WebGPUTextureLike;
  textureView: unknown;
  sampler: WebGPUSamplerLike;
  width: number;
  height: number;
}

export type TextureDefaultKind = "white" | "normal";

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
  private readonly _resources = new Map<SceneTexture, TextureResource>();
  private _defaultResource: TextureResource | null = null;
  private _defaultNormalResource: TextureResource | null = null;

  constructor(params: {
    renderContext: RenderContext;
    bindGroupLayoutManager: BindGroupLayoutManager;
  }) {
    this._renderContext = params.renderContext;
    this._bindGroupLayoutManager = params.bindGroupLayoutManager;
  }

  public getBinding(sceneTexture: SceneTexture | null | undefined, defaultKind: TextureDefaultKind = "white"): SDKResult<WebGPUTextureBinding> {
    if (!sceneTexture || sceneTexture.destroyed || sceneTexture.compressed) {
      return this._getDefaultBinding(defaultKind);
    }
    const existing = this._resources.get(sceneTexture);
    if (existing) {
      return {
        ok: true,
        value: {
          sampler: existing.sampler,
          textureView: existing.textureView,
          key: this.getTextureKey(sceneTexture)
        }
      };
    }

    const resourceResult = this._createTextureResource(sceneTexture);
    if (resourceResult.ok === false) {
      return resourceResult;
    }
    const resource = resourceResult.value;
    this._resources.set(sceneTexture, resource);
    return {
      ok: true,
      value: {
        sampler: resource.sampler,
        textureView: resource.textureView,
        key: this.getTextureKey(sceneTexture)
      }
    };
  }

  public getTextureKey(sceneTexture: SceneTexture | null | undefined): string {
    if (!sceneTexture || sceneTexture.destroyed || sceneTexture.compressed) {
      return DEFAULT_TEXTURE_KEY;
    }
    return `${sceneTexture.model.id}:${sceneTexture.id}:${sceneTexture.width}x${sceneTexture.height}`;
  }

  public getDefaultTextureKey(defaultKind: TextureDefaultKind = "white"): string {
    return defaultKind === "normal" ? DEFAULT_NORMAL_TEXTURE_KEY : DEFAULT_TEXTURE_KEY;
  }

  public sceneTextureImageDataChanged(sceneTexture: SceneTexture): void {
    const resource = this._resources.get(sceneTexture);
    if (!resource) {
      return;
    }
    const width = Math.max(1, sceneTexture.width | 0);
    const height = Math.max(1, sceneTexture.height | 0);
    if (resource.width === width && resource.height === height && this._uploadTexture(sceneTexture, resource.texture, width, height)) {
      return;
    }
    resource.texture.destroy?.();
    this._resources.delete(sceneTexture);
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
      const resource = {texture, textureView: texture.createView(), sampler, width: 1, height: 1};
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

  private _createTextureResource(sceneTexture: SceneTexture): SDKResult<TextureResource> {
    const width = Math.max(1, sceneTexture.width | 0);
    const height = Math.max(1, sceneTexture.height | 0);
    let texture: WebGPUTextureLike | null = null;
    try {
      texture = this._renderContext.device.createTexture({
        label: `xeokit-webgpu-scene-texture:${sceneTexture.model.id}:${sceneTexture.id}`,
        size: {width, height, depthOrArrayLayers: 1},
        format: getTextureFormat(sceneTexture),
        usage: GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.COPY_DST | GPU_TEXTURE_USAGE.RENDER_ATTACHMENT
      });
      const uploaded = this._uploadTexture(sceneTexture, texture, width, height);
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
      const sampler = this._renderContext.device.createSampler?.({
        label: `xeokit-webgpu-scene-texture-sampler:${sceneTexture.model.id}:${sceneTexture.id}`,
        magFilter: sceneTexture.magFilter === NearestFilter ? "nearest" : "linear",
        minFilter: getMinFilter(sceneTexture.minFilter),
        mipmapFilter: getMipmapFilter(sceneTexture.minFilter),
        addressModeU: getAddressMode(sceneTexture.wrapS),
        addressModeV: getAddressMode(sceneTexture.wrapT)
      }) ?? {};
      return {
        ok: true,
        value: {texture, textureView: texture.createView(), sampler, width, height}
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

  private _uploadTexture(sceneTexture: SceneTexture, texture: WebGPUTextureLike, width: number, height: number): boolean {
    const imageData = sceneTexture.imageData;
    if (imageData && this._renderContext.device.queue.writeTexture) {
      this._renderContext.device.queue.writeTexture(
        {texture},
        imageData.data,
        {bytesPerRow: width * 4, rowsPerImage: height},
        {width, height, depthOrArrayLayers: 1}
      );
      return true;
    }
    if (sceneTexture.image && this._renderContext.device.queue.copyExternalImageToTexture) {
      this._renderContext.device.queue.copyExternalImageToTexture(
        {source: sceneTexture.image, flipY: sceneTexture.flipY},
        {texture},
        {width, height, depthOrArrayLayers: 1}
      );
      return true;
    }
    return false;
  }
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

function getTextureFormat(sceneTexture: SceneTexture): "rgba8unorm" | "rgba8unorm-srgb" {
  return sceneTexture.encoding === sRGBEncoding ? "rgba8unorm-srgb" : "rgba8unorm";
}
