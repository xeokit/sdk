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
// The effects panel exposes the standard renderer knobs (IBL, sun +
// cascaded shadows, SAO, bloom, FXAA, ACES tonemap) plus a render-mode
// preset picker so users can flip between Navigation / Detailed /
// Realistic and watch the effect stack respond via the `renderModes`
// gating each component now carries.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

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

// Metals need explicit `metallic: 1.0, roughness: 1.0` SceneMaterial
// factors. The shader multiplies the painted MR-texture sample by
// these scalars (`vMaterial.x * mrRoughnessFactor`,
// `vMaterial.y * mrMetallicFactor`) — SceneMaterial's defaults are
// `metallic: 0.0`/`roughness: 0.6`, which would zero out the painted
// metallic and dampen roughness. With both factors pinned at 1.0 the
// MR texture drives the BRDF directly, so the metals actually look
// metallic instead of plastic.
const METAL_PARAMS = { color: METAL_TINT, metallic: 1.0, roughness: 1.0 };

const MATERIALS = [
  // Row 1 — masonry
  { id: "brick",       label: "Brick",        paint: xeokit.model.procgen.paintMaterials.paintBrick,     params: { color: DIFFUSE_TINT } },
  { id: "concrete",    label: "Concrete",     paint: xeokit.model.procgen.paintMaterials.paintConcrete,  params: { color: DIFFUSE_TINT } },
  { id: "limestone",   label: "Limestone",    paint: xeokit.model.procgen.paintMaterials.paintLimestone, params: { color: DIFFUSE_TINT } },
  { id: "granite",     label: "Granite",      paint: xeokit.model.procgen.paintMaterials.paintGranite,   params: { color: DIFFUSE_TINT } },
  // Row 2 — interior finish
  { id: "marble",      label: "Marble",       paint: xeokit.model.procgen.paintMaterials.paintMarble,    params: { color: DIFFUSE_TINT } },
  { id: "oak",         label: "Oak",          paint: xeokit.model.procgen.paintMaterials.paintOak,       params: { color: DIFFUSE_TINT } },
  { id: "plaster",     label: "Plaster",      paint: xeokit.model.procgen.paintMaterials.paintPlaster,   params: { color: DIFFUSE_TINT } },
  { id: "asphalt",     label: "Asphalt",      paint: xeokit.model.procgen.paintMaterials.paintAsphalt,   params: { color: DIFFUSE_TINT } },
  // Row 3 — working metals + glass
  { id: "steel_pol",   label: "Steel pol.",   paint: xeokit.model.procgen.paintMaterials.paintPolSteel,  params: METAL_PARAMS },
  { id: "steel_brush", label: "Steel brush.", paint: xeokit.model.procgen.paintMaterials.paintBrushSteel,params: METAL_PARAMS },
  { id: "copper",      label: "Copper",       paint: xeokit.model.procgen.paintMaterials.paintCopper,    params: METAL_PARAMS },
  { id: "glass",       label: "Glass",        paint: xeokit.model.procgen.paintMaterials.paintGlass,
    params: { color: NEUTRAL_TINT, opacity: 0.35, alphaMode: "BLEND" } },
  // Row 4 — mirror metals. Roughness pinned low so the IBL studio
  // environment reflects clearly on the spheres' curved surfaces;
  // each picks a different tint so you can see chromatic Fresnel
  // shifts (bright F0 reflections coloured by the metal's albedo).
  { id: "chrome",      label: "Chrome",       paint: xeokit.model.procgen.paintMaterials.paintChrome,    params: METAL_PARAMS },
  { id: "gold",        label: "Gold",         paint: xeokit.model.procgen.paintMaterials.paintGold,      params: METAL_PARAMS },
  { id: "aluminium",   label: "Aluminium",    paint: xeokit.model.procgen.paintMaterials.paintAluminium, params: METAL_PARAMS },
  { id: "brass",       label: "Brass",        paint: xeokit.model.procgen.paintMaterials.paintBrass,     params: METAL_PARAMS },
  // Row 5 — additional reflective metals. Silver pushes the F0 ceiling
  // (most reflective natural metal); platinum + iron are cooler-toned
  // mirror finishes for comparison; titanium sits at a higher roughness
  // to anchor the row against the chrome end of the spectrum.
  { id: "silver",      label: "Silver",       paint: xeokit.model.procgen.paintMaterials.paintSilver,    params: METAL_PARAMS },
  { id: "platinum",    label: "Platinum",     paint: xeokit.model.procgen.paintMaterials.paintPlatinum,  params: METAL_PARAMS },
  { id: "titanium",    label: "Titanium",     paint: xeokit.model.procgen.paintMaterials.paintTitanium,  params: METAL_PARAMS },
  { id: "iron",        label: "Iron",         paint: xeokit.model.procgen.paintMaterials.paintIron,      params: METAL_PARAMS },
  // Row 6 — weathered metal. Rust is a dielectric oxide, so the
  // painter drops metallic to 0 and pushes roughness toward 1 inside
  // the rusted patches — colour, normal and MR all shift in lockstep
  // off a shared fBm mask, so the discoloration reads as physically
  // corroded steel rather than a tinted painted finish.
  { id: "rusty",       label: "Rusty steel",  paint: xeokit.model.procgen.paintMaterials.paintRustyMetal, params: METAL_PARAMS }
];

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
const studio = new xeokit.studio.Studio({});

