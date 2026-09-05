import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {Scene, type SceneModel, type SceneModelBatch} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {signalExampleLoadedOnNextRender} from "../../../utils/snapshotReady.js";
import {createExampleRenderer, createModelNavigationPickAdapter} from "../../../utils/standaloneRuntime.js";

const canvas = mustElement<HTMLCanvasElement>("demoCanvas");
const stats = mustElement<HTMLElement>("stats");
const logEl = mustElement<HTMLElement>("log");
const stageBtn = mustElement<HTMLButtonElement>("stageBtn");
const commitBtn = mustElement<HTMLButtonElement>("commitBtn");
const rollbackBtn = mustElement<HTMLButtonElement>("rollbackBtn");
const sealBtn = mustElement<HTMLButtonElement>("sealBtn");
const attemptBtn = mustElement<HTMLButtonElement>("attemptBtn");
const resetBtn = mustElement<HTMLButtonElement>("resetBtn");

const scene = new Scene({logging: false});
const viewer = new Viewer({scene, logging: false});
const view = unwrap(viewer.createView({
  id: "lifecycleBatchView",
  htmlElement: canvas,
  backgroundColor: [0.95, 0.96, 0.97],
  camera: {
    projection: "perspective",
    eye: [72, -86, 54],
    look: [18, 18, 5],
    up: [0, 0, 1]
  },
  effects: {
    sao: {enabled: false},
    edges: {enabled: false},
    bloom: {enabled: false},
    atmosphere: {enabled: false},
    depthOfField: {enabled: false},
    tonemap: {enabled: false},
    antiAliasing: {enabled: false},
    shadows: {enabled: false},
    sky: {enabled: false},
    sectionPlaneCaps: {enabled: false},
    bodyHatch: {enabled: false}
  },
  lights: {
    ibl: {enabled: false},
    hemispheric: {enabled: false}
  },
  texturing: {
    enabled: false
  }
}));
const renderer = await createExampleRenderer(viewer, {sky: false});
signalExampleLoadedOnNextRender(renderer, view);
const picker = new RoutingPickStrategy(scene, renderer);
new ModelNavigationController(view, {
  pick: createModelNavigationPickAdapter(view, picker),
  followPointer: true,
  doublePickFlyTo: false,
  keyboardDollyRate: 14,
  keyboardPanRate: 8,
  mouseWheelDollyRate: 90
});

let sceneModel: SceneModel;
let batchSerial = 0;
let lastCommittedBatch: SceneModelBatch | null = null;

reset();

stageBtn.addEventListener("click", () => {
  if (sceneModel.activeBatch || sceneModel.lifecycle === "sealed") {
    update();
    return;
  }
  const batchId = `tile-${++batchSerial}`;
  unwrap(sceneModel.beginBatch({id: batchId}));
  createTile(batchId, batchSerial - 1);
  setLog(`Staged ${batchId}. Objects are in the SceneModel, but not attached to Viewer/renderer until commit.`);
  update();
});

commitBtn.addEventListener("click", () => {
  if (!sceneModel.activeBatch) {
    update();
    return;
  }
  lastCommittedBatch = unwrap(sceneModel.commitBatch());
  setLog(`Committed ${lastCommittedBatch.id}. Renderer should now show allocationKind=sealedBatch.`);
  requestAnimationFrame(update);
});

rollbackBtn.addEventListener("click", () => {
  const batchId = sceneModel.activeBatch?.id;
  if (!batchId) {
    update();
    return;
  }
  unwrap(sceneModel.rollbackBatch());
  setLog(`Rolled back ${batchId}; staged components were destroyed.`);
  update();
});

sealBtn.addEventListener("click", () => {
  const res = sceneModel.seal();
  setLog(res.ok ? "Model sealed. Further topology/resource growth is rejected." : res.error);
  update();
});

attemptBtn.addEventListener("click", () => {
  const res = sceneModel.createGeometry({
    id: `lateGeometry-${Date.now()}`,
    primitive: TrianglesPrimitive,
    positions: BOX_POSITIONS,
    indices: BOX_INDICES
  });
  setLog(res.ok ? "Unexpectedly created late geometry." : res.error);
  update();
});

resetBtn.addEventListener("click", reset);
renderer.events.onViewRendered.subscribe(() => update());

