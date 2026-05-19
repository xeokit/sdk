// Section Caps — Test Row.
//
// Visual regression harness for `xeokit.presentations.sectionCaps.createSectionCaps`.
// Twelve minimal generated solids are laid out in a single row
// along the world X axis. A horizontal section plane sweeps
// vertically through them; the slider controls its world Z
// position.
//
// The cap geometry emitted by `createSectionCaps` renders in two
// places simultaneously:
//
//   - In-place on the section plane (inside the source row).
//     Marked non-clippable so the section plane that slices the
//     source solids leaves the caps intact.
//   - A second copy lifted into a parallel cap-preview row above
//     the source row, by giving the cap `SceneModel` a
//     coordinate-system origin that compensates for the current
//     cut Z. As the slider moves, the cap row updates but its
//     world Z stays fixed.
//
// Cases (left → right along the row):
//
//   0. Cube                       — rectangular cap.
//   1. Vertical cylinder          — circular cap.
//   2. Sphere                     — circular cap from sphere intersection.
//   3. Vertical cone              — circular cap, radius varies with cut Z.
//   4. Hollow vertical cylinder   — annular cap (outer CCW + hole CW).
//   5. Hollow vertical box        — rectangle with rectangular hole.
//   6. Plate w/ 2 cylindrical holes — rectangle with two circular holes.
//   7. Two disjoint cubes (single mesh) — two separate outer rings.
//   8. Slab top coplanar w/ cut   — cap is the top face (coplanar handler).
//   9. Cube entirely above cut    — no cap expected.
//  10. Cube entirely below cut    — no cap expected.
//  11. Open-sided non-watertight cube — unclosed loop, no cap.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

// World layout — Z-up, source row along world +X at world Y = 0.
const CUT_Z_DEFAULT = 1.0;
const TILE_PITCH = 2.5;
const NUM_TILES = 12;
const ROW_START_X = -((NUM_TILES - 1) * TILE_PITCH) / 2;
const CAP_ROW_Z = 6.0;

