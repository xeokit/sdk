// Import the xeokit SDK bundle. This bundle provides the demo helper together
// with the scene, procedural geometry, and rendering APIs used by this example.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const { scene } = studio;

  // Create the SceneModel with xeokit's default right-handed Z-up coordinate
  // system. The basis [1,0,0, 0,0,1, 0,1,0] maps: X=right, Z=up, Y=forward.
  const sceneModelResult = scene.createModel({
    id: "cityModel",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 0, 1, // Up
        0, 1, 0  // Forward
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });
  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }
  const sceneModel = sceneModelResult.value;

  // A single unit box geometry (half-extents of 1 on all axes) is reused for
  // every building and the ground slab via different scale/position transforms.
  const boxResult = xeokit.model.procgen.buildGeometry.buildBox({ xSize: 1, ySize: 1, zSize: 1 });
  if (!boxResult.ok) {
    throw new Error(boxResult.error);
  }
  const box = boxResult.value;

  sceneModel.createGeometry({
    id: "box",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: box.positions,
    indices: box.indices
  });

  // Seeded PRNG (mulberry32) — reproducible layout every load.
  let seed = 98765;
  function rand() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  let nextId = 0;

  // Place a scaled box in Z-up space. cx/cy are ground-plane (X-Y) centres;
  // h is the full height along Z. The box is raised so its base sits at Z=0.
  function placeBox(cx, cy, w, d, h, color) {
    const meshId = `m${nextId}`;
    const objId  = `o${nextId++}`;
    sceneModel.createMesh({
      id: meshId,
      geometryId: "box",
      matrix: xeokit.model.scene.buildMat4({
        position: [cx, cy, h / 2],
        scale:    [w / 2, d / 2, h / 2]
      }),
      color
    });
    sceneModel.createObject({ id: objId, meshIds: [meshId] });
  }

  // ---------------------------------------------------------------------------
  // City layout
  //
  // Buildings are placed on a regular slot grid. Every slotsPerBlock slots a
  // street gap is inserted. This produces a city of numBlocks × numBlocks
  // super-blocks, each containing slotsPerBlock × slotsPerBlock buildings.
  //
  //   Total buildings = (numBlocks × slotsPerBlock)²
  // ---------------------------------------------------------------------------

  const slotSize      = 3;    // world units per building slot (centre-to-centre)
  const streetWidth   = 5;    // gap between super-blocks
  const slotsPerBlock = 10;   // building slots along each super-block axis
  const numBlocks     = 5;   // super-blocks along each axis

  const blockStride   = slotsPerBlock * slotSize + streetWidth;
  const halfCity      = (numBlocks * blockStride) / 2;
  const cityDiameter  = numBlocks * blockStride;

  // Ground slab — lies on the X-Y plane, thin in Z.
  placeBox(0, 0, cityDiameter + streetWidth * 2,
                 cityDiameter + streetWidth * 2, 0.4, [0.18, 0.18, 0.18]);

  for (let bx = 0; bx < numBlocks; bx++) {
    for (let bz = 0; bz < numBlocks; bz++) {
      for (let sx = 0; sx < slotsPerBlock; sx++) {
        for (let sz = 0; sz < slotsPerBlock; sz++) {

          // Ground-plane (X-Y) centre of this slot.
          const cx = bx * blockStride + sx * slotSize - halfCity + slotSize / 2;
          const cy = bz * blockStride + sz * slotSize - halfCity + slotSize / 2;

          // Normalised distance from city centre drives height and colour.
          const nx = (bx + sx / slotsPerBlock) / numBlocks - 0.5;
          const ny = (bz + sz / slotsPerBlock) / numBlocks - 0.5;
          const distNorm = Math.min(1, Math.hypot(nx, ny) / 0.5);

          const maxH = 22 - distNorm * 18;   // 22 m downtown, 4 m outskirts
          const h    = Math.max(1.5, rand() * maxH);

          const w = 1.2 + rand() * (slotSize - 1.4);
          const d = 1.2 + rand() * (slotSize - 1.4);

          // Colour: tall buildings are cool blue-grey; short ones warm tan.
          const t = h / 22;
          const r = 0.62 - t * 0.22;
          const g = 0.60 - t * 0.12;
          const b = 0.55 + t * 0.20;

          placeBox(cx, cy, w, d, h, [r, g, b]);
        }
      }
    }
  }

  // Position camera to take in the full city extent.
  // In Z-up space the camera eye is offset in X, Y and Z; up is [0, 0, 1].
  studio.viewManager.createView({
    camera: {
      eye:  [halfCity * 1.4, halfCity * 1.4, halfCity * 1.0],
      look: [0, 0, 8],
      up:   [0, 0, 1]
    }
  });

  studio.finished();
});
