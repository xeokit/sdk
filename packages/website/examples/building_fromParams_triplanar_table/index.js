// Import the xeokit SDK bundle. This bundle provides the demo helper
// together with the scene and rendering APIs used by this example.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// Create the demo helper. This helper initializes the shared rendering
// context and provides utilities for configuring and running the demo.
const studio = new xeokit.studio.Studio({});

studio
    .init()
    .then(() => {

      // Access the Scene created by the Studio. The Scene manages the
      // models and renderable content used by the example.
      const { scene } = studio;

      // Create a View with a perspective camera positioned to frame the
      // table model from a three-quarter angle that keeps the ground plane
      // around the legs in shot, so the textured surfaces and any cast
      // shadows are easy to read.
      studio.viewManager.createView({
        camera: {
          projection: "perspective",
          far: 1000000,
          eye:  [14, -14, 10],
          look: [0,  0,   3],
          up:   [0,  0,   1]
        }
      });

      // Build the procedural textures the materials below will sample
      // through the renderer's triplanar fallback. These are drawn into
      // off-screen canvases so the example needs no external image
      // assets — `SceneModel.createTexture` accepts an HTMLCanvasElement
      // directly.
      const woodCanvas   = makeWoodTexture(512);
      const marbleCanvas = makeMarbleTexture(512);

      // Create a SceneModel to hold the model geometry, meshes, and objects.
      const sceneModelResult = scene.createModel({
        id: "demoModel"
      });

      if (!sceneModelResult.ok) {
        return;
      }

      const sceneModel = sceneModelResult.value;

      // Register the canvases as SceneTextures. The renderer's per-batch
      // atlas uploads them once at attach time; the triplanar shader
      // variant samples the same atlas three times per fragment, blended
      // by world normal weights.
      sceneModel.createTexture({ id: "tex_wood",   image: woodCanvas });
      sceneModel.createTexture({ id: "tex_marble", image: marbleCanvas });

      // Materials reference the textures by id. `triplanarScale` controls
      // the world-units-per-repeat for each material — `0.6` means one
      // texture tile per ~0.6 scene units, so the legs (8-unit-tall boxes)
      // show roughly 13 grain repeats top-to-bottom.
      sceneModel.createMaterial({
        id: "WOOD",
        color: [1.0, 1.0, 1.0],
        roughness: 0.55,
        metallic: 0.0,
        colorTextureId: "tex_wood",
        triplanarScale: 0.6
      });
      sceneModel.createMaterial({
        id: "MARBLE",
        color: [1.0, 1.0, 1.0],
        roughness: 0.32,
        metallic: 0.0,
        colorTextureId: "tex_marble",
        triplanarScale: 1.2
      });

      // Populate the SceneModel from structured parameters. Geometry,
      // meshes, and objects are defined in a single step. The geometry
      // carries no UVs — the renderer detects this and routes the
      // material's textures through the triplanar shader variant, so
      // the boxes pick up their wood / marble look without any UV
      // unwrap or per-vertex tangent.
      const fromParamsResult = sceneModel.fromParams({
        geometries: [
          {
            id: "demoBoxGeometry",
            primitive: xeokit.base.constants.TrianglesPrimitive,
            positions: [
              1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
              -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
              -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
            ],
            // Define triangle indices for the six faces of the box.
            // Note: no `uvs:` field — UVs are intentionally omitted so the
            // triplanar fallback path engages on every mesh that
            // references this geometry.
            indices: [
              0, 1, 2, 0, 2, 3,
              4, 5, 6, 4, 6, 7,
              8, 9, 10, 8, 10, 11,
              12, 13, 14, 12, 14, 15,
              16, 17, 18, 16, 18, 19,
              20, 21, 22, 20, 22, 23
            ]
          }
        ],

        // Mesh instances of the shared box geometry. Transforms are
        // written for the SDK's default +Z-up coordinate system: legs are
        // tall along Z, the tabletop is flat in the X-Y plane, and the
        // model sits on the z = 0 ground plane.
        meshes: [
          {
            id: "redLeg-mesh",
            geometryId: "demoBoxGeometry",
            position: [-4, -4, 3],
            scale: [1, 1, 3],
            rotation: [0, 0, 0],
            materialId: "WOOD"
          },
          {
            id: "greenLeg-mesh",
            geometryId: "demoBoxGeometry",
            position: [4, -4, 3],
            scale: [1, 1, 3],
            rotation: [0, 0, 0],
            materialId: "WOOD"
          },
          {
            id: "blueLeg-mesh",
            geometryId: "demoBoxGeometry",
            position: [4, 4, 3],
            scale: [1, 1, 3],
            rotation: [0, 0, 0],
            materialId: "WOOD"
          },
          {
            id: "yellowLeg-mesh",
            geometryId: "demoBoxGeometry",
            position: [-4, 4, 3],
            scale: [1, 1, 3],
            rotation: [0, 0, 0],
            materialId: "WOOD"
          },
          {
            id: "tableTop-mesh",
            geometryId: "demoBoxGeometry",
            position: [0, 0, 6],
            scale: [6, 6, 0.5],
            rotation: [0, 0, 0],
            materialId: "MARBLE"
          }
        ],

        // Objects wrap the meshes as logical entities the View can
        // address (highlight, hide, pick, etc.).
        objects: [
          { id: "redLeg",         meshIds: ["redLeg-mesh"]    },
          { id: "greenLeg",       meshIds: ["greenLeg-mesh"]  },
          { id: "blueLeg",        meshIds: ["blueLeg-mesh"]   },
          { id: "yellowLeg",      meshIds: ["yellowLeg-mesh"] },
          { id: "purpleTableTop", meshIds: ["tableTop-mesh"]  }
        ]
      });

      if (!fromParamsResult.ok) {
        throw new Error("Unable to populate SceneModel from params: " + fromParamsResult.error);
      }

      studio.finished();
    });

