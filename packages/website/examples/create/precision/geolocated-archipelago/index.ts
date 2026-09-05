import {yieldToHost} from "@xeokit/sdk/base/utils";
import {Data} from "@xeokit/sdk/model/data";
import {CameraFlightAnimation} from "@xeokit/sdk/viewing/cameraFlight";
import {createStandaloneRuntime, failExample, finishExample, mustOk} from "../../../utils/standaloneRuntime.js";
import {buildArchipelago} from "./archipelago";
import {placeBuildings} from "./buildings";

const UTM_EAST = 267_000.0;
const UTM_NORTH = 6_550_000.0;

main().catch((error) => {
  failExample("geolocated-archipelago", error);
});

async function main() {
  const data = new Data();
  const {scene, view, renderer} = await createStandaloneRuntime({
    grid: true,
    webGPU: {
      renderConfigs: {
        logDepth: true
      }
    },
    viewParams: {
      camera: {
        eye: [UTM_EAST + 160, UTM_NORTH - 220, 130],
        look: [UTM_EAST, UTM_NORTH, 10],
        up: [0, 0, 1],
        perspectiveProjection: {near: 0.001, far: 200000}
      }
    }
  });

  const sceneModel = mustOk(scene.createModel({
    id: "archipelago",
    coordinateSystem: {
      basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
      origin: [UTM_EAST, 0.0, UTM_NORTH],
      units: "meters",
      scaleToMeters: 1
    }
  }));

  const {duplexAnchor, houseAnchor, SEA_LEVEL} = await buildArchipelago(sceneModel, yieldToHost);
  await placeBuildings(scene, data, sceneModel, {
    UTM_EAST,
    UTM_NORTH,
    duplexAnchor,
    houseAnchor,
    SEA_LEVEL
  });

  const cameraFlight = new CameraFlightAnimation(view, {duration: 1.8});
  const flyToTarget = (target, duration = 1.8) => {
    if (duration === 0) {
      cameraFlight.jumpTo(target);
    } else {
      cameraFlight.flyTo({...target, duration, arc: true, easing: "inThenOut"});
    }
  };

  const duplexTarget = targetFromAnchor(duplexAnchor ?? [0, 0, 0], [160, -220, 130], 10);
  const houseTarget = targetFromAnchor(houseAnchor ?? [-6500, 9500, 10], [190, -230, 150], 12);
  const ferryTarget = {
    eye: [UTM_EAST + 8500 + 180, UTM_NORTH - 8500 - 250, SEA_LEVEL + 110],
    look: [UTM_EAST + 8500, UTM_NORTH - 8500, SEA_LEVEL + 8]
  };

  const panel = createPanel();
  panel.querySelector('[data-action="fly-duplex"]')?.addEventListener("click", () => flyToTarget(duplexTarget));
  panel.querySelector('[data-action="fly-house"]')?.addEventListener("click", () => flyToTarget(houseTarget));
  panel.querySelector('[data-action="fly-ferry"]')?.addEventListener("click", () => flyToTarget(ferryTarget));
  startFpsMeter(view, panel);

  flyToTarget(duplexTarget, 0);
  finishExample(renderer, view);
}

function targetFromAnchor(anchor, eyeOffset, lookHeight) {
  const [x, y, z] = anchor;
  return {
    eye: [UTM_EAST + x + eyeOffset[0], UTM_NORTH + y + eyeOffset[1], z + eyeOffset[2]],
    look: [UTM_EAST + x, UTM_NORTH + y, z + lookHeight]
  };
}

function createPanel() {
  const panel = document.createElement("section");
  panel.id = "archipelagoPanel";
  panel.innerHTML = `
    <style>
      #archipelagoPanel {
        position: absolute;
        left: 16px;
        top: 16px;
        z-index: 200000050;
        width: min(360px, calc(100vw - 32px));
        box-sizing: border-box;
        padding: 14px;
        border: 1px solid rgba(20, 30, 45, 0.14);
        border-radius: 8px;
        background: rgba(248, 250, 252, 0.92);
        color: #1f2937;
        font: 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      #archipelagoPanel h1 { margin: 0 0 8px; font-size: 16px; line-height: 1.2; }
      #archipelagoPanel p { margin: 0 0 10px; }
      #archipelagoPanel .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
      #archipelagoPanel button {
        height: 30px;
        border: 1px solid #cbd5e1;
        border-radius: 5px;
        background: #fff;
        color: #1d4ed8;
        cursor: pointer;
        font: inherit;
      }
      #archipelagoPanel .stats { display: flex; gap: 14px; color: #475569; }
      @media (max-width: 720px) {
        #archipelagoPanel { top: auto; bottom: 12px; }
      }
    </style>
    <h1>Double-Precision Archipelago</h1>
    <p>54 islands in a 56 km UTM scene with loaded building and ferry models.</p>
    <div class="actions">
      <button type="button" data-action="fly-duplex">Duplex</button>
      <button type="button" data-action="fly-house">House</button>
      <button type="button" data-action="fly-ferry">Ferry</button>
    </div>
    <div class="stats">
      <span>FPS <strong data-stat="fps">0</strong></span>
      <span>Frame <strong data-stat="ms">0.0</strong> ms</span>
    </div>`;
  document.body.appendChild(panel);
  return panel;
}

function startFpsMeter(view, panel) {
  const fpsEl = panel.querySelector('[data-stat="fps"]');
  const msEl = panel.querySelector('[data-stat="ms"]');
  let fpsAvg = 0;
  let msAvg = 0;
  let last = performance.now();
  const tick = () => {
    if (view.destroyed) {
      return;
    }
    const now = performance.now();
    const dt = now - last;
    last = now;
    if (dt > 0) {
      const fps = 1000 / dt;
      fpsAvg = fpsAvg === 0 ? fps : fpsAvg + 0.1 * (fps - fpsAvg);
      msAvg = msAvg === 0 ? dt : msAvg + 0.1 * (dt - msAvg);
      if (fpsEl) {
        fpsEl.textContent = String(Math.round(fpsAvg));
      }
      if (msEl) {
        msEl.textContent = msAvg.toFixed(1);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
