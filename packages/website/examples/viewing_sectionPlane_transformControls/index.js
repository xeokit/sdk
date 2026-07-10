// SectionPlane driven by TransformControls.
//
// TransformControls can't bind to a SectionPlane directly — its
// TransformControlsTarget union accepts a SceneObject, a SceneMesh,
// or any object with a `getMatrix` / `setMatrix` pair. SectionPlane
// stores `pos` (a world-space point on the plane) and `dir` (the
// plane normal — the half-space the renderer discards), so we build
// a thin adapter that:
//
//   * exports a 4×4 matrix whose translation is `plane.pos` and
//     whose +Z column is `plane.dir` (with an arbitrary orthonormal
//     X / Y completing the frame);
//   * on every `setMatrix` write-back from the gizmo, copies the
//     translation column to `plane.pos` and the rotated +Z column
//     to `plane.dir`, so dragging translates the plane and rotating
//     re-aims its normal.
//
// This is the recommended pattern for any non-SceneObject state
// you want to drive with the gizmo.
//
// Model: Duplex, loaded direct from IFC. The IFCLoader walks
// the source file in one pass and populates both the SceneModel
// (geometry, including IfcSpace volumes — the room voids the
// XGF converter strips out by default) and the DataModel
// (semantic structure: types, names, relationships). Loading
// from IFC keeps the SceneObject ↔ DataObject id mapping
// intact, which the drawings panel's "Room labels" feature
// relies on.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene, data } = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [24.40, 23.70, 27.04],
      look: [4.39, 8.90, 2.54],
      up:   [-0.56, -0.41, 0.71],
    },
  });

  // ── Load Duplex (IFC) ───────────────────────────────────────
  //
  // Duplex is authored Y-up. The SceneModel basis declares that
  // source frame so the Scene's default Z-up basis rotates it upright
  // while keeping the SceneObject ↔ DataObject id mapping intact.
  const sceneModel = mustCreate(scene.createModel({
    id: "duplex",
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
  }));
  const dataModel = mustCreate(data.createModel({
    id: "duplex",
  }));

  try {
    const ifcLoader = new xeokit.formats.ifc.IFCLoader();
    const response = await fetch("../../models/Duplex/ifc/model.ifc");
    const fileData = await response.arrayBuffer();
    await ifcLoader.load({fileData, sceneModel, dataModel});
  } catch (err) {
    sceneModel.destroy();
    dataModel.destroy();
    console.error("Error loading IFC:", err);
    return;
  }

  // Place the plane at the centre of the loaded model, with its
  // normal pointing straight up — a horizontal slice through the
  // building. `studio.picking.collisionIndex` aggregates AABBs across
  // every loaded SceneModel; it's the same source `viewFit` uses.
  const aabb = studio.picking.collisionIndex.getSceneAABB() || [0, 0, 0, 0, 0, 0];
  const centre = [
    (aabb[0] + aabb[3]) * 0.5,
    (aabb[1] + aabb[4]) * 0.5,
    (aabb[2] + aabb[5]) * 0.5,
  ];

  // `capColor` is intentionally omitted — the example demonstrates
  // clean clip-and-discard slicing. With no plane carrying a
  // capColor, the renderer's stencil cap pass is skipped entirely
  // (RenderManager guards on `anyCap` across active planes), so
  // clipped fragments fully discard instead of being filled.
  const plane = mustCreate(view.createSectionPlane({
    id:     "slice",
    pos:    centre,
    dir:    [0, 0, 1],
    active: true,
  }));

  // ── Adapter: SectionPlane ↔ 4×4 matrix ─────────────────────
  //
  // Column-major layout (the form xeokit's math passes to
  // `setMatrix`):
  //
  //   [ X.x  X.y  X.z  0 ]   indices  0  1  2  3
  //   [ Y.x  Y.y  Y.z  0 ]            4  5  6  7
  //   [ Z.x  Z.y  Z.z  0 ]            8  9 10 11
  //   [ T.x  T.y  T.z  1 ]           12 13 14 15
  //
  // Z (column 2) is the plane normal. Translation (column 3) is
  // a point on the plane.
  const planeAdapter = {
    getMatrix() {
      const z = normalize(plane.dir.slice());
      // Pick any reference axis not parallel to z, then
      // Gram–Schmidt out an orthonormal X / Y.
      const ref = Math.abs(z[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const x   = normalize(cross(ref, z));
      const y   = cross(z, x);
      const p   = plane.pos;
      return new Float64Array([
        x[0], x[1], x[2], 0,
        y[0], y[1], y[2], 0,
        z[0], z[1], z[2], 0,
        p[0], p[1], p[2], 1,
      ]);
    },
    setMatrix(m) {
      const previousPos = plane.pos.slice();
      const previousDir = normalize(plane.dir.slice());
      // The +Z column is the gizmo's "up" after rotation — that's
      // our new plane normal. Renormalise to absorb any drift
      // from float math in the gizmo's snap path.
      const dir = normalize([m[8], m[9], m[10]], previousDir);
      const rawPos = [m[12], m[13], m[14]];
      const delta = [
        rawPos[0] - previousPos[0],
        rawPos[1] - previousPos[1],
        rawPos[2] - previousPos[2],
      ];
      const slide = dot(delta, dir);
      plane.dir = dir;
      plane.pos = [
        previousPos[0] + dir[0] * slide,
        previousPos[1] + dir[1] * slide,
        previousPos[2] + dir[2] * slide,
      ];
    },
  };

  // ── Hand the adapter to TransformControls ──────────────────
  const controls = studio.attachTransformControls(
    view,
    planeAdapter,
    "translate",   // start in translate; press R for rotate
  );
  applyPlaneControlMode(controls, "translate");

  // Keyboard mode-switch — same conventions as the
  // viewing_transformControls_demo example.
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if      (k === "g") applyPlaneControlMode(controls, "translate");
    else if (k === "r") applyPlaneControlMode(controls, "rotate");
    else if (k === "n") controls.setMode("none");
  });

  // ── Info panel ──────────────────────────────────────────────
  const info = studio.openInfoPanel({
    id:    "viewing_sectionPlane_transformControls",
    title: "SectionPlane × TransformControls",
    description:
      "<p>Drag the gizmo to slice the model. The gizmo's translation " +
      "becomes <code>plane.pos</code>; its rotated +Z axis becomes " +
      "<code>plane.dir</code>.</p>" +
      "<p><b>G</b> translate &nbsp; <b>R</b> rotate &nbsp; <b>N</b> hide gizmo</p>",
  });
  info.addToggle({
    label:    "Section plane",
    value:    plane.active,
    onChange: (on) => { plane.active = on; },
  });

  studio.finished();
});

function applyPlaneControlMode(controls, mode) {
  controls.setSpace("local");
  controls.setShowX(true);
  controls.setShowY(true);
  controls.setShowZ(true);
  controls.setMode(mode);
}

// ── tiny vec3 helpers ────────────────────────────────────────
function normalize(v, fallback = [0, 0, -1]) {
  const l = Math.hypot(v[0], v[1], v[2]);
  if (!Number.isFinite(l) || l < 1e-12) return fallback.slice();
  return [v[0] / l, v[1] / l, v[2] / l];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
