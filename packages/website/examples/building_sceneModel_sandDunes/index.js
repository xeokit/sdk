// Import the xeokit SDK bundle. This bundle provides the demo helper together
// with the scene and rendering APIs used by this example.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const { scene } = studio;

  // Create the SceneModel using xeokit's default right-handed Z-up coordinate
  // system: X=right, Z=up, Y=forward. Dune heights grow along the Z axis and
  // the ground plane is X-Y.
  const sceneModelResult = scene.createModel({
    id: "duneModel",
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

  // ---------------------------------------------------------------------------
  // Height field — two components combined:
  //
  //  1. Wave undulation — a sum of large-wavelength asymmetric dune waves that
  //     give the field its broad rolling character and fine surface ripples.
  //
  //  2. Barchan stamps — 30 individual crescent dunes scattered across the
  //     field. Each barchan is a parabolic mound with a Gaussian notch carved
  //     from the leeward face, leaving the characteristic curved slip face and
  //     two downwind horns.
  //
  // Wind direction is +Y. The barchan horns point in +Y; the gentle windward
  // ramp faces −Y.
  // ---------------------------------------------------------------------------

  // --- Wave layers -----------------------------------------------------------

  const layers = [
    // Large background rolls — long wavelength, low frequency
    { angle: 0.00,           wavelength: 90,  amplitude: 1.8, wf: 0.63 },
    { angle: Math.PI * 0.08, wavelength: 120, amplitude: 1.2, wf: 0.62 },
    { angle: Math.PI * 0.22, wavelength: 70,  amplitude: 0.9, wf: 0.65 },
    { angle: Math.PI * 0.47, wavelength: 110, amplitude: 0.7, wf: 0.60 },
    // Surface ripples
    { angle: Math.PI * 0.14, wavelength: 18,  amplitude: 0.25, wf: 0.60 },
    { angle: Math.PI * 0.56, wavelength: 24,  amplitude: 0.20, wf: 0.62 },
    { angle: Math.PI * 0.88, wavelength:  8,  amplitude: 0.08, wf: 0.60 },
  ];

  function duneProfile(t, wf) {
    if (t < wf) {
      return 0.5 * (1 - Math.cos(Math.PI * t / wf));
    } else {
      return 0.5 * (1 + Math.cos(Math.PI * (t - wf) / (1 - wf)));
    }
  }

  function waveHeight(x, y) {
    let h = 0;
    for (const L of layers) {
      const proj = x * Math.cos(L.angle) + y * Math.sin(L.angle);
      const t = ((proj / L.wavelength % 1) + 1) % 1;
      h += L.amplitude * duneProfile(t, L.wf);
    }
    return h;
  }

  // --- Barchan stamps --------------------------------------------------------
  //
  // barchanKernel(lx, ly): height at normalised position within one barchan.
  //   Coordinates are in units of the barchan half-width; wind blows in +ly.
  //
  //   body  — parabolic mound truncated at rb = 1 (the outer footprint)
  //   notch — Gaussian bowl centred on the leeward face (ly ≈ +0.4) that
  //            carves away the slip-face material between the two horns.
  //
  //   Result: broad windward ramp, sharp crest at ly ≈ −0.3, steep concave
  //   leeward face, and two downwind horns at roughly (±0.7, +0.3).

  function barchanKernel(lx, ly) {
    const rb = Math.sqrt(lx * lx + ly * ly);
    if (rb >= 1.0) return 0;
    const body  = 1.0 - rb * rb;
    const rn    = Math.sqrt(lx * lx + (ly - 0.4) * (ly - 0.4)) / 0.72;
    const notch = Math.max(0, 1.0 - rn * rn);
    return Math.max(0, body - notch * 1.3);
  }

  // Seeded PRNG (mulberry32) for reproducible placement.
  let seed = 12345;
  function rand() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // 18 barchans at random positions, sizes, and slight wind-direction tilts.
  // Real barchans have height/width ≈ 0.08–0.12, so keep heights modest.
  const barchans = [];
  for (let i = 0; i < 32; i++) {
    barchans.push({
      cx:     (rand() - 0.5) * 270,
      cy:     (rand() - 0.5) * 270,
      scale:  18 + rand() * 22,      // half-width: 18–40 m
      height:  2 + rand() * 3,       // crest height: 2–5 m  (h/w ≈ 0.07–0.14)
      tilt:   (rand() - 0.5) * 0.35, // ±~10° deviation from prevailing wind
    });
  }

  function barchanHeight(x, y) {
    let h = 0;
    for (const b of barchans) {
      const dx  = x - b.cx;
      const dy  = y - b.cy;
      const cos = Math.cos(b.tilt);
      const sin = Math.sin(b.tilt);
      // Rotate into the barchan's local wind-aligned frame, then normalise.
      const lx  = ( dx * cos + dy * sin) / b.scale;
      const ly  = (-dx * sin + dy * cos) / b.scale;
      h += b.height * barchanKernel(lx, ly);
    }
    return h;
  }

  function height(x, y) {
    return waveHeight(x, y) + barchanHeight(x, y);
  }

  // ---------------------------------------------------------------------------
  // Tiled mesh generation
  //
  // The terrain is divided into a TILES×TILES grid of independent patches.
  // Each patch covers TILE_CELLS×TILE_CELLS quads (TILE_CELLS+1 vertices per
  // axis). Adjacent patches share world-space positions along their borders
  // because height() is deterministic — no visible seams.
  //
  // Each patch becomes its own SceneGeometry, SceneMesh, and SceneObject,
  // making every tile individually selectable and frustum-cullable.
  //
  // Grid layout:
  //   TILE_CELLS = 32  →  33×33 = 1 089 vertices per tile
  //   TILES      =  8  →   8× 8 =    64 tiles total
  //   GRID       = 257  →  256×256 quads across the full field
  //   SIZE       = 200 m
  // ---------------------------------------------------------------------------

  const TILE_CELLS = 32;
  const TILES      = 8;
  const GRID       = TILE_CELLS * TILES + 1;  // 257
  const SIZE       = 400;

  const step = SIZE / (GRID - 1);
  const half = SIZE / 2;
  const eps  = step * 0.3;

  const V        = TILE_CELLS + 1;
  const numVerts = V * V;
  const numTris  = TILE_CELLS * TILE_CELLS * 2;

  // Brick texture — paint the PBR triple once, upload as three
  // tileable textures, then bind into a single material that every
  // tile mesh references. The tile geometries carry no UVs, so the
  // material's triplanarScale drives world-space (triplanar) sampling:
  // the brick pattern repeats once per BRICK_TILE_M world metres.
  const TEX_SIZE      = 256;
  const BRICK_TILE_M  = 6;
  const brickMaps     = xeokit.model.procgen.paintMaterials.paintBrick(TEX_SIZE);

  sceneModel.createTexture({
    id: "brickColorTex",
    imageData: brickMaps.color,
    encoding:  xeokit.base.constants.sRGBEncoding,
    minFilter: xeokit.base.constants.LinearFilter,
    wrapS:     xeokit.base.constants.RepeatWrapping,
    wrapT:     xeokit.base.constants.RepeatWrapping,
    flipY:     false,
    mipmap:    true
  });
  sceneModel.createTexture({
    id: "brickNormalTex",
    imageData: brickMaps.normal,
    encoding:  xeokit.base.constants.LinearEncoding,
    minFilter: xeokit.base.constants.LinearFilter,
    wrapS:     xeokit.base.constants.RepeatWrapping,
    wrapT:     xeokit.base.constants.RepeatWrapping,
    flipY:     false,
    mipmap:    true
  });
  sceneModel.createTexture({
    id: "brickMRTex",
    imageData: brickMaps.mr,
    encoding:  xeokit.base.constants.LinearEncoding,
    minFilter: xeokit.base.constants.LinearFilter,
    wrapS:     xeokit.base.constants.RepeatWrapping,
    wrapT:     xeokit.base.constants.RepeatWrapping,
    flipY:     false,
    mipmap:    true
  });
  sceneModel.createMaterial({
    id: "brickMat",
    colorTextureId:             "brickColorTex",
    normalsTextureId:           "brickNormalTex",
    metallicRoughnessTextureId: "brickMRTex",
    // Diffuse-dominant materials render dimmer than the painted texel
    // values because Lambert divides by π. The aecChart demo applies a
    // ~1.6× tint multiplier to compensate; use the same here so the
    // bricks read at their intended brightness.
    color: [1.6, 1.6, 1.6],
    // World-space repeat distance. With no per-vertex UVs on the tile
    // geometries, this engages the renderer's triplanar sampling, which
    // uses textureGrad with the un-wrapped gradient — so the tiled texture
    // doesn't seam at every repeat the way the UV (fract) path does.
    triplanarScale: BRICK_TILE_M
  });

  for (let ty = 0; ty < TILES; ty++) {
    for (let tx = 0; tx < TILES; tx++) {

      const positions = new Float32Array(numVerts * 3);
      const normals   = new Float32Array(numVerts * 3);
      const indices   = new Uint32Array(numTris * 3);

      for (let row = 0; row < V; row++) {
        for (let col = 0; col < V; col++) {
          const x = (tx * TILE_CELLS + col) * step - half;
          const y = (ty * TILE_CELLS + row) * step - half;
          const z = height(x, y);

          const vi = (row * V + col) * 3;
          positions[vi    ] = x;
          positions[vi + 1] = y;
          positions[vi + 2] = z;

          // Gradient via central differences → surface normal in Z-up space.
          const dzdx = (height(x + eps, y) - height(x - eps, y)) / (2 * eps);
          const dzdy = (height(x, y + eps) - height(x, y - eps)) / (2 * eps);
          const len  = Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1);
          normals[vi    ] = -dzdx / len;
          normals[vi + 1] = -dzdy / len;
          normals[vi + 2] =  1    / len;
        }
      }

      // Triangulate each quad as two CCW triangles (when viewed from +Z).
      //
      //   a — b
      //   |  / |
      //   c — d
      //
      //   Triangle 1: a, b, c  (upper-left)
      //   Triangle 2: b, d, c  (lower-right)
      //
      let ii = 0;
      for (let row = 0; row < TILE_CELLS; row++) {
        for (let col = 0; col < TILE_CELLS; col++) {
          const a = row * V + col;
          const b = a + 1;
          const c = a + V;
          const d = c + 1;
          indices[ii++] = a; indices[ii++] = b; indices[ii++] = c;
          indices[ii++] = b; indices[ii++] = d; indices[ii++] = c;
        }
      }

      const id = `tile_${ty}_${tx}`;

      // No UVs: the brick material's triplanarScale makes the renderer sample
      // the textures by world-space position (triplanar) instead of vertex UVs.
      // Adjacent tiles sample continuously in world space, and the triplanar
      // path uses textureGrad so the tiled pattern doesn't seam at every repeat.
      sceneModel.createGeometry({
        id: `${id}_geom`,
        primitive: xeokit.base.constants.TrianglesPrimitive,
        positions,
        normals,
        indices
      });

      sceneModel.createMesh({
        id: `${id}_mesh`,
        geometryId: `${id}_geom`,
        materialId: "brickMat"
      });

      sceneModel.createObject({
        id: `${id}_obj`,
        meshIds: [`${id}_mesh`]
      });
    }
  }

  // Camera: elevated and south of centre, looking across the dune field so
  // the barchan crescent shapes and steep slip faces are visible.
  const view = studio.viewManager.createView({
    camera: {
      eye:  [0, -180, 80],
      look: [0, 10, 4],
      up:   [0, 0, 1]
    }
  });

  view.effects.edges.enabled = false;

  studio.openInfoPanelFromMeta();
  studio.finished();
});
