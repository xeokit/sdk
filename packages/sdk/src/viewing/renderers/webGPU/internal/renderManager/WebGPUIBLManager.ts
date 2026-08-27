import {SDKErrorType, type SDKResult} from "../../../../../base/core";
import {
  addVec3 as addVec3Math,
  cross3Vec3,
  dotVec3,
  lenVec3,
  mulVec3Scalar,
  normalizeVec3 as normalizeVec3Math,
  subVec3 as subVec3Math,
  type Vec3
} from "../../../../../base/math/vector";
import type {View} from "../../../../viewer";
import type {WebGPUTextureLike} from "../../core";
import {GPU_BUFFER_USAGE, GPU_TEXTURE_USAGE} from "../constants";
import {RenderContext} from "../RenderContext";

const BRDF_LUT_SIZE = 256;
const BRDF_SAMPLE_COUNT = 256;
const SOURCE_SIZE = 256;
const SOURCE_MIPS = 9;
const IRRADIANCE_SIZE = 32;
const IRRADIANCE_SAMPLE_COUNT = 64;
const PREFILTER_SIZE = 128;
const PREFILTER_MIPS = 8;
const PREFILTER_SAMPLE_COUNT = 128;
const CUBE_FACE_COUNT = 6;
const IBL_UNIFORM_FLOATS = 16;
const IBL_CUBEMAP_FORMAT = "rgba16float";
const PI = Math.PI;
const TWO_PI = Math.PI * 2;
const HALF_FLOAT_VALUE = new Float32Array(1);
const HALF_FLOAT_BITS = new Uint32Array(HALF_FLOAT_VALUE.buffer);
let cachedBRDFLUTPixels: Uint8Array | null = null;

interface HDRImageLike {
  data: Float32Array;
  width: number;
  height: number;
}

interface IBLTextureSet {
  irradianceTexture: WebGPUTextureLike;
  prefilteredTexture: WebGPUTextureLike;
  brdfLUTTexture: WebGPUTextureLike;
  destroy(): void;
}

interface EnvironmentSampler {
  sample(dir: Vec3, lod?: number): Vec3;
  sourceMipLevel?(dir: Vec3, targetCubeSize: number): number;
}

interface SourceCubeMip {
  size: number;
  faces: Float32Array[];
}

interface SourceCubeMap extends EnvironmentSampler {
  mips: SourceCubeMip[];
}

interface EquirectMip {
  width: number;
  height: number;
  data: Float32Array;
}

interface ImagePixelsLike {
  data: ArrayLike<number>;
  width: number;
  height: number;
  linear: boolean;
}

/**
 * Builds WebGPU split-sum IBL resources shared through the frame bind group.
 *
 * @internal
 */
export class WebGPUIBLManager {

  private readonly _renderContext: RenderContext;
  private readonly _uniformData = new Float32Array(IBL_UNIFORM_FLOATS);
  private _textureSet: IBLTextureSet | null = null;
  private _signature = "";

  constructor(renderContext: RenderContext) {
    this._renderContext = renderContext;
  }

  public init(): SDKResult<void> {
    return {ok: true, value: undefined};
  }