async function main() {
  const studio = new xeokit.studio.Studio({});
  await studio.init();

  const {scene} = studio;

  // ── Source SceneModel.
  //
  // basis = identity (Y-up). With the Scene's default Z-up basis
  // `[1,0,0, 0,0,1, 0,1,0]`, the coordinate-system transform
  // becomes `transpose(scene) * identity = scene_basis`, which
  // maps model-Y to world-Z. Procgen builders that work along
  // model-Y (cylinder, lathe) therefore stand vertical in world
  // space, which is the natural orientation for a horizontal
  // section plane.
  const sourceResult = scene.createModel({
    id: "section-caps-test-source",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1,
    },
  });
  if (!sourceResult.ok) throw new Error(sourceResult.error);
  const source = sourceResult.value;

  source.createMaterial({
    id: "sourceMat",
    color: [0.55, 0.58, 0.62],
    roughness: 0.85,
  });

  // ── Cases. Single row along world X. `centreZ` is the source
  // mesh's world-Z centre — defaults to 1 (straddling the cut
  // plane at z=1).
  const cases = [];
  cases.push({
    id: "00_cube",
    centreZ: 1.0,
    build: () => buildBoxGeom(2, 2, 2),
  });
  cases.push({
    id: "01_cylinder",
    centreZ: 1.0,
    build: () => buildCylinderGeom(0.9, 0.9, 2.0, 32),
  });
  cases.push({
    id: "02_sphere",
    centreZ: 1.0,
    build: () => buildSphereGeom(1.0, 24, 16),
  });
  cases.push({
    id: "03_cone",
    centreZ: 1.0,
    build: () => buildCylinderGeom(0.0, 1.0, 2.0, 32),
  });
  cases.push({
    id: "04_pipe",
    centreZ: 1.0,
    build: () => buildHollowCylinderGeom({
      outerRadius: 0.9, innerRadius: 0.5, height: 2.0, segments: 32,
    }),
  });
  cases.push({
    id: "05_frame",
    centreZ: 1.0,
    build: () => buildHollowBoxGeom({
      outerX: 2.0, outerY: 2.0,
      innerX: 1.0, innerY: 1.0,
      height: 2.0,
    }),
  });
  cases.push({
    id: "06_2holes",
    centreZ: 1.0,
    // Side walls only — tagged `TrianglesPrimitive` because the
    // hand-rolled mesh leaves top/bottom open (the cap-extraction
    // test depends only on side-wall topology).
    primitive: xeokit.base.constants.TrianglesPrimitive,
    build: () => buildPlateWithHolesGeom({
      sizeX: 2.0, sizeY: 2.0, height: 2.0,
      holes: [
        {cx: -0.5, cy: 0.0, radius: 0.3, segments: 20},
        {cx:  0.5, cy: 0.0, radius: 0.3, segments: 20},
      ],
    }),
  });
  cases.push({
    id: "07_twoCubes",
    centreZ: 1.0,
    build: () => {
      const a = buildBoxGeomShifted(0.7, 1.6, 1.6, [-0.6, 0, 0]);
      const b = buildBoxGeomShifted(0.7, 1.6, 1.6, [+0.6, 0, 0]);
      return concatGeoms(a, b);
    },
  });
  cases.push({
    id: "08_slabTopCoplanar",
    centreZ: 0.5,
    // Slab from world z=0 to z=1; top face exactly on the cut
    // plane. Build args (xSize, ySize, zSize) — ySize is the
    // model-Y / world-Z (vertical) extent.
    build: () => buildBoxGeom(2.0, 1.0, 2.0),
  });
  cases.push({
    id: "09_cubeAbove",
    centreZ: 2.5,
    build: () => buildBoxGeom(1.5, 1.5, 1.5),
  });
  cases.push({
    id: "10_cubeBelow",
    centreZ: -0.5,
    build: () => buildBoxGeom(1.5, 1.5, 1.5),
  });
  cases.push({
    id: "11_openSide",
    centreZ: 1.0,
    primitive: xeokit.base.constants.TrianglesPrimitive,
    build: () => buildOpenSidedCubeGeom(1.5, 1.5, 1.5),
  });

  // ── Register every case as a SceneObject in the source model.
  // Mesh position is in MODEL coords; with source basis = Y-up
  // identity and scene = Z-up, model (X, Y, Z) renders at world
  // (X, Z, Y). To place at world (gridX, 0, centreZ) we pass
  // model position `[gridX, centreZ, 0]`.
  cases.forEach((c, idx) => {
    const geomResult = c.build();
    if (!geomResult.ok) {
      console.error(`[${c.id}] build failed:`, geomResult.error);
      return;
    }
    const geom = geomResult.value;
    source.createGeometry({
      id: `geom_${c.id}`,
      primitive: c.primitive ?? xeokit.base.constants.SolidPrimitive,
      positions: geom.positions,
      indices: geom.indices,
    });
    const gridX = ROW_START_X + idx * TILE_PITCH;
    source.createMesh({
      id: `mesh_${c.id}`,
      geometryId: `geom_${c.id}`,
      materialId: "sourceMat",
      position: [gridX, c.centreZ, 0],
    });
    source.createObject({
      id: `obj_${c.id}`,
      originalSystemId: c.id,
      meshIds: [`mesh_${c.id}`],
    });
  });

  // ── View. Camera positioned in front of the row (at -Y),
  // raised enough to see both the source row and the cap-preview
  // row above it.
  const view = studio.viewManager.createView({
    camera: {
      eye:  [0, -38, 4],
      look: [0, 0, 3.5],
      up:   [0, 0, 1],
    },
    renderMode: xeokit.base.constants.QualityRender,
    effects: {
      tonemap: {sRGBEncode: true},
      sectionPlaneCaps: {renderModes: []},
    },
  });

  // ── Section plane and cap-row state. Both rebuild on slider
  // movement; `rebuildCaps` swaps the cap SceneModel out with a
  // freshly-extracted one whose coordinate-system origin lifts
  // every cap so the cap row sits at a fixed world Z regardless
  // of where the section plane currently is.
  const planeResult = view.createSectionPlane({
    id: "horizontal",
    pos: [0, 0, CUT_Z_DEFAULT],
    dir: [0, 0, 1],
    active: true,
  });
  if (!planeResult.ok) throw new Error(planeResult.error);
  const sectionPlane = planeResult.value;

  let currentCapModel = null;
  let capRebuildSeq = 0;

  function rebuildCaps(cutZ) {
    const seq = ++capRebuildSeq;
    if (currentCapModel) currentCapModel.destroy();
    // Cap SceneModel matches the Scene's Z-up basis exactly so
    // the world-space positions emitted by the extractor pass
    // through unchanged. `origin` is specified in the cap
    // SceneModel's local basis where `col1 = (0, 0, 1) = world
    // Z`, so the second component is what lifts the row along
    // world Z (vertical), NOT the third.
    const r = scene.createModel({
      id: `caps-${seq}`,
      coordinateSystem: {
        basis: [
          1, 0, 0,
          0, 0, 1,
          0, 1, 0,
        ],
        origin: [0, CAP_ROW_Z - cutZ, 0],
      },
    });
    if (!r.ok) { console.error(r.error); return null; }
    const m = r.value;
    const e = xeokit.presentations.sectionCaps.createSectionCaps({
      sourceSceneModel: source,
      targetSceneModel: m,
      capPlanes: [{dir: [0, 0, 1], dist: -cutZ}],
      capColor: [0.79, 0.32, 0.09],
      idPrefix: `cap${seq}`,
    });
    if (!e.ok) { console.error(e.error); m.destroy(); return null; }
    // Caps live above the source row and must never be clipped by
    // the section plane that slices the source.
    view.setObjectsClippable(Object.keys(m.objects), false);
    currentCapModel = m;
    refreshStats(e.value);
    return m;
  }

  function refreshStats(r) {
    statsEl.textContent =
      `${r.numObjectsWithCaps} objects, ${r.numCapMeshes} cap meshes` +
      (r.numUnclosedMeshes ? `, ${r.numUnclosedMeshes} unclosed` : "");
  }

  // ── UI bindings ──────────────────────────────────────────────
  const planeBtn    = document.getElementById("planeToggle");
  const planeOffset = document.getElementById("planeOffset");
  const sourceBtn   = document.getElementById("sourceToggle");
  const capsBtn     = document.getElementById("capsToggle");
  const statsEl     = document.getElementById("stats");

  rebuildCaps(CUT_Z_DEFAULT);

  function syncPlaneBtn() {
    planeBtn.textContent = sectionPlane.active ? "on" : "off";
    planeBtn.setAttribute("aria-pressed", String(sectionPlane.active));
  }
  planeBtn.addEventListener("click", () => {
    sectionPlane.active = !sectionPlane.active;
    syncPlaneBtn();
  });
  planeOffset.addEventListener("input", () => {
    const z = parseFloat(planeOffset.value);
    sectionPlane.pos = [0, 0, z];
    rebuildCaps(z);
  });
  syncPlaneBtn();

  let sourceOn = true;
  function syncSourceBtn() {
    sourceBtn.textContent = sourceOn ? "on" : "off";
    sourceBtn.setAttribute("aria-pressed", String(sourceOn));
  }
  sourceBtn.addEventListener("click", () => {
    sourceOn = !sourceOn;
    view.setObjectsVisible(Object.keys(source.objects), sourceOn);
    syncSourceBtn();
  });

  let capsOn = true;
  function syncCapsBtn() {
    capsBtn.textContent = capsOn ? "on" : "off";
    capsBtn.setAttribute("aria-pressed", String(capsOn));
  }
  capsBtn.addEventListener("click", () => {
    capsOn = !capsOn;
    if (currentCapModel) {
      view.setObjectsVisible(Object.keys(currentCapModel.objects), capsOn);
    }
    syncCapsBtn();
  });

  studio.finished();
}

