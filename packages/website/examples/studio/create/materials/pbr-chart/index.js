// Canonical PBR sphere chart.
//
// 7×7 grid of identical spheres sharing one base colour, each with a
// different (roughness, metallic) pair. Lit by the renderer's
// procedural-sky cubemap + directional sun so the same Cook-Torrance
// BRDF that runs in the cityscape demo is on display, isolated from
// the noise of textures, normals, and material variation. Useful as
// both a sanity test (does the BRDF look like the reference grid in
// every PBR paper?) and a tutorial.
//
// Axes:
//   - X (left → right)   : roughness from 0.04 (mirror-smooth) to 1.0
//                          (fully diffuse). Lower bound is the
//                          renderer's `PBR_MIN_ROUGHNESS` clamp; below
//                          that the GGX denominator collapses.
//   - Y (back → front)   : metallic from 0 (pure dielectric) to 1
//                          (pure metal). Mid values are the "0.5
//                          metallic" trap — physically nothing real
//                          sits there; included for completeness.
//
// Base colour is copper-ish so the metallic side of the grid shows
// the wavelength-tinted Fresnel reflection (chrome-mirror golds-back
// onto warm metal). Switch the `BASE_COLOR` constant to grey to see
// the response in pure luminance.
import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

const N = 7;                                   // grid is N×N spheres
const SPACING = 1.5;                            // metres between sphere centres
const SPHERE_R = 0.55;                          // sphere radius
const BASE_COLOR = [0.95, 0.64, 0.54];          // copper F0 — also the dielectric albedo

