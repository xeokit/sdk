import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {buildBox, buildSphere} from "@xeokit/sdk/model/generation/buildGeometry";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {addSlider, failExample, mustElement, mustOk, signalExampleLoaded, toNavigationPick, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";

main().catch((error) => failExample("view/section-planes/intro", error));

async function main() {
  // Scene and Viewer are intentionally constructed here so the View-owned clipping API is not hidden.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = mustOk(viewer.createView({
    id: "sectionPlanesIntroView",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [0.96, 0.97, 0.98],
    camera: {
      eye: [12, -28, 16],
      look: [0, 0, 2],
      up: [0, 0, 1]
    },
    effects: {
      sectionPlaneCaps: {enabled: true},
      edges: {enabled: true, useMeshColor: true, edgeWidth: 1},
      sao: {enabled: true, intensity: 0.08, scale: 0.9},
      tonemap: {enabled: true, sRGBEncode: true}
    }
  }));
  const renderer = await createRenderer(viewer);

  // Navigation stays independent from section planes; picks come from the renderer strategy.
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    },
    followPointer: true
  });

  // Create a small authored scene inline. The section planes clip any clippable ViewObject.
  const box = mustOk(buildBox({xSize: 2, ySize: 2, zSize: 2}));
  const sphere = mustOk(buildSphere({radius: 1, widthSegments: 32, heightSegments: 24}));
  const sceneModel = mustOk(scene.createModel({id: "sectioned", updateHint: "static"}));
  const meshes = [];
  const objects = [];
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 5;
    meshes.push({id: `box_m${i}`, geometryId: "box", position: [x, 0, 0], scale: [2, 2, 2], materialId: "matBox"});
    meshes.push({id: `sphere_m${i}`, geometryId: "sphere", position: [x, 0, 3.2], scale: [1.2, 1.2, 1.2], materialId: "matSphere"});
    objects.push({id: `obj_box_${i}`, meshIds: [`box_m${i}`]});
    objects.push({id: `obj_sphere_${i}`, meshIds: [`sphere_m${i}`]});
  }
  mustOk(sceneModel.fromParams({
    materials: [
      {id: "matBox", color: [0.55, 0.58, 0.62], roughness: 0.65, hatchPattern: {families: [{angle: 0, spacing: 0.3, lineWidth: 0.025}, {angle: 90, spacing: 0.3, lineWidth: 0.025}], color: [0.18, 0.2, 0.22], space: "world"}},
      {id: "matSphere", color: [0.75, 0.55, 0.3], roughness: 0.35, hatchPattern: {families: [{angle: 45, spacing: 0.18, lineWidth: 0.02}], color: [0.08, 0.05, 0.02], space: "world"}}
    ],
    geometries: [
      {
        id: "box",
        primitive: TrianglesPrimitive,
        positions: box.positions,
        normals: box.normals,
        indices: box.indices
      },
      {id: "sphere", primitive: TrianglesPrimitive, positions: sphere.positions, normals: sphere.normals, indices: sphere.indices}
    ],
    meshes,
    objects
  }));

  // SectionPlane belongs to the View, not the SceneModel. Each View can slice the same Scene differently.
  const horizontal = mustOk(view.createSectionPlane({id: "planeA", pos: [0, 0, 1.5], dir: [0, 0, 1], active: true, capColor: [0.32, 0.34, 0.38]}));
  const diagonal = mustOk(view.createSectionPlane({id: "planeB", pos: [0, 0, 0], dir: [Math.SQRT1_2, Math.SQRT1_2, 0], active: false, capColor: [0.38, 0.3, 0.22]}));

  const panel = createPanel();
  addToggle(panel, "Horizontal plane", horizontal.active, (on) => { horizontal.active = on; });
  addSlider(panel, {label: "Horizontal offset", min: -3, max: 3, step: 0.05, value: 1.5, digits: 2, onChange: (t) => { horizontal.pos = [0, 0, t]; }});
  addToggle(panel, "Diagonal plane", diagonal.active, (on) => { diagonal.active = on; });
  addSlider(panel, {label: "Diagonal offset", min: -6, max: 6, step: 0.05, value: 0, digits: 2, onChange: (t) => { diagonal.pos = [Math.SQRT1_2 * t, Math.SQRT1_2 * t, 0]; }});
  const centreSphere = view.objects["obj_sphere_2"];
  if (centreSphere) {
    addToggle(panel, "Centre sphere clippable", centreSphere.clippable, (on) => { centreSphere.clippable = on; });
  }
  addToggle(panel, "Caps", view.effects.sectionPlaneCaps.enabled, (on) => { view.effects.sectionPlaneCaps.enabled = on; });

  signalExampleLoaded();
  window.sectionPlanesIntroExample = {scene, viewer, view, renderer, picker, inputController, sceneModel, horizontal, diagonal};
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

function createPanel() {
  const panel = document.createElement("aside");
  panel.style.cssText = "position:absolute;top:16px;right:16px;z-index:20;width:260px;padding:12px;background:rgba(255,255,255,.94);border:1px solid #ddd;border-radius:6px;font:12px system-ui;display:grid;gap:8px";
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
