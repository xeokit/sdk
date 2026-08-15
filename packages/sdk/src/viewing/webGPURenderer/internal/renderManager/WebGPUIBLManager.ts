import {SDKErrorType, type SDKResult} from "../../../../base/core";
import {
  addVec3 as addVec3Math,
  cross3Vec3,
  dotVec3,
  lenVec3,
  mulVec3Scalar,
  normalizeVec3 as normalizeVec3Math,
  subVec3 as subVec3Math,
  type Vec3
} from "../../../../base/math/vector";
import type {View} from "../../../viewer";
import type {WebGPUTextureLike} from "../../core";
import {GPU_BUFFER_USAGE, GPU_TEXTURE_USAGE} from "../constants";
import {RenderContext} from "../RenderContext";

const BRDF_LUT_SIZE = 128;
const IRRADIANCE_SIZE = 16;
const PREFILTER_SIZE = 64;
const PREFILTER_MIPS = 7;
const SAMPLE_COUNT = 64;
const IBL_UNIFORM_FLOATS = 16;
const IBL_CUBEMAP_FORMAT = "rgba16float";
const PI = Math.PI;
const HALF_FLOAT_VALUE = new Float32Array(1);
const HALF_FLOAT_BITS = new Uint32Array(HALF_FLOAT_VALUE.buffer);

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
    const env = createEnvironmentSampler(view);
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
  for (let face = 0; face < 6; face++) {
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

function createEnvironmentSampler(view: View | null): (dir: Vec3) => Vec3 {
  const hemi: any = view ? (view as any).lights?.hemispheric : null;
  const shadowDir = view ? ((view as any).effects?.shadows?.direction ?? [-0.45, -0.35, -0.80]) : [-0.45, -0.35, -0.80];
  const up = normalizeVec3Safe([
    Number(hemi?.worldUp?.[0] ?? 0),
    Number(hemi?.worldUp?.[1] ?? 0),
    Number(hemi?.worldUp?.[2] ?? 1)
  ]);
  const hdr = view ? ((view as any).lights?.ibl?.environmentHDR as HDRImageLike | undefined) : undefined;
  if (hdr?.data && hdr.width > 0 && hdr.height > 0) {
    return (dir) => sampleHDR(hdr, dir, up);
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
  return (dir) => {
    const upDot = dotVec3(dir, up);
    const skyMix = Math.max(0, upDot);
    const groundMix = Math.max(0, -upDot);
    const horizonMix = Math.pow(Math.max(0, 1 - Math.abs(upDot)), 2);
    const sunDot = Math.max(0, dotVec3(dir, sunDir));
    const sun = Math.pow(sunDot, 900) * 10 + Math.pow(sunDot, 80) * 2.5;
    return [
      sky[0] * skyMix + ground[0] * groundMix + horizon[0] * horizonMix + sun,
      sky[1] * skyMix + ground[1] * groundMix + horizon[1] * horizonMix + sun * 0.92,
      sky[2] * skyMix + ground[2] * groundMix + horizon[2] * horizonMix + sun * 0.72
    ];
  };
}

function sampleHDR(hdr: HDRImageLike, dir: Vec3, up: Vec3): Vec3 {
  const ref: Vec3 = Math.abs(up[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const east = normalizeVec3Safe(cross3Vec3(up, ref, [0, 0, 0]));
  const north = cross3Vec3(east, up, [0, 0, 0]);
  const lat = Math.asin(clamp(dotVec3(dir, up), -1, 1));
  const lon = Math.atan2(dotVec3(dir, east), dotVec3(dir, north));
  const u = (0.5 + lon / (2 * PI)) * hdr.width;
  const v = (0.5 - lat / PI) * hdr.height;
  const x = Math.max(0, Math.min(hdr.width - 1, Math.floor(u)));
  const y = Math.max(0, Math.min(hdr.height - 1, Math.floor(v)));
  const idx = (y * hdr.width + x) * 4;
  return [hdr.data[idx], hdr.data[idx + 1], hdr.data[idx + 2]];
}

function sampleIrradiance(env: (dir: Vec3) => Vec3, n: Vec3): Vec3 {
  let total: Vec3 = [0, 0, 0];
  let weight = 0;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const xi = hammersley(i, SAMPLE_COUNT);
    const local = cosineSampleHemisphere(xi[0], xi[1]);
    const dir = tangentToWorld(local, n);
    const ndotl = Math.max(0, dotVec3(n, dir));
    const c = env(dir);
    total = addVec3Result(total, scaleVec3(c, ndotl));
    weight += ndotl;
  }
  return weight > 0 ? scaleVec3(total, 1 / weight) : [0, 0, 0];
}

function samplePrefiltered(env: (dir: Vec3) => Vec3, r: Vec3, roughness: number): Vec3 {
  if (roughness <= 0.001) {
    return env(r);
  }
  let total: Vec3 = [0, 0, 0];
  let weight = 0;
  const v = r;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const xi = hammersley(i, SAMPLE_COUNT);
    const h = tangentToWorld(importanceSampleGGX(xi[0], xi[1], roughness), r);
    const l = normalizeVec3Safe(subVec3Result(scaleVec3(h, 2 * dotVec3(v, h)), v));
    const ndotl = Math.max(0, dotVec3(r, l));
    if (ndotl > 0) {
      total = addVec3Result(total, scaleVec3(env(l), ndotl));
      weight += ndotl;
    }
  }
  return weight > 0 ? scaleVec3(total, 1 / weight) : env(r);
}

function createBRDFLUTPixels(): Uint8Array {
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
  return pixels;
}

function integrateBRDF(ndotv: number, roughness: number): [number, number] {
  const v: Vec3 = [Math.sqrt(Math.max(0, 1 - ndotv * ndotv)), 0, ndotv];
  let a = 0;
  let b = 0;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const xi = hammersley(i, SAMPLE_COUNT);
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
  return [a / SAMPLE_COUNT, b / SAMPLE_COUNT];
}

function geometrySmithIBL(ndotv: number, ndotl: number, roughness: number): number {
  const a = roughness * roughness;
  const k = (a * a) / 2;
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
