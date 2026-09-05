import {IFCLoader} from "@xeokit/sdk/formats/ifc";
import {Data} from "@xeokit/sdk/model/data";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {TransformControls} from "@xeokit/sdk/viewing/transformControls";
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

main().catch((error) => failExample("view/section-planes/transform-controls", error));

async function main() {
  // Create the core SDK objects directly. The example needs a real DataModel
  // because IFCLoader can preserve IFC semantic IDs beside rendered geometry.
  const scene = new Scene({logging: false});
  const data = new Data();
  const viewer = new Viewer({scene, logging: false});
  const view = mustOk(viewer.createView({
    id: "sectionPlaneTransformControlsView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [1, 1, 1],
    camera: {
      eye: [24.4, 23.7, 27.04],
      look: [4.39, 8.9, 2.54],
      up: [-0.56, -0.41, 0.71]
    },
    effects: {
      sectionPlaneCaps: {enabled: true},
      edges: {enabled: true, useMeshColor: true, edgeWidth: 1},
      sao: {enabled: true, intensity: 0.08, scale: 0.9},
      tonemap: {enabled: true, sRGBEncode: true}
    }
  }));
  const renderer = await createRenderer(viewer);

  // TransformControls and model navigation share the same View; navigation picks
  // the loaded model while the controls own their temporary gizmo geometry.
  const picker = new RoutingPickStrategy(scene, renderer);
  const navigation = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    },
    followPointer: true
  });

  // The Duplex sidecar is inlined to make the model-space contract explicit.
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

  // Place a View-owned section plane through the model center. The plane is not
  // model data; another View could show the same model with no clipping at all.
  const center = sceneCenter(scene.aabb || [0, 0, 0, 0, 0, 0]);
  const plane = mustOk(view.createSectionPlane({
    id: "slice",
    pos: center,
    dir: [0, 0, 1],
    active: true
  }));

  // TransformControls accepts a target adapter. The adapter maps a 4x4 gizmo
  // frame to SectionPlane.pos and SectionPlane.dir.
  const planeAdapter = {
    getMatrix() {
      const z = normalize(plane.dir.slice());
      const ref = Math.abs(z[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const x = normalize(cross(ref, z));
      const y = cross(z, x);
      const p = plane.pos;
      return new Float64Array([
        x[0], x[1], x[2], 0,
        y[0], y[1], y[2], 0,
        z[0], z[1], z[2], 0,
        p[0], p[1], p[2], 1
      ]);
    },
    setMatrix(matrix) {
      const previousPos = plane.pos.slice();
      const dir = normalize([matrix[8], matrix[9], matrix[10]], normalize(plane.dir.slice()));
      const rawPos = [matrix[12], matrix[13], matrix[14]];
      const delta = [rawPos[0] - previousPos[0], rawPos[1] - previousPos[1], rawPos[2] - previousPos[2]];
      const slide = dot(delta, dir);
      plane.dir = dir;
      plane.pos = [
        previousPos[0] + dir[0] * slide,
        previousPos[1] + dir[1] * slide,
        previousPos[2] + dir[2] * slide
      ];
    }
  };
  const controls = TransformControls.openFor({view, modelNavigation: navigation});
  controls.attach(planeAdapter);
  applyPlaneControlMode(controls, "translate");

  // Keep the keyboard shortcuts local and explicit so SDK users can copy the pattern.
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "g") applyPlaneControlMode(controls, "translate");
    if (key === "r") applyPlaneControlMode(controls, "rotate");
    if (key === "n") controls.setMode("none");
  });

  const panel = createPanel();
  addToggle(panel, "Section plane", plane.active, (on) => { plane.active = on; });

  signalExampleLoaded();
  window.sectionPlaneTransformControlsExample = {scene, data, viewer, view, renderer, picker, navigation, controls, sceneModel, dataModel, plane};
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

function applyPlaneControlMode(controls, mode) {
  controls.setSpace("local");
  controls.setShowX(true);
  controls.setShowY(true);
  controls.setShowZ(true);
  controls.setMode(mode);
}

function createPanel() {
  const panel = document.createElement("aside");
  panel.style.cssText = "position:absolute;top:16px;right:16px;z-index:20;width:220px;padding:12px;background:rgba(255,255,255,.94);border:1px solid #ddd;border-radius:6px;font:12px system-ui";
  document.body.appendChild(panel);
  return panel;
}

function addToggle(container, label, value, onChange) {
  const row = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = value;
  input.addEventListener("change", () => onChange(input.checked));
  row.append(input, document.createTextNode(` ${label}`));
  container.appendChild(row);
}

function sceneCenter(aabb) {
  return [(aabb[0] + aabb[3]) * 0.5, (aabb[1] + aabb[4]) * 0.5, (aabb[2] + aabb[5]) * 0.5];
}

function normalize(v, fallback = [0, 0, -1]) {
  const length = Math.hypot(v[0], v[1], v[2]);
  return Number.isFinite(length) && length > 1e-12 ? [v[0] / length, v[1] / length, v[2] / length] : fallback.slice();
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