// ────────────────────────────────────────────────────────────────────
// Geometry builders — wrappers over procgen plus four hand-built
// helpers for the topology / edge cases the procgen library doesn't
// cover directly.
//
// Each returns the canonical `SDKResult<GeometryArrays>` shape so
// the caller can uniformly check `.ok`.
//
// Coordinate convention: model-space, Y-up (matches the source
// `SceneModel`'s identity basis). The Scene applies a Z-up swap so
// model-Y becomes world-Z — vertical in the final render.
// ────────────────────────────────────────────────────────────────────

function buildBoxGeom(xSize, ySize, zSize) {
  return xeokit.model.procgen.buildGeometry.buildBox({
    center: [0, 0, 0], xSize, ySize, zSize,
  });
}

function buildBoxGeomShifted(xSize, ySize, zSize, centre) {
  return xeokit.model.procgen.buildGeometry.buildBox({
    center: centre, xSize, ySize, zSize,
  });
}

function buildCylinderGeom(radiusTop, radiusBottom, height, radialSegments) {
  return xeokit.model.procgen.buildGeometry.buildCylinder({
    center: [0, 0, 0],
    radiusTop, radiusBottom, height, radialSegments,
    heightSegments: 1, openEnded: false,
  });
}

function buildSphereGeom(radius, widthSegments, heightSegments) {
  return xeokit.model.procgen.buildGeometry.buildSphere({
    center: [0, 0, 0], radius, widthSegments, heightSegments,
  });
}

