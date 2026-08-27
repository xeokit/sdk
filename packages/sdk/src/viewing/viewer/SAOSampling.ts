import type {SAODebugMode} from "./SAOParams";

/**
 * Normalizes the public SAO debug option.
 *
 * @internal
 */
export function normalizeSAODebugMode(value: SAODebugMode | undefined | null): SAODebugMode {
  if (value === true || value === "finalFactor") {
    return "finalFactor";
  }
  if (
    value === "linearDepth" ||
    value === "normal" ||
    value === "rawOcclusion" ||
    value === "blurredOcclusion"
  ) {
    return value;
  }
  return false;
}

/**
 * Converts the public SAO debug option to the scalar ID consumed by shaders.
 *
 * @internal
 */
export function getSAODebugModeId(value: SAODebugMode | undefined | null): number {
  const mode = normalizeSAODebugMode(value);
  if (mode === "linearDepth") {
    return 1;
  }
  if (mode === "normal") {
    return 2;
  }
  if (mode === "rawOcclusion") {
    return 3;
  }
  if (mode === "blurredOcclusion") {
    return 4;
  }
  if (mode === "finalFactor") {
    return 5;
  }
  return 0;
}

/**
 * Returns true when the SAO debug mode needs the raw, pre-blur occlusion pass.
 *
 * @internal
 */
export function isRawSAODebugMode(value: SAODebugMode | undefined | null): boolean {
  const mode = normalizeSAODebugMode(value);
  return mode === "linearDepth" || mode === "normal" || mode === "rawOcclusion";
}
