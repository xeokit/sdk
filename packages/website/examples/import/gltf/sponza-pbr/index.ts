import {GLTFLoader} from "@xeokit/sdk/formats/gltf";
import {encodeRadianceHDR, paintStudioHDR} from "@xeokit/sdk/model/generation/paintEnvironments";
import {Scene} from "@xeokit/sdk/model/scene";
import {DEFAULT_VIEW_PROFILES, ViewProfiles} from "@xeokit/sdk/viewing/profiles";
import {WalkNavigationController} from "@xeokit/sdk/viewing/navigation/walk";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {finishExample, mustElement, mustOk, setStatus, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const PROFILE_SUN_ID = "__xeokit_studio_profile_sun";
const SPONZA_BASE = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Sponza/glTF/";
const SPONZA_GLTF = SPONZA_BASE + "Sponza.gltf";
const GLTF_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};
const INITIAL_WALK_CAMERA = {
  eye: [-7.73, -0.51, 1.65],
  look: [2.27, -0.26, 1.45],
  up: [0, 0, 1]
};

main().catch((error) => {
  setStatus("status", error instanceof Error ? error.message : String(error), "error");
  console.error(error);
});

async function main() {
  // Create the scene graph directly so the renderer, navigation, and loader
  // setup are all visible in this tutorial source.
  const canvas = mustElement("demoCanvas");
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});

  // Sponza is a textured PBR glTF scene. The profile panel below changes these
  // effects at runtime, but the initial View starts in a realistic configuration.
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: canvas,
    adaptiveQuality: false,
    camera: INITIAL_WALK_CAMERA,
    effects: {
      edges: {enabled: false},
      tonemap: {enabled: true, sRGBEncode: true}
    },
    texturing: {enabled: true}
  }));
  const renderer = await createRenderer(viewer);

  // Add direct light and a procedural HDR studio environment for IBL.
  view.clearLights();
  new AmbientLight(view, {color: [1, 1, 1], intensity: 0.08});
  new DirLight(view, {id: PROFILE_SUN_ID, dir: [-0.18, -0.28, -0.94], color: [1, 0.96, 0.9], intensity: 1.3, space: "world"});
  const hdrBuffer = encodeRadianceHDR(paintStudioHDR(1024, 512), 1024, 512);
  const iblResult = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuffer);
  if (!iblResult.ok) {
    throw new Error(iblResult.error);
  }

  // Use renderer-backed picking for both model navigation and the suspended
  // orbit controller used by walk navigation.
  const picker = new RoutingPickStrategy(scene, renderer);

  const modelNavigation = new ModelNavigationController(view, {
    active: false,
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({
        view,
        canvasPos: pickParams.canvasPos,
        snapRadius: pickParams.snapRadius,
        snapToVertex: pickParams.snapToVertex,
        snapToEdge: pickParams.snapToEdge,
        pickInvisible: pickParams.pickInvisible,
        pickSurfaceNormal: pickParams.pickSurfaceNormal
      });
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    },
    followPointer: true,
    doublePickFlyTo: false
  });
  const walkNavigation = new WalkNavigationController(view, {
    active: false,
    suspendModelNavigationController: modelNavigation,
    eyeHeight: 1.65,
    bodyRadius: 0.32,
    walkSpeed: 4.8,
    runSpeed: 11,
    movementAcceleration: 18,
    movementDeceleration: 24,
    stepHeight: 0.35,
    maxFall: 1,
    mouseLookDegreesPerPixel: 0.09,
    keyboardLookDegreesPerSecond: 72,
    maxPitchDegrees: 80,
    keyboardEnabledOnlyOnMouseover: false
  });
  const profiles = new ViewProfiles(view, {
    profiles: DEFAULT_VIEW_PROFILES,
    activeProfile: "realistic"
  });
  syncProfileSun(view);

  // Create the target SceneModel before loading. glTF assets are authored
  // Y-up; this explicit source coordinate system lets SceneModel convert
  // Sponza into the SDK's default Z-up scene before rendering and walking.
  const sceneModel = mustOk(scene.createModel({
    id: "sponza",
    coordinateSystem: GLTF_COORDINATE_SYSTEM
  }));

  // Fetch the external glTF file as bytes. The baseUri lets GLTFLoader resolve
  // Sponza's external buffers and textures relative to the .gltf.
  setStatus("status", "Loading Sponza...");
  const response = await fetch(SPONZA_GLTF);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching Sponza.gltf`);
  }
  const fileData = await response.arrayBuffer();
  const loadResult = await new GLTFLoader().load({fileData, sceneModel}, {baseUri: SPONZA_BASE});
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }
  walkNavigation.active = true;

  document.getElementById("status")?.style.setProperty("display", "none");
  document.getElementById("panel")?.style.setProperty("display", "block");
  wireUpPanel(view, profiles);
  finishExample(renderer, view);

  window.sponzaGltfExample = {scene, viewer, view, renderer, sceneModel, modelNavigation, walkNavigation, profiles};
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") {
    return configureExampleRenderer(viewer, new WebGLRenderer({viewer}));
  }
  const result = await WebGPURenderer.create({viewer});
  if (!result.ok) {
    throw new Error(result.error);
  }
  return configureExampleRenderer(viewer, result.value);
}

function wireUpPanel(view, profiles) {
  populatePanelFromView(view);

  bindSelect("viewProfile", (value) => {
    const result = profiles.setActiveProfile(value);
    if (!result.ok) {
      console.error(result.error);
      return;
    }
    syncProfileSun(view);
    updateSubpanelDisabledStates(view);
  });

  bindSelect("tonemapMode", (value) => { view.effects.tonemap.mode = value; });
  bindRange("exposure", (value) => { view.effects.tonemap.exposure = value; }, 2);
  bindCheck("tonemapSRGB", (value) => { view.effects.tonemap.sRGBEncode = value; });
  bindRange("renderScale", (value) => { view.effects.tonemap.renderScale = value; }, 1);

  bindRange("hemisphereIntensity", (value) => { view.lights.hemispheric.intensity = value; }, 2);
  bindColor("hemisphereSky", (rgb) => { view.lights.hemispheric.skyColor = rgb; });
  bindColor("hemisphereGround", (rgb) => { view.lights.hemispheric.groundColor = rgb; });

  bindRange("iblIntensity", (value) => { view.lights.ibl.intensity = value; }, 2);

  const updateSun = () => {
    const x = Number(getInput("sunX").value);
    const y = Number(getInput("sunY").value);
    const z = Number(getInput("sunZ").value);
    setText("sunXVal", x.toFixed(2));
    setText("sunYVal", y.toFixed(2));
    setText("sunZVal", z.toFixed(2));
    const dir = [x, y, z];
    view.effects.shadows.direction = dir;
    syncProfileSun(view);
    if (getInput("hemisphereFollowsSun").checked) {
      view.lights.hemispheric.worldUp = sunUpFromDir(dir);
    }
  };
  getInput("sunX").addEventListener("input", updateSun);
  getInput("sunY").addEventListener("input", updateSun);
  getInput("sunZ").addEventListener("input", updateSun);
  getInput("hemisphereFollowsSun").addEventListener("change", updateSun);

  bindRange("shadowsIntensity", (value) => { view.effects.shadows.intensity = value; }, 2);
  bindSelect("shadowsCascades", (value) => { view.effects.shadows.cascadeCount = Number.parseInt(value, 10); });
  bindRange("shadowsCascadeSplit", (value) => { view.effects.shadows.cascadeSplitLambda = value; }, 2);
  bindSelect("shadowsPCF", (value) => { view.effects.shadows.pcfKernelSize = Number.parseInt(value, 10); });
  bindSelect("shadowsResolution", (value) => { view.effects.shadows.resolution = Number.parseInt(value, 10); });
  bindCheck("shadowsAutoFit", (value) => { view.effects.shadows.autoFit = value; });
  bindRange("shadowsBias", (value) => { view.effects.shadows.bias = value; }, 4);
  bindRange("shadowsNormalOffsetBias", (value) => { view.effects.shadows.normalOffsetBias = value; }, 3);
  bindRange("shadowsSlopeBias", (value) => { view.effects.shadows.slopeBias = value; }, 4);
  bindRange("shadowsMaxDistance", (value) => { view.effects.shadows.maxDistance = value; }, 0);
  bindRange("shadowsPadding", (value) => { view.effects.shadows.padding = value; }, 2);

  bindRange("saoIntensity", (value) => { view.effects.sao.intensity = value; }, 2);
  bindRange("saoKernelRadius", (value) => { view.effects.sao.kernelRadius = value; }, 0);
  bindRange("saoNumSamples", (value) => { view.effects.sao.numSamples = value | 0; }, 0);
  bindCheck("saoBlur", (value) => { view.effects.sao.blur = value; });
  bindRange("saoBias", (value) => { view.effects.sao.bias = value; }, 2);
  bindRange("saoScale", (value) => { view.effects.sao.scale = value; }, 2);
  bindRange("saoBlendCutoff", (value) => { view.effects.sao.blendCutoff = value; }, 2);
  bindRange("saoBlendFactor", (value) => { view.effects.sao.blendFactor = value; }, 2);
  bindRange("saoMinResolution", (value) => { view.effects.sao.minResolution = value; }, 2);

  bindRange("bloomIntensity", (value) => { view.effects.bloom.intensity = value; }, 2);
  bindRange("bloomThreshold", (value) => { view.effects.bloom.threshold = value; }, 2);
  bindRange("bloomKnee", (value) => { view.effects.bloom.knee = value; }, 2);

  bindSelect("aaMode", (value) => { view.effects.antiAliasing.mode = value; });

  bindColor("edgesColor", (rgb) => { view.effects.edges.edgeColor = rgb; });
  bindRange("edgesAlpha", (value) => { view.effects.edges.edgeAlpha = value; }, 2);
  bindRange("edgesWidth", (value) => { view.effects.edges.edgeWidth = value | 0; }, 0);
  bindRange("edgesFadeStart", (value) => { view.effects.edges.edgeFadeStart = value; }, 2);
  bindRange("edgesFadeEnd", (value) => { view.effects.edges.edgeFadeEnd = value; }, 2);

  updateSubpanelDisabledStates(view);
}

function syncProfileSun(view) {
  const profileSun = view.lightSources[PROFILE_SUN_ID];
  if (profileSun) {
    profileSun.dir = Array.from(view.effects.shadows.direction);
  }
}

function updateSubpanelDisabledStates(view) {
  const effects = {
    tonemap: view.effects.tonemap,
    hemispheric: view.lights.hemispheric,
    ibl: view.lights.ibl,
    shadows: view.effects.shadows,
    sao: view.effects.sao,
    bloom: view.effects.bloom,
    aa: view.effects.antiAliasing,
    edges: view.effects.edges
  };
  for (const [name, effect] of Object.entries(effects)) {
    const details = document.querySelector(`#panel details[data-effect="${name}"]`);
    if (!details || !effect) {
      continue;
    }
    const active = effect.applied && effect.possible !== false;
    details.classList.toggle("disabled", !active);
    if (!active) {
      details.open = false;
    }
  }
}