// ────────────────────────────────────────────────────────────────────
// Procedural texture authoring
// ────────────────────────────────────────────────────────────────────

// Deterministic hash → [0, 1). Used so the procedural patterns below
// produce the same canvas every page-load.
function hash01(x) {
  x = (x | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 1000003) / 1000003;
}

// Light wood-grain albedo: warm tan base with parallel longitudinal
// stripes plus a few pore specks. Triplanar sampling makes the grain
// look continuous across each leg's three primary faces.
function makeWoodTexture(size) {
  const canvas = document.createElement("canvas");
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Grain runs along the canvas X axis. Slight Y wobble keeps the
      // stripes from reading as printed lines.
      const wobble = Math.sin(x * 0.06 + y * 0.005) * 4 + Math.sin(x * 0.013) * 6;
      const stripe = Math.sin((y + wobble) * 0.18);
      const noise  = hash01(x * 7919 + y * 6271) * 0.18 - 0.09;
      const tone   = 0.55 + stripe * 0.18 + noise;
      // Warm tan: slightly more red than green, much less blue.
      const r = Math.round(255 * Math.min(1, Math.max(0, tone * 0.95)));
      const g = Math.round(255 * Math.min(1, Math.max(0, tone * 0.72)));
      const b = Math.round(255 * Math.min(1, Math.max(0, tone * 0.45)));
      const i = (y * size + x) * 4;
      data[i]     = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Pale marble albedo: near-white base with a few dark veins authored as
// distorted contour lines through a simple noise field.
function makeMarbleTexture(size) {
  const canvas = document.createElement("canvas");
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Two octaves of value noise via lerped hash samples. The marble
      // veins are thresholded contour lines through that noise.
      const u = x / size;
      const v = y / size;
      const n1 = hash01(Math.floor(x * 0.04) * 131 + Math.floor(y * 0.04) * 197);
      const n2 = hash01(Math.floor(x * 0.13) * 311 + Math.floor(y * 0.13) * 251);
      const field = (n1 * 0.7 + n2 * 0.3) + Math.sin(u * 12 + v * 4) * 0.08;
      const vein = Math.abs(Math.sin(field * 22)) < 0.06 ? 0.65 : 1.0;
      const grit = (hash01(x * 2069 + y * 6151) - 0.5) * 0.04;
      const tone = Math.max(0, Math.min(1, 0.92 * vein + grit));
      // Cool off-white: slightly more blue than red, a touch of beige.
      const r = Math.round(255 * Math.min(1, tone * 0.97));
      const g = Math.round(255 * Math.min(1, tone * 0.96));
      const b = Math.round(255 * Math.min(1, tone * 0.92));
      const i = (y * size + x) * 4;
      data[i]     = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
