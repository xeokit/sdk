// AEC PBR Materials Chart.
//
// 4×4 grid of textured cube + sphere stacks demonstrating common
// building materials. Each cell pairs a cube with a smaller sphere on
// top so users can compare how the same material reads on flat-shaded
// faces vs. a curved surface (where the sphere's UV wrap shows the
// classic back-pole seam).
//   Row 1 (back, masonry):    Brick · Concrete · Limestone · Granite
//   Row 2 (finish):           Marble · Oak · Painted plaster · Asphalt
//   Row 3 (working metals):   Steel (polished) · Steel (brushed) ·
//                             Copper · Glass
//   Row 4 (front, mirror metals — IBL reflection showcase):
//                             Chrome · Gold · Aluminium · Brass
//
// Every material drives a full PBR set:
//   - colourTexture            (albedo, sRGB)
//   - normalsTexture           (tangent-space, derived from a height field)
//   - metallicRoughnessTexture (G = roughness, B = metallic, glTF convention)
//
// All three maps are painted procedurally into 256×256 HTMLCanvasElements
// at boot — no network fetches, no large binary assets. The renderer
// accepts a canvas directly as `imageData` (GPUMemoryBatch.ts:67), so
// we just hand the canvases over.
//
// The example uses fixed built-in view settings so the
// scene focuses on the material chart.

import {LinearEncoding, LinearFilter, TrianglesPrimitive, sRGBEncoding} from "@xeokit/sdk/base/constants";
import {buildBox, buildSphere} from "@xeokit/sdk/model/generation/buildGeometry";
import {encodeRadianceHDR, paintStudioHDR} from "@xeokit/sdk/model/generation/paintEnvironments";
import * as PaintMaterials from "@xeokit/sdk/model/generation/paintMaterials";
import {Scene, buildMat4} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {createExampleView, createModelNavigationPickAdapter, getRequestedRenderer} from "../../../utils/standaloneRuntime.js";
import {signalExampleLoaded, signalExampleLoadedOnNextRender} from "../../../utils/snapshotReady.js";

const TEX_SIZE = 256;
const CUBE_HALF = 0.55;     // half-extent — gives a 1.1m cube on a 1.85m grid
const SPHERE_R  = 0.40;     // sphere on top of each cube
const SPACING_X = 1.85;
const SPACING_Y = 1.85;

const COLS = 4;
const ROWS = 6;

// ---------------------------------------------------------------------
// Material catalogue. Each entry pairs a label with a paint function
// returning { color, normal, mr } HTMLCanvasElements, plus the static
// material parameters that the canvases don't encode (opacity / alpha
// mode / tint multiplier).
//
// `color` acts as a per-material multiplier on the texture sample.
// The diffuse Lambert term is `albedo / π`, so painted values that
// look right perceptually render dimmer than intended once shaded.
// We apply a `~π/2` boost to the diffuse-dominant materials to bring
// the on-screen result back toward the painter's intent. Metals are
// dominated by Fresnel specular (which uses the painted colour as F0
// when `metallic = 1`), so a small bump is enough; glass is mostly
// specular reflection through a transparent body and stays at unity.
// ---------------------------------------------------------------------
const DIFFUSE_TINT = [1.6, 1.6, 1.6];
const METAL_TINT   = [1.2, 1.2, 1.2];
const NEUTRAL_TINT = [1.0, 1.0, 1.0];
const SEALED_MASONRY_PARAMS = { color: DIFFUSE_TINT, clearcoat: 0.18, clearcoatRoughness: 0.42 };
const POLISHED_STONE_PARAMS = { color: DIFFUSE_TINT, clearcoat: 0.55, clearcoatRoughness: 0.18 };
const LACQUERED_FINISH_PARAMS = { color: DIFFUSE_TINT, clearcoat: 0.45, clearcoatRoughness: 0.16 };
const PROTECTIVE_METAL_COAT_PARAMS = { color: METAL_TINT, metallic: 1.0, roughness: 1.0, clearcoat: 0.35, clearcoatRoughness: 0.12 };
const GLASS_PARAMS = { color: NEUTRAL_TINT, opacity: 0.35, alphaMode: "BLEND", clearcoat: 1.0, clearcoatRoughness: 0.02 };

