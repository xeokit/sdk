// Loads the bundled HousePlan glTF model and exposes the Rendering
// panel — same shape and wiring as the materials-chart, Cityscape,
// Duplex and Sponza demos. Effect parameters are not overridden; the
// SDK constructor defaults stand and the panel populates itself from
// the View at boot.
//
// HousePlan is a single-file `.glb` so the loader doesn't need a
// `baseUri` — all geometry, textures, and materials are embedded in
// the binary blob.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const HOUSE_PLAN_URL = "../../models/HousePlan/gltf/model.glb";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;


  const sceneModel = mustCreate(scene.createModel({
    id: "housePlan",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 1, 0, // Up
        0, 0, 1  // Forward
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }));

  const view = studio.viewManager.createView({
    camera: {
      "eye": [1396.192488512606,-228.91295922593062,7.605782942380627],
      "look": [1389.9821022363608,-234.97883380249922,1.9956860109231078],
      "up": [-0.3882818817391334,-0.3792467944611508,0.8398863311210985]
    },
    renderMode: xeokit.base.constants.RealisticRender,
    effects: {
      tonemap: {
        sRGBEncode: true
      }
    }
  });

  const status = document.getElementById("status");
  const panel  = document.getElementById("panel");

  const gltfLoader = new xeokit.formats.gltf.GLTFLoader();

  fetch(HOUSE_PLAN_URL)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${HOUSE_PLAN_URL}`);
      return response.arrayBuffer();
    })
    .then(fileData => gltfLoader.load({ fileData, sceneModel }))
    .then(() => {
      // Push a procedural equirectangular environment into IBL. The
      // renderer projects it onto the IBL source cubemap, prefilters
      // it for specular roughness levels, and convolves a diffuse
      // irradiance probe — so metals reflect the studio light, glass
      // picks up real ambient tinting, and the building's shaded
      // sides get richer colour than the default three-band gradient.
      view.lights.ibl.setEnvironmentImage(xeokit.model.procgen.paintEnvironments.paintSky(1024, 512));
      status.style.display = "none";
      panel.style.display = "block";
      wireUpPanel(view);
      studio.finished();
    })
    .catch(err => {
      status.textContent = `Failed to load HousePlan: ${err.message || err}`;
      console.error(err);
    });
});

function mustCreate(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

// ---------------------------------------------------------------------
// Rendering panel
//
// Lifted verbatim from SceneModel_build_pbr_materials_chart so every
// example using this panel layout keeps a single source of truth for
// behaviour. Effect parameters are not overridden — the SDK
// constructor defaults stand. The panel state in index.html mirrors
// those defaults so what the user sees in the UI matches what the
// renderer is actually doing.
// ---------------------------------------------------------------------

function renderModeFor(name) {
  const c = xeokit.base.constants;
  switch (name) {
    case "navigation": return c.NavigationRender;
    case "realistic":  return c.RealisticRender;
    case "detailed":
    default:           return c.DetailedRender;
  }
}

// Reverse of renderModeFor — map a render-mode constant back to the
// pulldown's option value, so the panel can sync itself to whatever
// the View's renderMode happens to be at boot.
function nameForRenderMode(mode) {
  const c = xeokit.base.constants;
  switch (mode) {
    case c.NavigationRender: return "navigation";
    case c.RealisticRender:  return "realistic";
    case c.DetailedRender:
    default:                 return "detailed";
  }
}

function wireUpPanel(view) {
  const $ = (id) => document.getElementById(id);

  // Pull every control's initial state from the View's effect components,
  // so the panel always agrees with the renderer's actual state regardless
  // of what the demo set up before showing the panel.
  populatePanelFromView(view);

  $("renderMode").addEventListener("change", (e) => {
    view.renderMode = renderModeFor(e.target.value);
    updateSubpanelDisabledStates(view);
  });

  // ---- Tonemap ----
  bindSelect("tonemapMode", v => { view.effects.tonemap.mode = v; });
  bindRange ("exposure",    v => { view.effects.tonemap.exposure = v; });
  bindCheck ("tonemapSRGB", v => { view.effects.tonemap.sRGBEncode = v; });
  bindRange ("renderScale", v => { view.effects.tonemap.renderScale = v; }, 1);

  // ---- Hemisphere Ambient ----
  bindRange ("hemisphereIntensity", v => { view.lights.hemispheric.intensity = v; });
  bindColor ("hemisphereSky",    rgb => { view.lights.hemispheric.skyColor    = rgb; });
  bindColor ("hemisphereGround", rgb => { view.lights.hemispheric.groundColor = rgb; });

  // ---- IBL (cubemap) ----
  bindRange ("iblIntensity", v => { view.lights.ibl.intensity = v; });

  // ---- Sun + Shadows ----
  const updateSun = () => {
    const x = parseFloat($("sunX").value);
    const y = parseFloat($("sunY").value);
    const z = parseFloat($("sunZ").value);
    $("sunXVal").textContent = x.toFixed(2);
    $("sunYVal").textContent = y.toFixed(2);
    $("sunZVal").textContent = z.toFixed(2);
    const dir = [x, y, z];
    view.effects.shadows.direction = dir;
    if ($("hemisphereFollowsSun").checked) {
      view.lights.hemispheric.worldUp = sunUpFromDir(dir);
    }
  };
  $("sunX").addEventListener("input", updateSun);
  $("sunY").addEventListener("input", updateSun);
  $("sunZ").addEventListener("input", updateSun);
  $("hemisphereFollowsSun").addEventListener("change", updateSun);

  bindRange ("shadowsIntensity",        v => { view.effects.shadows.intensity = v; });
  bindSelect("shadowsCascades",         v => { view.effects.shadows.cascadeCount = parseInt(v, 10); });
  bindRange ("shadowsCascadeSplit",     v => { view.effects.shadows.cascadeSplitLambda = v; });
  bindSelect("shadowsPCF",              v => { view.effects.shadows.pcfKernelSize = parseInt(v, 10); });
  bindSelect("shadowsResolution",       v => { view.effects.shadows.resolution = parseInt(v, 10); });
  bindCheck ("shadowsAutoFit",          v => { view.effects.shadows.autoFit = v; });
  bindRange ("shadowsBias",             v => { view.effects.shadows.bias = v; }, 4);
  bindRange ("shadowsNormalOffsetBias", v => { view.effects.shadows.normalOffsetBias = v; }, 3);
  bindRange ("shadowsSlopeBias",        v => { view.effects.shadows.slopeBias = v; }, 4);
  bindRange ("shadowsMaxDistance",      v => { view.effects.shadows.maxDistance = v; }, 0);
  bindRange ("shadowsPadding",          v => { view.effects.shadows.padding = v; });

  // ---- SAO ----
  bindRange ("saoIntensity",     v => { view.effects.sao.intensity = v; });
  bindRange ("saoKernelRadius",  v => { view.effects.sao.kernelRadius = v; }, 0);
  bindRange ("saoNumSamples",    v => { view.effects.sao.numSamples = v | 0; }, 0);
  bindCheck ("saoBlur",          v => { view.effects.sao.blur = v; });
  bindRange ("saoBias",          v => { view.effects.sao.bias = v; });
  bindRange ("saoScale",         v => { view.effects.sao.scale = v; });
  bindRange ("saoBlendCutoff",   v => { view.effects.sao.blendCutoff = v; });
  bindRange ("saoBlendFactor",   v => { view.effects.sao.blendFactor = v; });
  bindRange ("saoMinResolution", v => { view.effects.sao.minResolution = v; });

  // ---- Bloom ----
  bindRange ("bloomIntensity",  v => { view.effects.bloom.intensity = v; });
  bindRange ("bloomThreshold",  v => { view.effects.bloom.threshold = v; });
  bindRange ("bloomKnee",       v => { view.effects.bloom.knee = v; });

  // ---- Antialiasing ----
  bindSelect("aaMode", v => { view.effects.antiAliasing.mode = v; });

  // ---- Edges ----
  bindColor ("edgesColor",     rgb => { view.effects.edges.edgeColor = rgb; });
  bindRange ("edgesAlpha",       v => { view.effects.edges.edgeAlpha = v; });
  bindRange ("edgesWidth",       v => { view.effects.edges.edgeWidth = v | 0; }, 0);
  bindRange ("edgesFadeStart",   v => { view.effects.edges.edgeFadeStart = v; });
  bindRange ("edgesFadeEnd",     v => { view.effects.edges.edgeFadeEnd = v; });

  // Reflect the initial render-mode preset into the subpanels.
  updateSubpanelDisabledStates(view);
}

// Mute / un-mute each effect subpanel based on whether its effect is
// `applied` under the current render mode. Reads the SDK's per-effect
// `applied` getters so the panel state always agrees with what the
// renderer is actually doing.
function updateSubpanelDisabledStates(view) {
  const effects = {
    tonemap:           view.effects.tonemap,
    hemispheric: view.lights.hemispheric,
    ibl:               view.lights.ibl,
    shadows: view.effects.shadows,
    sao:     view.effects.sao,
    bloom:   view.effects.bloom,
    aa:      view.effects.antiAliasing,
    edges:   view.effects.edges
  };
  for (const [name, effect] of Object.entries(effects)) {
    const details = document.querySelector(`#panel details[data-effect="${name}"]`);
    if (!details || !effect) continue;
    const active = effect.applied && (effect.possible !== false);
    details.classList.toggle("disabled", !active);
    if (!active) details.open = false;
  }
}