studio.init().then(() => {

  const { scene } = studio;

  const sceneModel = mustCreate(scene.createModel({
    id: "pbrChartModel",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 0, 1,
        0, 1, 0
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }));

  // Single shared sphere geometry. Per-vertex normals + UVs so every
  // mesh lands in the smooth-shaded UV-bearing batch and runs through
  // the full Cook-Torrance + IBL path. UVs aren't used here (no
  // textures bound on these materials), but their presence is what
  // routes the meshes into the variant the BRDF lives in.
  const sphere = mustBuild(xeokit.model.generation.buildGeometry.buildSphere({
    radius: 1,
    widthSegments: 32,
    heightSegments: 24
  }));
  sceneModel.createGeometry({
    id: "sphere",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: sphere.positions,
    normals: sphere.normals,
    uvs: sphere.uv,
    indices: sphere.indices
  });

  // Floor — a flat dark slab, large enough to ground the spheres and
  // catch directional shadows. The chart reads better against a
  // muted floor than over the default skybox.
  const box = mustBuild(xeokit.model.generation.buildGeometry.buildBox({
    xSize: 1, ySize: 1, zSize: 1
  }));
  sceneModel.createGeometry({
    id: "box",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: box.positions,
    normals: box.normals,
    uvs: box.uv,
    indices: box.indices
  });

  mustCreate(sceneModel.createMaterial({
    id: "FLOOR",
    color: [0.20, 0.21, 0.23],
    roughness: 0.92,
    metallic: 0.0
  }));

  const halfGrid = ((N - 1) * SPACING) * 0.5;
  const floorPad = SPACING * 1.5;
  const floorHalfW = halfGrid + floorPad;

  let nextId = 0;
  function placePart(geometryId, position, scale, materialId, rotation) {
    const meshId = `m${nextId}`;
    const objId  = `o${nextId++}`;
    sceneModel.createMesh({
      id: meshId,
      geometryId,
      matrix: xeokit.model.scene.buildMat4({ position, scale, rotation }),
      materialId
    });
    sceneModel.createObject({ id: objId, meshIds: [meshId] });
  }

  // Floor slab — top at z = 0.
  placePart("box",
    [0, 0, -0.05],
    [floorHalfW, floorHalfW, 0.05],
    "FLOOR");

  // ---------------------------------------------------------------------------
  // Sphere grid. One material per cell so the renderer can pack them
  // into the per-mesh attribute texture and the BRDF reads the right
  // (roughness, metallic) per fragment. Roughness is clamped to 0.04
  // so the lowest-mip prefiltered specular sample stays well-defined.
  // ---------------------------------------------------------------------------

  for (let mi = 0; mi < N; mi++) {       // metallic axis (back → front)
    for (let ri = 0; ri < N; ri++) {     // roughness axis (left → right)
      const roughness = Math.max(0.04, ri / (N - 1));
      const metallic  = mi / (N - 1);

      const matId = `pbr_${mi}_${ri}`;
      mustCreate(sceneModel.createMaterial({
        id: matId,
        color: BASE_COLOR,
        roughness,
        metallic
      }));

      const cx = (ri - (N - 1) * 0.5) * SPACING;
      const cy = (mi - (N - 1) * 0.5) * SPACING;
      placePart("sphere",
        [cx, cy, SPHERE_R],
        [SPHERE_R, SPHERE_R, SPHERE_R],
        matId);
    }
  }

  // ---------------------------------------------------------------------------
  // View — perspective camera framed on the chart, with SAO + cascaded
  // directional shadows + Layer-2 IBL. The IBL component drives the
  // procedural sky cubemap that the prefilter pipeline samples for
  // each sphere's specular reflection — that's what the metallic +
  // smooth corner is reflecting.
  // ---------------------------------------------------------------------------

  const view = studio.viewManager.createView({
    camera: {
      // Camera positioned slightly off-axis + above so all 49 spheres
      // are visible without the metallic/smooth corner being directly
      // edge-on (which would hide its specular hot-spot).
      eye:  [halfGrid * 0.4, -halfGrid * 2.1, halfGrid * 1.2],
      look: [0, 0, SPHERE_R * 1.2],
      up:   [0, 0, 1]
    },
    effects: {
      edges: {
        enabled: false
      },
      tonemap: {
        sRGBEncode: true
      }
    }
  });

  view.effects.sao.enabled = false;
  view.effects.sao.intensity = 0.10;
  view.effects.sao.kernelRadius = 40;

  view.effects.shadows.enabled = false;
  view.effects.shadows.intensity = 0.55;
  view.effects.shadows.cascadeCount = 3;
  view.effects.shadows.pcfKernelSize = 3;
  view.effects.shadows.resolution = 2048;
  // Sun comes from the upper-front-right so smooth metal spheres
  // (back row) catch a sharp specular hot-spot on their upper-right;
  // also ensures the chart casts a clean grid of shadows on the floor.
  view.effects.shadows.direction = [-0.45, -0.35, -0.85];

  view.lights.ibl.intensity = 0.1;
  view.lights.hemispheric.skyColor    = [0.62, 0.72, 0.86];
  view.lights.hemispheric.groundColor = [0.42, 0.36, 0.30];
  view.lights.hemispheric.worldUp = [0, 0, 1];

  // HDR studio environment — paints a Float32 RGBA equirect (sky/horizon/
  // ground gradient + a sun pegged at ~60 units), encodes it as a
  // Radiance .hdr buffer, and pushes it through the public HDR API.
  // The renderer uploads the result as RGBA16F so the bright sun
  // survives the prefilter and shows up as a real specular bloom on
  // the smooth metallic spheres in the back-left of the chart.
  const sunWorld = (() => {
    const sd = view.effects.shadows.direction;
    const sl = Math.hypot(sd[0], sd[1], sd[2]) || 1;
    return [-sd[0] / sl, -sd[1] / sl, -sd[2] / sl];
  })();
  const hdrPixels = xeokit.model.generation.paintEnvironments.paintSunSkyHDR(512, 256, { sunDirection: sunWorld });
  const hdrBuf = xeokit.model.generation.paintEnvironments.encodeRadianceHDR(hdrPixels, 512, 256);
  const hdrResult = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuf);
  if (!hdrResult.ok) console.warn("[SceneModel_build_pbr_chart]", hdrResult.error);

  view.effects.tonemap.mode = "aces";

  studio.openInfoPanelFromMeta();
  studio.finished();
});

function mustCreate(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function mustBuild(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