// Metals need explicit `metallic: 1.0, roughness: 1.0` SceneMaterial
// factors. The shader multiplies the painted MR-texture sample by
// these scalars (`vMaterial.x * mrRoughnessFactor`,
// `vMaterial.y * mrMetallicFactor`) — SceneMaterial's defaults are
// `metallic: 0.0`/`roughness: 0.6`, which would zero out the painted
// metallic and dampen roughness. With both factors pinned at 1.0 the
// MR texture drives the BRDF directly, while a light protective coat
// adds the tight secondary highlight common on polished architectural
// metal samples without replacing the coloured metal F0.
const METAL_PARAMS = PROTECTIVE_METAL_COAT_PARAMS;

const MATERIALS = [
  // Row 1 — masonry
  { id: "brick",       label: "Brick",        paint: PaintMaterials.paintBrick,     params: SEALED_MASONRY_PARAMS },
  { id: "concrete",    label: "Concrete",     paint: PaintMaterials.paintConcrete,  params: SEALED_MASONRY_PARAMS },
  { id: "limestone",   label: "Limestone",    paint: PaintMaterials.paintLimestone, params: SEALED_MASONRY_PARAMS },
  { id: "granite",     label: "Granite",      paint: PaintMaterials.paintGranite,   params: POLISHED_STONE_PARAMS },
  // Row 2 — interior finish
  { id: "marble",      label: "Marble",       paint: PaintMaterials.paintMarble,    params: POLISHED_STONE_PARAMS },
  { id: "oak",         label: "Oak",          paint: PaintMaterials.paintOak,       params: LACQUERED_FINISH_PARAMS },
  { id: "plaster",     label: "Plaster",      paint: PaintMaterials.paintPlaster,   params: LACQUERED_FINISH_PARAMS },
  { id: "asphalt",     label: "Asphalt",      paint: PaintMaterials.paintAsphalt,   params: { color: DIFFUSE_TINT, clearcoat: 0.08, clearcoatRoughness: 0.55 } },
  // Row 3 — working metals + glass
  { id: "steel_pol",   label: "Steel pol.",   paint: PaintMaterials.paintPolSteel,  params: METAL_PARAMS },
  { id: "steel_brush", label: "Steel brush.", paint: PaintMaterials.paintBrushSteel,params: METAL_PARAMS },
  { id: "copper",      label: "Copper",       paint: PaintMaterials.paintCopper,    params: METAL_PARAMS },
  { id: "glass",       label: "Glass",        paint: PaintMaterials.paintGlass,
    params: GLASS_PARAMS },
  // Row 4 — mirror metals. Roughness pinned low so the IBL studio
  // environment reflects clearly on the spheres' curved surfaces;
  // each picks a different tint so you can see chromatic Fresnel
  // shifts (bright F0 reflections coloured by the metal's albedo).
  { id: "chrome",      label: "Chrome",       paint: PaintMaterials.paintChrome,    params: METAL_PARAMS },
  { id: "gold",        label: "Gold",         paint: PaintMaterials.paintGold,      params: METAL_PARAMS },
  { id: "aluminium",   label: "Aluminium",    paint: PaintMaterials.paintAluminium, params: METAL_PARAMS },
  { id: "brass",       label: "Brass",        paint: PaintMaterials.paintBrass,     params: METAL_PARAMS },
  // Row 5 — additional reflective metals. Silver pushes the F0 ceiling
  // (most reflective natural metal); platinum + iron are cooler-toned
  // mirror finishes for comparison; titanium sits at a higher roughness
  // to anchor the row against the chrome end of the spectrum.
  { id: "silver",      label: "Silver",       paint: PaintMaterials.paintSilver,    params: METAL_PARAMS },
  { id: "platinum",    label: "Platinum",     paint: PaintMaterials.paintPlatinum,  params: METAL_PARAMS },
  { id: "titanium",    label: "Titanium",     paint: PaintMaterials.paintTitanium,  params: METAL_PARAMS },
  { id: "iron",        label: "Iron",         paint: PaintMaterials.paintIron,      params: METAL_PARAMS },
  // Row 6 — weathered metal. Rust is a dielectric oxide, so the
  // painter drops metallic to 0 and pushes roughness toward 1 inside
  // the rusted patches — colour, normal and MR all shift in lockstep
  // off a shared fBm mask, so the discoloration reads as physically
  // corroded steel rather than a tinted painted finish.
  { id: "rusty",       label: "Rusty steel",  paint: PaintMaterials.paintRustyMetal, params: METAL_PARAMS }
];

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
const canvas = mustElement<HTMLCanvasElement>("demoCanvas");
const status = document.getElementById("status");

main().catch((error) => {
  reportError(error instanceof Error ? error.message : String(error));
});

