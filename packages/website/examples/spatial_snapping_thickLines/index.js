// WebGLRenderer — snap-to-vertex / snap-to-edge picking on thick lines.
//
// Companion to WebGLRenderer_snapping_table — that demo snaps to
// triangle-mesh edges and corners. This one builds a scene of pure
// LinesPrimitive geometry rendered through the quad-expanded
// thick-line technique, snaps to the *lines themselves*, and
// exercises every line-style code path the renderer carries:
//
//   - View-level `linesMaterial.linePattern` (the box — no
//     per-material override, so it follows whichever preset the
//     picker in the intro card currently has set).
//   - Per-material `linePattern` overrides — five neighbouring
//     shapes each carry their own SceneMaterial with a different
//     style (solid, dashed, dotted, dashDot, dashDotDot, custom
//     long-dash). The GPU plumbing denormalises each material's
//     pattern into the per-mesh attribute texture so the FS
//     reads the per-mesh value and ignores the view uniform.
//   - Snap deliberately ignores the dash pattern — gaps are
//     decoration, not geometry, so a dashed line is snappable
//     along its whole length.
//
// Click anywhere over the thick lines to see the cursor track
// the snap target; the marker tints red on vertex hits and
// amber on edge hits.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const SNAP_RADIUS_PX = 30;
const LINE_WIDTH_PX  = 6;

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const {scene, renderer} = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [0,  16, 18],
      look: [0,  0,  0],
      up:   [0,  0,  1],
    },
  });

  // Thick lines on every WebGL2 backend. The quad-expanded
  // technique reads this value uniformly; legacy `gl.LINES`
  // would be clamped to 1 px on Windows/ANGLE.
  view.linesMaterial.lineWidth = LINE_WIDTH_PX;
  view.linesMaterial.joinStyle = "round";

  // View-level default. The box mesh below carries NO material
  // and therefore inherits this value — switching the picker
  // in the intro card retouches just that shape, while the
  // five other shapes stay pinned to their per-material styles.
  view.linesMaterial.linePattern = "solid";

  const sceneModel = mustCreate(scene.createModel({id: "thickLines"}));

  // ── Geometries ────────────────────────────────────────────
  //
  // Each geometry is plain LinesPrimitive — the only "kinds"
  // here are how the indices are laid out:
  //   - disjoint segment list (box, plus) → free-end caps at
  //     every endpoint, no joints.
  //   - closed polyline (pentagram, triangle, octagon) →
  //     every endpoint shares with a neighbour, joints fire.
  //   - open polyline (Z) → mixed joints + free ends.
  // The line-style code path is orthogonal to the geometry —
  // any pattern can run on any of these. The shapes are
  // sized + spaced so all six are visible simultaneously.

  const boxLines  = mustOk(xeokit.model.procgen.buildGeometry.buildBoxLines({xSize: 1.6, ySize: 1.6, zSize: 1.6}));
  const pentagram = buildPentagram(1.6);
  const zPoly     = buildZPolyline(1.4);
  const triangle  = buildClosedNgon(3, 1.7);
  const plusSign  = buildPlusSign(1.6);
  const octagon   = buildClosedNgon(8, 1.6);

  // ── Materials ────────────────────────────────────────────
  //
  // One SceneMaterial per style so the GPU encoder denormalises
  // a distinct per-mesh pattern into the meshAttributeTexture.
  // The `color` field doubles as the per-mesh tint; the
  // `linePattern` is the new bit being exercised. A `lineWidth`
  // override is set on each material so each shape carries the
  // same visible thickness even though the demo's view-level
  // width is 6 — keeps proportions even across styles.
  mustCreate(sceneModel.fromParams({
    materials: [
      // No "boxMat" — the box deliberately picks up the View's
      // linesMaterial.linePattern (mutable via the picker UI).
      {id: "pentagramMat", color: [0.85, 0.30, 0.20], lineWidth: LINE_WIDTH_PX, linePattern: "dashed"},
      {id: "zMat",         color: [0.20, 0.55, 0.30], lineWidth: LINE_WIDTH_PX, linePattern: "dotted"},
      {id: "triangleMat",  color: [0.70, 0.45, 0.10], lineWidth: LINE_WIDTH_PX, linePattern: "dashDot"},
      {id: "plusMat",      color: [0.20, 0.40, 0.75], lineWidth: LINE_WIDTH_PX, linePattern: "dashDotDot"},
      // Custom dash array — long dash, short gap, short dash,
      // short gap (a "long-short" surveyor's chain). Exercises
      // the user-supplied number[] code path.
      {id: "octagonMat",   color: [0.55, 0.20, 0.55], lineWidth: LINE_WIDTH_PX, linePattern: [5, 1, 1, 1]},
    ],
    geometries: [
      {id: "box",       primitive: xeokit.base.constants.LinesPrimitive, positions: boxLines.positions,  indices: boxLines.indices},
      {id: "pentagram", primitive: xeokit.base.constants.LinesPrimitive, positions: pentagram.positions, indices: pentagram.indices},
      {id: "zpoly",     primitive: xeokit.base.constants.LinesPrimitive, positions: zPoly.positions,     indices: zPoly.indices},
      {id: "triangle",  primitive: xeokit.base.constants.LinesPrimitive, positions: triangle.positions,  indices: triangle.indices},
      {id: "plus",      primitive: xeokit.base.constants.LinesPrimitive, positions: plusSign.positions,  indices: plusSign.indices},
      {id: "octagon",   primitive: xeokit.base.constants.LinesPrimitive, positions: octagon.positions,   indices: octagon.indices},
    ],
    // 2-row × 3-column grid in the X-Z plane (Z is up). Y = 0.
    // Order top-to-bottom-left-to-right:
    //   Row 1 (Z = +3):  box (view fallback)  | pentagram (dashed) | Z (dotted)
    //   Row 2 (Z = -3):  triangle (dashDot)   | plus (dashDotDot)  | octagon (custom)
    meshes: [
      {id: "boxMesh",       geometryId: "box",       position: [-6,  0,  3], color: [0.10, 0.30, 0.85]},
      {id: "pentaMesh",     geometryId: "pentagram", position: [ 0,  0,  3], materialId: "pentagramMat"},
      {id: "zMesh",         geometryId: "zpoly",     position: [ 6,  0,  3], materialId: "zMat"},
      {id: "triangleMesh",  geometryId: "triangle",  position: [-6,  0, -3], materialId: "triangleMat"},
      {id: "plusMesh",      geometryId: "plus",      position: [ 0,  0, -3], materialId: "plusMat"},
      {id: "octagonMesh",   geometryId: "octagon",   position: [ 6,  0, -3], materialId: "octagonMat"},
    ],
    objects: [
      {id: "box-obj",      meshIds: ["boxMesh"]},
      {id: "penta-obj",    meshIds: ["pentaMesh"]},
      {id: "z-obj",        meshIds: ["zMesh"]},
      {id: "triangle-obj", meshIds: ["triangleMesh"]},
      {id: "plus-obj",     meshIds: ["plusMesh"]},
      {id: "octagon-obj",  meshIds: ["octagonMesh"]},
    ],
  }));

  const markerEl = document.getElementById("marker");
  const statusEl = document.getElementById("status");

  view.htmlElement.addEventListener("mousemove", (e) => {
    const result = renderer.pick(view, {
      canvasPos:    [e.offsetX, e.offsetY],
      snapToVertex: true,
      snapToEdge:   true,
      snapRadius:   SNAP_RADIUS_PX,
    });

    const value = result.ok ? result.value : null;
    const snappedCanvasPos = value ? value.snappedCanvasPos : undefined;
    if (!value || !snappedCanvasPos) {
      hideMarker();
      return;
    }

    const {snappedToVertex, snappedToEdge} = value;
    if (!snappedToVertex && !snappedToEdge) {
      hideMarker();
      return;
    }

    const mode  = snappedToVertex ? "vertex" : "edge";
    const label = snappedToVertex ? "Snap → Vertex" : "Snap → Edge";

    markerEl.style.display = "block";
    markerEl.style.left = `${snappedCanvasPos[0]}px`;
    markerEl.style.top  = `${snappedCanvasPos[1]}px`;
    markerEl.dataset.mode = mode;

    statusEl.textContent  = label;
    statusEl.dataset.mode = mode;
  });

  view.htmlElement.addEventListener("mouseleave", hideMarker);

  function hideMarker() {
    markerEl.style.display = "none";
    markerEl.dataset.mode = "none";
    statusEl.textContent = "No snap";
    statusEl.dataset.mode = "none";
  }

  // ── Info panel ──────────────────────────────────────────────
  const info = studio.openInfoPanel({
    id:    "spatial_snapping_thickLines",
    title: "Snap to thick lines",
    description:
      "<p>Six thick-line shapes — each with its own " +
      "<code>linePattern</code>. Move the cursor over any of them " +
      "and the marker snaps to the nearest vertex (red) or edge " +
      "(amber) within ~30 px. Snap ignores dash gaps so dashed " +
      "lines are still snappable along their full length.</p>" +
      "<p>Per-material override: pentagram dashed · Z dotted · " +
      "triangle dash-dot · plus dash-dot-dot · octagon " +
      "<code>[5,1,1,1]</code>. The <b>box</b> has no per-material " +
      "override and follows the view-level pattern below.</p>",
  });
  // View-level linePattern picker. Only affects the box (which
  // has no per-material override). The five other shapes keep
  // their own per-material patterns — that's the per-material
  // override path being demonstrated.
  info.addRadioGroup({
    label:    "Box line pattern",
    value:    view.linesMaterial.linePattern,
    options:  [
      {value: "solid",      label: "solid"},
      {value: "dashed",     label: "dashed"},
      {value: "dotted",     label: "dotted"},
      {value: "dashDot",    label: "dash-dot"},
      {value: "dashDotDot", label: "dash-dot-dot"},
    ],
    onChange: (v) => { view.linesMaterial.linePattern = v; },
  });

  studio.finished();
});