// Pulls every panel control's initial state from the View's effect
// components, so the panel always agrees with the renderer regardless
// of what the demo set up. Called once at `wireUpPanel` start.
function populatePanelFromView(view) {
  // ---- Render-mode pulldown ----
  setSelect("renderMode", nameForRenderMode(view.renderMode));

  // ---- Tonemap ----
  setSelect("tonemapMode", view.effects.tonemap.mode);
  setRange ("exposure",    view.effects.tonemap.exposure, 2);
  setCheck ("tonemapSRGB", view.effects.tonemap.sRGBEncode);
  setRange ("renderScale", view.effects.tonemap.renderScale, 1);

  // ---- Hemisphere Ambient ----
  setRange ("hemisphereIntensity", view.lights.hemispheric.intensity, 2);
  setColor ("hemisphereSky",       view.lights.hemispheric.skyColor);
  setColor ("hemisphereGround",    view.lights.hemispheric.groundColor);

  // ---- IBL (cubemap) ----
  setRange ("iblIntensity", view.lights.ibl.intensity, 2);

  // ---- Sun + Shadows ----
  setRange ("shadowsIntensity",        view.effects.shadows.intensity, 2);
  const dir = view.effects.shadows.direction;
  setRange ("sunX", dir[0], 2);
  setRange ("sunY", dir[1], 2);
  setRange ("sunZ", dir[2], 2);
  setSelect("shadowsCascades",         String(view.effects.shadows.cascadeCount));
  setRange ("shadowsCascadeSplit",     view.effects.shadows.cascadeSplitLambda, 2);
  setSelect("shadowsPCF",              String(view.effects.shadows.pcfKernelSize));
  setSelect("shadowsResolution",       String(view.effects.shadows.resolution));
  setCheck ("shadowsAutoFit",          view.effects.shadows.autoFit);
  setRange ("shadowsBias",             view.effects.shadows.bias, 4);
  setRange ("shadowsNormalOffsetBias", view.effects.shadows.normalOffsetBias, 3);
  setRange ("shadowsSlopeBias",        view.effects.shadows.slopeBias, 4);
  setRange ("shadowsMaxDistance",      view.effects.shadows.maxDistance, 0);
  setRange ("shadowsPadding",          view.effects.shadows.padding, 2);

  // ---- SAO ----
  setRange ("saoIntensity",     view.effects.sao.intensity, 2);
  setRange ("saoKernelRadius",  view.effects.sao.kernelRadius, 0);
  setRange ("saoNumSamples",    view.effects.sao.numSamples, 0);
  setCheck ("saoBlur",          view.effects.sao.blur);
  setRange ("saoBias",          view.effects.sao.bias, 2);
  setRange ("saoScale",         view.effects.sao.scale, 2);
  setRange ("saoBlendCutoff",   view.effects.sao.blendCutoff, 2);
  setRange ("saoBlendFactor",   view.effects.sao.blendFactor, 2);
  setRange ("saoMinResolution", view.effects.sao.minResolution, 2);

  // ---- Bloom ----
  setRange ("bloomIntensity",  view.effects.bloom.intensity, 2);
  setRange ("bloomThreshold",  view.effects.bloom.threshold, 2);
  setRange ("bloomKnee",       view.effects.bloom.knee, 2);

  // ---- Antialiasing ----
  setSelect("aaMode", view.effects.antiAliasing.mode);

  // ---- Edges ----
  setColor ("edgesColor",      view.effects.edges.edgeColor);
  setRange ("edgesAlpha",      view.effects.edges.edgeAlpha, 2);
  setRange ("edgesWidth",      view.effects.edges.edgeWidth, 0);
  setRange ("edgesFadeStart",  view.effects.edges.edgeFadeStart, 2);
  setRange ("edgesFadeEnd",    view.effects.edges.edgeFadeEnd, 2);
}