function populatePanelFromView(view) {
  setSelect("tonemapMode", view.effects.tonemap.mode);
  setRange("exposure", view.effects.tonemap.exposure, 2);
  setCheck("tonemapSRGB", view.effects.tonemap.sRGBEncode);
  setRange("renderScale", view.effects.tonemap.renderScale, 1);

  setRange("hemisphereIntensity", view.lights.hemispheric.intensity, 2);
  setColor("hemisphereSky", view.lights.hemispheric.skyColor);
  setColor("hemisphereGround", view.lights.hemispheric.groundColor);

  setRange("iblIntensity", view.lights.ibl.intensity, 2);

  setRange("shadowsIntensity", view.effects.shadows.intensity, 2);
  const dir = view.effects.shadows.direction;
  setRange("sunX", dir[0], 2);
  setRange("sunY", dir[1], 2);
  setRange("sunZ", dir[2], 2);
  setSelect("shadowsCascades", String(view.effects.shadows.cascadeCount));
  setRange("shadowsCascadeSplit", view.effects.shadows.cascadeSplitLambda, 2);
  setSelect("shadowsPCF", String(view.effects.shadows.pcfKernelSize));
  setSelect("shadowsResolution", String(view.effects.shadows.resolution));
  setCheck("shadowsAutoFit", view.effects.shadows.autoFit);
  setRange("shadowsBias", view.effects.shadows.bias, 4);
  setRange("shadowsNormalOffsetBias", view.effects.shadows.normalOffsetBias, 3);
  setRange("shadowsSlopeBias", view.effects.shadows.slopeBias, 4);
  setRange("shadowsMaxDistance", view.effects.shadows.maxDistance, 0);
  setRange("shadowsPadding", view.effects.shadows.padding, 2);

  setRange("saoIntensity", view.effects.sao.intensity, 2);
  setRange("saoKernelRadius", view.effects.sao.kernelRadius, 0);
  setRange("saoNumSamples", view.effects.sao.numSamples, 0);
  setCheck("saoBlur", view.effects.sao.blur);
  setRange("saoBias", view.effects.sao.bias, 2);
  setRange("saoScale", view.effects.sao.scale, 2);
  setRange("saoBlendCutoff", view.effects.sao.blendCutoff, 2);
  setRange("saoBlendFactor", view.effects.sao.blendFactor, 2);
  setRange("saoMinResolution", view.effects.sao.minResolution, 2);

  setRange("bloomIntensity", view.effects.bloom.intensity, 2);
  setRange("bloomThreshold", view.effects.bloom.threshold, 2);
  setRange("bloomKnee", view.effects.bloom.knee, 2);

  setSelect("aaMode", view.effects.antiAliasing.mode);

  setColor("edgesColor", view.effects.edges.edgeColor);
  setRange("edgesAlpha", view.effects.edges.edgeAlpha, 2);
  setRange("edgesWidth", view.effects.edges.edgeWidth, 0);
  setRange("edgesFadeStart", view.effects.edges.edgeFadeStart, 2);
  setRange("edgesFadeEnd", view.effects.edges.edgeFadeEnd, 2);
}

