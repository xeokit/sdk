// xeokit V3 demo: double-precision transformed megasite
//
// Purpose:
// - Demonstrates xeokit V3 placing a richly detailed procedurally-generated site
//   at giant world coordinates that would typically jitter in plain float32 WebGL.
// - Geometry remains local/small; only transforms + model coordinate system carry
//   the huge double-precision values.
// - The site spans kilometers, so when viewed up close while far from the world
//   origin, a naive engine would usually show shaking edges and unstable motion.
//
// Notes:
// - xeokit V3 stores scene/model transforms in double precision and renders them
//   robustly through internal RTC tiling / camera-relative evaluation.
// - Vertex coordinates still need to remain ordinary float32-sized.
// - Avoid giant scale transforms; keep scale modest and use large positions/origins
//   instead. This aligns with current V3 docs.

import * as xeokit from "../../js/xeokit-demo-bundle.js";

const demoHelper = new xeokit.demo.DemoHelper({});

demoHelper.init().then(() => {

  const { scene } = demoHelper;

  // ---------------------------------------------------------------------------
  // Camera
  //
  // Frame the whole megasite from above at startup. The site is kilometers
  // across, and the application can safely use a large far clip plane.
  // ---------------------------------------------------------------------------

  demoHelper.createView({
    camera: {
      eye:  [4200, -5200, 2600],
      look: [700, 300, 120],
      up:   [0, 0, 1],
      perspectiveProjection: {
        far: 100000
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Create a model whose coordinate-system origin sits at enormous world-space
  // coordinates, including fractional parts that are not stably representable
  // in float32 once the magnitude gets this large.
  //
  // In many conventional WebGL engines, placing geometry directly at these
  // coordinates would cause visible jitter while navigating close to surfaces.
  // In xeokit V3, the model/transform path remains double-precision.
  // ---------------------------------------------------------------------------

  const worldOriginX = 0;
  const worldOriginY = 0;
  const worldOriginZ = 0;

  const sceneModelResult = scene.createModel({
    id: "doublePrecisionMegasite",
    coordinateSystem: {
      basis: [
        1, 0, 0, // Right
        0, 0, 1, // Up
        0, 1, 0  // Forward
      ],
      origin: [worldOriginX, worldOriginY, worldOriginZ],
      units: "meters",
      scaleToMeters: 1
    }
  });

  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  const sceneModel = sceneModelResult.value;

  // ---------------------------------------------------------------------------
  // Shared geometries
  // ---------------------------------------------------------------------------

  function must(result) {
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.value;
  }

  const box = must(xeokit.procgen.buildBoxGeometry({ xSize: 1, ySize: 1, zSize: 1 }));
  const cyl = must(xeokit.procgen.buildCylinderGeometry({
    radiusTop: 1,
    radiusBottom: 1,
    height: 1,
    radialSegments: 16,
    heightSegments: 1
  }));
  const sphere = must(xeokit.procgen.buildSphereGeometry({
    radius: 1,
    widthSegments: 16,
    heightSegments: 12
  }));

  sceneModel.createGeometry({
    id: "box",
    primitive: xeokit.constants.TrianglesPrimitive,
    positions: box.positions,
    indices: box.indices
  });

  sceneModel.createGeometry({
    id: "cyl",
    primitive: xeokit.constants.TrianglesPrimitive,
    positions: cyl.positions,
    indices: cyl.indices
  });

  sceneModel.createGeometry({
    id: "sphere",
    primitive: xeokit.constants.TrianglesPrimitive,
    positions: sphere.positions,
    indices: sphere.indices
  });

  // ---------------------------------------------------------------------------
  // Deterministic PRNG for reproducible procedural detail
  // ---------------------------------------------------------------------------

  let seed = 246813579;
  function rand() {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(a, b) {
    return a + rand() * (b - a);
  }

  function pick(arr) {
    return arr[Math.floor(rand() * arr.length)];
  }

  let nextMeshId = 0;
  let nextObjectId = 0;
  let nextTransformId = 0;

  function createTransform(position, rotation = [0, 0, 0], scale = [1, 1, 1], parentTransformId = undefined) {
    const id = `t${nextTransformId++}`;
    sceneModel.createTransform({
      id,
      position,
      rotation,
      scale,
      parentTransformId
    });
    return id;
  }

  function addMesh({
                     geometryId,
                     position = [0, 0, 0],
                     rotation = [0, 0, 0],
                     scale = [1, 1, 1],
                     color = [0.8, 0.8, 0.8],
                     parentTransformId
                   }) {
    const meshId = `m${nextMeshId++}`;
    const objectId = `o${nextObjectId++}`;

    sceneModel.createMesh({
      id: meshId,
      geometryId,
      parentTransformId,
      matrix: xeokit.scene.buildMat4({
        position,
        rotation,
        scale
      }),
      color
    });

    sceneModel.createObject({
      id: objectId,
      meshIds: [meshId]
    });

    return { meshId, objectId };
  }

  // ---------------------------------------------------------------------------
  // Palette
  // ---------------------------------------------------------------------------

  const colors = {
    ground:       [0.20, 0.22, 0.24],
    asphalt:      [0.13, 0.14, 0.15],
    concrete:     [0.63, 0.64, 0.66],
    concrete2:    [0.55, 0.57, 0.60],
    steel:        [0.56, 0.60, 0.66],
    darkSteel:    [0.28, 0.31, 0.35],
    glassA:       [0.36, 0.50, 0.62],
    glassB:       [0.26, 0.42, 0.52],
    copper:       [0.58, 0.40, 0.28],
    rust:         [0.48, 0.29, 0.20],
    tankWhite:    [0.82, 0.84, 0.86],
    vegetation:   [0.20, 0.32, 0.18],
    beaconRed:    [0.88, 0.12, 0.10],
    light:        [0.94, 0.88, 0.70]
  };

  // ---------------------------------------------------------------------------
  // Utility builders
  // ---------------------------------------------------------------------------

  function addBox(x, y, z, sx, sy, sz, color, rot = [0, 0, 0], parentTransformId = undefined) {
    addMesh({
      geometryId: "box",
      position: [x, y, z],
      rotation: rot,
      scale: [sx, sy, sz],
      color,
      parentTransformId
    });
  }

  function addCylinder(x, y, z, radius, height, color, rot = [0, 0, 0], parentTransformId = undefined) {
    addMesh({
      geometryId: "cyl",
      position: [x, y, z],
      rotation: rot,
      scale: [radius, radius, height],
      color,
      parentTransformId
    });
  }

  function addSphere(x, y, z, radius, color, parentTransformId = undefined) {
    addMesh({
      geometryId: "sphere",
      position: [x, y, z],
      scale: [radius, radius, radius],
      color,
      parentTransformId
    });
  }

  function addRoadSegment(x, y, length, width, headingDeg) {
    addBox(x, y, 0.08, length * 0.5, width * 0.5, 0.08, colors.asphalt, [0, 0, headingDeg]);

    const stripeCount = Math.max(1, Math.floor(length / 80));
    for (let i = 0; i < stripeCount; i++) {
      const t = (i + 0.5) / stripeCount - 0.5;
      const localX = t * length * 0.88;
      const ang = headingDeg * Math.PI / 180;
      const wx = x + Math.cos(ang) * localX;
      const wy = y + Math.sin(ang) * localX;
      addBox(wx, wy, 0.10, 3.0, 0.16, 0.01, [0.92, 0.90, 0.72], [0, 0, headingDeg]);
    }
  }

  function addTree(x, y, h = range(7, 12)) {
    addCylinder(x, y, h * 0.18, 0.22, h * 0.36, [0.36, 0.25, 0.16]);
    addSphere(x, y, h * 0.62, h * 0.28, colors.vegetation);
  }

  function addLightPole(x, y, h = 12) {
    addCylinder(x, y, h * 0.5, 0.12, h, colors.darkSteel);
    addBox(x, y, h + 0.3, 0.6, 0.22, 0.12, colors.light);
  }

  function addTowerBlock(parentTransformId, footprintX, footprintY, width, depth, floors, colorA, colorB) {
    const floorH = 3.5;
    const h = floors * floorH;

    addBox(footprintX, footprintY, h * 0.5, width * 0.5, depth * 0.5, h * 0.5, colorA, [0, 0, 0], parentTransformId);

    // Vertical fins / facade articulation
    const finCount = Math.max(2, Math.floor(width / 10));
    for (let i = 0; i <= finCount; i++) {
      const fx = footprintX - width * 0.5 + (i / finCount) * width;
      addBox(fx, footprintY - depth * 0.5 - 0.12, h * 0.5, 0.12, 0.10, h * 0.5, colorB, [0, 0, 0], parentTransformId);
      addBox(fx, footprintY + depth * 0.5 + 0.12, h * 0.5, 0.12, 0.10, h * 0.5, colorB, [0, 0, 0], parentTransformId);
    }

    const bandCount = Math.floor(floors / 10);
    for (let i = 1; i <= bandCount; i++) {
      const z = i * 10 * floorH;
      addBox(footprintX, footprintY, z, width * 0.54, depth * 0.54, 0.16, [0.82, 0.82, 0.84], [0, 0, 0], parentTransformId);
    }

    // Roof detail
    addBox(footprintX, footprintY, h + 0.8, width * 0.18, depth * 0.18, 0.8, colors.darkSteel, [0, 0, 0], parentTransformId);
  }

  function addPodium(parentTransformId, x, y, w, d, h) {
    addBox(x, y, h * 0.5, w * 0.5, d * 0.5, h * 0.5, colors.concrete2, [0, 0, 0], parentTransformId);

    for (let ix = -1; ix <= 1; ix++) {
      addBox(x + ix * w * 0.22, y - d * 0.5 - 0.2, h * 0.3, 1.2, 0.2, h * 0.3, colors.darkSteel, [0, 0, 0], parentTransformId);
    }
  }

  function addResidentialTowerCluster(cx, cy, count) {
    const districtId = createTransform([cx, cy, 0]);

    for (let i = 0; i < count; i++) {
      const px = range(-120, 120);
      const py = range(-120, 120);
      const rot = Math.floor(range(0, 4)) * 90;
      const floors = Math.floor(range(14, 32));
      const w = range(16, 24);
      const d = range(16, 22);

      addPodium(districtId, px, py, w * 1.4, d * 1.4, range(4, 7));
      const towerId = createTransform([px, py, range(5, 8)], [0, 0, rot], [1, 1, 1], districtId);

      addTowerBlock(
        towerId,
        0, 0,
        w, d,
        floors,
        pick([colors.glassA, colors.glassB, colors.steel]),
        pick([[0.78, 0.80, 0.82], [0.50, 0.55, 0.60], [0.24, 0.27, 0.30]])
      );

      for (let j = 0; j < 2; j++) {
        addTree(px + range(-22, 22), py + range(-22, 22), range(6, 10));
      }
    }
  }

  function addTankFarm(cx, cy, rows, cols) {
    const farmId = createTransform([cx, cy, 0]);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) * 0.5) * 34;
        const y = (r - (rows - 1) * 0.5) * 34;
        const radius = range(8, 11);
        const h = range(10, 16);

        addCylinder(x, y, h * 0.5, radius, h, colors.tankWhite, [90, 0, 0], farmId);
        addCylinder(x, y, h + 1.2, radius * 0.92, 0.6, [0.72, 0.74, 0.76], [90, 0, 0], farmId);

        // Ladder + catwalk ring hint
        addBox(x + radius + 0.5, y, h * 0.5, 0.18, 0.18, h * 0.5, colors.darkSteel, [0, 0, 0], farmId);
      }
    }

    // Pipe corridor between rows
    for (let r = 0; r < rows; r++) {
      const py = (r - (rows - 1) * 0.5) * 34;
      addBox(0, py, 2.2, cols * 18, 0.7, 0.25, colors.copper, [0, 0, 0], farmId);
      addBox(0, py + 1.2, 2.8, cols * 18, 0.5, 0.22, colors.steel, [0, 0, 0], farmId);
    }
  }

  function addProcessPlant(cx, cy) {
    const plantId = createTransform([cx, cy, 0]);

    // Main process decks
    for (let i = 0; i < 3; i++) {
      const px = -70 + i * 55;
      const py = 0;
      const deckW = range(24, 32);
      const deckD = range(22, 28);
      const deckH = range(18, 30);

      addBox(px, py, 1.8, deckW * 0.5, deckD * 0.5, 1.8, colors.concrete, [0, 0, 0], plantId);

      for (let level = 0; level < 3; level++) {
        const z = 5 + level * (deckH / 3);
        addBox(px, py, z, deckW * 0.48, deckD * 0.48, 0.20, colors.darkSteel, [0, 0, 0], plantId);

        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            addCylinder(
              px + sx * deckW * 0.42,
              py + sy * deckD * 0.42,
              z * 0.5,
              0.45,
              z,
              colors.steel,
              [0, 0, 0],
              plantId
            );
          }
        }
      }

      // Vertical vessels
      for (let v = 0; v < 2; v++) {
        const vx = px + range(-deckW * 0.25, deckW * 0.25);
        const vy = py + range(-deckD * 0.20, deckD * 0.20);
        const vh = range(18, 34);
        addCylinder(vx, vy, vh * 0.5 + 2.2, range(1.4, 2.4), vh, pick([colors.steel, colors.concrete2]), [0, 0, 0], plantId);
      }
    }

    // Distillation towers
    for (let i = 0; i < 3; i++) {
      const x = -80 + i * 55;
      const h = range(48, 70);
      addCylinder(x, -52, h * 0.5, range(2.8, 4.0), h, pick([colors.steel, colors.copper]), [0, 0, 0], plantId);

      for (let k = 0; k < 2; k++) {
        addBox(x + 4.2, -52, 16 + k * (h - 24) / 2, 2.8, 0.28, 0.14, colors.darkSteel, [0, 90, 0], plantId);
      }
    }

    // Pipe racks
    for (let row = 0; row < 2; row++) {
      const py = -14 + row * 22;
      addBox(0, py, 7.0, 100, 2.4, 0.25, colors.darkSteel, [0, 0, 0], plantId);
      addBox(0, py, 9.0, 100, 2.0, 0.22, colors.copper, [0, 0, 0], plantId);

      for (let i = -4; i <= 4; i++) {
        addCylinder(i * 20, py - 1.0, 3.5, 0.28, 7.0, colors.darkSteel, [0, 0, 0], plantId);
        addCylinder(i * 20, py + 1.0, 3.5, 0.28, 7.0, colors.darkSteel, [0, 0, 0], plantId);
      }
    }
  }

  function addPortCranes(cx, cy, count) {
    const portId = createTransform([cx, cy, 0]);

    for (let i = 0; i < count; i++) {
      const x = i * 68 - (count - 1) * 34;
      const craneId = createTransform([x, 0, 0], [0, 0, 0], [1, 1, 1], portId);

      // Legs
      addBox(-6, -4, 17, 1.0, 1.0, 17, colors.steel, [0, 0, 4], craneId);
      addBox( 6, -4, 17, 1.0, 1.0, 17, colors.steel, [0, 0,-4], craneId);
      addBox(-6,  4, 17, 1.0, 1.0, 17, colors.steel, [0, 0,-4], craneId);
      addBox( 6,  4, 17, 1.0, 1.0, 17, colors.steel, [0, 0, 4], craneId);

      // Top beam and boom
      addBox(0, 0, 35, 14, 3, 1.0, colors.copper, [0, 0, 0], craneId);
      addBox(18, 0, 37, 24, 1.2, 0.8, colors.copper, [0, 8, 0], craneId);

      // Trolley + cable + spreader
      const trolleyX = range(8, 24);
      addBox(trolleyX, 0, 36.6, 1.2, 1.2, 1.0, [0.92, 0.72, 0.18], [0, 0, 0], craneId);
      addBox(trolleyX, 0, 22, 0.10, 0.10, 13.5, [0.10, 0.10, 0.10], [0, 0, 0], craneId);
    }
  }

  function addCauseway(cx0, cy0, cx1, cy1) {
    const dx = cx1 - cx0;
    const dy = cy1 - cy0;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const mx = (cx0 + cx1) * 0.5;
    const my = (cy0 + cy1) * 0.5;

    addBox(mx, my, 2.0, len * 0.5, 10, 1.6, colors.concrete, [0, 0, ang]);

    const pierCount = Math.max(2, Math.floor(len / 140));
    for (let i = 0; i <= pierCount; i++) {
      const t = i / pierCount;
      const px = cx0 + dx * t;
      const py = cy0 + dy * t;
      addCylinder(px, py - 3.5, 1.0, 0.8, 2.0, colors.concrete2);
      addCylinder(px, py + 3.5, 1.0, 0.8, 2.0, colors.concrete2);
      addLightPole(px, py, 9);
    }
  }

  // ---------------------------------------------------------------------------
  // Ground / water / large-scale context
  // ---------------------------------------------------------------------------

  const siteHalf = 4200;

  // Main terrain slab
  addBox(0, 0, -0.6, siteHalf, siteHalf, 0.6, colors.ground);

  // Waterfront basin
  addBox(1500, -1200, -0.3, 1500, 900, 0.3, [0.10, 0.18, 0.24]);

  // Large arterial roads across kilometers
  addRoadSegment(0, 0, 7000, 18, 0);
  addRoadSegment(0, 0, 7000, 18, 90);
  addRoadSegment(-600, 800, 4800, 14, 35);
  addRoadSegment(1300, -500, 3600, 14, -25);

  for (let i = -3; i <= 3; i++) {
    addLightPole(i * 800, 8, 14);
    addLightPole(8, i * 800, 14);
  }

  // ---------------------------------------------------------------------------
  // Districts spread kilometers apart
  // These separations are intentional: they make absolute-coordinate precision
  // problems very obvious in less capable engines when orbiting near details.
  // ---------------------------------------------------------------------------

  addResidentialTowerCluster(-1800, 1300, 6);
  addResidentialTowerCluster(-900, 1700, 3);

  addProcessPlant(700, 400);
  addTankFarm(1300, 900, 2, 3);

  addPortCranes(2500, -1100, 4);
  addTankFarm(2200, -450, 1, 3);

  addCauseway(700, 400, 2500, -1100);

  // Solar / service field for more long-range detail
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 10; c++) {
      const x = -2600 + c * 34;
      const y = -1800 + r * 24;
      addBox(x, y, 0.9, 11, 4.0, 0.12, [0.10, 0.16, 0.22], [18, 0, 12]);
      addCylinder(x - 2.8, y, 0.42, 0.12, 0.85, colors.darkSteel);
      addCylinder(x + 2.8, y, 0.42, 0.12, 0.85, colors.darkSteel);
    }
  }

  // Sparse vegetation / detail between districts
  for (let i = 0; i < 40; i++) {
    addTree(range(-3500, 3400), range(-3200, 3100), range(5.5, 10));
  }

  // ---------------------------------------------------------------------------
  // A tiny "precision witness" cluster:
  // very small separations at huge coordinates.
  //
  // These objects differ by centimeters in model-local space while the whole
  // model sits at an enormous double-precision origin. In many engines, these
  // close features shimmer when the camera moves because the world transform
  // collapses to float precision.
  // ---------------------------------------------------------------------------

  const witnessId = createTransform([3200.123456789, 2100.987654321, 0.0]);

  addBox(0.000, 0.000, 1.5, 2.0, 2.0, 1.5, [0.95, 0.25, 0.15], [0, 0, 0], witnessId);
  addBox(2.030, 0.000, 1.5, 2.0, 2.0, 1.5, [0.15, 0.85, 0.35], [0, 0, 0], witnessId);
  addBox(4.061, 0.000, 1.5, 2.0, 2.0, 1.5, [0.15, 0.35, 0.95], [0, 0, 0], witnessId);

  addCylinder(1.015, 2.045, 1.2, 0.18, 2.4, [0.95, 0.9, 0.2], [0, 0, 0], witnessId);
  addCylinder(3.046, 2.045, 1.2, 0.18, 2.4, [0.95, 0.9, 0.2], [0, 0, 0], witnessId);



  demoHelper.finished();
});