  public prepare(view: View, options: {active?: boolean} = {}): SDKResult<void> {
    try {
      const baseResult = this._ensureBaseResources();
      if (baseResult.ok === false) {
        return baseResult;
      }
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUIBLManager.prepare] Failed to initialize WebGPU IBL resources: ${e instanceof Error ? e.message : String(e)}`
      };
    }
    const ibl: any = (view as any).lights?.ibl;
    const active = options.active !== false && !!(ibl?.applied && ibl?.possible);
    const signature = active ? this._createSignature(view, ibl) : "disabled";
    if (signature !== this._signature) {
      const refreshResult = this._refreshTextures(active ? view : null);
      if (refreshResult.ok === false) {
        return refreshResult;
      }
      this._signature = signature;
    }
    this.writeUniforms(active ? view : null);
    return {ok: true, value: undefined};
  }

  public writeUniforms(view: View | null): void {
    const ibl: any = view ? (view as any).lights?.ibl : null;
    const intensity = view && ibl?.applied && ibl?.possible ? Math.max(0, Number(ibl.intensity ?? 1.0)) : 0;
    const vm = view?.camera?.viewMatrix;
    this._uniformData.fill(0);
    this._uniformData[0] = intensity;
    this._uniformData[1] = PREFILTER_MIPS - 1;
    if (vm) {
      this._uniformData[4] = vm[0]; this._uniformData[5] = vm[4]; this._uniformData[6] = vm[8];
      this._uniformData[8] = vm[1]; this._uniformData[9] = vm[5]; this._uniformData[10] = vm[9];
      this._uniformData[12] = vm[2]; this._uniformData[13] = vm[6]; this._uniformData[14] = vm[10];
    } else {
      this._uniformData[4] = 1;
      this._uniformData[9] = 1;
      this._uniformData[14] = 1;
    }
    if (this._renderContext.iblUniformBuffer) {
      this._renderContext.device.queue.writeBuffer(this._renderContext.iblUniformBuffer, 0, this._uniformData);
    }
  }

  public destroy(): void {
    this._textureSet?.destroy();
    this._textureSet = null;
    this._renderContext.iblUniformBuffer?.destroy?.();
    this._renderContext.iblUniformBuffer = null;
    this._renderContext.iblSampler = null;
    this._renderContext.iblIrradianceView = null;
    this._renderContext.iblPrefilteredView = null;
    this._renderContext.iblBRDFLUTView = null;
    this._renderContext.iblBindGroupVersion++;
  }

  private _refreshTextures(view: View | null): SDKResult<void> {
    try {
      const textureSet = this._createTextureSet(view);
      this._textureSet?.destroy();
      this._textureSet = textureSet;
      this._renderContext.iblIrradianceView = textureSet.irradianceTexture.createView({
        dimension: "cube",
        baseArrayLayer: 0,
        arrayLayerCount: 6
      });
      this._renderContext.iblPrefilteredView = textureSet.prefilteredTexture.createView({
        dimension: "cube",
        baseArrayLayer: 0,
        arrayLayerCount: 6
      });
      this._renderContext.iblBRDFLUTView = textureSet.brdfLUTTexture.createView();
      this._renderContext.iblBindGroupVersion++;
      return {ok: true, value: undefined};
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUIBLManager._refreshTextures] Failed to build WebGPU IBL textures: ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  private _ensureBaseResources(): SDKResult<void> {
    try {
      if (!this._renderContext.iblUniformBuffer) {
        this._renderContext.iblUniformBuffer = this._renderContext.device.createBuffer({
          label: "xeokit-webgpu-ibl-uniforms",
          size: IBL_UNIFORM_FLOATS * 4,
          usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
        });
      }
      if (!this._renderContext.iblSampler) {
        this._renderContext.iblSampler = this._renderContext.device.createSampler?.({
          label: "xeokit-webgpu-ibl-sampler",
          magFilter: "linear",
          minFilter: "linear",
          mipmapFilter: "linear",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge"
        }) ?? {};
      }
      if (!this._textureSet) {
        const refreshResult = this._refreshTextures(null);
        if (refreshResult.ok === false) {
          return refreshResult;
        }
      }
      return {ok: true, value: undefined};
    } catch (e) {
      return {
        ok: false,
        type: SDKErrorType.InitializationFailed,
        error: `[WebGPUIBLManager._ensureBaseResources] Failed to initialize WebGPU IBL base resources: ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  private _createTextureSet(view: View | null): IBLTextureSet {
    if (!view) {
      return this._createPlaceholderTextureSet();
    }
    const env = createSourceCubeMap(createEnvironmentSampler(view));
    const irradianceTexture = this._createCubeTexture("xeokit-webgpu-ibl-irradiance-cubemap", IRRADIANCE_SIZE, 1);
    uploadCubeMip(this._renderContext, irradianceTexture, IRRADIANCE_SIZE, 0, (dir) => {
      return sampleIrradiance(env, dir);
    });
    const prefilteredTexture = this._createCubeTexture("xeokit-webgpu-ibl-prefiltered-cubemap", PREFILTER_SIZE, PREFILTER_MIPS);
    for (let mip = 0; mip < PREFILTER_MIPS; mip++) {
      const size = Math.max(1, PREFILTER_SIZE >> mip);
      const roughness = mip / (PREFILTER_MIPS - 1);
      uploadCubeMip(this._renderContext, prefilteredTexture, size, mip, (dir) => {
        return samplePrefiltered(env, dir, roughness);
      });
    }
    const brdfLUTTexture = this._renderContext.device.createTexture({
      label: "xeokit-webgpu-ibl-brdf-lut",
      size: {width: BRDF_LUT_SIZE, height: BRDF_LUT_SIZE, depthOrArrayLayers: 1},
      format: "rgba8unorm",
      usage: GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.COPY_DST
    });
    this._renderContext.device.queue.writeTexture?.(
      {texture: brdfLUTTexture},
      createBRDFLUTPixels(),
      {bytesPerRow: BRDF_LUT_SIZE * 4, rowsPerImage: BRDF_LUT_SIZE},
      {width: BRDF_LUT_SIZE, height: BRDF_LUT_SIZE, depthOrArrayLayers: 1}
    );
    return {
      irradianceTexture,
      prefilteredTexture,
      brdfLUTTexture,
      destroy: () => {
        irradianceTexture.destroy?.();
        prefilteredTexture.destroy?.();
        brdfLUTTexture.destroy?.();
      }
    };
  }

  private _createPlaceholderTextureSet(): IBLTextureSet {
    const irradianceTexture = this._createCubeTexture("xeokit-webgpu-ibl-placeholder-irradiance-cubemap", 1, 1);
    uploadCubeMip(this._renderContext, irradianceTexture, 1, 0, () => [0, 0, 0]);
    const prefilteredTexture = this._createCubeTexture("xeokit-webgpu-ibl-placeholder-prefiltered-cubemap", 1, 1);
    uploadCubeMip(this._renderContext, prefilteredTexture, 1, 0, () => [0, 0, 0]);
    const brdfLUTTexture = this._renderContext.device.createTexture({
      label: "xeokit-webgpu-ibl-placeholder-brdf-lut",
      size: {width: 1, height: 1, depthOrArrayLayers: 1},
      format: "rgba8unorm",
      usage: GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.COPY_DST
    });
    this._renderContext.device.queue.writeTexture?.(
      {texture: brdfLUTTexture},
      new Uint8Array([255, 0, 0, 255]),
      {bytesPerRow: 4, rowsPerImage: 1},
      {width: 1, height: 1, depthOrArrayLayers: 1}
    );
    return {
      irradianceTexture,
      prefilteredTexture,
      brdfLUTTexture,
      destroy: () => {
        irradianceTexture.destroy?.();
        prefilteredTexture.destroy?.();
        brdfLUTTexture.destroy?.();
      }
    };
  }

  private _createCubeTexture(label: string, size: number, mipLevelCount: number): WebGPUTextureLike {
    return this._renderContext.device.createTexture({
      label,
      size: {width: size, height: size, depthOrArrayLayers: 6},
      mipLevelCount,
      format: IBL_CUBEMAP_FORMAT,
      usage: GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.COPY_DST
    });
  }

  private _createSignature(view: View, ibl: any): string {
    const hemi: any = (view as any).lights?.hemispheric;
    const shadowDir = (view as any).effects?.shadows?.direction ?? [-0.45, -0.35, -0.80];
    return [
      "active",
      ibl?.environmentVersion ?? 0,
      ibl?.environmentHDR ? `${ibl.environmentHDR.width}x${ibl.environmentHDR.height}` : "procedural",
      hemi?.skyColor?.join?.(",") ?? "",
      hemi?.groundColor?.join?.(",") ?? "",
      hemi?.worldUp?.join?.(",") ?? "",
      shadowDir.join(",")
    ].join("|");
  }
}

function uploadCubeMip(
  renderContext: RenderContext,
  texture: WebGPUTextureLike,
  size: number,
  mipLevel: number,
  sampler: (dir: Vec3) => Vec3
): void {
  for (let face = 0; face < CUBE_FACE_COUNT; face++) {
    const pixels = new Uint16Array(size * size * 4);
    let offset = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = ((x + 0.5) / size) * 2 - 1;
        const v = ((y + 0.5) / size) * 2 - 1;
        const color = sampler(cubeDirection(face, u, v));
        pixels[offset++] = toHalfFloat(Math.max(0, color[0]));
        pixels[offset++] = toHalfFloat(Math.max(0, color[1]));
        pixels[offset++] = toHalfFloat(Math.max(0, color[2]));
        pixels[offset++] = toHalfFloat(1);
      }
    }
    renderContext.device.queue.writeTexture?.(
      {texture, mipLevel, origin: {x: 0, y: 0, z: face}},
      pixels,
      {bytesPerRow: size * 8, rowsPerImage: size},
      {width: size, height: size, depthOrArrayLayers: 1}
    );
  }
}

