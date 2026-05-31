// Slice the Duplex XGF model with a SectionPlane through its
// centre. No interactive gizmo — the plane is placed once at the
// AABB centroid with a +Z normal, then a slider in the intro card
// nudges its position along that normal.
//
// `capColor` is intentionally omitted; the renderer's stencil cap
// pass is gated on at least one active plane carrying a capColor,
// so with no capColor the clipped fragments fully discard and the
// cut surface stays open.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

  const { scene } = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [-16, -14, 10],
      look: [4, 4, 4],
      up:   [0, 0, 1],
    },
  });

  // ── Load Duplex XGF ──────────────────────────────────────────
  //
  // The basis remaps the model's local Y-up frame onto the
  // viewer's Z-up world (matching every other Duplex example),
  // so the building stands upright and a section-plane normal of
  // [0, 0, 1] cuts horizontally.
  const sceneModel = mustCreate(scene.createModel({
    id: "duplex",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 0, 1,
        0, 1, 0,
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1,
    },
  }));

  try {
    await studio.loadModel({
      id:     "duplex",
      src:    "../../models/Duplex/xgf/model.xgf",
      format: "xgf",
      sceneModel,
    });
  } catch (err) {
    sceneModel.destroy();
    console.error("Error loading XGF:", err);
    return;
  }

  // ── Place the section plane ─────────────────────────────────
  //
  // `studio.picking.collisionIndex` aggregates AABBs across every
  // loaded model — the same source `viewFit` reads from — so
  // it's a stable way to find the model's world-space centre
  // without poking at SceneModel internals.
  const aabb = studio.picking.collisionIndex.getSceneAABB() || [0, 0, 0, 0, 0, 0];
  const centreZ = (aabb[2] + aabb[5]) * 0.5;
  const centre  = [(aabb[0] + aabb[3]) * 0.5, (aabb[1] + aabb[4]) * 0.5, centreZ];

  const plane = mustCreate(view.createSectionPlane({
    id:     "slice",
    pos:    centre,
    dir:    [0, 0, 1],
    active: true,
  }));

  // ── Info panel ──────────────────────────────────────────────
  const info = studio.openInfoPanel({
    id:    "viewing_sectionPlane_duplex",
    title: "SectionPlane — Duplex (XGF)",
    description:
      "<p>Horizontal cut through the centre of the Duplex model. " +
      "Toggle the plane on/off and slide to move it along its normal.</p>",
  });
  info.addToggle({
    label:    "Section plane",
    value:    plane.active,
    onChange: (on) => { plane.active = on; },
  });
  // Slider value is a signed offset along the plane's normal.
  // The plane normal is constant ([0, 0, 1]) so the only thing
  // that changes is `plane.pos[2]`.
  info.addSlider({
    label:    "Offset (m)",
    min:      -5,
    max:      5,
    step:     0.05,
    value:    0,
    digits:   2,
    onChange: (t) => { plane.pos = [centre[0], centre[1], centreZ + t]; },
  });

  studio.finished();
});


function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