// ── Helpers ──────────────────────────────────────────────────

// Closed 5-pointed star polyline. Walking every-other vertex of a
// regular pentagon (step 2 mod 5) produces the classic pentagram
// path; closing the loop back to vertex 0 makes five segments
// where every endpoint is shared with a neighbour.
function buildPentagram(r) {
  const positions = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI / 5);
    positions.push(r * Math.cos(a), 0, r * Math.sin(a));
  }
  const indices = [];
  let cur = 0;
  for (let i = 0; i < 5; i++) {
    const next = (cur + 2) % 5;
    indices.push(cur, next);
    cur = next;
  }
  return {positions, indices};
}

// Open "Z" polyline — top bar, diagonal, bottom bar. Three
// segments, two interior joints, two free ends.
function buildZPolyline(half) {
  const positions = [
    -half,  0,  half,  // 0  top-left
     half,  0,  half,  // 1  top-right
    -half,  0, -half,  // 2  bottom-left
     half,  0, -half,  // 3  bottom-right
  ];
  const indices = [
    0, 1,   // top bar
    1, 2,   // diagonal
    2, 3,   // bottom bar
  ];
  return {positions, indices};
}

// Regular closed N-gon polyline drawn in the X-Z plane. n=3 is a
// triangle, n=8 is an octagon, etc. Indices share endpoints so
// every joint exercises the polyline detector.
function buildClosedNgon(n, r) {
  const positions = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI / n);
    positions.push(r * Math.cos(a), 0, r * Math.sin(a));
  }
  const indices = [];
  for (let i = 0; i < n; i++) {
    indices.push(i, (i + 1) % n);
  }
  return {positions, indices};
}

// Plus / cross sign — two crossing disjoint segments. No shared
// indices ⇒ all four endpoints are free ends. Useful for
// confirming that dash patterns lay down identically on
// disjoint and polyline geometry.
function buildPlusSign(half) {
  const positions = [
    -half, 0,   0,  // 0  left
     half, 0,   0,  // 1  right
       0,  0,-half, // 2  bottom
       0,  0, half, // 3  top
  ];
  const indices = [
    0, 1,  // horizontal
    2, 3,  // vertical
  ];
  return {positions, indices};
}


function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function mustOk(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
