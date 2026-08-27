import type {ViewProfile} from "./ViewProfilesParams";

/**
 * Built-in profile IDs supplied by {@link DEFAULT_VIEW_PROFILES}.
 *
 * These IDs are also used by {@link viewing!adaptiveQuality.AdaptiveQuality}
 * defaults: `"fast"` while the camera is moving and `"realistic"` when it is
 * at rest.
 */
export type DefaultViewProfileId = "fast" | "detailed" | "realistic";

/**
 * Built-in View profile map keyed by {@link DefaultViewProfileId}.
 */
export type DefaultViewProfiles = Record<DefaultViewProfileId, ViewProfile>;

const HEMISPHERE_SKY: [number, number, number] = [0.62, 0.72, 0.86];
const HEMISPHERE_GROUND: [number, number, number] = [0.42, 0.36, 0.30];
const WORLD_UP: [number, number, number] = [0, 0, 1];

/**
 * Built-in {@link ViewProfiles} definitions for common interactive viewers.
 *
 * The presets are tuned to avoid large tonal changes between profiles. They
 * use the same tonemap exposure and related environment colors, then vary
 * costlier effects and light balance.
 *
 * - `"fast"` minimizes work during interaction. It disables SAO, edges,
 *   bloom, atmosphere, IBL, shadows and antialiasing, and enables reduced
 *   resolution scale.
 * - `"detailed"` favors engineering readability. It enables subtle SAO,
 *   soft mesh-colored edges and SMAA, with moderate IBL as the primary
 *   ambient source and a low analytical hemisphere fill.
 * - `"realistic"` favors presentation quality. It enables IBL, sky, subtle
 *   SAO, restrained bloom, atmosphere and cast shadows.
 *
 * These are normal profile definitions. Applications can clone and edit them,
 * or pass them directly to {@link ViewProfiles} when the defaults are suitable.
 */
export const DEFAULT_VIEW_PROFILES: DefaultViewProfiles = {
  fast: {
    sao: {enabled: false},
    edges: {enabled: false},
    bloom: {enabled: false},
    atmosphere: {enabled: false},
    depthOfField: {enabled: false},
    colorGrading: {enabled: false},
    shadows: {enabled: false},
    sectionPlaneCaps: {enabled: false},
    bodyHatch: {enabled: false},
    tonemap: {
      enabled: true,
      mode: "aces",
      exposure: 0.82,
      sRGBEncode: true,
      renderScale: 1
    },
    antiAliasing: {
      enabled: false,
      mode: "fxaa"
    },
    sky: {
      enabled: true,
      sunEnabled: true,
      sunGlowIntensity: 0.15,
      worldUp: WORLD_UP
    },
    ibl: {
      enabled: false,
      intensity: 0
    },
    hemispheric: {
      enabled: true,
      intensity: 0.58,
      skyColor: HEMISPHERE_SKY,
      groundColor: HEMISPHERE_GROUND,
      worldUp: WORLD_UP
    },
    texturing: {enabled: true},
    resolutionScale: {
      enabled: true,
      resolutionScale: 0.72
    }
  },

  detailed: {
    sao: {
      enabled: true,
      intensity: 0.12,
      kernelRadius: 80,
      numSamples: 8,
      blur: true,
      bias: 0.5,
      scale: 1,
      blendCutoff: 0.3,
      blendFactor: 0.9,
      minResolution: 0
    },
    edges: {
      enabled: true,
      edgeColor: [0.28, 0.30, 0.34],
      useMeshColor: true,
      edgeDarken: 0.35,
      edgeWidth: 1,
      edgeAlpha: 0.55,
      edgeFadeStart: 0.45,
      edgeFadeEnd: 1
    },
    bloom: {enabled: false},
    atmosphere: {enabled: false},
    depthOfField: {enabled: false},
    colorGrading: {enabled: false},
    shadows: {enabled: false},
    sectionPlaneCaps: {enabled: true},
    bodyHatch: {enabled: false},
    tonemap: {
      enabled: true,
      mode: "aces",
      exposure: 0.82,
      sRGBEncode: true,
      renderScale: 1
    },
    antiAliasing: {
      enabled: true,
      mode: "smaa"
    },
    sky: {
      enabled: true,
      sunEnabled: true,
      sunGlowIntensity: 0.18,
      worldUp: WORLD_UP
    },
    ibl: {
      enabled: true,
      intensity: 0.28
    },
    hemispheric: {
      enabled: true,
      intensity: 0.18,
      skyColor: HEMISPHERE_SKY,
      groundColor: HEMISPHERE_GROUND,
      worldUp: WORLD_UP
    },
    texturing: {enabled: true},
    resolutionScale: {
      enabled: false,
      resolutionScale: 1
    }
  },

  realistic: {
    sao: {
      enabled: true,
      intensity: 0.16,
      kernelRadius: 100,
      numSamples: 12,
      blur: true,
      bias: 0.5,
      scale: 1,
      blendCutoff: 0.3,
      blendFactor: 1,
      minResolution: 0
    },
    edges: {enabled: false},
    bloom: {
      enabled: true,
      threshold: 4,
      knee: 0.45,
      intensity: 0.12
    },
    atmosphere: {
      enabled: true,
      color: [0.72, 0.82, 0.92],
      startDistance: 120,
      endDistance: 650,
      intensity: 0.22,
      maxOpacity: 0.35,
      affectSky: false
    },
    depthOfField: {enabled: false},
    colorGrading: {enabled: false},
    shadows: {
      enabled: true,
      intensity: 0.38,
      bias: 0.001,
      projectionSize: 30,
      lightDistance: 50,
      resolution: 2048,
      direction: [-0.5, -1, -0.3],
      autoFit: true,
      maxDistance: 200,
      padding: 1.1,
      pcfKernelSize: 7,
      contactHardening: true,
      lightRadius: 0.08,
      normalOffsetBias: 0.0035,
      slopeBias: 0.00125,
      cascadeCount: 4,
      cascadeSplitLambda: 0.5
    },
    sectionPlaneCaps: {enabled: true},
    bodyHatch: {enabled: false},
    tonemap: {
      enabled: true,
      mode: "aces",
      exposure: 0.82,
      sRGBEncode: true,
      renderScale: 1
    },
    antiAliasing: {
      enabled: true,
      mode: "smaa"
    },
    sky: {
      enabled: true,
      sunEnabled: true,
      sunAngularSize: 2.5,
      sunGlowSize: 14,
      sunGlowIntensity: 0.22,
      worldUp: WORLD_UP
    },
    ibl: {
      enabled: true,
      intensity: 0.72
    },
    hemispheric: {
      enabled: true,
      intensity: 0.04,
      skyColor: HEMISPHERE_SKY,
      groundColor: HEMISPHERE_GROUND,
      worldUp: WORLD_UP
    },
    texturing: {enabled: true},
    resolutionScale: {
      enabled: false,
      resolutionScale: 1
    }
  }
};
