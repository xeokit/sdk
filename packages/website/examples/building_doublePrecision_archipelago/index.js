// Import the xeokit SDK bundle.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// =============================================================================
// Double-precision archipelago
//
// All seven islands sit at a genuine UTM Zone 32N origin
// (~267 km easting, ~6 550 km northing, off the Norwegian coast).
// Geometry vertices stay within ±6 000 m (float32-safe); only the
// SceneModel origin carries the large double-precision coordinate.
// The renderer's RTC tiling keeps every cliff face jitter-free.
//
// Terrain features
//   • Domain-warped layered noise for natural ridges and valleys
//   • Per-island Gaussian summit bumps for distinct peaks
//   • Ridged noise layers for sharp rocky spines
//   • Angular Fourier harmonics on the boundary → rugged coastlines
//     with headlands, inlets, and sea stacks
//
// Geometry reuse
//   • Three rock shapes are each created once and instanced via mesh
//     matrices across every island
//   • Each rock and each island terrain is its own SceneObject
// =============================================================================

const UTM_EAST  = 267_000.0;
const UTM_NORTH = 6_550_000.0;

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const { scene } = studio;

  const sceneModelResult = scene.createModel({
    id: "archipelago",
    coordinateSystem: {
      basis: [1, 0, 0,   0, 1, 0,   0, 0, 1],  // Z-up, X=east, Y=north
      origin: [UTM_EAST, UTM_NORTH, 0.0],
      units: "meters",
      scaleToMeters: 1
    }
  });
  if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
  const model = sceneModelResult.value;

  // ---------------------------------------------------------------------------
  // PRNG — mulberry32, seeded per use-site for reproducibility
  // ---------------------------------------------------------------------------
  let _seed = 0;
  function seedRand(s) { _seed = (s | 0); }
  function rand() {
    _seed = (_seed + 0x6D2B79F5) | 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------------------------------------------------------------------------
  // Terrain data — generated once per island, used purely inside islandHeight()
  //
  //  layers   — macro topography and surface detail waves
  //  warp     — two domain-warp fields that displace (x,y) before sampling
  //             the layers, bending ridges into natural curves
  //  peaks    — Gaussian summit bumps (2–4 per island) for distinct high points
  //  ridge    — flag: true → use 1−|sin| (sharp ridged spine) instead of sin
  // ---------------------------------------------------------------------------
  function generateTerrain(seed) {
    seedRand(seed);

    const layers = [
      // Large-scale topography: broad valleys and massifs
      { kx: 0.0035+rand()*0.0020, ky: 0.0030+rand()*0.0020, amp: 1.00, phase: rand()*6.28, ridge: false },
      { kx: 0.0075+rand()*0.0030, ky: 0.0070+rand()*0.0030, amp: 0.60, phase: rand()*6.28, ridge: rand()>0.5 },
      { kx: 0.0160+rand()*0.0060, ky: 0.0150+rand()*0.0060, amp: 0.32, phase: rand()*6.28, ridge: rand()>0.4 },
      // Mid-frequency: spurs and gullies
      { kx: 0.0340+rand()*0.0120, ky: 0.0320+rand()*0.0120, amp: 0.16, phase: rand()*6.28, ridge: rand()>0.6 },
      { kx: 0.0700+rand()*0.0250, ky: 0.0660+rand()*0.0250, amp: 0.08, phase: rand()*6.28, ridge: false },
      // Fine surface detail: scree and rocky texture
      { kx: 0.1400+rand()*0.0500, ky: 0.1300+rand()*0.0500, amp: 0.040, phase: rand()*6.28, ridge: false },
      { kx: 0.2800+rand()*0.1000, ky: 0.2600+rand()*0.1000, amp: 0.018, phase: rand()*6.28, ridge: false },
    ];

    // Domain warp: two low-frequency displacements that bend the sampling grid
    const warp = [
      {
        kx: 0.0022+rand()*0.0010, ky: 0.0020+rand()*0.0010,
        ax: 60+rand()*40, ay: 55+rand()*35,
        px: rand()*6.28,  py: rand()*6.28
      },
      {
        kx: 0.0055+rand()*0.0020, ky: 0.0050+rand()*0.0020,
        ax: 28+rand()*18, ay: 25+rand()*16,
        px: rand()*6.28,  py: rand()*6.28
      },
    ];

    // Gaussian summit bumps
    const numPeaks = 2 + Math.floor(rand() * 3);
    const peaks = [];
    for (let i = 0; i < numPeaks; i++) {
      peaks.push({
        fx:    (rand() - 0.5) * 0.65,   // fractional offset from centre
        fy:    (rand() - 0.5) * 0.65,
        sigma: 0.09 + rand() * 0.11,    // width as fraction of island radius
        amp:   0.14 + rand() * 0.16     // height boost as fraction of maxH
      });
    }

    return { layers, warp, peaks };
  }

  // ---------------------------------------------------------------------------
  // Coastline edge function — pre-generated per island
  //
  // Returns edgeFn(angle) → effective island radius at that bearing.
  // Constructed from superimposed angular harmonics:
  //   • Low frequencies (n=2–5): major lobes, fjords, peninsulas
  //   • Mid frequencies (n=6–11): bays and headlands
  //   • High frequencies (n=12–20): sea stacks, cliff serrations
  // ---------------------------------------------------------------------------
  function generateEdgeFn(baseRad, seed) {
    seedRand(seed * 17 + 3);
    const harmonics = [];

    for (let n = 2; n <= 5; n++) {
      const amp = (0.22 - (n - 2) * 0.04) * (0.6 + rand() * 0.8);
      harmonics.push({ freq: n, amp, phase: rand() * 6.28 });
    }
    for (let n = 6; n <= 11; n++) {
      harmonics.push({ freq: n, amp: 0.05 + rand() * 0.05, phase: rand() * 6.28 });
    }
    for (let n = 12; n <= 20; n++) {
      harmonics.push({ freq: n, amp: 0.016 + rand() * 0.016, phase: rand() * 6.28 });
    }

    return function edgeFn(angle) {
      let v = 0;
      for (const h of harmonics) {
        v += h.amp * Math.cos(h.freq * angle + h.phase);
      }
      return baseRad * Math.max(0.22, 0.80 + v);
    };
  }

  // ---------------------------------------------------------------------------
  // islandHeight — pure height function (no PRNG calls)
  //
  //  1. Compute distance and bearing from island centre
  //  2. Reject if beyond the jagged coastline (edgeFn)
  //  3. Domain-warp (x,y) to bend the wave grid
  //  4. Evaluate layered noise (regular + ridged layers)
  //  5. Add Gaussian summit bumps
  //  6. Apply smooth coastal envelope and power bias
  // ---------------------------------------------------------------------------
  function islandHeight(x, y, cx, cy, baseRad, terrain, edgeFn) {
    const dx   = x - cx,  dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const edge = edgeFn(Math.atan2(dy, dx));
    if (dist >= edge) return 0;

    // Smooth-step envelope: steep coastline cliffs, gentle inland gradient
    const t   = 1 - dist / edge;
    const env = t * t * (3 - 2 * t);           // smoothstep
    const maxH = baseRad * 0.26;

    // Domain warp: displace sampling point along two low-frequency fields
    let wx = 0, wy = 0;
    for (const W of terrain.warp) {
      wx += W.ax * Math.sin(W.kx * x + W.ky * y + W.px);
      wy += W.ay * Math.cos(W.kx * x + W.ky * y + W.py);
    }
    const xw = x + wx,  yw = y + wy;

    // Layered noise — ridged layers use (1 − |sin|) for sharp rocky spines
    let h = 0;
    for (const L of terrain.layers) {
      const raw = Math.sin(L.kx * xw + L.ky * yw + L.phase);
      h += L.amp * (L.ridge ? 1 - Math.abs(raw) : 0.5 + 0.5 * raw);
    }

    // Gaussian summit bumps — add local high points
    for (const P of terrain.peaks) {
      const pdx = dx / baseRad - P.fx;
      const pdy = dy / baseRad - P.fy;
      h += P.amp * Math.exp(-(pdx * pdx + pdy * pdy) / (P.sigma * P.sigma));
    }

    // Power bias (lifts peaks, flattens bases) × coastal envelope²
    h = Math.pow(Math.max(0, h) / 2.2, 1.55) * maxH * env * env;
    return h;
  }

  // ---------------------------------------------------------------------------
  // Rock geometry — three shapes, each created once and instanced via matrices
  //
  // Aspect ratios tuned so they read as boulders (wider than tall) at all sizes.
  // ---------------------------------------------------------------------------
  function buildRockGeom(id, xSize, zSize, ySize) {
    const r = xeokit.model.procgen.buildGeometry.buildBox({ xSize, ySize, zSize });
    if (!r.ok) return;
    model.createGeometry({
      id,
      primitive: xeokit.base.constants.TrianglesPrimitive,
      positions: r.value.positions,
      normals:   r.value.normals,
      indices:   r.value.indices
    });
  }

  buildRockGeom("rock_lg", 7.2, 3.8, 6.0);   // wide flat-topped boulder
  buildRockGeom("rock_md", 3.4, 2.0, 3.0);   // mid-size angular block
  buildRockGeom("rock_sm", 1.6, 1.2, 1.5);   // small scree fragment

  const ROCK_GEOMS = ["rock_lg", "rock_md", "rock_sm"];

  // ---------------------------------------------------------------------------
  // Ocean — one large flat quad just below sea level
  // ---------------------------------------------------------------------------
  const SEA = 9200;
  const seaPos  = new Float32Array([-SEA,-SEA,-0.5,  SEA,-SEA,-0.5,  SEA,SEA,-0.5,  -SEA,SEA,-0.5]);
  const seaNorm = new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1]);
  const seaIdx  = new Uint32Array([0,1,2, 0,2,3]);
  model.createGeometry({ id:"ocean_geom", primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: seaPos, normals: seaNorm, indices: seaIdx });
  model.createMesh({ id:"ocean_mesh", geometryId:"ocean_geom",
    color: [0.06, 0.16, 0.28], opacity: 0.94 });
  model.createObject({ id:"ocean", meshIds:["ocean_mesh"] });

  // ---------------------------------------------------------------------------
  // Islands — layout in model-local space (metres from UTM origin)
  //
  // All cx/cy plus the maximum rock offset stay within ±6 200 m,
  // well within float32 precision.  The double-precision origin carries
  // the full 267 000 / 6 550 000 m world coordinates transparently.
  // ---------------------------------------------------------------------------
  const ISLANDS = [
    { id:"A", cx:     0, cy:     0, rad: 680, seed: 11 },
    { id:"B", cx:  3200, cy:  1600, rad: 450, seed: 22 },
    { id:"C", cx: -2800, cy:  2700, rad: 530, seed: 33 },
    { id:"D", cx:  1200, cy: -3400, rad: 400, seed: 44 },
    { id:"E", cx: -4000, cy: -1700, rad: 350, seed: 55 },
    { id:"F", cx:  5200, cy: -2800, rad: 290, seed: 66 },
    { id:"G", cx: -5100, cy:  1100, rad: 320, seed: 77 },
  ];

  // Terrain grid: 56 quads per side → 57×57 = 3 249 vertices per island
  const N = 56;
  const V = N + 1;

  let nextId = 0;

  for (const isl of ISLANDS) {
    const terrain = generateTerrain(isl.seed);
    const edgeFn  = generateEdgeFn(isl.rad, isl.seed);
    const step    = (2 * isl.rad) / N;
    const eps     = step * 0.30;

    const positions = new Float32Array(V * V * 3);
    const normals   = new Float32Array(V * V * 3);
    const indices   = new Uint32Array(N * N * 6);

    for (let row = 0; row < V; row++) {
      for (let col = 0; col < V; col++) {
        const x = isl.cx - isl.rad + col * step;
        const y = isl.cy - isl.rad + row * step;
        const z = islandHeight(x, y, isl.cx, isl.cy, isl.rad, terrain, edgeFn);

        const vi = (row * V + col) * 3;
        positions[vi    ] = x;
        positions[vi + 1] = y;
        positions[vi + 2] = z;

        // Surface normal via central differences (pure calls — no PRNG)
        const dzdx = (islandHeight(x+eps, y, isl.cx, isl.cy, isl.rad, terrain, edgeFn)
                    - islandHeight(x-eps, y, isl.cx, isl.cy, isl.rad, terrain, edgeFn)) / (2*eps);
        const dzdy = (islandHeight(x, y+eps, isl.cx, isl.cy, isl.rad, terrain, edgeFn)
                    - islandHeight(x, y-eps, isl.cx, isl.cy, isl.rad, terrain, edgeFn)) / (2*eps);
        const len  = Math.sqrt(dzdx*dzdx + dzdy*dzdy + 1);
        normals[vi    ] = -dzdx / len;
        normals[vi + 1] = -dzdy / len;
        normals[vi + 2] =  1    / len;
      }
    }

    let ii = 0;
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const a = row*V+col, b=a+1, c=a+V, d=c+1;
        indices[ii++]=a; indices[ii++]=b; indices[ii++]=c;
        indices[ii++]=b; indices[ii++]=d; indices[ii++]=c;
      }
    }

    seedRand(isl.seed * 3 + 1);
    const g  = 0.42 + rand() * 0.10;
    const terrainColor = [g + rand()*0.06, g + rand()*0.04, g + rand()*0.02];

    model.createGeometry({
      id: `isl_${isl.id}_geom`,
      primitive: xeokit.base.constants.TrianglesPrimitive,
      positions, normals, indices
    });
    model.createMesh({ id: `isl_${isl.id}_mesh`, geometryId: `isl_${isl.id}_geom`, color: terrainColor });
    // Island terrain — its own SceneObject, independently selectable
    model.createObject({ id: `island_${isl.id}`, meshIds: [`isl_${isl.id}_mesh`] });

    // -------------------------------------------------------------------------
    // Scatter rocks — each is its own SceneObject so it can be selected,
    // highlighted, or hidden independently from the island terrain.
    //
    // Positions stay in model-local space (small floats).  The mesh matrix
    // holds only a centimetre-scale translation from the local origin.
    // -------------------------------------------------------------------------
    seedRand(isl.seed * 91 + 7);
    const numRocks = 30 + Math.floor(rand() * 35);

    for (let r = 0; r < numRocks; r++) {
      const angle = rand() * Math.PI * 2;
      const frac  = 0.12 + rand() * 0.84;   // 12–96 % of nominal radius
      const rx = isl.cx + Math.cos(angle) * frac * isl.rad;
      const ry = isl.cy + Math.sin(angle) * frac * isl.rad;
      const rz = islandHeight(rx, ry, isl.cx, isl.cy, isl.rad, terrain, edgeFn);
      if (rz < 0.6) continue;   // skip below / near water-line

      const geom  = ROCK_GEOMS[Math.floor(rand() * 3)];
      const scale = 0.55 + rand() * 0.90;
      const yaw   = rand() * 360;
      const pitch = (rand() - 0.5) * 22;   // slight random tilt
      const g2    = 0.26 + rand() * 0.20;
      const rid   = nextId++;

      model.createMesh({
        id: `rm${rid}`,
        geometryId: geom,
        matrix: xeokit.model.scene.buildMat4({
          position: [rx, ry, rz],
          rotation: [pitch, 0, yaw],
          scale:    [scale, scale, scale * (0.65 + rand() * 0.55)]
        }),
        color: [g2, g2 - 0.02, g2 - 0.05]
      });
      // Each rock boulder is an independent SceneObject
      model.createObject({ id: `rock_${rid}`, meshIds: [`rm${rid}`] });
    }
  }

  // ---------------------------------------------------------------------------
  // Camera — elevated south-east view across the full archipelago
  // ---------------------------------------------------------------------------
  studio.viewManager.createView({
    camera: {
      eye:  [1400, -9800, 4400],
      look: [200,   700,   60],
      up:   [0, 0, 1],
      perspectiveProjection: { far: 90000 }
    }
  });

  studio.finished();
});