function setRange(id, value, decimals) {
  const input = document.getElementById(id);
  if (!input) {
    return;
  }
  input.value = String(value);
  setText(id + "Val", decimals === 0 ? String(value | 0) : Number(value).toFixed(decimals));
}

function setCheck(id, value) {
  const input = document.getElementById(id);
  if (input) {
    input.checked = Boolean(value);
  }
}

function setSelect(id, value) {
  const input = document.getElementById(id);
  if (input) {
    input.value = String(value);
  }
}

function setColor(id, rgb) {
  const input = document.getElementById(id);
  if (input && rgb && rgb.length >= 3) {
    input.value = rgbToHex(rgb);
  }
}

function bindRange(id, fn, decimals) {
  const input = getInput(id);
  const valueLabel = document.getElementById(id + "Val");
  input.addEventListener("input", () => {
    const value = Number.parseFloat(input.value);
    if (valueLabel) {
      valueLabel.textContent = decimals === 0 ? String(value | 0) : value.toFixed(decimals ?? 2);
    }
    fn(value);
  });
}

function bindCheck(id, fn) {
  getInput(id).addEventListener("change", (event) => fn(event.target.checked));
}

function bindSelect(id, fn) {
  getInput(id).addEventListener("change", (event) => fn(event.target.value));
}

function bindColor(id, fn) {
  getInput(id).addEventListener("input", (event) => fn(hexToRgb(event.target.value)));
}

function getInput(id) {
  const input = document.getElementById(id);
  if (!input) {
    throw new Error(`Missing #${id}`);
  }
  return input;
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  }
}

function rgbToHex(rgb) {
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value * 255)));
  const hex = (value) => clamp(value).toString(16).padStart(2, "0");
  return `#${hex(rgb[0])}${hex(rgb[1])}${hex(rgb[2])}`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.substring(0, 2), 16) / 255,
    Number.parseInt(value.substring(2, 4), 16) / 255,
    Number.parseInt(value.substring(4, 6), 16) / 255
  ];
}

function sunUpFromDir(dir) {
  const length = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  return [-dir[0] / length, -dir[1] / length, -dir[2] / length];
}
