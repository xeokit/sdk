import {AmbientLight, DirLight} from "@xeokit/sdk/viewing/viewer";
import {
  createStandaloneRuntime,
  finishExample,
} from "./standaloneRuntime.js";

export const Z_UP_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

export const Y_UP_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

export async function createFormatExampleViewer(params = {}) {
  const runtime = await createStandaloneRuntime({
    grid: params.grid ?? true,
    statusId: params.statusId ?? "status",
    viewParams: {
      id: params.viewId || "demoView",
      backgroundColor: params.backgroundColor || [1, 1, 1],
      texturing: {enabled: params.texturing !== false},
      effects: {
        edges: {enabled: params.edges === true, useMeshColor: true, edgeWidth: 1},
        tonemap: {enabled: true, mode: "aces", exposure: params.exposure ?? 0.55, sRGBEncode: true},
        sao: {enabled: params.sao === true, intensity: 0.08, scale: 0.8},
        bloom: {enabled: params.bloom === true, threshold: 0.9, knee: 0.45, intensity: 0.35},
        shadows: {enabled: params.shadows === true},
        atmosphere: {enabled: false},
        depthOfField: {enabled: false},
        sky: params.sky === false ? {enabled: false} : {
          enabled: true,
          skyColor: [0.58, 0.72, 0.88],
          horizonColor: [0.82, 0.89, 0.93],
          groundColor: [0.62, 0.66, 0.62],
          sunEnabled: true,
          sunDirection: [0.45, 0.35, 0.85],
          worldUp: [0, 0, 1]
        }
      },
      lights: {
        ibl: {enabled: params.ibl === true, intensity: params.iblIntensity ?? 0.65},
        hemispheric: {
          enabled: true,
          intensity: params.hemisphericIntensity ?? 0.35,
          skyColor: [0.62, 0.72, 0.86],
          groundColor: [0.42, 0.38, 0.32],
          worldUp: [0, 0, 1]
        }
      },
      ...(params.viewParams || {})
    },
    navigationParams: params.navigationParams || {}
  });

  if (params.clearLights === true) {
    runtime.view.clearLights();
    new AmbientLight(runtime.view, {color: [1, 1, 1], intensity: params.ambientIntensity ?? 0.18});
    new DirLight(runtime.view, {
      dir: params.sunDir || [-0.45, -0.55, -0.72],
      color: params.sunColor || [1, 0.96, 0.9],
      intensity: params.sunIntensity ?? 1.15,
      space: "world"
    });
  }

  return runtime;
}

export function finishFormatExample(renderer, view) {
  document.getElementById("status")?.style.setProperty("display", "none");
  finishExample(renderer, view);
}