function reset(): void {
  if (sceneModel && !sceneModel.destroyed) {
    sceneModel.destroy();
  }
  batchSerial = 0;
  lastCommittedBatch = null;
  sceneModel = unwrap(scene.createModel({
    id: `lifecycleDemo-${Date.now()}`,
    updateHint: "static",
    lifecycle: "streaming",
    memoryPolicy: "compact"
  }));
  setLog("Ready. Stage a batch, then commit or roll it back.");
  update();
}

function createTile(batchId: string, tileIndex: number): void {
  const gridX = tileIndex % 4;
  const gridY = Math.floor(tileIndex / 4);
  const originX = gridX * 24;
  const originY = gridY * 24;
  const colorBase = [
    [0.25, 0.48, 0.78],
    [0.78, 0.42, 0.28],
    [0.34, 0.62, 0.38],
    [0.58, 0.42, 0.74]
  ][tileIndex % 4];

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const n = row * 5 + col;
      const height = 3 + ((tileIndex * 7 + n * 3) % 9);
      const x = originX + col * 4.2;
      const y = originY + row * 4.2;
      const id = `${batchId}-${n}`;
      sceneModel.createGeometry({
        id: `g-${id}`,
        primitive: TrianglesPrimitive,
        positions: scaledBoxPositions(1.3, 1.3, height),
        indices: BOX_INDICES
      });
      sceneModel.createMesh({
        id: `m-${id}`,
        geometryId: `g-${id}`,
        position: [x, y, height * 0.5],
        color: [
          Math.min(1, colorBase[0] + row * 0.04),
          Math.min(1, colorBase[1] + col * 0.035),
          colorBase[2]
        ]
      });
      sceneModel.createObject({
        id: `o-${id}`,
        meshIds: [`m-${id}`]
      });
    }
  }
}

function update(): void {
  const activeBatch = sceneModel.activeBatch;
  const memory = renderer.getMemoryInspector?.();
  const batches = memory?.ok && memory.value.gpuResources ? memory.value.gpuResources.batches : [];
  const batchRows = batches.map((batch: any, i: number) => {
    const label = batch.sceneBatchId || batch.sceneModelId || "shared";
    return `#${i} ${batch.geometryStorage}/${batch.allocationKind}/${batch.memoryPolicy}/${label}`;
  });

  const rows: Array<[string, string]> = [
    ["updateHint", sceneModel.updateHint],
    ["lifecycle", sceneModel.lifecycle],
    ["memoryPolicy", sceneModel.memoryPolicy],
    ["activeBatch", activeBatch ? activeBatch.id : "none"],
    ["active staged", activeBatch ? `${activeBatch.objects.length} objects, ${activeBatch.meshes.length} meshes` : "0"],
    ["scene objects", String(Object.keys(sceneModel.objects).length)],
    ["scene meshes", String(Object.keys(sceneModel.meshes).length)],
    ["scene geometries", String(Object.keys(sceneModel.geometries).length)],
    ["last committed", lastCommittedBatch ? lastCommittedBatch.id : "none"],
    ["renderer batches", String(batches.length)],
    ["renderer paths", batchRows.length ? batchRows.join("\n") : "none"]
  ];

  stats.innerHTML = rows.map(([label, value]) =>
    `<div class="row"><span>${escapeHTML(label)}</span><span>${escapeHTML(value)}</span></div>`
  ).join("");

  stageBtn.disabled = !!activeBatch || sceneModel.lifecycle === "sealed";
  commitBtn.disabled = !activeBatch;
  rollbackBtn.disabled = !activeBatch;
  sealBtn.disabled = !!activeBatch || sceneModel.lifecycle === "sealed";
  attemptBtn.disabled = !!activeBatch;
}

function setLog(message: string): void {
  logEl.textContent = message;
}

function mustElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
}

function unwrap<T>(result: {ok: true; value: T} | {ok: false; error: string}): T {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Operation failed");
  }
  return result.value;
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char] || char));
}

function scaledBoxPositions(sx: number, sy: number, sz: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < BOX_POSITIONS.length; i += 3) {
    out.push(BOX_POSITIONS[i] * sx, BOX_POSITIONS[i + 1] * sy, BOX_POSITIONS[i + 2] * sz);
  }
  return out;
}

const BOX_POSITIONS = [
  -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5
];

const BOX_INDICES = [
  0, 1, 2, 0, 2, 3,
  4, 6, 5, 4, 7, 6,
  0, 4, 5, 0, 5, 1,
  1, 5, 6, 1, 6, 2,
  2, 6, 7, 2, 7, 3,
  3, 7, 4, 3, 4, 0
];