studio.init().then(() => {
  const status = document.getElementById("status");

  try {
    buildScene();
    status.style.display = "none";
    document.getElementById("panel").style.display = "block";
    studio.openInfoPanelFromMeta();
    studio.finished();
  } catch (err) {
    status.textContent = `Init failed: ${err.message || err}`;
    console.error(err);
  }
});

function buildScene() {
  const { scene } = studio;

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

  const sphere = mustBuild(xeokit.model.procgen.buildGeometry.buildSphere({
    radius: 1, widthSegments: 64, heightSegments: 40
  }));

  sceneModel.createGeometry({
    id: "sphere",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: sphere.positions,
    normals:   sphere.normals,
    indices:   sphere.indices
  });

  const box = mustBuild(xeokit.model.procgen.buildGeometry.buildBox({
    xSize: 1, ySize: 1, zSize: 1
  }));

  sceneModel.createGeometry({
    id: "box",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: box.positions,
    normals:   box.normals,
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
      matrix: xeokit.model.scene.buildMat4({ position, scale, rotation }),
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
    // and metallic-roughness are linear-data textures. `LinearFilter`
    // disables mipmapping so the GPU never picks the wrong mip across
    // the sphere's U=0/U=1 seam meridian — that mip-derivative jump
    // was the dominant source of the visible vertical streak on the
    // textured spheres.
    const colorTexId  = `tex_${def.id}_color`;
    const normalTexId = `tex_${def.id}_normal`;
    const mrTexId     = `tex_${def.id}_mr`;

    sceneModel.createTexture({
      id: colorTexId,
      imageData: maps.color,
      encoding: xeokit.base.constants.sRGBEncoding,
      minFilter: xeokit.base.constants.LinearFilter,
      flipY: false,
      mipmap: true
    });

    sceneModel.createTexture({
      id: normalTexId,
      imageData: maps.normal,
      encoding: xeokit.base.constants.LinearEncoding,
      minFilter: xeokit.base.constants.LinearFilter,
      flipY: false,
      mipmap: true
    });

    sceneModel.createTexture({
      id: mrTexId,
      imageData: maps.mr,
      encoding: xeokit.base.constants.LinearEncoding,
      minFilter: xeokit.base.constants.LinearFilter,
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

  const view = studio.viewManager.createView({
    camera: {
      // Stack reaches z ≈ 2 * CUBE_HALF + 2 * SPHERE_R; pull the eye
      // back and up so all 16 cube/sphere pairs sit comfortably in
      // frame. Look-at lands roughly at the cube/sphere joint.
      eye:  [-halfX * 0.9, halfY * 3.0, 6.0],
      look: [0, 0, CUBE_HALF + SPHERE_R * 0.4],
      up:   [0, 0, 1]
    },
    renderMode: xeokit.base.constants.RealisticRender,
    effects: {
      tonemap: {
        sRGBEncode: true
      }
    }
  });

  // ── IBL environment ──────────────────────────────────────────────
  //
  // Drive IBL from a procedural equirectangular studio environment.
  // The HDR variant emits Float32 RGBA so the sun + softbox cores
  // exceed 1.0 and survive the prefilter as bright specular peaks on
  // the smooth metal spheres (chrome / gold / aluminium / brass) —
  // the LDR sibling clamps those cores at 1.0 so reflections wash
  // out into soft blobs after blur.
  const hdrPixels = xeokit.model.procgen.paintEnvironments.paintStudioHDR(1024, 512);
  const hdrBuf    = xeokit.model.procgen.paintEnvironments.encodeRadianceHDR(hdrPixels, 1024, 512);
  view.lights.ibl.setEnvironmentHDRBuffer(hdrBuf);

  wireUpPanel(view);
}

// ---------------------------------------------------------------------
// Panel wiring
//
// The demo deliberately doesn't override any effect parameters — every
// SAO / Shadows / IBL / Bloom / Tonemap / AntiAliasing / Edges value
// is left at the SDK constructor default. The panel's initial slider
// positions and select states (set in index.html) mirror those
// defaults, so the panel's visible state agrees with what the
// renderer is actually doing.
// ---------------------------------------------------------------------

function renderModeFor(name) {
  const c = xeokit.base.constants;
  switch (name) {
    case "navigation": return c.NavigationRender;
    case "realistic":  return c.RealisticRender;
    case "detailed":
    default:           return c.DetailedRender;
  }
}

// Reverse of renderModeFor — map a render-mode constant back to the
// pulldown's option value, so the panel can sync itself to whatever
// the View's renderMode happens to be at boot.
function nameForRenderMode(mode) {
  const c = xeokit.base.constants;
  switch (mode) {
    case c.NavigationRender: return "navigation";
    case c.RealisticRender:  return "realistic";
    case c.DetailedRender:
    default:                 return "detailed";
  }
}

function wireUpPanel(view) {
  const $ = (id) => document.getElementById(id);

  // Pull every control's initial state from the View's effect components,
  // so the panel always agrees with the renderer's actual state regardless
  // of what the demo set up before showing the panel.
  populatePanelFromView(view);

  $("renderMode").addEventListener("change", (e) => {
    view.renderMode = renderModeFor(e.target.value);
    updateSubpanelDisabledStates(view);
  });

  // ---- Tonemap ----
  bindSelect("tonemapMode", v => { view.effects.tonemap.mode = v; });
  bindRange ("exposure",    v => { view.effects.tonemap.exposure = v; });
  bindCheck ("tonemapSRGB", v => { view.effects.tonemap.sRGBEncode = v; });
  bindRange ("renderScale", v => { view.effects.tonemap.renderScale = v; }, 1);

  // ---- Hemisphere Ambient ----
  bindRange ("hemisphereIntensity", v => { view.lights.hemispheric.intensity = v; });
  bindColor ("hemisphereSky",    rgb => { view.lights.hemispheric.skyColor    = rgb; });
  bindColor ("hemisphereGround", rgb => { view.lights.hemispheric.groundColor = rgb; });

  // ---- IBL (cubemap) ----
  bindRange ("iblIntensity", v => { view.lights.ibl.intensity = v; });

  // ---- Sun + Shadows ----
  const updateSun = () => {
    const x = parseFloat($("sunX").value);
    const y = parseFloat($("sunY").value);
    const z = parseFloat($("sunZ").value);
    $("sunXVal").textContent = x.toFixed(2);
    $("sunYVal").textContent = y.toFixed(2);
    $("sunZVal").textContent = z.toFixed(2);
    const dir = [x, y, z];
    view.effects.shadows.direction = dir;
    if ($("hemisphereFollowsSun").checked) {
      view.lights.hemispheric.worldUp = sunUpFromDir(dir);
    }
  };
  $("sunX").addEventListener("input", updateSun);
  $("sunY").addEventListener("input", updateSun);
  $("sunZ").addEventListener("input", updateSun);
  $("hemisphereFollowsSun").addEventListener("change", updateSun);

  bindRange ("shadowsIntensity",        v => { view.effects.shadows.intensity = v; });
  bindSelect("shadowsCascades",         v => { view.effects.shadows.cascadeCount = parseInt(v, 10); });
  bindRange ("shadowsCascadeSplit",     v => { view.effects.shadows.cascadeSplitLambda = v; });
  bindSelect("shadowsPCF",              v => { view.effects.shadows.pcfKernelSize = parseInt(v, 10); });
  bindSelect("shadowsResolution",       v => { view.effects.shadows.resolution = parseInt(v, 10); });
  bindCheck ("shadowsAutoFit",          v => { view.effects.shadows.autoFit = v; });
  bindRange ("shadowsBias",             v => { view.effects.shadows.bias = v; }, 4);
  bindRange ("shadowsNormalOffsetBias", v => { view.effects.shadows.normalOffsetBias = v; }, 3);
  bindRange ("shadowsSlopeBias",        v => { view.effects.shadows.slopeBias = v; }, 4);
  bindRange ("shadowsMaxDistance",      v => { view.effects.shadows.maxDistance = v; }, 0);
  bindRange ("shadowsPadding",          v => { view.effects.shadows.padding = v; });

  // ---- SAO ----
  bindRange ("saoIntensity",     v => { view.effects.sao.intensity = v; });
  bindRange ("saoKernelRadius",  v => { view.effects.sao.kernelRadius = v; }, 0);
  bindRange ("saoNumSamples",    v => { view.effects.sao.numSamples = v | 0; }, 0);
  bindCheck ("saoBlur",          v => { view.effects.sao.blur = v; });
  bindRange ("saoBias",          v => { view.effects.sao.bias = v; });
  bindRange ("saoScale",         v => { view.effects.sao.scale = v; });
  bindRange ("saoBlendCutoff",   v => { view.effects.sao.blendCutoff = v; });
  bindRange ("saoBlendFactor",   v => { view.effects.sao.blendFactor = v; });
  bindRange ("saoMinResolution", v => { view.effects.sao.minResolution = v; });

  // ---- Bloom ----
  bindRange ("bloomIntensity",  v => { view.effects.bloom.intensity = v; });
  bindRange ("bloomThreshold",  v => { view.effects.bloom.threshold = v; });
  bindRange ("bloomKnee",       v => { view.effects.bloom.knee = v; });

  // ---- Antialiasing ----
  bindSelect("aaMode", v => { view.effects.antiAliasing.mode = v; });

  // ---- Edges ----
  bindColor ("edgesColor",     rgb => { view.effects.edges.edgeColor = rgb; });
  bindRange ("edgesAlpha",       v => { view.effects.edges.edgeAlpha = v; });
  bindRange ("edgesWidth",       v => { view.effects.edges.edgeWidth = v | 0; }, 0);
  bindRange ("edgesFadeStart",   v => { view.effects.edges.edgeFadeStart = v; });
  bindRange ("edgesFadeEnd",     v => { view.effects.edges.edgeFadeEnd = v; });

  // Reflect the initial render-mode preset into the subpanels.
  updateSubpanelDisabledStates(view);
}

// Mute / un-mute each effect subpanel based on whether its effect is
// `applied` under the current render mode. Reads the SDK's per-effect
// `applied` getters so the panel state always agrees with what the
// renderer is actually doing.
function updateSubpanelDisabledStates(view) {
  const effects = {
    tonemap:           view.effects.tonemap,
    hemispheric: view.lights.hemispheric,
    ibl:               view.lights.ibl,
    shadows: view.effects.shadows,
    sao:     view.effects.sao,
    bloom:   view.effects.bloom,
    aa:      view.effects.antiAliasing,
    edges:   view.effects.edges
  };
  for (const [name, effect] of Object.entries(effects)) {
    const details = document.querySelector(`#panel details[data-effect="${name}"]`);
    if (!details || !effect) continue;
    const active = effect.applied && (effect.possible !== false);
    details.classList.toggle("disabled", !active);
    if (!active) details.open = false;
  }
}

// Pulls every panel control's initial state from the View's effect
// components, so the panel always agrees with the renderer regardless
// of what the demo set up. Called once at `wireUpPanel` start.
function populatePanelFromView(view) {
  // ---- Render-mode pulldown ----
  setSelect("renderMode", nameForRenderMode(view.renderMode));

  // ---- Tonemap ----
  setSelect("tonemapMode", view.effects.tonemap.mode);
  setRange ("exposure",    view.effects.tonemap.exposure, 2);
  setCheck ("tonemapSRGB", view.effects.tonemap.sRGBEncode);
  setRange ("renderScale", view.effects.tonemap.renderScale, 1);

  // ---- Hemisphere Ambient ----
  setRange ("hemisphereIntensity", view.lights.hemispheric.intensity, 2);
  setColor ("hemisphereSky",       view.lights.hemispheric.skyColor);
  setColor ("hemisphereGround",    view.lights.hemispheric.groundColor);

  // ---- IBL (cubemap) ----
  setRange ("iblIntensity", view.lights.ibl.intensity, 2);

  // ---- Sun + Shadows ----
  setRange ("shadowsIntensity",        view.effects.shadows.intensity, 2);
  const dir = view.effects.shadows.direction;
  setRange ("sunX", dir[0], 2);
  setRange ("sunY", dir[1], 2);
  setRange ("sunZ", dir[2], 2);
  setSelect("shadowsCascades",         String(view.effects.shadows.cascadeCount));
  setRange ("shadowsCascadeSplit",     view.effects.shadows.cascadeSplitLambda, 2);
  setSelect("shadowsPCF",              String(view.effects.shadows.pcfKernelSize));
  setSelect("shadowsResolution",       String(view.effects.shadows.resolution));
  setCheck ("shadowsAutoFit",          view.effects.shadows.autoFit);
  setRange ("shadowsBias",             view.effects.shadows.bias, 4);
  setRange ("shadowsNormalOffsetBias", view.effects.shadows.normalOffsetBias, 3);
  setRange ("shadowsSlopeBias",        view.effects.shadows.slopeBias, 4);
  setRange ("shadowsMaxDistance",      view.effects.shadows.maxDistance, 0);
  setRange ("shadowsPadding",          view.effects.shadows.padding, 2);

  // ---- SAO ----
  setRange ("saoIntensity",     view.effects.sao.intensity, 2);
  setRange ("saoKernelRadius",  view.effects.sao.kernelRadius, 0);
  setRange ("saoNumSamples",    view.effects.sao.numSamples, 0);
  setCheck ("saoBlur",          view.effects.sao.blur);
  setRange ("saoBias",          view.effects.sao.bias, 2);
  setRange ("saoScale",         view.effects.sao.scale, 2);
  setRange ("saoBlendCutoff",   view.effects.sao.blendCutoff, 2);
  setRange ("saoBlendFactor",   view.effects.sao.blendFactor, 2);
  setRange ("saoMinResolution", view.effects.sao.minResolution, 2);

  // ---- Bloom ----
  setRange ("bloomIntensity",  view.effects.bloom.intensity, 2);
  setRange ("bloomThreshold",  view.effects.bloom.threshold, 2);
  setRange ("bloomKnee",       view.effects.bloom.knee, 2);

  // ---- Antialiasing ----
  setSelect("aaMode", view.effects.antiAliasing.mode);

  // ---- Edges ----
  setColor ("edgesColor",      view.effects.edges.edgeColor);
  setRange ("edgesAlpha",      view.effects.edges.edgeAlpha, 2);
  setRange ("edgesWidth",      view.effects.edges.edgeWidth, 0);
  setRange ("edgesFadeStart",  view.effects.edges.edgeFadeStart, 2);
  setRange ("edgesFadeEnd",    view.effects.edges.edgeFadeEnd, 2);
}

function setRange(id, value, decimals) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = String(value);
  const valEl = document.getElementById(id + "Val");
  if (valEl) {
    valEl.textContent = decimals === 0
      ? String(value | 0)
      : Number(value).toFixed(decimals);
  }
}

function setCheck(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}

function setSelect(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = String(value);
}

function setColor(id, rgb) {
  const el = document.getElementById(id);
  if (el && rgb && rgb.length >= 3) el.value = rgbToHex(rgb);
}

function rgbToHex(rgb) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v * 255)));
  const h = v => clamp(v).toString(16).padStart(2, "0");
  return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}`;
}

function bindRange(id, fn, decimals) {
  const el = document.getElementById(id);
  const valEl = document.getElementById(id + "Val");
  el.addEventListener("input", () => {
    const v = parseFloat(el.value);
    if (valEl) {
      valEl.textContent = decimals !== undefined
        ? (decimals === 0 ? String(v | 0) : v.toFixed(decimals))
        : (Math.abs(v) < 10 && el.step !== "1") ? v.toFixed(2) : String(v | 0);
    }
    fn(v);
  });
}

function bindCheck(id, fn) {
  document.getElementById(id).addEventListener("change", e => fn(e.target.checked));
}

function bindSelect(id, fn) {
  document.getElementById(id).addEventListener("change", e => fn(e.target.value));
}

function bindColor(id, fn) {
  document.getElementById(id).addEventListener("input", e => {
    fn(hexToRgb(e.target.value));
  });
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255
  ];
}

function sunUpFromDir(dir) {
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  return [-dir[0] / len, -dir[1] / len, -dir[2] / len];
}

function mustCreate(r) {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

function mustBuild(r) {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