async function main() {
  const scene = new Scene({logging: true});
  const viewer = new Viewer({scene, logging: true});

  // ── Scene model ──────────────────────────────────────────────────

  const sceneModel = mustCreate(scene.createModel({
    id: "pbrMaterialsChart",
    coordinateSystem: {
      // Y-axis-as-up scene-local basis swapped to render Z-up so the
      // floor lies in the XY plane and the camera's "up" stays [0,0,1].
      basis: [1, 0, 0,  0, 0, 1,  0, 1, 0],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }));

  // ── Geometry ─────────────────────────────────────────────────────
  //
  // Every material reuses one unit cube + one unit sphere (radius 1).
  // The cube is flat-shaded with a fresh [0..1]² UV per face (no UV-
  // wrap seam); the sphere has per-vertex normals + UVs for the
  // smooth-shaded BRDF path. The same cube doubles as the floor slab.

  const sphere = mustBuild(buildSphere({
    radius: 1, widthSegments: 64, heightSegments: 40
  }));

  sceneModel.createGeometry({
    id: "sphere",
    primitive: TrianglesPrimitive,
    positions: sphere.positions,
    normals:   sphere.normals,
    uvs:       sphere.uv,
    indices:   sphere.indices
  });

  const box = mustBuild(buildBox({
    xSize: 1, ySize: 1, zSize: 1
  }));

  sceneModel.createGeometry({
    id: "box",
    primitive: TrianglesPrimitive,
    positions: box.positions,
    normals:   box.normals,
    uvs:       box.uv,
    indices:   box.indices
  });

  // ── Layout ───────────────────────────────────────────────────────

  const halfX      = ((COLS - 1) * SPACING_X) * 0.5;
  const halfY      = ((ROWS - 1) * SPACING_Y) * 0.5;
  const floorPad   = SPACING_X * 1.1;
  const floorHalfX = halfX + floorPad;
  const floorHalfY = halfY + floorPad;

  // ── Mesh + object helpers ────────────────────────────────────────
  //
  // Close over `sceneModel` and the running id counters, so the
  // calls below can just pass positional args.

  let nextMeshId = 0;
  let nextObjId  = 0;

  function makeMesh(geometryId, position, scale, materialId, rotation) {
    const meshId = `m${nextMeshId++}`;
    sceneModel.createMesh({
      id: meshId,
      geometryId,
      matrix: buildMat4({ position, scale, rotation }),
      materialId
    });
    return meshId;
  }

  function makeObject(meshIds) {
    sceneModel.createObject({ id: `o${nextObjId++}`, meshIds });
  }

  // ── Floor ────────────────────────────────────────────────────────
  //
  // Flat dark slab so shadows + SAO have something to land on. Top
  // face sits at z = 0.

  mustCreate(sceneModel.createMaterial({
    id: "FLOOR",
    color: [0.20, 0.21, 0.23],
    roughness: 0.92,
    metallic: 0.0
  }));

  makeObject([
    makeMesh("box", [0, 0, -0.05], [floorHalfX, floorHalfY, 0.05], "FLOOR")
  ]);

  // ── Per-material paint + bind + place ────────────────────────────

  for (let i = 0; i < MATERIALS.length; i++) {
    const def = MATERIALS[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const cx = (col - (COLS - 1) * 0.5) * SPACING_X;

    // Row 0 is the masonry row at the back of the scene (negative Y);
    // Row 2 is metals + glass in front.
    const cy = ((ROWS - 1) * 0.5 - row) * SPACING_Y;

    // Paint the PBR triple.
    const maps = def.paint(TEX_SIZE);

    // Upload each map. sRGB encoding for the colour map only — normal
    // and metallic-roughness are linear-data textures. Mipmaps keep the
    // high-frequency procedural paints stable when the chart is viewed
    // obliquely or from thumbnail distance.
    const colorTexId  = `tex_${def.id}_color`;
    const normalTexId = `tex_${def.id}_normal`;
    const mrTexId     = `tex_${def.id}_mr`;

    sceneModel.createTexture({
      id: colorTexId,
      imageData: maps.color,
      encoding: sRGBEncoding,
      minFilter: LinearFilter,
      flipY: false,
      mipmap: true
    });

    sceneModel.createTexture({
      id: normalTexId,
      imageData: maps.normal,
      encoding: LinearEncoding,
      minFilter: LinearFilter,
      flipY: false,
      mipmap: true
    });

    sceneModel.createTexture({
      id: mrTexId,
      imageData: maps.mr,
      encoding: LinearEncoding,
      minFilter: LinearFilter,
      flipY: false,
      mipmap: true
    });

    // Bind the maps into a SceneMaterial.
    const matId = `mat_${def.id}`;

    mustCreate(sceneModel.createMaterial({
      id: matId,
      colorTextureId:             colorTexId,
      normalsTextureId:           normalTexId,
      metallicRoughnessTextureId: mrTexId,
      ...def.params
    }));

    // Place the cube + sphere stack. Cube sits flush on the floor;
    // sphere sits on top of the cube (sphere centre = cube top +
    // sphere radius). Both share one SceneObject so the pair is a
    // single picking / data-graph entity.
    const cubeMeshId = makeMesh("box",
      [cx, cy, CUBE_HALF],
      [CUBE_HALF, CUBE_HALF, CUBE_HALF],
      matId);

    const sphereMeshId = makeMesh("sphere",
      [cx, cy, 2 * CUBE_HALF + SPHERE_R],
      [SPHERE_R, SPHERE_R, SPHERE_R],
      matId);

    makeObject([cubeMeshId, sphereMeshId]);
  }

  // ── View, lighting and effects ───────────────────────────────────

  const view = createExampleView(viewer, {
    id: "aecMaterialsChartView",
    htmlElement: canvas,
    camera: {
      // Stack reaches z ≈ 2 * CUBE_HALF + 2 * SPHERE_R; pull the eye
      // back and up so the material grid fills the tutorial thumbnail
      // without clipping the front or rear rows.
      eye:  [-halfX * 0.65, halfY * 2.1, 4.4],
      look: [0, -0.6, CUBE_HALF + SPHERE_R * 0.35],
      up:   [0, 0, 1]
    },
    effects: {
      edges: {
        enabled: false
      },
      tonemap: {
        sRGBEncode: true
      }
    },
    lights: {
      ibl: {
        enabled: true,
        intensity: 0.58
      },
      hemispheric: {
        enabled: true,
        intensity: 0.08,
        skyColor: [0.62, 0.72, 0.86],
        groundColor: [0.42, 0.36, 0.30],
        worldUp: [0, 0, 1]
      }
    }
  });

  const renderer = await createRenderer(viewer);
  renderer.events.onError.subscribe((_renderer, error) => {
    reportError(error.error);
  });
  mustCreate(renderer.setInfiniteGridEnabled(true));

  const picker = new RoutingPickStrategy(scene, renderer);
  new ModelNavigationController(view, {
    pick: createModelNavigationPickAdapter(view, picker),
    followPointer: true,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false,
    keyboardDollyRate: 10,
    keyboardPanRate: 4,
    mouseWheelDollyRate: 70,
    touchDollyRate: 0.16
  });

  // ── IBL environment ──────────────────────────────────────────────
  //
  // Drive IBL from a procedural equirectangular studio environment.
  // The HDR variant emits Float32 RGBA so the sun + softbox cores
  // exceed 1.0 and survive the prefilter as bright specular peaks on
  // the smooth metal spheres (chrome / gold / aluminium / brass) —
  // the LDR sibling clamps those cores at 1.0 so reflections wash
  // out into soft blobs after blur.
  const hdrPixels = paintStudioHDR(1024, 512);
  const hdrBuf    = encodeRadianceHDR(hdrPixels, 1024, 512);
  view.lights.ibl.setEnvironmentHDRBuffer(hdrBuf);

  renderer.events.onViewRendered.subscribe(() => {
    if (status) {
      status.dataset.state = "ok";
      status.textContent = "AEC PBR materials: HDR IBL, tonemap, and grid.";
    }
  });

  signalExampleLoadedOnNextRender(renderer, view);

  window.addEventListener("resize", () => {
  });

  (window as any).aecMaterialsChartDemo = {
    scene,
    viewer,
    view,
    renderer,
    sceneModel
  };
}

function mustCreate(r) {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

function mustBuild(r) {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

async function createRenderer(viewer) {
  if (getRequestedRenderer() === "webgl") {
    return new WebGLRenderer({viewer, logging: true});
  }
  return mustCreate(await WebGPURenderer.create({viewer}));
}

function mustElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
}

function reportError(message: string) {
  if (status) {
    status.dataset.state = "error";
    status.textContent = `Init failed: ${message}`;
  }
  signalExampleLoaded();
  console.error("[create/materials/aec-chart]", message);
}