/**
 * Watertight hollow cylinder (pipe) via `buildLathe` with a
 * rectangular profile that traces the outer wall, top cap, inner
 * wall, and bottom cap in CCW order in (r, y) space.
 */
function buildHollowCylinderGeom({outerRadius, innerRadius, height, segments}) {
  const halfH = height * 0.5;
  return xeokit.model.procgen.buildGeometry.buildLathe({
    profile: [
      outerRadius, -halfH,
      outerRadius,  halfH,
      innerRadius,  halfH,
      innerRadius, -halfH,
    ],
    segments,
    closedProfile: true,
  });
}

/**
 * Watertight hollow box (rectangular frame extruded along Y).
 *
 * Topology: 4 outer side faces + 4 inner side faces + 2 annular
 * (rectangular-ring) caps top and bottom, all CCW from outside.
 */
function buildHollowBoxGeom({outerX, outerY, innerX, innerY, height}) {
  const hx = outerX * 0.5, hy = outerY * 0.5;
  const ix = innerX * 0.5, iy = innerY * 0.5;
  const hh = height * 0.5;

  const positions = [
    // Outer bottom
    -hx, -hh, -hy,
     hx, -hh, -hy,
     hx, -hh,  hy,
    -hx, -hh,  hy,
    // Outer top
    -hx,  hh, -hy,
     hx,  hh, -hy,
     hx,  hh,  hy,
    -hx,  hh,  hy,
    // Inner bottom
    -ix, -hh, -iy,
     ix, -hh, -iy,
     ix, -hh,  iy,
    -ix, -hh,  iy,
    // Inner top
    -ix,  hh, -iy,
     ix,  hh, -iy,
     ix,  hh,  iy,
    -ix,  hh,  iy,
  ];

  const indices = [
    // Outer -Z face — outward normal -Z
    0, 4, 5,   0, 5, 1,
    // Outer +X face — outward normal +X
    1, 5, 6,   1, 6, 2,
    // Outer +Z face — outward normal +Z
    2, 6, 7,   2, 7, 3,
    // Outer -X face — outward normal -X
    3, 7, 4,   3, 4, 0,

    // Inner side faces — outward normals point INTO the hole.
    8, 9, 13,   8, 13, 12,
    9, 10, 14,  9, 14, 13,
    10, 11, 15, 10, 15, 14,
    11, 8, 12,  11, 12, 15,

    // Top annular cap — outward normal +Y.
    4, 5, 13,   4, 13, 12,
    5, 6, 14,   5, 14, 13,
    6, 7, 15,   6, 15, 14,
    7, 4, 12,   7, 12, 15,

    // Bottom annular cap — outward normal -Y.
    0, 8, 9,    0, 9, 1,
    1, 9, 10,   1, 10, 2,
    2, 10, 11,  2, 11, 3,
    3, 11, 8,   3, 8, 0,
  ];

  return {
    ok: true,
    value: {
      positions: new Float32Array(positions),
      indices: new Uint32Array(indices),
    },
  };
}

/**
 * Rectangular plate with one or more axis-aligned cylindrical
 * holes drilled along the Y axis. Built as side walls only — the
 * outer rectangular shell plus one inner cylindrical surface per
 * hole.
 *
 * Top and bottom faces are intentionally omitted: the
 * cap-extraction test depends only on side-wall straddling
 * triangles. Avoiding the polygon-with-N-holes top/bottom
 * triangulation keeps the builder simple while still exercising
 * the multi-hole-per-outer path in the extractor.
 */