function createEnvironmentSampler(view: View | null): EnvironmentSampler {
  const hemi: any = view ? (view as any).lights?.hemispheric : null;
  const shadowDir = view ? ((view as any).effects?.shadows?.direction ?? [-0.45, -0.35, -0.80]) : [-0.45, -0.35, -0.80];
  const up = normalizeVec3Safe([
    Number(hemi?.worldUp?.[0] ?? 0),
    Number(hemi?.worldUp?.[1] ?? 0),
    Number(hemi?.worldUp?.[2] ?? 1)
  ]);
  const hdr = view ? ((view as any).lights?.ibl?.environmentHDR as HDRImageLike | undefined) : undefined;
  if (hdr?.data && hdr.width > 0 && hdr.height > 0) {
    return createEquirectEnvironmentSampler({
      data: hdr.data,
      width: hdr.width,
      height: hdr.height,
      linear: true
    }, up);
  }
  const ldrImage = view ? ((view as any).lights?.ibl?.environmentImage as TexImageSource | undefined) : undefined;
  if (ldrImage) {
    return createEquirectEnvironmentSampler(readLDRImagePixels(ldrImage), up);
  }
  const sky = [
    Number(hemi?.skyColor?.[0] ?? 0.62),
    Number(hemi?.skyColor?.[1] ?? 0.72),
    Number(hemi?.skyColor?.[2] ?? 0.86)
  ] as Vec3;
  const ground = [
    Number(hemi?.groundColor?.[0] ?? 0.42),
    Number(hemi?.groundColor?.[1] ?? 0.36),
    Number(hemi?.groundColor?.[2] ?? 0.30)
  ] as Vec3;
  const horizon = [
    Math.min(1, sky[0] * 0.55 + 0.40),
    Math.min(1, sky[1] * 0.55 + 0.40),
    Math.min(1, sky[2] * 0.55 + 0.40)
  ] as Vec3;
  const sunDir = normalizeVec3Safe([-shadowDir[0], -shadowDir[1], -shadowDir[2]]);
  const sunColor: Vec3 = [12.0, 11.0, 8.5];
  const horizonBlend = 0.25;
  const sunCosSize = Math.cos((4.0 * PI / 180.0) * 0.5);
  const sunGlowSize = 8.0;
  const sunGlowIntensity = 4.5;
  return {
    sample: (dir) => {
      const upDot = dotVec3(dir, up);
      const blend = smoothstep(0, 1, Math.min(1, Math.abs(upDot) / horizonBlend));
      const base = upDot > 0
        ? mixVec3(horizon, sky, blend)
        : mixVec3(horizon, ground, blend);
      const sunDot = Math.max(0, dotVec3(dir, sunDir));
      if (sunDot > sunCosSize) {
        return sunColor;
      }
      const glow = Math.pow(sunDot, sunGlowSize) * sunGlowIntensity;
      return addVec3Result(base, scaleVec3(sunColor, glow));
    }
  };
}

function mixVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  const s = 1 - t;
  return [
    a[0] * s + b[0] * t,
    a[1] * s + b[1] * t,
    a[2] * s + b[2] * t
  ];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function createEquirectEnvironmentSampler(source: ImagePixelsLike, up: Vec3): EnvironmentSampler {
  const mips = createEquirectMips(source);
  const ref: Vec3 = Math.abs(up[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const east = normalizeVec3Safe(cross3Vec3(up, ref, [0, 0, 0]));
  const north = cross3Vec3(east, up, [0, 0, 0]);
  return {
    sample: (dir, lod = 0) => sampleEquirectMips(mips, dir, up, east, north, lod),
    sourceMipLevel: (dir, targetCubeSize) => {
      const lat = Math.asin(clamp(dotVec3(dir, up), -1, 1));
      const saCube = 4 * PI / (CUBE_FACE_COUNT * targetCubeSize * targetCubeSize);
      const saEquirect = 2 * PI * PI * Math.max(Math.cos(lat), 1e-3) / (source.width * source.height);
      return Math.max(0, 0.5 * Math.log2(saCube / saEquirect));
    }
  };
}

function readLDRImagePixels(source: TexImageSource): ImagePixelsLike {
  const width = Number((source as any).naturalWidth || (source as any).videoWidth || (source as any).displayWidth || (source as any).width || 0);
  const height = Number((source as any).naturalHeight || (source as any).videoHeight || (source as any).displayHeight || (source as any).height || 0);
  if (width <= 0 || height <= 0) {
    throw new Error("[WebGPUIBLManager] IBL environment image has zero dimensions.");
  }
  const canvas = createReadbackCanvas(width, height);
  const ctx = (canvas as any).getContext?.("2d", {willReadFrequently: true});
  if (!ctx?.drawImage || !ctx?.getImageData) {
    throw new Error("[WebGPUIBLManager] 2D canvas readback is unavailable for IBL environment image sampling.");
  }
  try {
    ctx.drawImage(source as any, 0, 0, width, height);
    const image = ctx.getImageData(0, 0, width, height);
    return {
      data: image.data,
      width,
      height,
      linear: false
    };
  } catch (e) {
    throw new Error(`[WebGPUIBLManager] Failed to read IBL environment image pixels: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function createReadbackCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  const doc = (globalThis as any).document;
  if (doc?.createElement) {
    const canvas = doc.createElement("canvas") as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  const OffscreenCanvasCtor = (globalThis as any).OffscreenCanvas;
  if (typeof OffscreenCanvasCtor === "function") {
    return new OffscreenCanvasCtor(width, height) as OffscreenCanvas;
  }
  throw new Error("[WebGPUIBLManager] IBL environment image sampling requires HTMLCanvasElement or OffscreenCanvas.");
}

function createEquirectMips(source: ImagePixelsLike): EquirectMip[] {
  let width = source.width;
  let height = source.height;
  let previous = convertSourcePixelsToLinearRGB(source);
  const mips: EquirectMip[] = [{width, height, data: previous}];
  while (width > 1 || height > 1) {
    const nextWidth = Math.max(1, width >> 1);
    const nextHeight = Math.max(1, height >> 1);
    const next = new Float32Array(nextWidth * nextHeight * 3);
    let dst = 0;
    for (let y = 0; y < nextHeight; y++) {
      for (let x = 0; x < nextWidth; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let dy = 0; dy < 2; dy++) {
          const sy = Math.min(height - 1, y * 2 + dy);
          for (let dx = 0; dx < 2; dx++) {
            const sx = (x * 2 + dx) % width;
            const src = (sy * width + sx) * 3;
            r += previous[src];
            g += previous[src + 1];
            b += previous[src + 2];
            count++;
          }
        }
        next[dst++] = r / count;
        next[dst++] = g / count;
        next[dst++] = b / count;
      }
    }
    width = nextWidth;
    height = nextHeight;
    previous = next;
    mips.push({width, height, data: previous});
  }
  return mips;
}

function convertSourcePixelsToLinearRGB(source: ImagePixelsLike): Float32Array {
  const data = source.data;
  const pixels = new Float32Array(source.width * source.height * 3);
  let dst = 0;
  for (let src = 0; src < data.length; src += 4) {
    if (source.linear) {
      pixels[dst++] = Number(data[src]);
      pixels[dst++] = Number(data[src + 1]);
      pixels[dst++] = Number(data[src + 2]);
    } else {
      pixels[dst++] = srgbByteToLinear(Number(data[src]));
      pixels[dst++] = srgbByteToLinear(Number(data[src + 1]));
      pixels[dst++] = srgbByteToLinear(Number(data[src + 2]));
    }
  }
  return pixels;
}

function sampleEquirectMips(mips: EquirectMip[], dir: Vec3, up: Vec3, east: Vec3, north: Vec3, lod: number): Vec3 {
  const lat = Math.asin(clamp(dotVec3(dir, up), -1, 1));
  const lon = Math.atan2(dotVec3(dir, east), dotVec3(dir, north));
  const level = clamp(lod, 0, mips.length - 1);
  const mip0 = Math.floor(level);
  const mip1 = Math.min(mips.length - 1, mip0 + 1);
  const t = level - mip0;
  const c0 = sampleEquirectMip(mips[mip0], lon, lat);
  if (t <= 0 || mip0 === mip1) {
    return c0;
  }
  return mixVec3(c0, sampleEquirectMip(mips[mip1], lon, lat), t);
}

function sampleEquirectMip(mip: EquirectMip, lon: number, lat: number): Vec3 {
  const u = (0.5 + lon / TWO_PI) * mip.width - 0.5;
  const v = (0.5 - lat / PI) * mip.height - 0.5;
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const tx = u - x0;
  const ty = v - y0;
  const c00 = readEquirectMipPixel(mip, x0, y0);
  const c10 = readEquirectMipPixel(mip, x0 + 1, y0);
  const c01 = readEquirectMipPixel(mip, x0, y0 + 1);
  const c11 = readEquirectMipPixel(mip, x0 + 1, y0 + 1);
  return mixVec3(mixVec3(c00, c10, tx), mixVec3(c01, c11, tx), ty);
}

function readEquirectMipPixel(mip: EquirectMip, x: number, y: number): Vec3 {
  const px = ((x % mip.width) + mip.width) % mip.width;
  const py = Math.max(0, Math.min(mip.height - 1, y));
  const idx = (py * mip.width + px) * 3;
  return [mip.data[idx], mip.data[idx + 1], mip.data[idx + 2]];
}

function createSourceCubeMap(env: EnvironmentSampler): SourceCubeMap {
  const baseFaces: Float32Array[] = [];
  for (let face = 0; face < CUBE_FACE_COUNT; face++) {
    const pixels = new Float32Array(SOURCE_SIZE * SOURCE_SIZE * 3);
    let offset = 0;
    for (let y = 0; y < SOURCE_SIZE; y++) {
      for (let x = 0; x < SOURCE_SIZE; x++) {
        const u = ((x + 0.5) / SOURCE_SIZE) * 2 - 1;
        const v = ((y + 0.5) / SOURCE_SIZE) * 2 - 1;
        const dir = cubeDirection(face, u, v);
        const color = env.sample(dir, env.sourceMipLevel?.(dir, SOURCE_SIZE) ?? 0);
        pixels[offset++] = Math.max(0, color[0]);
        pixels[offset++] = Math.max(0, color[1]);
        pixels[offset++] = Math.max(0, color[2]);
      }
    }
    baseFaces.push(pixels);
  }
  const mips: SourceCubeMip[] = [{size: SOURCE_SIZE, faces: baseFaces}];
  while (mips.length < SOURCE_MIPS) {
    mips.push(downsampleCubeMip(mips[mips.length - 1]));
  }
  return {
    mips,
    sample: (dir, lod = 0) => sampleSourceCubeMap(mips, dir, lod)
  };
}

function downsampleCubeMip(source: SourceCubeMip): SourceCubeMip {
  const width = source.size;
  const nextSize = Math.max(1, width >> 1);
  const faces = source.faces.map((sourceFace) => {
    const next = new Float32Array(nextSize * nextSize * 3);
    let dst = 0;
    for (let y = 0; y < nextSize; y++) {
      for (let x = 0; x < nextSize; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let dy = 0; dy < 2; dy++) {
          const sy = Math.min(width - 1, y * 2 + dy);
          for (let dx = 0; dx < 2; dx++) {
            const sx = Math.min(width - 1, x * 2 + dx);
            const src = (sy * width + sx) * 3;
            r += sourceFace[src];
            g += sourceFace[src + 1];
            b += sourceFace[src + 2];
            count++;
          }
        }
        next[dst++] = r / count;
        next[dst++] = g / count;
        next[dst++] = b / count;
      }
    }
    return next;
  });
  return {size: nextSize, faces};
}

function sampleSourceCubeMap(mips: SourceCubeMip[], dir: Vec3, lod: number): Vec3 {
  const level = clamp(lod, 0, mips.length - 1);
  const mip0 = Math.floor(level);
  const mip1 = Math.min(mips.length - 1, mip0 + 1);
  const t = level - mip0;
  const c0 = sampleSourceCubeMip(mips[mip0], dir);
  if (t <= 0 || mip0 === mip1) {
    return c0;
  }
  return mixVec3(c0, sampleSourceCubeMip(mips[mip1], dir), t);
}

function sampleSourceCubeMip(mip: SourceCubeMip, dir: Vec3): Vec3 {
  const n = normalizeVec3Safe(dir);
  const ax = Math.abs(n[0]);
  const ay = Math.abs(n[1]);
  const az = Math.abs(n[2]);
  let face: number;
  let u: number;
  let v: number;
  if (ax >= ay && ax >= az) {
    if (n[0] >= 0) {
      face = 0; u = -n[2] / ax; v = -n[1] / ax;
    } else {
      face = 1; u = n[2] / ax; v = -n[1] / ax;
    }
  } else if (ay >= ax && ay >= az) {
    if (n[1] >= 0) {
      face = 2; u = n[0] / ay; v = n[2] / ay;
    } else {
      face = 3; u = n[0] / ay; v = -n[2] / ay;
    }
  } else if (n[2] >= 0) {
    face = 4; u = n[0] / az; v = -n[1] / az;
  } else {
    face = 5; u = -n[0] / az; v = -n[1] / az;
  }
  const x = ((u + 1) * 0.5) * mip.size - 0.5;
  const y = ((v + 1) * 0.5) * mip.size - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const c00 = readCubeMipPixel(mip, face, x0, y0);
  const c10 = readCubeMipPixel(mip, face, x0 + 1, y0);
  const c01 = readCubeMipPixel(mip, face, x0, y0 + 1);
  const c11 = readCubeMipPixel(mip, face, x0 + 1, y0 + 1);
  return mixVec3(mixVec3(c00, c10, tx), mixVec3(c01, c11, tx), ty);
}

function readCubeMipPixel(mip: SourceCubeMip, face: number, x: number, y: number): Vec3 {
  const px = Math.max(0, Math.min(mip.size - 1, x));
  const py = Math.max(0, Math.min(mip.size - 1, y));
  const idx = (py * mip.size + px) * 3;
  const data = mip.faces[face];
  return [data[idx], data[idx + 1], data[idx + 2]];
}

function sampleIrradiance(env: EnvironmentSampler, n: Vec3): Vec3 {
  let total: Vec3 = [0, 0, 0];
  let weight = 0;
  for (let i = 0; i < IRRADIANCE_SAMPLE_COUNT; i++) {
    const xi = hammersley(i, IRRADIANCE_SAMPLE_COUNT);
    const local = cosineSampleHemisphere(xi[0], xi[1]);
    const dir = tangentToWorld(local, n);
    const ndotl = Math.max(0, dotVec3(n, dir));
    const c = env.sample(dir, 0);
    total = addVec3Result(total, scaleVec3(c, ndotl));
    weight += ndotl;
  }
  return weight > 0 ? scaleVec3(total, 1 / weight) : [0, 0, 0];
}

function samplePrefiltered(env: EnvironmentSampler, r: Vec3, roughness: number): Vec3 {
  if (roughness <= 0.001) {
    return env.sample(r, 0);
  }
  let total: Vec3 = [0, 0, 0];
  let weight = 0;
  const v = r;
  const a = roughness * roughness;
  const a2 = a * a;
  const saTexel = 4 * PI / (CUBE_FACE_COUNT * SOURCE_SIZE * SOURCE_SIZE);
  for (let i = 0; i < PREFILTER_SAMPLE_COUNT; i++) {
    const xi = hammersley(i, PREFILTER_SAMPLE_COUNT);
    const h = tangentToWorld(importanceSampleGGX(xi[0], xi[1], roughness), r);
    const l = normalizeVec3Safe(subVec3Result(scaleVec3(h, 2 * dotVec3(v, h)), v));
    const ndotl = Math.max(0, dotVec3(r, l));
    if (ndotl > 0) {
      const ndoth = Math.max(0, dotVec3(r, h));
      const denom = ndoth * ndoth * (a2 - 1) + 1;
      const d = a2 / Math.max(PI * denom * denom, 1e-8);
      const pdf = d * 0.25 + 1e-4;
      const saSample = 1 / (PREFILTER_SAMPLE_COUNT * pdf);
      const lod = Math.max(0, 0.5 * Math.log2(saSample / saTexel));
      total = addVec3Result(total, scaleVec3(env.sample(l, lod), ndotl));
      weight += ndotl;
    }
  }
  return weight > 0 ? scaleVec3(total, 1 / weight) : env.sample(r, 0);
}

function createBRDFLUTPixels(): Uint8Array {
  if (cachedBRDFLUTPixels) {
    return cachedBRDFLUTPixels;
  }
  const pixels = new Uint8Array(BRDF_LUT_SIZE * BRDF_LUT_SIZE * 4);
  let offset = 0;
  for (let y = 0; y < BRDF_LUT_SIZE; y++) {
    const roughness = (y + 0.5) / BRDF_LUT_SIZE;
    for (let x = 0; x < BRDF_LUT_SIZE; x++) {
      const ndotv = (x + 0.5) / BRDF_LUT_SIZE;
      const lut = integrateBRDF(ndotv, roughness);
      pixels[offset++] = toByte(lut[0]);
      pixels[offset++] = toByte(lut[1]);
      pixels[offset++] = 0;
      pixels[offset++] = 255;
    }
  }
  cachedBRDFLUTPixels = pixels;
  return pixels;
}

function integrateBRDF(ndotv: number, roughness: number): [number, number] {
  const v: Vec3 = [Math.sqrt(Math.max(0, 1 - ndotv * ndotv)), 0, ndotv];
  let a = 0;
  let b = 0;
  for (let i = 0; i < BRDF_SAMPLE_COUNT; i++) {
    const xi = hammersley(i, BRDF_SAMPLE_COUNT);
    const h = importanceSampleGGX(xi[0], xi[1], roughness);
    const l = normalizeVec3Safe(subVec3Result(scaleVec3(h, 2 * dotVec3(v, h)), v));
    const ndotl = Math.max(l[2], 0);
    const ndoth = Math.max(h[2], 0);
    const vdoth = Math.max(dotVec3(v, h), 0);
    if (ndotl > 0) {
      const g = geometrySmithIBL(ndotv, ndotl, roughness);
      const gVis = (g * vdoth) / Math.max(ndoth * ndotv, 1e-5);
      const fc = Math.pow(1 - vdoth, 5);
      a += (1 - fc) * gVis;
      b += fc * gVis;
    }
  }
  return [a / BRDF_SAMPLE_COUNT, b / BRDF_SAMPLE_COUNT];
}

function geometrySmithIBL(ndotv: number, ndotl: number, roughness: number): number {
  const k = (roughness * roughness) / 2;
  return ndotv / (ndotv * (1 - k) + k) * ndotl / (ndotl * (1 - k) + k);
}

function importanceSampleGGX(u1: number, u2: number, roughness: number): Vec3 {
  const a = roughness * roughness;
  const phi = 2 * PI * u1;
  const cosTheta = Math.sqrt((1 - u2) / (1 + (a * a - 1) * u2));
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  return [Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta];
}

function cosineSampleHemisphere(u1: number, u2: number): Vec3 {
  const r = Math.sqrt(u1);
  const phi = 2 * PI * u2;
  return [r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(Math.max(0, 1 - u1))];
}

function tangentToWorld(local: Vec3, n: Vec3): Vec3 {
  const up: Vec3 = Math.abs(n[2]) < 0.999 ? [0, 0, 1] : [1, 0, 0];
  const tangent = normalizeVec3Safe(cross3Vec3(up, n, [0, 0, 0]));
  const bitangent = cross3Vec3(n, tangent, [0, 0, 0]);
  return normalizeVec3Safe(addVec3Result(addVec3Result(scaleVec3(tangent, local[0]), scaleVec3(bitangent, local[1])), scaleVec3(n, local[2])));
}

function cubeDirection(face: number, u: number, v: number): Vec3 {
  switch (face) {
    case 0: return normalizeVec3Safe([1, -v, -u]);
    case 1: return normalizeVec3Safe([-1, -v, u]);
    case 2: return normalizeVec3Safe([u, 1, v]);
    case 3: return normalizeVec3Safe([u, -1, -v]);
    case 4: return normalizeVec3Safe([u, -v, 1]);
    default: return normalizeVec3Safe([-u, -v, -1]);
  }
}

function hammersley(i: number, n: number): [number, number] {
  return [i / n, radicalInverseVdC(i)];
}

function radicalInverseVdC(bits: number): number {
  bits = (bits << 16) | (bits >>> 16);
  bits = ((bits & 0x55555555) << 1) | ((bits & 0xAAAAAAAA) >>> 1);
  bits = ((bits & 0x33333333) << 2) | ((bits & 0xCCCCCCCC) >>> 2);
  bits = ((bits & 0x0F0F0F0F) << 4) | ((bits & 0xF0F0F0F0) >>> 4);
  bits = ((bits & 0x00FF00FF) << 8) | ((bits & 0xFF00FF00) >>> 8);
  return (bits >>> 0) * 2.3283064365386963e-10;
}

function scaleVec3(v: Vec3, s: number): Vec3 {
  return mulVec3Scalar(v, s, [0, 0, 0]);
}

function addVec3Result(a: Vec3, b: Vec3): Vec3 {
  return addVec3Math(a, b, [0, 0, 0]);
}

function subVec3Result(a: Vec3, b: Vec3): Vec3 {
  return subVec3Math(a, b, [0, 0, 0]);
}

function normalizeVec3Safe(v: Vec3): Vec3 {
  return lenVec3(v) > 1e-8 ? normalizeVec3Math(v, [0, 0, 0]) : [0, 0, 1];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function toByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

function srgbByteToLinear(value: number): number {
  const c = clamp(value / 255, 0, 1);
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function toHalfFloat(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value >= 65504) {
    return 0x7bff;
  }
  HALF_FLOAT_VALUE[0] = value;
  const bits = HALF_FLOAT_BITS[0];
  const sign = (bits >>> 16) & 0x8000;
  let exponent = ((bits >>> 23) & 0xff) - 127 + 15;
  let mantissa = bits & 0x7fffff;
  if (exponent <= 0) {
    if (exponent < -10) {
      return sign;
    }
    mantissa = (mantissa | 0x800000) >>> (1 - exponent);
    return sign | ((mantissa + 0x1000) >>> 13);
  }
  if (exponent >= 31) {
    return sign | 0x7bff;
  }
  return sign | (exponent << 10) | ((mantissa + 0x1000) >>> 13);
}
