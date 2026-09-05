import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {buildBox} from "@xeokit/sdk/model/generation/buildGeometry";
import {Scene, buildMat4} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {finishExample, mustElement, mustOk, toNavigationPick, createExampleRenderer} from "../../../utils/standaloneRuntime.js";

const CITY_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => console.error(error));

async function main() {
  // Standalone SDK setup: the benchmark owns its Scene, Viewer, View, renderer,
  // and navigation controller just like the import examples.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});

  const sceneModel = mustOk(scene.createModel({
    id: "cityModel",
    coordinateSystem: CITY_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const box = mustOk(buildBox({xSize: 1, ySize: 1, zSize: 1}));
  mustOk(sceneModel.createGeometry({
    id: "box",
    primitive: TrianglesPrimitive,
    positions: box.positions,
    indices: box.indices
  }));

  let seed = 98765;
  const rand = () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let nextId = 0;
  const placeBox = (cx, cy, w, d, h, color) => {
    const meshId = `m${nextId}`;
    const objId = `o${nextId++}`;
    mustOk(sceneModel.createMesh({
      id: meshId,
      geometryId: "box",
      matrix: buildMat4({
        position: [cx, cy, h / 2],
        scale: [w / 2, d / 2, h / 2]
      }),
      color
    }));
    mustOk(sceneModel.createObject({id: objId, meshIds: [meshId]}));
  };

  const slotSize = 3;
  const streetWidth = 5;
  const slotsPerBlock = 10;
  const numBlocks = 5;
  const blockStride = slotsPerBlock * slotSize + streetWidth;
  const halfCity = (numBlocks * blockStride) / 2;
  const cityDiameter = numBlocks * blockStride;

  placeBox(0, 0, cityDiameter + streetWidth * 2, cityDiameter + streetWidth * 2, 0.4, [0.18, 0.18, 0.18]);
  for (let bx = 0; bx < numBlocks; bx++) {
    for (let bz = 0; bz < numBlocks; bz++) {
      for (let sx = 0; sx < slotsPerBlock; sx++) {
        for (let sz = 0; sz < slotsPerBlock; sz++) {
          const cx = bx * blockStride + sx * slotSize - halfCity + slotSize / 2;
          const cy = bz * blockStride + sz * slotSize - halfCity + slotSize / 2;
          const nx = (bx + sx / slotsPerBlock) / numBlocks - 0.5;
          const ny = (bz + sz / slotsPerBlock) / numBlocks - 0.5;
          const distNorm = Math.min(1, Math.hypot(nx, ny) / 0.5);
          const maxH = 22 - distNorm * 18;
          const h = Math.max(1.5, rand() * maxH);
          const w = 1.2 + rand() * (slotSize - 1.4);
          const d = 1.2 + rand() * (slotSize - 1.4);
          const t = h / 22;
          placeBox(cx, cy, w, d, h, [0.62 - t * 0.22, 0.60 - t * 0.12, 0.55 + t * 0.20]);
        }
      }
    }
  }

  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {
      eye: [halfCity * 1.4, halfCity * 1.4, halfCity * 1.0],
      look: [0, 0, 8],
      up: [0, 0, 1]
    },
    effects: {
      sky: {enabled: true},
      sao: {enabled: false},
      shadows: {enabled: false},
      edges: {enabled: false}
    }
  }));
  const renderer = await createExampleRenderer(viewer);
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });

  window.cityscapeVBOProbe = createVBOProbe(renderer, view);
  window.cityscapeVBOProbe.sample();
  finishExample(renderer, view);
  window.proceduralCityscapeBenchmark = {scene, viewer, view, renderer, picker, inputController, sceneModel};
}

function createVBOProbe(renderer, view) {
  const inspectorResult = renderer.getRenderInspector();
  if (inspectorResult.ok === false) {
    console.warn(inspectorResult.error);
    return {lastFrameStats: null, sample: async () => null};
  }
  const inspector = inspectorResult.value;
  return {
    lastFrameStats: null,
    async sample() {
      view.needsRender();
      const [frame] = await inspector.captureFrames(1);
      this.lastFrameStats = frame?.vboGeometryTriangles || null;
      window.__lastCityscapeVBOStats = this.lastFrameStats;
      return this.lastFrameStats;
    }
  };
}
