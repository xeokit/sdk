import * as xeokit from "../../../../js/xeokit-studio-bundle.js";
import {signalExampleLoadedOnNextRender} from "../../../utils/snapshotReady.js";

// Bare SDK setup. This example wires AdaptiveQuality to ViewProfiles without
// using Studio.
const {Scene} = xeokit.model.scene;
const {Viewer} = xeokit.viewing.viewer;
const {WebGLRenderer} = xeokit.viewing.renderers.webGL;
const {ModelNavigationController} = xeokit.viewing.navigation.model;
const {AdaptiveQuality} = xeokit.viewing.adaptiveQuality;
const {ViewProfiles, DEFAULT_VIEW_PROFILES} = xeokit.viewing.profiles;

const XGF_URL = "../../../../models/HousePlan/xgf/model.xgf";

main().catch((error) => {
  console.error("[view/profiles/adaptive-quality]", error);
});

async function main() {
  // Scene owns model data; Viewer owns one or more Views over that Scene.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});

  // The camera is framed for the bundled HousePlan XGF model.
  const view = mustOk(viewer.createView({
    id: "adaptiveQualityDemo",
    htmlElement: document.getElementById("demoCanvas"),
    backgroundColor: [0.96, 0.97, 0.98],
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [1396.192488512606, -228.91295922593062, 7.605782942380627],
      look: [1389.9821022363608, -234.97883380249922, 1.9956860109231078],
      up: [-0.3882818817391334, -0.3792467944611508, 0.8398863311210985]
    }
  }));

  // Attach the WebGL renderer and basic camera controls.
  const renderer = new WebGLRenderer({viewer});
  const inputController = new ModelNavigationController(view, {
    pick: noPick,
    followPointer: false,
    doublePickFlyTo: false,
    keyboardDollyRate: 12,
    keyboardPanRate: 5,
    mouseWheelDollyRate: 90,
    touchDollyRate: 0.18
  });

  applyNeutralIBL(view);

  // AdaptiveQuality switches this ViewProfiles instance between fast and
  // realistic profiles as camera movement starts and stops.
  const profiles = new ViewProfiles(view, {
    profiles: DEFAULT_VIEW_PROFILES,
    activeProfile: "realistic"
  });

  const adaptiveQuality = new AdaptiveQuality({
    viewProfiles: profiles,
    fastProfile: "fast",
    restProfile: "realistic",
    restMs: 450
  });

  // Load model content after the View exists so renderer registration can
  // follow normal Scene/Viewer events.
  await loadHousePlan(scene);
  wireAdaptivePanel(view, profiles, adaptiveQuality);
  view.needsRender();

  // Bare examples create the same marker that Studio.finished() creates.
  // The snapshot script waits for this element before capturing.
  signalExampleLoadedOnNextRender(renderer, view);

  window.adaptiveQualityProfilesDemo = {
    scene,
    viewer,
    view,
    renderer,
    inputController,
    profiles,
    adaptiveQuality
  };
}

async function loadHousePlan(scene) {
  const response = await fetch(XGF_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${XGF_URL}`);
  }

  const sceneModel = mustOk(scene.createModel({
    id: "housePlan",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters"
    }
  }));

  const loader = new xeokit.formats.xgf.XGFLoader();
  await loader.load({
    fileData: await response.arrayBuffer(),
    sceneModel
  });
}

function wireAdaptivePanel(view, profiles, adaptiveQuality) {
  const enabled = document.getElementById("adaptiveEnabled");
  const activeProfile = document.getElementById("activeProfile");
  const movingState = document.getElementById("movingState");
  const info = document.querySelector("#adaptivePanel .profileInfo");
  let movingUntil = 0;

  renderProfileInfo(info, DEFAULT_VIEW_PROFILES);

  // Camera events mark the View as moving for the small status readout.
  // AdaptiveQuality does its own camera listening internally.
  const markMoving = () => {
    movingUntil = performance.now() + 520;
  };

  const events = view.viewer.events;
  events.onCameraViewMatrixUpdated.subscribe((changedView) => {
    if (changedView === view) {
      markMoving();
    }
  });
  events.onCameraProjMatrixUpdated.subscribe((changedView) => {
    if (changedView === view) {
      markMoving();
    }
  });

  enabled.addEventListener("change", () => {
    adaptiveQuality.enabled = enabled.checked;
  });

  // Poll lightweight state for the panel. The profile can change from camera
  // events, not only from UI events.
  const tick = () => {
    const active = profiles.activeProfile;
    activeProfile.textContent = active || "none";
    movingState.textContent = performance.now() < movingUntil ? "yes" : "no";
    syncProfileInfo(info, active);
    requestAnimationFrame(tick);
  };
  tick();
}

function renderProfileInfo(container, profiles) {
  // Render directly from DEFAULT_VIEW_PROFILES so the example UI cannot drift
  // from the values actually passed to ViewProfiles.
  container.replaceChildren();
  for (const profileId of ["fast", "detailed", "realistic"]) {
    const profile = profiles[profileId];
    const details = document.createElement("details");
    details.dataset.profile = profileId;

    const summary = document.createElement("summary");
    summary.textContent = profileId;
    details.appendChild(summary);

    const list = document.createElement("div");
    list.className = "effectList";
    for (const effectId of Object.keys(profile)) {
      const props = profile[effectId];
      const row = document.createElement("div");
      row.className = "effectRow";

      const name = document.createElement("div");
      name.className = "effectName";
      name.textContent = effectId;

      const values = document.createElement("div");
      values.className = "effectProps";
      values.append(...formatEffectProperties(props));

      row.append(name, values);
      list.appendChild(row);
    }

    details.appendChild(list);
    container.appendChild(details);
  }
}

function syncProfileInfo(container, activeProfile) {
  for (const details of container.querySelectorAll("details[data-profile]")) {
    const isActive = details.dataset.profile === activeProfile;
    details.classList.toggle("active", isActive);
  }
}

function formatEffectProperties(props) {
  const entries = Object.entries(props);
  return entries.flatMap(([key, value], index) => {
    const span = document.createElement("span");
    if (key === "enabled") {
      span.className = value === true ? "enabled" : "disabled";
    }
    span.textContent = `${key}: ${formatValue(value)}`;
    return index === entries.length - 1 ? [span] : [span, document.createTextNode(", ")];
  });
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return `[${value.join(", ")}]`;
  }
  return String(value);
}

function applyNeutralIBL(view) {
  const env = xeokit.model.generation.paintEnvironments;
  const hdrPixels = env.paintStudioHDR(512, 256);
  const hdrBuf = env.encodeRadianceHDR(hdrPixels, 512, 256);
  const result = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuf);
  if (!result.ok) {
    console.warn(result.error);
  }
}

function noPick() {
  return {
    ok: true,
    value: null
  };
}

function mustOk(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