function setRange(id, value, decimals) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = String(value);
  const valEl = document.getElementById(id + "Val");
  if (valEl) {
    valEl.textContent = decimals === 0
      ? String(value | 0)
      : Number(value).toFixed(decimals);
  }
}

function setCheck(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}

function setSelect(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = String(value);
}

function setColor(id, rgb) {
  const el = document.getElementById(id);
  if (el && rgb && rgb.length >= 3) el.value = rgbToHex(rgb);
}

function rgbToHex(rgb) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v * 255)));
  const h = v => clamp(v).toString(16).padStart(2, "0");
  return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}`;
}

function bindRange(id, fn, decimals) {
  const el = document.getElementById(id);
  const valEl = document.getElementById(id + "Val");
  el.addEventListener("input", () => {
    const v = parseFloat(el.value);
    if (valEl) {
      valEl.textContent = decimals !== undefined
        ? (decimals === 0 ? String(v | 0) : v.toFixed(decimals))
        : (Math.abs(v) < 10 && el.step !== "1") ? v.toFixed(2) : String(v | 0);
    }
    fn(v);
  });
}

function bindCheck(id, fn) {
  document.getElementById(id).addEventListener("change", e => fn(e.target.checked));
}

function bindSelect(id, fn) {
  document.getElementById(id).addEventListener("change", e => fn(e.target.value));
}

function bindColor(id, fn) {
  document.getElementById(id).addEventListener("input", e => {
    fn(hexToRgb(e.target.value));
  });
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255
  ];
}

function sunUpFromDir(dir) {
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  return [-dir[0] / len, -dir[1] / len, -dir[2] / len];
}

