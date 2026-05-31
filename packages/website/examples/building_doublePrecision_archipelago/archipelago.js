// =============================================================================
// Procedural archipelago generation
//
// Builds the islands, rocks, and ocean into the supplied SceneModel, entirely
// in the model's local space (small float32 metres). Factored out of index.js
// so the example itself stays focused on the double-precision coordinate
// handling rather than the proc-gen maths.
//
// Returns the two building anchor points (local coords) and the sea level —
// everything index.js needs to place the Duplex, House, and Ferry.
// =============================================================================

export async function buildArchipelago(xeokit, model, yieldToHost) {
  const { TrianglesPrimitive, sRGBEncoding, LinearFilter } = xeokit.base.constants;

  // PRNG — mulberry32, seeded per use-site for reproducibility.
  let _seed = 0;
  const seedRand = (s) => { _seed = (s | 0); };
  const rand = () => {
    _seed = (_seed + 0x6D2B79F5) | 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Per-island terrain parameters: layered noise, two domain-warp fields, and
  // a few Gaussian summit bumps.
  function generateTerrain(seed) {
    seedRand(seed);
    const layers = [
      { kx: 0.0035+rand()*0.0020, ky: 0.0030+rand()*0.0020, amp: 1.00, phase: rand()*6.28, ridge: false },
      { kx: 0.0075+rand()*0.0030, ky: 0.0070+rand()*0.0030, amp: 0.60, phase: rand()*6.28, ridge: rand()>0.5 },
      { kx: 0.0160+rand()*0.0060, ky: 0.0150+rand()*0.0060, amp: 0.32, phase: rand()*6.28, ridge: rand()>0.4 },
      { kx: 0.0340+rand()*0.0120, ky: 0.0320+rand()*0.0120, amp: 0.16, phase: rand()*6.28, ridge: rand()>0.6 },
      { kx: 0.0700+rand()*0.0250, ky: 0.0660+rand()*0.0250, amp: 0.08, phase: rand()*6.28, ridge: false },
      { kx: 0.1400+rand()*0.0500, ky: 0.1300+rand()*0.0500, amp: 0.040, phase: rand()*6.28, ridge: false },
      { kx: 0.2800+rand()*0.1000, ky: 0.2600+rand()*0.1000, amp: 0.018, phase: rand()*6.28, ridge: false },
    ];
    const warp = [
      { kx: 0.0022+rand()*0.0010, ky: 0.0020+rand()*0.0010, ax: 60+rand()*40, ay: 55+rand()*35, px: rand()*6.28, py: rand()*6.28 },
      { kx: 0.0055+rand()*0.0020, ky: 0.0050+rand()*0.0020, ax: 28+rand()*18, ay: 25+rand()*16, px: rand()*6.28, py: rand()*6.28 },
    ];
    const numPeaks = 2 + Math.floor(rand() * 3);
    const peaks = [];
    for (let i = 0; i < numPeaks; i++) {
      peaks.push({
        fx:    (rand() - 0.5) * 0.65,
        fy:    (rand() - 0.5) * 0.65,
        sigma: 0.09 + rand() * 0.11,
        amp:   0.14 + rand() * 0.16
      });
    }
    return { layers, warp, peaks };
  }

  // Coastline radius as a function of bearing — superimposed angular harmonics
  // give natural lobes, bays, and sea-stack serrations.
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

  // Terrain height at (x,y) — pure function, no PRNG. Returns z ≥ 0, tapering
  // to 0 at the coastline.
  function islandHeight(x, y, cx, cy, baseRad, terrain, edgeFn) {
    const dx   = x - cx,  dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const edge = edgeFn(Math.atan2(dy, dx));
    if (dist >= edge) return 0;

    const t   = 1 - dist / edge;
    const env = t * t * (3 - 2 * t);           // smoothstep coastal envelope
    const maxH = baseRad * 0.26;

    let wx = 0, wy = 0;
    for (const W of terrain.warp) {
      wx += W.ax * Math.sin(W.kx * x + W.ky * y + W.px);
      wy += W.ay * Math.cos(W.kx * x + W.ky * y + W.py);
    }
    const xw = x + wx,  yw = y + wy;

    let h = 0;
    for (const L of terrain.layers) {
      const raw = Math.sin(L.kx * xw + L.ky * yw + L.phase);
      h += L.amp * (L.ridge ? 1 - Math.abs(raw) : 0.5 + 0.5 * raw);
    }
    for (const P of terrain.peaks) {
      const pdx = dx / baseRad - P.fx;
      const pdy = dy / baseRad - P.fy;
      h += P.amp * Math.exp(-(pdx * pdx + pdy * pdy) / (P.sigma * P.sigma));
    }
    h = Math.pow(Math.max(0, h) / 2.2, 1.55) * maxH * env * env;
    return h;
  }

  // Three boulder shapes, each created once and instanced via mesh matrices.
  function buildRockGeom(id, xSize, zSize, ySize) {
    const r = xeokit.model.procgen.buildGeometry.buildBox({ xSize, ySize, zSize });
    if (!r.ok) return;
    model.createGeometry({
      id, primitive: TrianglesPrimitive,
      positions: r.value.positions, normals: r.value.normals, indices: r.value.indices
    });
  }
  buildRockGeom("rock_lg", 7.2, 3.8, 6.0);
  buildRockGeom("rock_md", 3.4, 2.0, 3.0);
  buildRockGeom("rock_sm", 1.6, 1.2, 1.5);
  const ROCK_GEOMS = ["rock_lg", "rock_md", "rock_sm"];

  // Matte material for rocks and the building slabs.
  model.createMaterial({ id: "MAT_MATTE", color: [1, 1, 1], roughness: 1.0, metallic: 0 });

  // Ocean — one tessellated quad raised to SEA_LEVEL. Island coastlines taper
  // to z = 0, so the sea sits just above them and inside-coast terrain is
  // dropped by ISLAND_DROP, leaving a clean waterline. Tessellated (not a
  // single quad) so the renderer's log-depth stays accurate across the world.
  const SEA = 28000;
  const SEA_LEVEL = 2.0;
  const ISLAND_DROP = 2.0;
  const SEA_N = 120;
  const SEA_V = SEA_N + 1;
  const seaPos  = new Float32Array(SEA_V * SEA_V * 3);
  const seaNorm = new Float32Array(SEA_V * SEA_V * 3);
  const seaIdx  = new Uint32Array(SEA_N * SEA_N * 6);
  for (let row = 0; row < SEA_V; row++) {
    for (let col = 0; col < SEA_V; col++) {
      const vi = (row * SEA_V + col) * 3;
      seaPos[vi    ] = -SEA + (col / SEA_N) * (2 * SEA);
      seaPos[vi + 1] = -SEA + (row / SEA_N) * (2 * SEA);
      seaPos[vi + 2] = SEA_LEVEL;
      seaNorm[vi] = 0; seaNorm[vi + 1] = 0; seaNorm[vi + 2] = 1;
    }
  }
  let seaII = 0;
  for (let row = 0; row < SEA_N; row++) {
    for (let col = 0; col < SEA_N; col++) {
      const a = row * SEA_V + col;
      const b = a + 1;
      const c = a + SEA_V;
      const d = c + 1;
      seaIdx[seaII++] = a; seaIdx[seaII++] = b; seaIdx[seaII++] = c;
      seaIdx[seaII++] = b; seaIdx[seaII++] = d; seaIdx[seaII++] = c;
    }
  }
  model.createGeometry({ id:"ocean_geom", primitive: TrianglesPrimitive,
    positions: seaPos, normals: seaNorm, indices: seaIdx });
  model.createMesh({ id:"ocean_mesh", geometryId:"ocean_geom",
    color: [0.06, 0.16, 0.28], opacity: 0.70 });
  model.createObject({ id:"ocean", meshIds:["ocean_mesh"] });
  await yieldToHost();

  // Island layout — model-local metres from the origin, fanned out in rings to
  // ~25 km. Each island reseeds the PRNG from its own `seed`, so array order
  // doesn't perturb any island's shape or rock placement.
  const ISLANDS = [
    { id:"A", cx:     0, cy:     0, rad: 680, seed: 11 },
    { id:"B", cx:  3200, cy:  1600, rad: 450, seed: 22 },
    { id:"C", cx: -2800, cy:  2700, rad: 530, seed: 33 },
    { id:"D", cx:  1200, cy: -3400, rad: 400, seed: 44 },
    { id:"E", cx: -4000, cy: -1700, rad: 350, seed: 55 },
    { id:"F", cx:  5200, cy: -2800, rad: 290, seed: 66 },
    { id:"G", cx: -5100, cy:  1100, rad: 320, seed: 77 },
    { id:"H", cx:     0, cy:  4800, rad: 380, seed:  88 },
    { id:"I", cx:  4500, cy:  4200, rad: 420, seed:  99 },
    { id:"J", cx: -4600, cy: -3800, rad: 460, seed: 111 },
    { id:"K", cx:  2400, cy:  4500, rad: 300, seed: 121 },
    { id:"L", cx: -2200, cy: -4500, rad: 350, seed: 131 },
    { id:"M", cx:  3800, cy:     0, rad: 380, seed: 141 },
    { id:"N", cx: -3700, cy:  4300, rad: 400, seed: 151 },
    { id:"O", cx:     0, cy: -4800, rad: 320, seed: 161 },
    { id:"P", cx:  7800, cy:  2200, rad: 460, seed: 171 },
    { id:"Q", cx:  2200, cy:  7800, rad: 430, seed: 181 },
    { id:"R", cx: -7800, cy:  2200, rad: 410, seed: 191 },
    { id:"S", cx: -2200, cy:  7800, rad: 380, seed: 201 },
    { id:"T", cx:  7400, cy: -3000, rad: 440, seed: 211 },
    { id:"U", cx:  3000, cy: -7400, rad: 420, seed: 221 },
    { id:"V", cx: -7400, cy: -3000, rad: 400, seed: 231 },
    { id:"W", cx: -3000, cy: -7400, rad: 390, seed: 241 },
    { id:"X", cx:  9500, cy:  6500, rad: 540, seed: 251 },
    { id:"Y", cx: -9500, cy: -6500, rad: 510, seed: 261 },
    { id:"Z", cx:  6500, cy:  9500, rad: 500, seed: 271 },
    { id:"AB", cx:-6500, cy:  9500, rad: 480, seed: 281 },
    { id:"AC", cx: 14000, cy:     0, rad: 560, seed: 291 },
    { id:"AD", cx: 12100, cy:  7000, rad: 520, seed: 301 },
    { id:"AE", cx:  7000, cy: 12100, rad: 580, seed: 311 },
    { id:"AF", cx:     0, cy: 14000, rad: 600, seed: 321 },
    { id:"AG", cx: -7000, cy: 12100, rad: 540, seed: 331 },
    { id:"AH", cx:-12100, cy:  7000, rad: 520, seed: 341 },
    { id:"AJ", cx:-14000, cy:     0, rad: 580, seed: 351 },
    { id:"AK", cx:-12100, cy: -7000, rad: 540, seed: 361 },
    { id:"AL", cx: -7000, cy:-12100, rad: 560, seed: 371 },
    { id:"AM", cx:     0, cy:-14000, rad: 600, seed: 381 },
    { id:"AN", cx:  7000, cy:-12100, rad: 520, seed: 391 },
    { id:"AP", cx: 12100, cy: -7000, rad: 540, seed: 401 },
    { id:"AQ", cx: 21000, cy:     0, rad: 700, seed: 411 },
    { id:"AR", cx: 17000, cy: 12500, rad: 650, seed: 421 },
    { id:"AS", cx: 12500, cy: 17000, rad: 700, seed: 431 },
    { id:"AT", cx:     0, cy: 21000, rad: 720, seed: 441 },
    { id:"AU", cx:-12500, cy: 17000, rad: 680, seed: 451 },
    { id:"AV", cx:-17000, cy: 12500, rad: 660, seed: 461 },
    { id:"AW", cx:-21000, cy:     0, rad: 700, seed: 471 },
    { id:"AX", cx:-12500, cy:-17000, rad: 650, seed: 481 },
    { id:"AY", cx:     0, cy:-21000, rad: 700, seed: 491 },
    { id:"AZ", cx: 12500, cy:-17000, rad: 680, seed: 501 },
    { id:"BA", cx: 25000, cy:  7000, rad: 800, seed: 511 },
    { id:"BB", cx:  7000, cy: 25000, rad: 750, seed: 521 },
    { id:"BC", cx:-25000, cy:  7000, rad: 780, seed: 531 },
    { id:"BD", cx: -7000, cy:-25000, rad: 760, seed: 541 },
    { id:"BE", cx: 22000, cy:-16000, rad: 820, seed: 551 },
  ];

  // Terrain grid: N quads per side. WATERLINE_H is the island-local height
  // marching squares contours at to find the visible coastline.
  const N = 56;
  const V = N + 1;
  let nextId = 0;
  const WATERLINE_H = SEA_LEVEL + ISLAND_DROP;

  // Coast-band texture: warm beach at u = 0 ramping to green inland. Sampled by
  // every island via per-vertex UVs derived from height above the waterline.
  const COAST_BAND_M = 100.0;
  const TEX_W = 256;
  const BEACH_RGB = [0.96, 0.92, 0.72];
  const GREEN_RGB = [0.30, 0.52, 0.24];
  const RAMP_END = 0.95;
  const coastTexData = new Uint8ClampedArray(TEX_W * 4);
  for (let i = 0; i < TEX_W; i++) {
    const u = i / (TEX_W - 1);
    const t = Math.min(1, u / RAMP_END);
    const s = t * t * (3 - 2 * t);
    coastTexData[i * 4    ] = Math.round((BEACH_RGB[0] + (GREEN_RGB[0] - BEACH_RGB[0]) * s) * 255);
    coastTexData[i * 4 + 1] = Math.round((BEACH_RGB[1] + (GREEN_RGB[1] - BEACH_RGB[1]) * s) * 255);
    coastTexData[i * 4 + 2] = Math.round((BEACH_RGB[2] + (GREEN_RGB[2] - BEACH_RGB[2]) * s) * 255);
    coastTexData[i * 4 + 3] = 255;
  }
  model.createTexture({
    id: "tex_coast",
    imageData: {data: coastTexData, width: TEX_W, height: 1},
    encoding: sRGBEncoding, minFilter: LinearFilter, magFilter: LinearFilter,
    mipmap: false, flipY: false,
  });
  model.createMaterial({
    id: "MAT_COAST", color: [1, 1, 1], roughness: 1.0, metallic: 0,
    colorTextureId: "tex_coast",
  });

  // World-space anchors for the two buildings — captured during the rock
  // scatter so each building plants on a real boulder.
  let duplexAnchor = null;
  let houseAnchor  = null;

  for (const isl of ISLANDS) {
    const terrain = generateTerrain(isl.seed);
    const edgeFn  = generateEdgeFn(isl.rad, isl.seed);
    const step    = (2 * isl.rad) / N;
    const eps     = step * 0.30;

    // Corner verts fill indices [0..V*V); marching-squares edge crossings are
    // allocated above that.
    const maxBoundaryVerts = 2 * N * N;
    const maxVerts = V * V + maxBoundaryVerts;
    const positions = new Float32Array(maxVerts * 3);
    const normals   = new Float32Array(maxVerts * 3);
    const sdfs      = new Float32Array(V * V);
    const uvs = new Float32Array(maxVerts * 2);

    // Pass 1 — regular corner grid: position, central-difference normal, UV.
    for (let row = 0; row < V; row++) {
      for (let col = 0; col < V; col++) {
        const x = isl.cx - isl.rad + col * step;
        const y = isl.cy - isl.rad + row * step;
        const z = islandHeight(x, y, isl.cx, isl.cy, isl.rad, terrain, edgeFn);

        const ci = row * V + col;
        const vi = ci * 3;
        positions[vi    ] = x;
        positions[vi + 1] = y;
        positions[vi + 2] = z > 0 ? z - ISLAND_DROP : 0;
        sdfs[ci] = z - WATERLINE_H;

        const dzdx = (islandHeight(x+eps, y, isl.cx, isl.cy, isl.rad, terrain, edgeFn)
                    - islandHeight(x-eps, y, isl.cx, isl.cy, isl.rad, terrain, edgeFn)) / (2*eps);
        const dzdy = (islandHeight(x, y+eps, isl.cx, isl.cy, isl.rad, terrain, edgeFn)
                    - islandHeight(x, y-eps, isl.cx, isl.cy, isl.rad, terrain, edgeFn)) / (2*eps);
        const len  = Math.sqrt(dzdx*dzdx + dzdy*dzdy + 1);
        normals[vi    ] = -dzdx / len;
        normals[vi + 1] = -dzdy / len;
        normals[vi + 2] =  1    / len;

        const sdf = z - WATERLINE_H;
        const uoff = ci * 2;
        uvs[uoff    ] = sdf > 0 ? Math.min(1, sdf / COAST_BAND_M) : 0;
        uvs[uoff + 1] = 0.5;
      }
    }

    // Pass 2 — marching squares over the cell grid, contouring at the
    // waterline so coastlines follow a smooth polygon instead of grid steps.
    const indicesArr = [];
    let nextBoundaryVi = V * V;

    // Emit a boundary crossing on the cell-edge between corners iA and iB,
    // linearly interpolating position + normal; z pinned to SEA_LEVEL.
    const makeCrossing = (iA, iB, sdfA, sdfB) => {
      const t = sdfA / (sdfA - sdfB);
      const aX = positions[iA*3 + 0], aY = positions[iA*3 + 1];
      const bX = positions[iB*3 + 0], bY = positions[iB*3 + 1];
      const aN0 = normals[iA*3 + 0], aN1 = normals[iA*3 + 1], aN2 = normals[iA*3 + 2];
      const bN0 = normals[iB*3 + 0], bN1 = normals[iB*3 + 1], bN2 = normals[iB*3 + 2];

      const vi = nextBoundaryVi++;
      const off = vi * 3;
      positions[off    ] = aX + (bX - aX) * t;
      positions[off + 1] = aY + (bY - aY) * t;
      positions[off + 2] = SEA_LEVEL;

      let nx = aN0 + (bN0 - aN0) * t;
      let ny = aN1 + (bN1 - aN1) * t;
      let nz = aN2 + (bN2 - aN2) * t;
      const nlen = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
      normals[off    ] = nx / nlen;
      normals[off + 1] = ny / nlen;
      normals[off + 2] = nz / nlen;

      const uoff = vi * 2;
      uvs[uoff    ] = 0;
      uvs[uoff + 1] = 0.5;
      return vi;
    };

    const tri = (i0, i1, i2) => {
      indicesArr.push(i0, i1, i2);
    };

    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const a = row * V + col;           // BL
        const b = a + 1;                   // BR
        const c = a + V + 1;               // TR
        const d = a + V;                   // TL
        const sA = sdfs[a], sB = sdfs[b], sC = sdfs[c], sD = sdfs[d];

        const code =
          (sA > 0 ? 1 : 0) |
          (sB > 0 ? 2 : 0) |
          (sC > 0 ? 4 : 0) |
          (sD > 0 ? 8 : 0);

        if (code === 0) continue;          // fully outside

        if (code === 15) {                 // fully inside
          tri(a, b, c);
          tri(a, c, d);
          continue;
        }

        const ab = (sA > 0) !== (sB > 0) ? makeCrossing(a, b, sA, sB) : -1;
        const bc = (sB > 0) !== (sC > 0) ? makeCrossing(b, c, sB, sC) : -1;
        const dc = (sD > 0) !== (sC > 0) ? makeCrossing(d, c, sD, sC) : -1;
        const ad = (sA > 0) !== (sD > 0) ? makeCrossing(a, d, sA, sD) : -1;

        switch (code) {
          case  1: tri(a, ab, ad); break;
          case  2: tri(b, bc, ab); break;
          case  4: tri(c, dc, bc); break;
          case  8: tri(d, ad, dc); break;

          case  3: tri(a, b, bc); tri(a, bc, ad); break;
          case  6: tri(b, c, dc); tri(b, dc, ab); break;
          case 12: tri(c, d, ad); tri(c, ad, bc); break;
          case  9: tri(d, a, ab); tri(d, ab, dc); break;

          case  5: tri(a, ab, ad); tri(c, dc, bc); break;
          case 10: tri(b, bc, ab); tri(d, ad, dc); break;

          case  7: tri(a, b, c); tri(a, c, dc); tri(a, dc, ad); break;
          case 11: tri(a, b, bc); tri(a, bc, dc); tri(a, dc, d); break;
          case 13: tri(a, ab, bc); tri(a, bc, c); tri(a, c, d); break;
          case 14: tri(b, c, d); tri(b, d, ad); tri(b, ad, ab); break;
        }
      }
    }

    const usedVerts = nextBoundaryVi;
    const usedPositions = positions.subarray(0, usedVerts * 3);
    const usedNormals   = normals.subarray(0, usedVerts * 3);
    const usedUvs       = uvs.subarray(0, usedVerts * 2);
    const trimmedIndices = new Uint32Array(indicesArr);

    model.createGeometry({
      id: `isl_${isl.id}_geom`,
      primitive: TrianglesPrimitive,
      positions: usedPositions,
      normals:   usedNormals,
      uvs:       usedUvs,
      indices:   trimmedIndices,
    });
    model.createMesh({
      id: `isl_${isl.id}_mesh`,
      geometryId: `isl_${isl.id}_geom`,
      materialId: "MAT_COAST",
      color: [1, 1, 1],
    });
    model.createObject({ id: `island_${isl.id}`, meshIds: [`isl_${isl.id}_mesh`] });

    // Scatter rocks — each its own SceneObject. Islands A and AB keep a denser
    // scatter so the Duplex / House anchor rocks land deterministically.
    seedRand(isl.seed * 91 + 7);
    const isBuildingIsland = (isl.id === "A" || isl.id === "AB");
    const numRocks = isBuildingIsland
      ? 30 + Math.floor(rand() * 35)
      :  6 + Math.floor(rand() *  6);

    for (let r = 0; r < numRocks; r++) {
      const angle = rand() * Math.PI * 2;
      const frac  = 0.12 + rand() * 0.84;
      const rx = isl.cx + Math.cos(angle) * frac * isl.rad;
      const ry = isl.cy + Math.sin(angle) * frac * isl.rad;
      const rz = islandHeight(rx, ry, isl.cx, isl.cy, isl.rad, terrain, edgeFn);
      if (rz < 0.6) continue;   // below / near the waterline

      if (!duplexAnchor && isl.id === "A") {
        duplexAnchor = [rx, ry, rz];
      }
      if (!houseAnchor && isl.id === "AB" && rz >= 5) {
        houseAnchor = [rx, ry, rz];
      }

      const geom  = ROCK_GEOMS[Math.floor(rand() * 3)];
      const scale = 0.55 + rand() * 0.90;
      const yaw   = rand() * 360;
      const pitch = (rand() - 0.5) * 22;
      const g2    = 0.26 + rand() * 0.20;
      const rid   = nextId++;

      model.createMesh({
        id: `rm${rid}`,
        geometryId: geom,
        materialId: "MAT_MATTE",
        matrix: xeokit.model.scene.buildMat4({
          position: [rx, ry, rz],
          rotation: [pitch, 0, yaw],
          scale:    [scale, scale, scale * (0.65 + rand() * 0.55)]
        }),
        color: [g2, g2 - 0.02, g2 - 0.05]
      });
      model.createObject({ id: `rock_${rid}`, meshIds: [`rm${rid}`] });
    }

    // Yield once per island so the browser can paint progress as the
    // archipelago streams in.
    await yieldToHost();
  }

  return { duplexAnchor, houseAnchor, SEA_LEVEL };
}
