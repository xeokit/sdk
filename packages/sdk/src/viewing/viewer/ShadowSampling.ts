import type {ShadowDebugMode} from "./ShadowsParams";

/**
 * Clamps shadow PCF kernel size to the odd texel widths supported by the renderers.
 *
 * @internal
 */
export function clampShadowPcfKernelSize(value: number): number {
  let v = Math.round(value);
  if (!Number.isFinite(v) || v < 1) v = 1;
  if (v > 7) v = 7;
  if ((v & 1) === 0) v += 1;
  if (v > 7) v = 7;
  return v;
}

/**
 * Converts a PCF kernel size to the half-width radius used by shader loops.
 *
 * @internal
 */
export function getShadowPcfRadius(value: number | undefined, fallbackKernelSize = 3): number {
  return (clampShadowPcfKernelSize(value !== undefined ? value : fallbackKernelSize) - 1) >> 1;
}

/**
 * Normalizes the public shadow debug option.
 *
 * @internal
 */
export function normalizeShadowDebugMode(value: ShadowDebugMode | undefined | null): ShadowDebugMode {
  if (value === true || value === "factor") {
    return "factor";
  }
  if (value === "depth" || value === "rawDepth") {
    return "rawDepth";
  }
  if (value === "cascade") {
    return "cascade";
  }
  if (
    value === "refDepth" ||
    value === "bias" ||
    value === "blockerDepth" ||
    value === "filterRadius" ||
    value === "visibility"
  ) {
    return value;
  }
  return false;
}

/**
 * Converts the public shadow debug option to the scalar ID consumed by shaders.
 *
 * @internal
 */
export function getShadowDebugModeId(value: ShadowDebugMode | undefined | null): number {
  const mode = normalizeShadowDebugMode(value);
  if (mode === "factor") {
    return 1;
  }
  if (mode === "rawDepth") {
    return 2;
  }
  if (mode === "cascade") {
    return 3;
  }
  if (mode === "refDepth") {
    return 4;
  }
  if (mode === "bias") {
    return 5;
  }
  if (mode === "blockerDepth") {
    return 6;
  }
  if (mode === "filterRadius") {
    return 7;
  }
  if (mode === "visibility") {
    return 8;
  }
  return 0;
}
