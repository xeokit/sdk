// View — section planes.
//
// Two section planes attached to a View, controllable via the
// intro card. The renderer packs every active plane into a
// uniform vec4 bank (vec4 = normal.xyz, -dot(normal, pos)) and
// the fragment shader discards any fragment whose dot product
// against the bank exceeds zero. The shader is compiled once
// with a fixed MAX_SECTION_PLANES = 8; creating, destroying,
// or toggling planes at runtime never recompiles a program.
//
// The scene is the same sphere-on-cube layout used by the
// hatch demo, so you can see the planes cutting through both
// curved and flat surfaces.

import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const {scene} = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [12, -28, 16],
      look: [0,   0,  2],
      up:   [0,   0,  1],
    },
  });


  // ── Scene ──
  //
  // Five sphere-on-cube pairs along the X axis. One shared
  // PBR-ish material so the row reads as one group of objects.
  const sphere = mustOk(xeokit.model.generation.buildGeometry.buildSphere({
    radius: 1, widthSegments: 32, heightSegments: 24,
  }));

  const sceneModel = mustCreate(scene.createModel({id: "sectioned"}));

  const meshes = [];
  const objects = [];
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 5;
    meshes.push({
      id: `box_m${i}`,
      geometryId: "box",
      position: [x, 0, 0],
      scale:    [2, 2, 2],
      materialId: "matBox",
    });
    meshes.push({
      id: `sphere_m${i}`,
      geometryId: "sphere",
      position: [x, 0, 3.2],
      scale:    [1.2, 1.2, 1.2],
      materialId: "matSphere",
    });
    objects.push({id: `obj_box_${i}`,    meshIds: [`box_m${i}`]});
    objects.push({id: `obj_sphere_${i}`, meshIds: [`sphere_m${i}`]});
  }

  mustCreate(sceneModel.fromParams({
    materials: [
      // Hatched box material — orthogonal crosshatch (horizontal +
      // vertical) in world space, reading as a coarse concrete /
      // masonry fill. Two families at 0° and 90°; the renderer
      // overlays both ink colours additively in the FS.
      {
        id: "matBox",
        color: [0.55, 0.58, 0.62],
        roughness: 0.65,
        metallic: 0.0,
        hatchPattern: {
          families: [
            {angle: 0,  spacing: 0.30, lineWidth: 0.025},
            {angle: 90, spacing: 0.30, lineWidth: 0.025},
          ],
          color: [0.18, 0.20, 0.22],
          space: "world",
        },
      },
      // Hatched sphere material — ANSI31 (cast iron diagonal)
      // in world space so cuts through the spheres show the
      // hatch on the cap surface at a consistent world pitch.
      {
        id: "matSphere",
        color: [0.75, 0.55, 0.30],
        roughness: 0.35,
        metallic: 0.0,
        hatchPattern: {
          families: [{angle: 45, spacing: 0.18, lineWidth: 0.02}],
          color: [0.08, 0.05, 0.02],
          space: "world",
        },
      },
    ],
    geometries: [
      {
        id: "box",
        primitive: xeokit.base.constants.TrianglesPrimitive,
        positions: [
           1,  1,  1,  -1,  1,  1,  -1, -1,  1,   1, -1,  1,
           1,  1,  1,   1, -1,  1,   1, -1, -1,   1,  1, -1,
           1,  1,  1,   1,  1, -1,  -1,  1, -1,  -1,  1,  1,
          -1,  1,  1,  -1,  1, -1,  -1, -1, -1,  -1, -1,  1,
          -1, -1, -1,   1, -1, -1,   1, -1,  1,  -1, -1,  1,
           1, -1, -1,  -1, -1, -1,  -1,  1, -1,   1,  1, -1,
        ],
        normals: [
          0, 0, 1,    0, 0, 1,    0, 0, 1,    0, 0, 1,
          1, 0, 0,    1, 0, 0,    1, 0, 0,    1, 0, 0,
          0, 1, 0,    0, 1, 0,    0, 1, 0,    0, 1, 0,
         -1, 0, 0,   -1, 0, 0,   -1, 0, 0,   -1, 0, 0,
          0,-1, 0,    0,-1, 0,    0,-1, 0,    0,-1, 0,
          0, 0,-1,    0, 0,-1,    0, 0,-1,    0, 0,-1,
        ],
        indices: [
          0, 1, 2,    0, 2, 3,
          4, 5, 6,    4, 6, 7,
          8, 9, 10,   8, 10, 11,
          12, 13, 14, 12, 14, 15,
          16, 17, 18, 16, 18, 19,
          20, 21, 22, 20, 22, 23,
        ],
      },
      {
        id: "sphere",
        primitive: xeokit.base.constants.TrianglesPrimitive,
        positions: sphere.positions,
        normals:   sphere.normals,
        indices:   sphere.indices,
      },
    ],
    meshes,
    objects,
  }));

  // ── Section planes ──
  //
  // Plane A: horizontal cut at z = 1.5. Plane B: 45° diagonal
  // through the origin in the XY plane. Both carry a capColor;
  // the renderer reads it only when the cap effect is on (see
  // the Caps toggle below). With the effect off, capColor is
  // ignored and every clipped fragment discards — clean cuts.
  const planeAResult = view.createSectionPlane({
    id: "planeA",
    pos: [0, 0, 1.5],
    dir: [0, 0, 1],
    active:   true,
    capColor: [0.32, 0.34, 0.38],
  });
  const planeBResult = view.createSectionPlane({
    id: "planeB",
    pos: [0, 0, 0],
    dir: [Math.SQRT1_2, Math.SQRT1_2, 0],   // 45° diagonal in XY
    active:   false,
    capColor: [0.38, 0.30, 0.22],
  });
  if (!planeAResult.ok) throw new Error(planeAResult.error);
  if (!planeBResult.ok) throw new Error(planeBResult.error);
  const planeA = planeAResult.value;
  const planeB = planeBResult.value;

  // ── Info panel ──────────────────────────────────────────────
  const info = studio.openInfoPanel({
    id:    "studio/view/section-planes/intro",
    title: "Section planes — intro",
    description:
      "<p>A scene of sphere-on-cube pairs sliced by two section " +
      "planes. The <b>Caps</b> toggle flips " +
      "<code>view.effects.sectionPlaneCaps</code> on and off — the " +
      "cap shading is a stencil-based pass that paints each plane's " +
      "<code>capColor</code> only where the plane physically crosses " +
      "the model.</p>" +
      "<p>The <b>Centre sphere</b> toggle flips " +
      "<code>ViewObject.clippable</code> on the middle sphere — when " +
      "off, that object ignores every active section plane.</p>",
  });

  bindPlane("Horizontal", planeA, [0, 0, 1],                    1.5);
  bindPlane("Diagonal",   planeB, [Math.SQRT1_2, Math.SQRT1_2, 0], 0);

  // Clippable toggle on the centre sphere — demonstrates that
  // setting ViewObject.clippable = false makes that object
  // ignore every active section plane.
  const centreSphere = view.objects["obj_sphere_2"];
  if (centreSphere) {
    info.addToggle({
      label:    "Centre sphere clippable",
      value:    centreSphere.clippable,
      onChange: (on) => { centreSphere.clippable = on; },
    });
  }

    // Caps toggle - effect state lives in view.effects.
  const caps = view.effects.sectionPlaneCaps;
  info.addToggle({
    label:    "Caps",
    value:    caps.applied,
    onChange: (on) => { caps.enabled = on; },
  });

  function bindPlane(label, plane, normal, initialOffset) {
    info.addToggle({
      label:    `${label} plane`,
      value:    plane.active,
      onChange: (on) => { plane.active = on; },
    });
    info.addSlider({
      label:    `${label} offset`,
      min:      label === "Horizontal" ? -3 : -6,
      max:      label === "Horizontal" ?  3 :  6,
      step:     0.05,
      value:    initialOffset,
      digits:   2,
      onChange: (t) => {
        // Slider value is the signed offset along the plane's
        // normal. Multiply by the unit normal to get the
        // world-space point the plane passes through.
        plane.pos = [normal[0] * t, normal[1] * t, normal[2] * t];
      },
    });
  }

  studio.finished();
});


function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function mustOk(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
