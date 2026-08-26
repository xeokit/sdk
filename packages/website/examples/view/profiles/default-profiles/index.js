import * as xeokit from "../../../../js/xeokit-studio-bundle.js";
import {signalExampleLoadedOnNextRender} from "../../../utils/snapshotReady.js";

// Bare SDK setup. Studio is not used in this example so the ViewProfiles
// lifecycle is explicit.
const {Scene} = xeokit.model.scene;
const {Viewer} = xeokit.viewing.viewer;
const {WebGLRenderer} = xeokit.viewing.renderers.webGL;
const {ModelNavigationController} = xeokit.viewing.navigation.model;
const {ViewProfiles, DEFAULT_VIEW_PROFILES} = xeokit.viewing.profiles;

const XGF_URL = "../../../../models/HousePlan/xgf/model.xgf";

main().catch((error) => {
  console.error("[view/profiles/default-profiles]", error);
});

async function main() {
  // Scene owns model data; Viewer owns one or more Views over that Scene.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});

  // The camera is framed for the bundled HousePlan XGF model.
  const view = mustOk(viewer.createView({
    id: "viewProfilesDemo",
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

  // ViewProfiles applies named effect-property maps to this View.
  // DEFAULT_VIEW_PROFILES provides fast, detailed and realistic profiles.
  const profiles = new ViewProfiles(view, {
    profiles: DEFAULT_VIEW_PROFILES,
    activeProfile: "realistic"
  });

  // Load model content after the View exists so renderer registration can
  // follow normal Scene/Viewer events.
  await loadHousePlan(scene);
  wireProfilePanel(viewProfiles);
  view.needsRender();

  // Bare examples create the same marker that Studio.finished() creates.
  // The snapshot script waits for this element before capturing.
  signalExampleLoadedOnNextRender(renderer, view);

  window.viewProfilesDemo = {
    scene,
    viewer,
    view,
    renderer,
    inputController,
    profiles
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

function wireProfilePanel(viewProfiles) {
  const panel = document.getElementById("profilePanel");
  const buttons = [...panel.querySelectorAll("button[data-profile]")];
  const status = panel.querySelector(".status");
  const info = panel.querySelector(".profileInfo");

  renderProfileInfo(info, DEFAULT_VIEW_PROFILES);

  // Button state reflects the active profile; expanding profile details is
  // left to the user.
  const sync = () => {
    const active = profiles.activeProfile;
    for (const button of buttons) {
      button.classList.toggle("active", button.dataset.profile === active);
    }
    for (const details of info.querySelectorAll("details[data-profile]")) {
      const isActive = details.dataset.profile === active;
      details.classList.toggle("active", isActive);
    }
    status.textContent = active || "none";
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      // setActiveProfile returns SDKResult because activation can fail when
      // an ID or profile property is invalid.
      const result = profiles.setActiveProfile(button.dataset.profile);
      if (!result.ok) {
        status.textContent = result.error;
        return;
      }
      sync();
    });
  }
  sync();
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
