import {IFCLoader} from "@xeokit/sdk/formats/ifc";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {DEFAULT_VIEW_PROFILES, ViewProfiles} from "@xeokit/sdk/viewing/profiles";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {failExample, fetchArrayBuffer, mustElement, mustOk, signalExampleLoaded, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

const IFC_URL = "../../../../models/Duplex/ifc/model.ifc";
const DUPLEX_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => failExample("view/effects/duplex", error));

async function main() {
  // Build the SDK runtime explicitly. The example is about configuring a View,
  // so renderer, navigation, profiles and loading are all visible in one file.
  const scene = new Scene({logging: false});
  const data = new Data();
  const viewer = new Viewer({scene, logging: false});
  const view = mustOk(viewer.createView({
    id: "duplexEffectsView",
    htmlElement: mustElement("demoCanvas"),
    adaptiveQuality: false,
    backgroundColor: [0.96, 0.97, 0.98],
    camera: {
      eye: [24.4, 23.7, 27.04],
      look: [4.39, 8.9, 2.54],
      up: [-0.56, -0.41, 0.71]
    }
  }));
  const renderer = await createRenderer(viewer);

  // Renderer-backed picking keeps navigation useful without involving Studio.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    },
    followPointer: true
  });

  // ViewProfiles owns named effect presets for this View. SDK users can copy this
  // pattern and then override individual effect properties through the same View.
  const profiles = new ViewProfiles(view, {
    profiles: DEFAULT_VIEW_PROFILES,
    activeProfile: "realistic"
  });

  // The Duplex sidecar is inlined so the model-space basis is visible at the load site.
  const sceneModel = mustOk(scene.createModel({
    id: "duplex",
    coordinateSystem: DUPLEX_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const dataModel = mustOk(data.createModel({id: "duplex"}));
  await new IFCLoader().load({
    fileData: await fetchArrayBuffer(IFC_URL),
    sceneModel,
    dataModel
  });

  wireEffectsPanel(view, profiles);
  mustElement("status").style.display = "none";
  mustElement("panel").style.display = "block";

  signalExampleLoaded();
  window.duplexEffectsExample = {scene, data, viewer, view, renderer, picker, inputController, profiles, sceneModel, dataModel};
}

async function createRenderer(viewer) {
  const rendererName = new URLSearchParams(window.location.search).get("renderer")?.toLowerCase();
  if (rendererName === "webgl") {
    return configureExampleRenderer(viewer, new WebGLRenderer({viewer, logging: false}));
  }
  const result = await WebGPURenderer.create({viewer, logging: false});
  if (!result.ok) {
    throw new Error(result.error);
  }
  return configureExampleRenderer(viewer, result.value);
}

function wireEffectsPanel(view, profiles) {
  // Each control mutates the public View component it demonstrates. Those
  // assignments automatically invalidate rendering.
  bindSelect("viewProfile", (value) => {
    const result = profiles.setActiveProfile(value);
    if (!result.ok) {
      console.error(result.error);
      return;
    }
    populatePanelFromView(view);
    updateSubpanelDisabledStates(view);
  });

  bindSelect("tonemapMode", (value) => { view.effects.tonemap.mode = value; });
  bindRange("exposure", (value) => { view.effects.tonemap.exposure = value; });
  bindCheck("tonemapSRGB", (value) => { view.effects.tonemap.sRGBEncode = value; });
  bindRange("renderScale", (value) => { view.effects.tonemap.renderScale = value; }, 1);

  bindRange("hemisphereIntensity", (value) => { view.lights.hemispheric.intensity = value; });
  bindColor("hemisphereSky", (rgb) => { view.lights.hemispheric.skyColor = rgb; });
  bindColor("hemisphereGround", (rgb) => { view.lights.hemispheric.groundColor = rgb; });
  bindRange("iblIntensity", (value) => { view.lights.ibl.intensity = value; });

  const updateSun = () => {
    const dir = [rangeValue("sunX"), rangeValue("sunY"), rangeValue("sunZ")];
    view.effects.shadows.direction = dir;
    if (checked("hemisphereFollowsSun")) {
      view.lights.hemispheric.worldUp = sunUpFromDir(dir);
    }
    writeValue("sunX", dir[0], 2);
    writeValue("sunY", dir[1], 2);
    writeValue("sunZ", dir[2], 2);
  };
  onInput("sunX", updateSun);
  onInput("sunY", updateSun);
  onInput("sunZ", updateSun);
  onInput("hemisphereFollowsSun", updateSun);

  bindRange("shadowsIntensity", (value) => { view.effects.shadows.intensity = value; });
  bindSelect("shadowsCascades", (value) => { view.effects.shadows.cascadeCount = parseInt(value, 10); });
  bindRange("shadowsCascadeSplit", (value) => { view.effects.shadows.cascadeSplitLambda = value; });
  bindSelect("shadowsPCF", (value) => { view.effects.shadows.pcfKernelSize = parseInt(value, 10); });
  bindSelect("shadowsResolution", (value) => { view.effects.shadows.resolution = parseInt(value, 10); });
  bindCheck("shadowsAutoFit", (value) => { view.effects.shadows.autoFit = value; });
  bindRange("shadowsBias", (value) => { view.effects.shadows.bias = value; }, 4);
  bindRange("shadowsNormalOffsetBias", (value) => { view.effects.shadows.normalOffsetBias = value; }, 3);
  bindRange("shadowsSlopeBias", (value) => { view.effects.shadows.slopeBias = value; }, 4);
  bindRange("shadowsMaxDistance", (value) => { view.effects.shadows.maxDistance = value; }, 0);
  bindRange("shadowsPadding", (value) => { view.effects.shadows.padding = value; });

  bindRange("saoIntensity", (value) => { view.effects.sao.intensity = value; });
  bindRange("saoKernelRadius", (value) => { view.effects.sao.kernelRadius = value; }, 0);
  bindRange("saoNumSamples", (value) => { view.effects.sao.numSamples = value | 0; }, 0);
  bindCheck("saoBlur", (value) => { view.effects.sao.blur = value; });
  bindRange("saoBias", (value) => { view.effects.sao.bias = value; });
  bindRange("saoScale", (value) => { view.effects.sao.scale = value; });
  bindRange("saoBlendCutoff", (value) => { view.effects.sao.blendCutoff = value; });
  bindRange("saoBlendFactor", (value) => { view.effects.sao.blendFactor = value; });
  bindRange("saoMinResolution", (value) => { view.effects.sao.minResolution = value; });

  bindRange("bloomIntensity", (value) => { view.effects.bloom.intensity = value; });
  bindRange("bloomThreshold", (value) => { view.effects.bloom.threshold = value; });
  bindRange("bloomKnee", (value) => { view.effects.bloom.knee = value; });
  bindSelect("aaMode", (value) => { view.effects.antiAliasing.mode = value; });
  bindColor("edgesColor", (rgb) => { view.effects.edges.edgeColor = rgb; });
  bindRange("edgesAlpha", (value) => { view.effects.edges.edgeAlpha = value; });
  bindRange("edgesWidth", (value) => { view.effects.edges.edgeWidth = value | 0; }, 0);
  bindRange("edgesFadeStart", (value) => { view.effects.edges.edgeFadeStart = value; });
  bindRange("edgesFadeEnd", (value) => { view.effects.edges.edgeFadeEnd = value; });

  populatePanelFromView(view);
  updateSubpanelDisabledStates(view);
}

function populatePanelFromView(view) {
  setSelect("viewProfile", "realistic");
  setSelect("tonemapMode", view.effects.tonemap.mode);
  setRange("exposure", view.effects.tonemap.exposure, 2);
  setCheck("tonemapSRGB", view.effects.tonemap.sRGBEncode);
  setRange("renderScale", view.effects.tonemap.renderScale, 1);
  setRange("hemisphereIntensity", view.lights.hemispheric.intensity, 2);
  setColor("hemisphereSky", view.lights.hemispheric.skyColor);
  setColor("hemisphereGround", view.lights.hemispheric.groundColor);
  setRange("iblIntensity", view.lights.ibl.intensity, 2);
  const dir = view.effects.shadows.direction || [-0.18, -0.28, -0.94];
  setRange("sunX", dir[0], 2);
  setRange("sunY", dir[1], 2);
  setRange("sunZ", dir[2], 2);
  setRange("shadowsIntensity", view.effects.shadows.intensity, 2);
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

function updateSubpanelDisabledStates(view) {
  const effectMap = {
    tonemap: view.effects.tonemap,
    hemispheric: view.lights.hemispheric,
    ibl: view.lights.ibl,
    shadows: view.effects.shadows,
    sao: view.effects.sao,
    bloom: view.effects.bloom,
    aa: view.effects.antiAliasing,
    edges: view.effects.edges
  };
  for (const details of document.querySelectorAll("details[data-effect]")) {
    const effect = effectMap[details.dataset.effect];
    details.classList.toggle("disabled", effect?.enabled === false);
  }
}

function bindRange(id, onChange, digits = 2) {
  onInput(id, () => {
    const value = rangeValue(id);
    writeValue(id, value, digits);
    onChange(value);
  });
}

function bindCheck(id, onChange) {
  onInput(id, () => onChange(checked(id)));
}

function bindSelect(id, onChange) {
  onInput(id, () => onChange(mustElement(id).value));
}

function bindColor(id, onChange) {
  onInput(id, () => onChange(hexToRGB(mustElement(id).value)));
}

function onInput(id, callback) {
  mustElement(id).addEventListener("input", callback);
}

function rangeValue(id) {
  return parseFloat(mustElement(id).value);
}

function checked(id) {
  return mustElement(id).checked === true;
}

function setRange(id, value, digits = 2) {
  const input = mustElement(id);
  input.value = String(value);
  writeValue(id, Number(value), digits);
}

function writeValue(id, value, digits) {
  const output = document.getElementById(`${id}Val`);
  if (output) {
    output.textContent = Number(value).toFixed(digits);
  }
}

function setCheck(id, value) {
  mustElement(id).checked = value === true;
}

function setSelect(id, value) {
  mustElement(id).value = String(value);
}

function setColor(id, rgb) {
  mustElement(id).value = rgbToHex(rgb);
}

function hexToRGB(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255
  ];
}

function rgbToHex(rgb) {
  return `#${rgb.map((value) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function sunUpFromDir(dir) {
  const length = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  return [-dir[0] / length, -dir[1] / length, -dir[2] / length];
}

