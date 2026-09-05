import {encodeRadianceHDR, paintStudioHDR} from "@xeokit/sdk/model/generation/paintEnvironments";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {DEFAULT_VIEW_PROFILES, ViewProfiles} from "@xeokit/sdk/viewing/profiles";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {fetchArrayBuffer, finishExample, mustElement, mustOk, noPick} from "../../../utils/standaloneRuntime.js";

// Bare SDK setup. Studio is not used in this example so the ViewProfiles
// lifecycle is explicit.

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
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [0.96, 0.97, 0.98],
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [1396.192488512606, -228.91295922593062, 7.605782942380627],
      look: [1389.9821022363608, -234.97883380249922, 1.9956860109231078],
      up: [-0.3882818817391334, -0.3792467944611508, 0.8398863311210985]
    }
  }));

  // Attach the renderer and basic camera controls.
  const renderer = mustOk(await WebGPURenderer.create({viewer}));
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
  wireProfilePanel(profiles, renderer, view);

  // Bare examples create the same marker that Studio.finished() creates.
  // The snapshot script waits for this element before capturing.
  finishExample(renderer, view);

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

  const loader = new XGFLoader();
  await loader.load({
    fileData: await fetchArrayBuffer(XGF_URL),
    sceneModel
  });
}

function wireProfilePanel(viewProfiles, renderer, view) {
  const panel = document.getElementById("profilePanel");
  const buttons = [...panel.querySelectorAll("button[data-profile]")];
  const status = panel.querySelector(".status");
  const info = panel.querySelector(".profileInfo");

  renderProfileInfo(info, DEFAULT_VIEW_PROFILES);

  // Button state reflects the active profile; expanding profile details is
  // left to the user.
  const sync = () => {
    const active = viewProfiles.activeProfile;
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
    button.addEventListener("click", async () => {
      const nextProfile = button.dataset.profile;
      if (nextProfile === viewProfiles.activeProfile) {
        return;
      }
      setProfileSwitching(true);
      await nextPaint();
      // setActiveProfile returns SDKResult because activation can fail when
      // an ID or profile property is invalid.
      const result = viewProfiles.setActiveProfile(nextProfile);
      if (!result.ok) {
        status.textContent = result.error;
        setProfileSwitching(false);
        return;
      }
      sync();
      clearProfileSwitchingAfterRender(renderer, view);
    });
  }
  sync();
}

function setProfileSwitching(switching) {
  document.documentElement.classList.toggle("profile-switching", switching);
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function clearProfileSwitchingAfterRender(renderer, view) {
  let done = false;
  let unsubscribe = null;
  const clear = () => {
    if (done) {
      return;
    }
    done = true;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    setProfileSwitching(false);
  };
  const onViewRendered = renderer?.events?.onViewRendered;
  if (onViewRendered && typeof onViewRendered.subscribe === "function") {
    unsubscribe = onViewRendered.subscribe((_renderer, renderedView) => {
      if (renderedView && renderedView !== view) {
        return;
      }
      clear();
    });
  }
  setTimeout(clear, 1200);
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
  const hdrPixels = paintStudioHDR(512, 256);
  const hdrBuf = encodeRadianceHDR(hdrPixels, 512, 256);
  const result = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuf);
  if (!result.ok) {
    console.warn(result.error);
  }
}