function buildPlateWithHolesGeom({sizeX, sizeY, height, holes}) {
  const hx = sizeX * 0.5, hz = sizeY * 0.5;
  const hh = height * 0.5;

  const positions = [];
  const indices = [];
  const pushV = (x, y, z) => {
    const idx = positions.length / 3;
    positions.push(x, y, z);
    return idx;
  };

  const OB_BL = pushV(-hx, -hh, -hz);
  const OB_BR = pushV( hx, -hh, -hz);
  const OB_TR = pushV( hx, -hh,  hz);
  const OB_TL = pushV(-hx, -hh,  hz);
  const OT_BL = pushV(-hx,  hh, -hz);
  const OT_BR = pushV( hx,  hh, -hz);
  const OT_TR = pushV( hx,  hh,  hz);
  const OT_TL = pushV(-hx,  hh,  hz);

  indices.push(OB_BL, OT_BL, OT_BR,  OB_BL, OT_BR, OB_BR); // -Z
  indices.push(OB_BR, OT_BR, OT_TR,  OB_BR, OT_TR, OB_TR); // +X
  indices.push(OB_TR, OT_TR, OT_TL,  OB_TR, OT_TL, OB_TL); // +Z
  indices.push(OB_TL, OT_TL, OT_BL,  OB_TL, OT_BL, OB_BL); // -X

  for (const h of holes) {
    const ringBot = [];
    const ringTop = [];
    for (let i = 0; i < h.segments; i++) {
      const a = (i / h.segments) * Math.PI * 2;
      const x = h.cx + Math.cos(a) * h.radius;
      const z = h.cy + Math.sin(a) * h.radius;
      ringBot.push(pushV(x, -hh, z));
      ringTop.push(pushV(x,  hh, z));
    }
    const n = ringBot.length;
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      indices.push(
        ringBot[i], ringBot[next], ringTop[next],
        ringBot[i], ringTop[next], ringTop[i],
      );
    }
  }

  return {
    ok: true,
    value: {
      positions: new Float32Array(positions),
      indices:   new Uint32Array(indices),
    },
  };
}

/**
 * Cube with the +X side face removed — non-watertight by design.
 * The remaining three side faces straddle the cut but the missing
 * face leaves a gap in the loop, so the extractor's stitcher
 * produces an open polyline instead of a closed loop. The mesh
 * is counted in `numUnclosedMeshes` and contributes no cap.
 */
function buildOpenSidedCubeGeom(xSize, ySize, zSize) {
  const boxResult = xeokit.model.procgen.buildGeometry.buildBox({
    center: [0, 0, 0], xSize, ySize, zSize,
  });
  if (!boxResult.ok) return boxResult;
  const box = boxResult.value;

  const halfX = xSize * 0.5;
  const pos = box.positions;
  const inIdx = box.indices;
  const outIdx = [];
  const xOf = (i) => pos[i * 3];
  for (let i = 0; i < inIdx.length; i += 3) {
    const a = inIdx[i], b = inIdx[i + 1], c = inIdx[i + 2];
    if (Math.abs(xOf(a) - halfX) < 1e-6 &&
        Math.abs(xOf(b) - halfX) < 1e-6 &&
        Math.abs(xOf(c) - halfX) < 1e-6) {
      continue;
    }
    outIdx.push(a, b, c);
  }
  return {
    ok: true,
    value: {
      positions: pos,
      indices:   new Uint32Array(outIdx),
    },
  };
}

/**
 * Concatenate two geometries' positions and indices into one,
 * offsetting the second's indices by the first's vertex count.
 * Used to build the "two disjoint cubes as one mesh" test case.
 */
function concatGeoms(a, b) {
  if (!a.ok) return a;
  if (!b.ok) return b;
  const A = a.value, B = b.value;
  const aVerts = A.positions.length / 3;
  const positions = new Float32Array(A.positions.length + B.positions.length);
  positions.set(A.positions, 0);
  positions.set(B.positions, A.positions.length);
  const indices = new Uint32Array(A.indices.length + B.indices.length);
  indices.set(A.indices, 0);
  for (let i = 0; i < B.indices.length; i++) {
    indices[A.indices.length + i] = B.indices[i] + aVerts;
  }
  return {
    ok: true,
    value: {positions, indices},
  };
}

main().catch(err => {
  console.error("[SectionCaps_TestGrid]", err);
});
