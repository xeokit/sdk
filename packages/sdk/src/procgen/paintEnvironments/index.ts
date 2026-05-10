/**
 * # Procedural Environment Images
 *
 * Functions that build environment images at runtime, suitable as
 * input to `IBL.setEnvironmentImage`. Each painter returns an
 * `HTMLCanvasElement` carrying the equirectangular projection.
 *
 * ## Usage
 *
 * ```ts
 * import {paintStudio} from "@xeokit/sdk/procgen/paintEnvironments";
 *
 * view.lights.ibl.setEnvironmentImage(paintStudio(1024, 512));
 * ```
 *
 * @module environments
 */

export * from "./paintStudio";
export * from "./paintSunset";
export * from "./paintSky";
export * from "./paintStudioHDR";
export * from "./paintSunSkyHDR";
export * from "./encodeRadianceHDR";
