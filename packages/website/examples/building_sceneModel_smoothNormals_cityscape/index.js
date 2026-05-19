// Procedural cityscape that exercises the renderer's smooth-shaded technique
// pair. Boxes, cylinders and spheres are built with their `normals` arrays
// populated and passed straight into `SceneModel.createGeometry` — the
// MeshManager then routes those geometries into a normals-bearing batch and
// the renderer compiles a shader variant that fetches per-vertex normals
// from a data texture instead of deriving a face normal in the fragment.
//
// SAO + directional shadows + hemisphere IBL are switched on so the smooth
// silhouettes on the domes and tower drums are easy to see.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const { scene } = studio;

  // Z-up coordinate system: X = right, Z = up, Y = forward. This matches the
  // sister Cityscape examples in the SDK.
  const sceneModel = mustCreate(scene.createModel({
    id: "cityNormalsModel",
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

  // ---------------------------------------------------------------------------
  // Shared geometries — each carries its `normals` array. Buildings reuse
  // these via per-mesh transforms; only one upload of vertex data per shape.
  // ---------------------------------------------------------------------------

  // Geometries pass UVs through too — the renderer's texture-sampling path
  // is gated on `hasUVs`, so even untextured meshes need to land in a
  // UV-bearing batch to be eligible for an albedo atlas binding. The
  // SDK maps procgen's `uv` field onto SceneGeometry's `uvs` parameter.
  const box = mustBuild(xeokit.model.procgen.buildGeometry.buildBox({
    xSize: 1, ySize: 1, zSize: 1
  }));
  sceneModel.createGeometry({
    id: "box",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: box.positions,
    normals: box.normals,
   // uvs: box.uv,
    indices: box.indices
  });

  // Drum / tower shaft. Built around the +Y axis natively, but our model
  // basis maps that to scene Z so it stands upright as-is.
  const cylinder = mustBuild(xeokit.model.procgen.buildGeometry.buildCylinder({
    radiusTop: 1,
    radiusBottom: 1,
    height: 2,
    radialSegments: 32,
    heightSegments: 1,
    openEnded: false
  }));
  sceneModel.createGeometry({
    id: "cylinder",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: cylinder.positions,
    normals: cylinder.normals,
 //   uvs: cylinder.uv,
    indices: cylinder.indices
  });

  // Full sphere — used for domes (scaled in Z to a hemisphere via mesh matrix).
  const sphere = mustBuild(xeokit.model.procgen.buildGeometry.buildSphere({
    radius: 1,
    widthSegments: 32,
    heightSegments: 18
  }));
  sceneModel.createGeometry({
    id: "sphere",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: sphere.positions,
    normals: sphere.normals,
   // uvs: sphere.uv,
    indices: sphere.indices
  });

  // Torus — used by the PBR showcase row to demonstrate full
  // textured PBR on a topologically-interesting surface (one continuous
  // UV mapping that bends around two axes).
  const torus = mustBuild(xeokit.model.procgen.buildGeometry.buildTorus({
    radius: 1.0,
    tube: 0.35,
    radialSegments: 32,
    tubeSegments: 24
  }));
  sceneModel.createGeometry({
    id: "torus",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    positions: torus.positions,
    normals: torus.normals,
  //  uvs: torus.uv,
    indices: torus.indices
  });

  // ---------------------------------------------------------------------------
  // Reproducible PRNG (mulberry32). Using a fixed seed keeps the layout
  // identical between reloads, which makes screenshot diffs viable.
  // The same `rand` is also used by the procedural texture painters,
  // so the textures themselves are deterministic too.
  // ---------------------------------------------------------------------------
  let seed = 1337;
  function rand() {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Allocate a square canvas, hand its 2D context to `paint`, return the
  // canvas. The returned HTMLCanvasElement is what `SceneModel.createTexture`
  // accepts via `imageData`, and what the renderer's atlas uploads via
  // `texSubImage2D`.
  function drawTexture(size, paint) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    paint(canvas.getContext("2d"), size);
    return canvas;
  }

  let nextId = 0;

  // Emits one mesh + matching object. The rendering pipeline addresses
  // meshes by object, so each placement needs both. Rotation is in degrees
  // (eulerToQuat applies DEGTORAD); cylinders need a +90° X rotation
  // because the procgen builder lays them along local Y while the scene
  // is Z-up.
  //
  // `materialId` references a pre-created SceneMaterial — the canonical
  // home for PBR parameters (colour, roughness, metallic, textures).
  // Every batch in this example carries normals so every mesh goes
  // through the Cook-Torrance BRDF.
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

  // ---------------------------------------------------------------------------
  // Building presets. Each takes the slot's ground centre (cx, cy) and a slot
  // half-width, and emits one or more parts. Sphere domes and cylinder shafts
  // are where the smooth-normal path visually pays off.
  // ---------------------------------------------------------------------------

  // Cylinders are authored with their local Y as the height axis, so every
  // placement rotates them onto scene Z. Boxes and spheres need no rotation:
  // the box's Z scale directly controls scene height, and the sphere is
  // rotationally symmetric so its scale.z is the dome flatness.
  const CYL_UPRIGHT = [90, 0, 0];

  // Material catalogue. Each entry's params are passed to
  // `SceneModel.createMaterial`; the resulting material id is then used by
  // every mesh that wants that look.
  //
  // Dielectrics carry a plausible diffuse colour and a roughness that
  // matches what the real material would do — concrete is matte, marble has
  // a soft sheen, painted stucco sits between them. `metallic = 0` means the
  // shader's Fresnel base reflectance is the standard 0.04 grey, so direct
  // light only contributes a faint specular ring near grazing angles.
  //
  // Metals override that: when `metallic = 1` the shader uses `color`
  // directly as the Fresnel `F0`, which is what gives copper its red
  // reflection, gold its yellow reflection, etc. The colour is therefore
  // the tint of the metal's reflection, not a diffuse albedo (metals have
  // no diffuse term — `(1 - F)·(1 - metallic)` zeroes it out).
  //
  // F0 values for the metals here come from measured spectroscopy data
  // tabulated in real-time PBR references (Disney/Khronos tables).
  const materialDefs = {
    CONCRETE:    { color: [0.78, 0.74, 0.68], roughness: 0.88, metallic: 0.0 },
    STUCCO_BLUE: { color: [0.46, 0.55, 0.65], roughness: 0.72, metallic: 0.0 },
    STUCCO_TAN:  { color: [0.72, 0.62, 0.48], roughness: 0.72, metallic: 0.0 },
    MARBLE:      { color: [0.92, 0.88, 0.80], roughness: 0.32, metallic: 0.0 },
    TERRACOTTA:  { color: [0.66, 0.42, 0.32], roughness: 0.55, metallic: 0.0 },
    SLATE:       { color: [0.30, 0.32, 0.36], roughness: 0.60, metallic: 0.0 },
    COPPER:      { color: [0.95, 0.64, 0.54], roughness: 0.30, metallic: 1.0 },
    GOLD:        { color: [1.00, 0.78, 0.34], roughness: 0.25, metallic: 1.0 },
    BRONZE:      { color: [0.71, 0.55, 0.35], roughness: 0.42, metallic: 1.0 },
    ALUMINUM:    { color: [0.91, 0.92, 0.92], roughness: 0.35, metallic: 1.0 },
    SILVER:      { color: [0.97, 0.96, 0.91], roughness: 0.18, metallic: 1.0 },
  };

  // Create one SceneMaterial per catalogue entry; expose the keys as a
  // material-id lookup (`M.CONCRETE` etc.) so the call sites below stay
  // readable.
  const M = {};
  for (const [key, def] of Object.entries(materialDefs)) {
    mustCreate(sceneModel.createMaterial({ id: key, ...def }));
    M[key] = key;
  }

  // ---------------------------------------------------------------------------
  // Albedo textures — drawn into off-screen canvases so the example doesn't
  // need any external image assets. The renderer's per-batch atlas packs
  // these into a single sRGB 2D texture; the per-mesh UV transform in
  // MeshAttributeTexture remaps each mesh's vUVs into its sub-rect.
  //
  // Each texture is 256×256 — small enough that several of them comfortably
  // fit the default 2048×2048 atlas, but large enough that the patterns
  // read cleanly across a building face.
  // ---------------------------------------------------------------------------

  // Brick pattern — staggered rows of warm-red rectangles with a mortar
  // gap. Used as the albedo for a "tiled-roof" terracotta variant.
  const brickCanvas = drawTexture(256, (ctx, size) => {
    ctx.fillStyle = "#3a2018"; // mortar
    ctx.fillRect(0, 0, size, size);
    const cols = 5, rows = 10;
    const colW = size / cols;
    const rowH = size / rows;
    for (let r = 0; r < rows; r++) {
      const offX = (r % 2) * (colW * 0.5);
      for (let c = -1; c < cols; c++) {
        const x = c * colW + offX;
        const y = r * rowH;
        // Slight per-brick brightness jitter for texture.
        const k = 0.85 + rand() * 0.15;
        ctx.fillStyle = `rgb(${(0.78 * 255 * k) | 0},${(0.42 * 255 * k) | 0},${(0.32 * 255 * k) | 0})`;
        ctx.fillRect(x + 1.5, y + 1.5, colW - 3, rowH - 3);
      }
    }
  });

  // Speckled stone — a noisy gray base with brighter and darker pebble
  // dots. Used as a textured concrete variant.
  const stoneCanvas = drawTexture(256, (ctx, size) => {
    ctx.fillStyle = "#9b9690";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < size * size / 6; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const v = (0.45 + rand() * 0.45) * 255;
      ctx.fillStyle = `rgb(${v | 0},${v | 0},${v * 0.96 | 0})`;
      ctx.fillRect(x, y, 1, 1);
    }
    // Lighter highlight blobs.
    for (let i = 0; i < 60; i++) {
      const x = rand() * size, y = rand() * size;
      const r = 1.5 + rand() * 2;
      ctx.fillStyle = `rgba(220, 220, 215, ${0.20 + rand() * 0.15})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Veined marble — pale base with a few semi-transparent veins drawn as
  // gently meandering polylines. Looks great on tower drums and domes
  // because GGX picks up the smooth roughness over the curved surface.
  const marbleCanvas = drawTexture(256, (ctx, size) => {
    ctx.fillStyle = "#ece8db";
    ctx.fillRect(0, 0, size, size);
    ctx.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      ctx.lineWidth = 0.6 + rand() * 1.2;
      ctx.strokeStyle = `rgba(140, 130, 110, ${0.10 + rand() * 0.12})`;
      ctx.beginPath();
      let x = rand() * size, y = rand() * size;
      ctx.moveTo(x, y);
      for (let j = 0; j < 14; j++) {
        x += (rand() - 0.5) * size * 0.35;
        y += (rand() - 0.5) * size * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });

  // ---------------------------------------------------------------------------
  // Metallic-roughness textures. glTF 2.0 packs roughness in G and metallic
  // in B — the renderer multiplies those channels against the material's
  // `roughness`/`metallic` values, so the texture acts as a per-texel
  // modulation. R and A are unused here (we'd put AO in R if we had an
  // occlusion stage). All MR canvases are linear data — no sRGB encoding.
  //
  // To make the variation visually obvious we push values to extremes
  // (~0.05 vs ~0.95 roughness) and sprinkle metallic accents (B=255) into
  // the dielectric textures — the textured materials below set
  // `material.metallic = 1` so the texture's B channel actually drives
  // metalness, otherwise multiplying by zero suppresses the effect.
  // ---------------------------------------------------------------------------

  // Brick wall — bricks are mid-rough fired clay (R≈0.7), mortar very
  // rough (R≈0.95). A few "wet/glazed" tiles drop to ~0.1, and the
  // corners sport metallic brass studs to give a high-contrast glint.
  const brickMRCanvas = drawTexture(256, (ctx, size) => {
    ctx.fillStyle = "rgb(0, 240, 0)"; // mortar — very rough, dielectric
    ctx.fillRect(0, 0, size, size);
    const cols = 5, rows = 10;
    const colW = size / cols;
    const rowH = size / rows;
    for (let r = 0; r < rows; r++) {
      const offX = (r % 2) * (colW * 0.5);
      for (let c = -1; c < cols; c++) {
        const x = c * colW + offX;
        const y = r * rowH;
        const dice = rand();
        let g, b;
        if (dice < 0.10) {
          // Glazed brick — roughness ~0.10, dielectric.
          g = 25; b = 0;
        } else if (dice < 0.18) {
          // Brass-stud-effect tile — fully metallic, smooth.
          g = 50; b = 255;
        } else {
          // Standard fired clay — roughness varies 0.6..0.85.
          g = (0.6 + rand() * 0.25) * 255;
          b = 0;
        }
        ctx.fillStyle = `rgb(0, ${g | 0}, ${b | 0})`;
        ctx.fillRect(x + 1.5, y + 1.5, colW - 3, rowH - 3);
      }
    }
  });

  // Concrete with metal inlays — base is very rough (~0.95), polished
  // patches drop to ~0.08, and a handful of opaque metal-rivet circles
  // mark hard-to-miss specular hot-spots when sun catches them.
  const stoneMRCanvas = drawTexture(256, (ctx, size) => {
    ctx.fillStyle = "rgb(0, 240, 0)"; // base: rough concrete
    ctx.fillRect(0, 0, size, size);
    // Polished worn-smooth patches — opaque, big roughness drop.
    for (let i = 0; i < 40; i++) {
      const x = rand() * size, y = rand() * size;
      const r = 4 + rand() * 10;
      ctx.fillStyle = "rgb(0, 25, 0)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Metal rivets — fully metallic, very smooth.
    for (let i = 0; i < 18; i++) {
      const x = rand() * size, y = rand() * size;
      const r = 2 + rand() * 4;
      ctx.fillStyle = "rgb(0, 50, 255)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Marble — moderately rough matrix (~0.7) with sharply polished veins
  // (~0.05) drawn opaquely so they really pop. A few veins are gilt
  // (metallic) for an art-deco accent.
  const marbleMRCanvas = drawTexture(256, (ctx, size) => {
    ctx.fillStyle = "rgb(0, 180, 0)"; // matrix: roughness ~0.7
    ctx.fillRect(0, 0, size, size);
    ctx.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      ctx.lineWidth = 1.2 + rand() * 2.0;
      const isGilt = rand() < 0.25;
      // Veins: dielectric polished crystal (G=15) or gilt brass (B=255).
      ctx.strokeStyle = isGilt ? "rgba(0, 40, 255, 1.0)" : "rgba(0, 15, 0, 1.0)";
      ctx.beginPath();
      let x = rand() * size, y = rand() * size;
      ctx.moveTo(x, y);
      for (let j = 0; j < 14; j++) {
        x += (rand() - 0.5) * size * 0.35;
        y += (rand() - 0.5) * size * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });

  // ---------------------------------------------------------------------------
  // Corroded copper — the visually-interesting case. A shared corrosion
  // mask is sampled at each pixel by all three maps (albedo, MR,
  // normal) so the verdigris colour, the dielectric oxide patch, and
  // the pitted bump pattern all line up exactly.
  //
  // The mask is built from three octaves of cheap sin-based value
  // noise plus a downward bias (verdigris collects in low spots and
  // drips downward), thresholded so the result reads as patches of
  // green-cyan oxide against pristine copper rather than a uniform
  // gradient.
  // ---------------------------------------------------------------------------

  const COPPER_SIZE = 256;
  const copperCorrosion = new Float32Array(COPPER_SIZE * COPPER_SIZE);
  // Sparse "bare metal" mask — small clean patches where rain or
  // touching has worn away the patina. ~4% of pixels.
  const copperBare = new Float32Array(COPPER_SIZE * COPPER_SIZE);
  for (let y = 0; y < COPPER_SIZE; y++) {
    for (let x = 0; x < COPPER_SIZE; x++) {
      const u = x / COPPER_SIZE, v = y / COPPER_SIZE;
      // Three octaves of value noise — wavelengths roughly 64, 32, 16 px.
      const n =
          0.50 * (0.5 + 0.5 * Math.sin(u *  4.0 + v *  5.0))
        + 0.30 * (0.5 + 0.5 * Math.sin(u *  9.0 - v *  7.0 + 1.7))
        + 0.20 * (0.5 + 0.5 * Math.sin(u * 17.0 + v * 13.0 + 0.5));
      // Drip bias: verdigris is heavier toward the bottom of the
      // texture (real domes corrode where water pools at the base).
      const drip = v * 0.25;
      // Bias the result slightly toward "more corroded" so most of
      // the dome reads as oxidised, with smaller pristine patches.
      copperCorrosion[y * COPPER_SIZE + x] = Math.min(1, Math.max(0, n + drip - 0.20));
      // Bare-metal speckle — small high-frequency noise field.
      copperBare[y * COPPER_SIZE + x] = hash2(x * 0.7, y * 0.7) > 0.96 ? 1 : 0;
    }
  }

  // Albedo: copper base, verdigris patches, dark-tarnish overlay. The
  // material's `color` will multiply through, so we author at full
  // intensity here and let `metallic = 1.0` pick up the texture's
  // colour as F0 in the BRDF.
  const copperColorCanvas = drawTexture(COPPER_SIZE, (ctx, size) => {
    const img = ctx.createImageData(size, size);
    const px = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = copperCorrosion[y * size + x];
        const bare = copperBare[y * size + x];
        // Pristine copper F0 (0.95, 0.64, 0.54) → verdigris (0.42,
        // 0.66, 0.56). At c=0 we render the metal colour, at c=1 we
        // render full verdigris. Bare-metal speckles override with a
        // brighter copper.
        let r = (1 - c) * 0.95 + c * 0.42;
        let g = (1 - c) * 0.64 + c * 0.66;
        let b = (1 - c) * 0.54 + c * 0.56;
        if (bare > 0) {
          r = 1.00; g = 0.72; b = 0.55;
        }
        // Dark tarnish where the corrosion mask is mid-range — that's
        // the muddy brown copper-oxide stage before the verdigris
        // green sets in.
        if (c > 0.30 && c < 0.55) {
          const k = 0.65;
          r *= k; g *= k * 0.9; b *= k * 0.85;
        }
        const i = (y * size + x) * 4;
        px[i] = (r * 255) | 0;
        px[i + 1] = (g * 255) | 0;
        px[i + 2] = (b * 255) | 0;
        px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // MR: pristine = smooth metallic; verdigris = rough dielectric.
  // This is the SINGLE most important channel for selling corrosion
  // — verdigris not being metal is what makes patinated bronze look
  // matte and "patched" rather than just discoloured-but-shiny.
  const copperMRCanvas = drawTexture(COPPER_SIZE, (ctx, size) => {
    const img = ctx.createImageData(size, size);
    const px = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = copperCorrosion[y * size + x];
        const bare = copperBare[y * size + x];
        // G (roughness): pristine 0.10, full verdigris 0.85.
        let g = 0.10 + c * 0.75;
        // B (metallic): pristine 1.0, verdigris 0.0 (oxide IS dielectric).
        let b = 1.0 - c;
        if (bare > 0) { g = 0.05; b = 1.0; }
        const i = (y * size + x) * 4;
        px[i] = 0;
        px[i + 1] = (g * 255) | 0;
        px[i + 2] = (b * 255) | 0;
        px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // ---------------------------------------------------------------------------
  // Tangent-space normal maps. RGB encodes (x, y, z) ∈ [-1, 1] as
  // `(x*0.5+0.5, y*0.5+0.5, z*0.5+0.5)` — a flat surface (no
  // perturbation) is `(128, 128, 255)`. Higher Z means more upright.
  //
  // We compute Z from a height-map gradient ("emboss" style) rather than
  // authoring normals directly: it makes the patterns easier to
  // reason about (just paint a height image, derive normals from
  // dHeight/dx, dHeight/dy).
  // ---------------------------------------------------------------------------

  /**
   * Renders a normal map from a `height(x, y) → [0, 1]` callback. Uses
   * central differences on a sparse height sample then writes the
   * resulting RGB normal to the canvas. `bumpStrength` scales the
   * tangent-space (x, y) — higher values give steeper apparent bumps.
   */
  function drawNormalMap(size, bumpStrength, height) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    const px = img.data;
    // 1-pixel central difference: dh/dx ≈ height(x+1) - height(x-1).
    // The output normal in tangent space is `normalize(-dx, -dy, 1/strength)`.
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const hL = height((x - 1 + size) % size, y);
        const hR = height((x + 1) % size, y);
        const hD = height(x, (y - 1 + size) % size);
        const hU = height(x, (y + 1) % size);
        const dx = (hR - hL) * bumpStrength;
        const dy = (hU - hD) * bumpStrength;
        const nz = 1.0;
        // Normalize.
        const len = Math.hypot(-dx, -dy, nz) || 1;
        const nxN = -dx / len;
        const nyN = -dy / len;
        const nzN = nz / len;
        const i = (y * size + x) * 4;
        px[i + 0] = Math.round((nxN * 0.5 + 0.5) * 255);
        px[i + 1] = Math.round((nyN * 0.5 + 0.5) * 255);
        px[i + 2] = Math.round((nzN * 0.5 + 0.5) * 255);
        px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  // Brick height map — recessed mortar, slightly raised brick faces.
  // Stamped into a height grid first so we can run drawNormalMap over it.
  const NM_SIZE = 256;
  function buildBrickHeights() {
    const h = new Float32Array(NM_SIZE * NM_SIZE);
    const cols = 5, rows = 10;
    const colW = NM_SIZE / cols;
    const rowH = NM_SIZE / rows;
    // Default = mortar height (low).
    h.fill(0.10);
    for (let r = 0; r < rows; r++) {
      const offX = (r % 2) * (colW * 0.5);
      for (let c = -1; c < cols; c++) {
        const x0 = Math.floor(c * colW + offX) + 2;
        const y0 = Math.floor(r * rowH) + 2;
        const x1 = Math.floor((c + 1) * colW + offX) - 2;
        const y1 = Math.floor((r + 1) * rowH) - 2;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            if (x < 0 || x >= NM_SIZE || y < 0 || y >= NM_SIZE) continue;
            // Slight outward dome on each brick — distance from edge.
            const ex = Math.min(x - x0, x1 - 1 - x);
            const ey = Math.min(y - y0, y1 - 1 - y);
            const edge = Math.min(ex, ey, 4) / 4;
            h[y * NM_SIZE + x] = 0.55 + 0.05 * edge;
          }
        }
      }
    }
    return h;
  }
  const brickHeights = buildBrickHeights();
  const brickNormalCanvas = drawNormalMap(NM_SIZE, 6.0, (x, y) => brickHeights[y * NM_SIZE + x]);

  // Stone — small bumps with a low-frequency ripple. The ripple gives
  // viewing-angle play; the bumps add detail. Uses a cheap value-noise
  // hash so it stays deterministic with the seeded PRNG.
  const stoneNormalCanvas = drawNormalMap(NM_SIZE, 4.0, (x, y) => {
    const u = x / NM_SIZE, v = y / NM_SIZE;
    // Two-octave value noise via sinusoidal hashes — coarse + fine.
    const coarse = 0.5 + 0.5 * Math.sin(u * 12.0) * Math.cos(v * 13.0);
    const fine   = 0.5 + 0.5 * Math.sin(u * 47.0 + 1.7) * Math.cos(v * 53.0 + 0.3);
    return coarse * 0.6 + fine * 0.4;
  });

  // Marble — sharp ridges along the same vein paths used by the colour
  // map. Veins are drawn as bumps so they catch the light differently
  // from the surrounding matrix; the matrix is gently undulating.
  function buildMarbleHeights() {
    const h = new Float32Array(NM_SIZE * NM_SIZE);
    for (let y = 0; y < NM_SIZE; y++) {
      for (let x = 0; x < NM_SIZE; x++) {
        const u = x / NM_SIZE, v = y / NM_SIZE;
        h[y * NM_SIZE + x] = 0.4 + 0.04 * Math.sin(u * 9.0) * Math.cos(v * 11.0);
      }
    }
    // Drop ridges along several meandering paths.
    for (let i = 0; i < 14; i++) {
      let x = rand() * NM_SIZE, y = rand() * NM_SIZE;
      const radius = 1.5 + rand() * 1.5;
      for (let step = 0; step < 14; step++) {
        const tx = x + (rand() - 0.5) * NM_SIZE * 0.35;
        const ty = y + (rand() - 0.5) * NM_SIZE * 0.35;
        // Rasterize a short segment from (x,y) to (tx,ty) as a ridge.
        const steps = 32;
        for (let s = 0; s <= steps; s++) {
          const px = x + (tx - x) * (s / steps);
          const py = y + (ty - y) * (s / steps);
          const r = Math.ceil(radius);
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const ix = ((Math.round(px) + dx) % NM_SIZE + NM_SIZE) % NM_SIZE;
              const iy = ((Math.round(py) + dy) % NM_SIZE + NM_SIZE) % NM_SIZE;
              const dist = Math.hypot(dx, dy);
              const fall = Math.max(0, 1 - dist / radius);
              h[iy * NM_SIZE + ix] = Math.max(h[iy * NM_SIZE + ix], 0.5 + 0.4 * fall);
            }
          }
        }
        x = tx; y = ty;
      }
    }
    return h;
  }
  const marbleHeights = buildMarbleHeights();
  const marbleNormalCanvas = drawNormalMap(NM_SIZE, 5.0, (x, y) => marbleHeights[y * NM_SIZE + x]);

  // Corroded-copper height field — three signals layered:
  //   1. Hammered base. Cosine-domed dimples scattered across the
  //      surface, the artisan-beaten pattern that's visible whether
  //      or not the metal has corroded.
  //   2. Verdigris pitting. Where the corrosion mask is high, oxide
  //      crusts build up irregular bumps and pits — these dominate
  //      the corroded patches and read as "rough rust" rather than
  //      "smooth metal".
  //   3. Bare-metal smoothing. Where the bare-metal speckle mask is
  //      set, the height is forced flat — the eye reads these as
  //      polished spots where someone touched or rain ran.
  function buildCorrodedCopperHeights() {
    const h = new Float32Array(COPPER_SIZE * COPPER_SIZE);
    // 1. Hammered dimple base.
    h.fill(0.5);
    const numDimples = 200;
    for (let i = 0; i < numDimples; i++) {
      const cx = rand() * COPPER_SIZE;
      const cy = rand() * COPPER_SIZE;
      const r = 6 + rand() * 4;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const dist = Math.hypot(dx, dy);
          if (dist > r) continue;
          const ix = ((Math.round(cx) + dx) % COPPER_SIZE + COPPER_SIZE) % COPPER_SIZE;
          const iy = ((Math.round(cy) + dy) % COPPER_SIZE + COPPER_SIZE) % COPPER_SIZE;
          const profile = 0.5 + 0.5 * Math.cos((dist / r) * Math.PI);
          h[iy * COPPER_SIZE + ix] = Math.max(h[iy * COPPER_SIZE + ix], 0.5 + 0.20 * profile);
        }
      }
    }
    // 2. Verdigris pitting on top of the dimples — high-frequency
    //    irregular bumps where the corrosion mask is strong.
    for (let y = 0; y < COPPER_SIZE; y++) {
      for (let x = 0; x < COPPER_SIZE; x++) {
        const c = copperCorrosion[y * COPPER_SIZE + x];
        if (c < 0.25) continue;
        // hash2 gives [0,1); raise corroded pixels by up to 0.30
        // height units, scaled by the corrosion mask so the heaviest
        // patches have the most aggressive bumps.
        const noise = hash2(x * 1.4 + 5.0, y * 1.4 + 9.0);
        const bump = (noise - 0.5) * 0.30 * c;
        h[y * COPPER_SIZE + x] += bump;
      }
    }
    // 3. Bare-metal speckle — flatten to the dimple-base value.
    for (let y = 0; y < COPPER_SIZE; y++) {
      for (let x = 0; x < COPPER_SIZE; x++) {
        if (copperBare[y * COPPER_SIZE + x] > 0) {
          h[y * COPPER_SIZE + x] = 0.55;
        }
      }
    }
    return h;
  }
  const corrodedCopperHeights = buildCorrodedCopperHeights();
  // Bump strength 5 — same as before, the verdigris-pitting signal is
  // ALREADY high contrast (0.30 height range vs the 0.20 hammered
  // signal), so a higher strength would saturate.
  const copperNormalCanvas = drawNormalMap(COPPER_SIZE, 5.0, (x, y) => corrodedCopperHeights[y * COPPER_SIZE + x]);

  // ---------------------------------------------------------------------------
  // Granite blocks. Coarse rectangular ashlar pattern (4×6 blocks) with deep
  // mortar grooves and a high-frequency crystal-bump layer inside each
  // block. Three textures (albedo, MR, normal) all derived from the same
  // block grid + crystal field so they line up perfectly.
  // ---------------------------------------------------------------------------

  const GRANITE_BLOCK_COLS = 4;
  const GRANITE_BLOCK_ROWS = 6;
  const GRANITE_GAP_PX = 5;        // mortar groove width, in pixels (NM_SIZE space)

  // Cheap deterministic 2D hash → [0, 1). Used to colour granite crystals
  // and seed the per-pixel bump layer. Keeps the texture reproducible
  // alongside `rand()` (which advances seed state on every call and would
  // be wasteful for ~65k samples).
  function hash2(x, y) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  // Returns true if (x, y) lies inside a block (i.e. NOT in the mortar gap).
  function graniteInsideBlock(x, y, size) {
    const colW = size / GRANITE_BLOCK_COLS;
    const rowH = size / GRANITE_BLOCK_ROWS;
    const ix = Math.floor(x / colW);
    const iy = Math.floor(y / rowH);
    // Stagger every other row by half a block — looks like real ashlar.
    const offX = (iy % 2) * (colW * 0.5);
    const localX = ((x - offX) % colW + colW) % colW;
    const localY = y % rowH;
    return localX >= GRANITE_GAP_PX && localX <= colW - GRANITE_GAP_PX
        && localY >= GRANITE_GAP_PX && localY <= rowH - GRANITE_GAP_PX;
  }

  // Albedo: warm-grey base with speckled mineral grains (white quartz,
  // black biotite, occasional pink feldspar). Mortar drawn darker on top.
  const graniteCanvas = drawTexture(NM_SIZE, (ctx, size) => {
    // Block fill — base tone with per-pixel speckle.
    const img = ctx.createImageData(size, size);
    const px = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const inside = graniteInsideBlock(x, y, size);
        let r, g, b;
        if (!inside) {
          // Mortar — dark warm grey, slightly varying.
          const t = 0.32 + hash2(x * 0.7, y * 0.7) * 0.06;
          r = t * 255; g = t * 250; b = t * 240;
        } else {
          // Granite base + crystal speckle. Three crystal types picked by
          // a second hash; weights skew toward grey/dark so pink crystals
          // are an accent.
          const baseT = 0.55 + hash2(x * 0.13, y * 0.17) * 0.15;
          const k = hash2(x * 0.9 + 3.1, y * 0.9 + 7.3);
          if (k < 0.06)        { r = 245; g = 215; b = 210; }      // pink feldspar
          else if (k < 0.20)   { r =  35; g =  35; b =  40; }      // dark biotite
          else if (k < 0.38)   { r = 240; g = 240; b = 232; }      // white quartz
          else {
            const v = baseT * 255;
            r = v * 1.02; g = v * 1.00; b = v * 0.95;
          }
        }
        const i = (y * size + x) * 4;
        px[i] = r | 0; px[i + 1] = g | 0; px[i + 2] = b | 0; px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // MR: granite is moderately polished (G≈0.42) inside blocks, mortar is
  // very rough (G≈0.92). All dielectric (B = 0). Slight per-pixel jitter
  // adds non-uniform sheen so reflections aren't a hard line at the
  // mortar edge.
  const graniteMRCanvas = drawTexture(NM_SIZE, (ctx, size) => {
    const img = ctx.createImageData(size, size);
    const px = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const inside = graniteInsideBlock(x, y, size);
        const jitter = hash2(x * 1.7, y * 2.3) * 0.06 - 0.03;
        const g = inside ? (0.42 + jitter) : (0.92 + jitter * 0.5);
        const i = (y * size + x) * 4;
        px[i] = 0;
        px[i + 1] = (g * 255) | 0;
        px[i + 2] = 0;
        px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Normal map: each block reads as a 3D pillow with deep mortar
  // grooves between blocks. The dominant signal is a block-scale dome
  // (centre high, edges sloping down to the mortar) — that's what
  // makes the surface look obviously bumpy at any camera distance,
  // not just at grazing angles. On top of the dome we layer
  // mid-frequency wavy noise + crystal speckle for surface texture.
  function buildGraniteHeights() {
    const h = new Float32Array(NM_SIZE * NM_SIZE);
    const colW = NM_SIZE / GRANITE_BLOCK_COLS;
    const rowH = NM_SIZE / GRANITE_BLOCK_ROWS;
    for (let y = 0; y < NM_SIZE; y++) {
      for (let x = 0; x < NM_SIZE; x++) {
        const iy = Math.floor(y / rowH);
        const offX = (iy % 2) * (colW * 0.5);
        const localX = ((x - offX) % colW + colW) % colW;
        const localY = y % rowH;
        const edgeX = Math.min(localX - GRANITE_GAP_PX, colW - GRANITE_GAP_PX - localX);
        const edgeY = Math.min(localY - GRANITE_GAP_PX, rowH - GRANITE_GAP_PX - localY);
        const edge = Math.min(edgeX, edgeY);
        if (edge < 0) {
          // Deep mortar gap — far below block height. Big drop drives
          // the seam shadow in grazing light.
          h[y * NM_SIZE + x] = 0.05 + hash2(x * 0.5, y * 0.5) * 0.02;
          continue;
        }
        // Block-scale dome: position within the block (0..1 from edge
        // to centre). A block at colW=64 px and rowH=42 px has centres
        // at 32 / 21 px from the edge, so distFromCentre / halfBlock
        // gives the relative position cleanly.
        const halfW = colW * 0.5 - GRANITE_GAP_PX;
        const halfH = rowH * 0.5 - GRANITE_GAP_PX;
        const cxRel = (localX - GRANITE_GAP_PX) / halfW - 1.0; // -1..+1 across width
        const cyRel = (localY - GRANITE_GAP_PX) / halfH - 1.0; // -1..+1 across height
        // Smoothed paraboloid: max at centre (0, 0), zero at edges.
        // 1 - max(|cxRel|, |cyRel|)^1.6 makes the dome slope sharper
        // toward the edges where the mortar groove is. Values clamp
        // to [0, 1].
        const r = Math.max(Math.abs(cxRel), Math.abs(cyRel));
        const dome = Math.max(0, 1 - Math.pow(r, 1.6));
        // Block base sits between 0.30 (edge of the dome) and 0.95
        // (centre). 0.65 of dynamic range in the dome alone — that's
        // what shapes the "pillow" silhouette in the rendered normal.
        const blockBase = 0.30 + dome * 0.65;
        // Mid-frequency surface texture so the dome doesn't look
        // perfectly smooth. Two sinusoidal harmonics; small amplitude
        // because the dome already drives most of the perturbation.
        const u = x / NM_SIZE, v = y / NM_SIZE;
        const wavy =
            0.03 * Math.sin(u * 22.0 + v * 13.0)
          + 0.02 * Math.cos(u * 31.0 - v * 17.0);
        // Crystal speckle — taller bumps that catch grazing highlights
        // as fine sparkle across the dome face.
        const noise = hash2(x * 0.93, y * 0.93);
        const speckle = noise > 0.50 ? (noise - 0.50) * 0.20 : 0;
        const crystal = noise > 0.90 ? (noise - 0.90) * 0.60 : 0;
        h[y * NM_SIZE + x] = blockBase + wavy + speckle + crystal;
      }
    }
    return h;
  }
  const graniteHeights = buildGraniteHeights();
  // Bump strength 6 — the block-scale dome is what dominates here
  // (height varies from 0.05 mortar to 0.95 centre = 0.9 of range over
  // ~30 px), which gives ~0.18 dh/dx → with bump=6 that's ~1.1, a
  // strong tilt without saturating into degenerate grazing normals.
  const graniteNormalCanvas = drawNormalMap(NM_SIZE, 6.0, (x, y) => graniteHeights[y * NM_SIZE + x]);

  // Register the canvases as SceneTextures. `imageData` accepts anything
  // `texSubImage2D` understands — HTMLCanvasElement is one of those forms.
  mustCreate(sceneModel.createTexture({ id: "tex_brick",     mipmap: true, image: brickCanvas    }));
  mustCreate(sceneModel.createTexture({ id: "tex_stone",     mipmap: true,image: stoneCanvas    }));
  mustCreate(sceneModel.createTexture({ id: "tex_marble",    mipmap: true,image: marbleCanvas   }));
  mustCreate(sceneModel.createTexture({ id: "mr_brick",     mipmap: true, image: brickMRCanvas  }));
  mustCreate(sceneModel.createTexture({ id: "mr_stone",      mipmap: true,image: stoneMRCanvas  }));
  mustCreate(sceneModel.createTexture({ id: "mr_marble",     mipmap: true,image: marbleMRCanvas }));
  mustCreate(sceneModel.createTexture({ id: "tex_copper",  mipmap: true,  image: copperColorCanvas }));
  mustCreate(sceneModel.createTexture({ id: "mr_copper",    mipmap: true, image: copperMRCanvas }));
  mustCreate(sceneModel.createTexture({ id: "nm_brick",     mipmap: true, image: brickNormalCanvas  }));
  mustCreate(sceneModel.createTexture({ id: "nm_stone",     mipmap: true, image: stoneNormalCanvas  }));
  mustCreate(sceneModel.createTexture({ id: "nm_marble",    mipmap: true, image: marbleNormalCanvas }));
  mustCreate(sceneModel.createTexture({ id: "nm_copper",    mipmap: true, image: copperNormalCanvas }));
  mustCreate(sceneModel.createTexture({ id: "tex_granite", mipmap: true,  image: graniteCanvas       }));
  mustCreate(sceneModel.createTexture({ id: "mr_granite",   mipmap: true, image: graniteMRCanvas     }));
  mustCreate(sceneModel.createTexture({ id: "nm_granite",   mipmap: true, image: graniteNormalCanvas }));

  // Textured material variants — colour set to white so the texture's
  // own pixel values dominate (the shader multiplies vColor through as a
  // tint, so material.color tweaks the texture's output without
  // colour-correcting it back into the catalogue range). For MR textures
  // we set roughness AND metallic to 1 so the texture's G/B channels
  // drive both values directly (the shader multiplies factor × texture,
  // so material.metallic = 0 would suppress the texture's metalness
  // entirely — that bug, on first attempt, was what made dielectric
  // surfaces look identical with vs without an MR texture).
  mustCreate(sceneModel.createMaterial({
    id: "TERRACOTTA_TEX",
    color: [1.0, 1.0, 1.0],
    roughness: 1.0,
    metallic: 1.0,
    colorTextureId: "tex_brick",
    metallicRoughnessTextureId: "mr_brick",
    normalsTextureId: "nm_brick"
  }));
  mustCreate(sceneModel.createMaterial({
    id: "CONCRETE_TEX",
    color: [1.0, 1.0, 1.0],
    roughness: 1.0,
    metallic: 1.0,
    colorTextureId: "tex_stone",
    metallicRoughnessTextureId: "mr_stone",
    normalsTextureId: "nm_stone"
  }));
  mustCreate(sceneModel.createMaterial({
    id: "MARBLE_TEX",
    color: [1.0, 1.0, 1.0],
    roughness: 1.0,
    metallic: 1.0,
    colorTextureId: "tex_marble",
    metallicRoughnessTextureId: "mr_marble",
    normalsTextureId: "nm_marble"
  }));

  // Corroded copper dome cap. Three coordinated textures share the
  // same corrosion mask: the albedo map paints verdigris green over
  // the copper base in patches; the MR map flips those same patches
  // from metallic-smooth to dielectric-rough (oxide isn't metal); the
  // normal map adds verdigris pitting where the mask is strong and
  // smooths bare-metal speckles flat. Material `color = white` so the
  // texture's pixel values drive the BRDF F0 and diffuse colour
  // unmodified — copper F0 in clean spots, verdigris colour where the
  // patina has set in.
  mustCreate(sceneModel.createMaterial({
    id: "COPPER_TEX",
    color: [1.0, 1.0, 1.0],
    roughness: 1.0,
    metallic: 1.0,
    colorTextureId: "tex_copper",
    metallicRoughnessTextureId: "mr_copper",
    normalsTextureId: "nm_copper"
  }));

  // Granite-block variant — coarse ashlar masonry pattern with deep
  // mortar grooves and crystal-speckled faces. The normal map carries
  // the bulk of the visual: each block stands proud with chamfered
  // edges that catch sunlight, and the crystal bumps inside each block
  // sparkle the GGX specular under the prefiltered cubemap.
  mustCreate(sceneModel.createMaterial({
    id: "GRANITE_TEX",
    color: [1.0, 1.0, 1.0],
    roughness: 1.0,
    metallic: 1.0,
    colorTextureId: "tex_granite",
    metallicRoughnessTextureId: "mr_granite",
    normalsTextureId: "nm_granite"
  }));

  // ---------------------------------------------------------------------------
  // Showcase materials. Each one isolates ONE pipeline feature so the
  // central plinth row reads as a side-by-side test rig:
  //
  //   - SHOWCASE_CHROME       — pristine smooth metal, no textures.
  //                             Pure GGX + prefiltered cubemap reflection.
  //   - SHOWCASE_MARBLE_W     — smooth white dielectric, no textures.
  //                             Soft Fresnel rim + diffuse IBL.
  //   - SHOWCASE_MATTE        — fully rough dielectric, no textures.
  //                             Pure Lambert + cosine irradiance, no
  //                             specular highlight. The "no spec ever"
  //                             reference point.
  //   - SHOWCASE_GOLD_TARN    — pristine gold metal with a tiny hint of
  //                             roughness. Demonstrates wavelength-
  //                             tinted Fresnel (gold's coloured F0).
  //   - SHOWCASE_ALBEDO_ONLY  — colour-texture map only (no MR, no
  //                             normal). Shows what naked diffuse
  //                             texturing buys you.
  //   - SHOWCASE_NORMAL_ONLY  — flat-grey base + brick normal map only.
  //                             Surface relief in isolation, no MR/colour.
  //   - SHOWCASE_MR_ONLY      — flat-grey base + a roughness-gradient
  //                             MR map. Side-by-side mirror→matte on
  //                             one sphere.
  //   - MARBLE_TEX            — full PBR (colour + MR + normal). The
  //                             "everything turned on" reference.
  //   - COPPER_TEX            — corroded copper. Multi-channel coordinated
  //                             corrosion mask driving all three maps.
  // ---------------------------------------------------------------------------

  // 1×1 white texture for the colour slot of normal-only / MR-only
  // demos. Atlas always packs a sub-rect; the white pixel makes the
  // diffuse layer a multiplicative passthrough so the relevant feature
  // (normal map / MR map) drives the entire BRDF response.
  const whiteCanvas = drawTexture(8, (ctx, size) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
  });

  // Roughness-gradient MR map for the MR-isolated demo. Vertical
  // gradient: top is mirror-smooth metal (G≈0.05, B=255), bottom is
  // very rough metal (G≈0.95, B=255). When wrapped on a sphere, the
  // top reflects the cubemap sharply while the bottom blurs it
  // through the highest prefilter mip — a clean visual contrast on a
  // single object.
  const mrGradientCanvas = drawTexture(256, (ctx, size) => {
    const img = ctx.createImageData(size, size);
    const px = img.data;
    for (let y = 0; y < size; y++) {
      const t = y / size; // 0 at top → 1 at bottom
      const g = (0.05 + t * 0.90) * 255;
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        px[i] = 0;
        px[i + 1] = g | 0;
        px[i + 2] = 255;
        px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  mustCreate(sceneModel.createTexture({ id: "tex_white",      image: whiteCanvas      }));
  mustCreate(sceneModel.createTexture({ id: "mr_gradient",    image: mrGradientCanvas }));

  // Plain (no-texture) showcase materials. Each isolates a specific
  // dielectric/metal/roughness combo so the BRDF's analytical response
  // is on display unmuddied by any texture variation.
  mustCreate(sceneModel.createMaterial({
    id: "SHOWCASE_CHROME",
    color: [0.97, 0.96, 0.91], // chromium F0
    roughness: 0.04,
    metallic: 1.0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "SHOWCASE_MARBLE_W",
    color: [0.92, 0.92, 0.90],
    roughness: 0.18,
    metallic: 0.0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "SHOWCASE_MATTE",
    color: [0.55, 0.55, 0.55],
    roughness: 0.95,
    metallic: 0.0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "SHOWCASE_GOLD_PLAIN",
    color: [1.00, 0.78, 0.34], // gold F0 from Khronos table
    roughness: 0.10,
    metallic: 1.0
  }));

  // One-aspect-only demos. Shared `tex_white` keeps the diffuse a flat
  // multiplier so the demonstrated feature stands alone.
  mustCreate(sceneModel.createMaterial({
    id: "SHOWCASE_ALBEDO_ONLY",
    color: [1.0, 1.0, 1.0],
    roughness: 0.55,
    metallic: 0.0,
    colorTextureId: "tex_brick" // brick pattern, no MR, no normal
  }));
  mustCreate(sceneModel.createMaterial({
    id: "SHOWCASE_NORMAL_ONLY",
    color: [0.75, 0.75, 0.75], // neutral grey so the bumps read by lighting
    roughness: 0.40,
    metallic: 0.0,
    colorTextureId: "tex_white",
    normalsTextureId: "nm_brick" // brick relief on a featureless surface
  }));
  mustCreate(sceneModel.createMaterial({
    id: "SHOWCASE_MR_ONLY",
    color: [1.00, 0.78, 0.34], // gold F0 — bright roughness contrast
    roughness: 1.0,
    metallic: 1.0,
    colorTextureId: "tex_white",
    metallicRoughnessTextureId: "mr_gradient"
  }));

  M.TERRACOTTA_TEX = "TERRACOTTA_TEX";
  M.CONCRETE_TEX   = "CONCRETE_TEX";
  M.MARBLE_TEX     = "MARBLE_TEX";
  M.COPPER_TEX     = "COPPER_TEX";
  M.GRANITE_TEX    = "GRANITE_TEX";
  M.SHOWCASE_CHROME       = "SHOWCASE_CHROME";
  M.SHOWCASE_MARBLE_W     = "SHOWCASE_MARBLE_W";
  M.SHOWCASE_MATTE        = "SHOWCASE_MATTE";
  M.SHOWCASE_GOLD_PLAIN   = "SHOWCASE_GOLD_PLAIN";
  M.SHOWCASE_ALBEDO_ONLY  = "SHOWCASE_ALBEDO_ONLY";
  M.SHOWCASE_NORMAL_ONLY  = "SHOWCASE_NORMAL_ONLY";
  M.SHOWCASE_MR_ONLY      = "SHOWCASE_MR_ONLY";

  // Pick from a weighted list — the weights sum doesn't have to be 1, the
  // helper normalises. Using rand() (the seeded PRNG) keeps the layout
  // reproducible across reloads.
  function pickWeighted(table) {
    let total = 0;
    for (const w of table) total += w[1];
    const t = rand() * total;
    let acc = 0;
    for (const [val, w] of table) {
      acc += w;
      if (t < acc) return val;
    }
    return table[table.length - 1][0];
  }

  // Material lookup tables. Keep these small and themed so the cityscape
  // reads as a coherent place — no random "concrete tower with a silver
  // dome", but plenty of marble drums + copper caps. Textured variants
  // are folded in alongside their flat-coloured siblings so reloading
  // the example shows a healthy mix of textured and untextured surfaces
  // (the renderer routes both through the atlas-bound shader; the
  // untextured ones sample the atlas's white sentinel).
  const BODY_DIELECTRICS = [
    [M.CONCRETE,     2.0],
    [M.CONCRETE_TEX, 1.2],
    [M.GRANITE_TEX,  1.6],
    [M.STUCCO_BLUE,  1.0],
    [M.STUCCO_TAN,   0.9],
    [M.MARBLE,       0.5],
    [M.MARBLE_TEX,   0.4]
  ];

  const TOWER_BODIES = [
    [M.MARBLE,      1.2],
    [M.MARBLE_TEX,  0.8],
    [M.GRANITE_TEX, 1.0],
    [M.CONCRETE,    0.8],
    [M.STUCCO_BLUE, 0.4]
  ];

  // Caps and finials — the parts where smooth normals + GGX specular pay
  // off the most. Mostly metallic so the cityscape gets a few catchy
  // glints from the sun, with the textured terracotta variant standing
  // in for traditional clay roof tiles.
  const ROOF_METALS = [
    [M.COPPER,         1.4],
    [M.COPPER_TEX,     1.4],
    [M.BRONZE,         1.2],
    [M.GOLD,           0.5],
    [M.TERRACOTTA,     0.8],
    [M.TERRACOTTA_TEX, 1.4]
  ];

  const FINIAL_METALS = [
    [M.GOLD,    1.5],
    [M.COPPER,  1.5],
    [M.BRONZE,  1.0],
    [M.SILVER,  0.7],
    [M.ALUMINUM, 0.7]
  ];

  function placeCuboid(cx, cy, half, h) {
    const body = pickWeighted(BODY_DIELECTRICS);
    placePart("box", [cx, cy, h / 2], [half, half, h / 2], body);
  }

  function placeTower(cx, cy, radius, h) {
    const body = pickWeighted(TOWER_BODIES);
    const cap  = pickWeighted(ROOF_METALS);
    placePart("cylinder", [cx, cy, h / 2], [radius, h / 2, radius], body, CYL_UPRIGHT);
    // Hemispherical cap — full sphere scaled flat and seated on the cylinder.
    placePart("sphere", [cx, cy, h], [radius, radius, radius * 0.6], cap);
  }

  function placeDomedHall(cx, cy, half, baseH) {
    const body = pickWeighted(BODY_DIELECTRICS);
    const dome = pickWeighted(ROOF_METALS);
    placePart("box", [cx, cy, baseH / 2], [half, half, baseH / 2], body);
    // Dome sized to fill the building footprint, sitting on top of the box.
    placePart("sphere", [cx, cy, baseH], [half, half, half * 0.85], dome);
  }

  function placeStepped(cx, cy, half, h) {
    // Both tiers share the same body material so the building reads as one
    // piece rather than two stacked colours.
    const body = pickWeighted(BODY_DIELECTRICS);
    const lowerH = h * 0.65;
    const upperH = h - lowerH;
    placePart("box", [cx, cy, lowerH / 2], [half, half, lowerH / 2], body);
    placePart("box",
      [cx, cy, lowerH + upperH / 2],
      [half * 0.6, half * 0.6, upperH / 2],
      body);
  }

  function placeOrbSpire(cx, cy, half, h) {
    // Slim marble shaft with a polished metallic finial — least common
    // building type, sprinkled in sparingly so each one reads as a landmark.
    const shaft = pickWeighted([[M.MARBLE, 1.5], [M.CONCRETE, 1.0]]);
    const finial = pickWeighted(FINIAL_METALS);
    const shaftR = half * 0.35;
    placePart("cylinder", [cx, cy, h / 2], [shaftR, h / 2, shaftR], shaft, CYL_UPRIGHT);
    placePart("sphere", [cx, cy, h + half * 0.3], [half * 0.5, half * 0.5, half * 0.5], finial);
  }

  // ---------------------------------------------------------------------------
  // Layout grid — declared up front because the plinth helper below
  // sizes itself relative to `slotSize`.
  // ---------------------------------------------------------------------------

  const slotSize    = 6;     // metres per building slot
  const numSlots    = 6;     // slots per side
  const halfCity    = (numSlots * slotSize) / 2;
  const cityExtent  = numSlots * slotSize;

  // ---------------------------------------------------------------------------
  // Plinth + showcase. Each of the 9 centre slots gets a short stone
  // plinth with a curved object on top demonstrating one PBR pipeline
  // feature. All plinths share the granite-block material so the row
  // reads as a coherent display rather than nine isolated buildings.
  // ---------------------------------------------------------------------------

  const PLINTH_HALF = slotSize * 0.34;  // plinth footprint half-width
  const PLINTH_HEIGHT = 4.5;            // plinth top height (Z)
  const SHOWCASE_RADIUS = slotSize * 0.22; // characteristic size of the object

  /**
   * Places one plinth + one showcase object on top.
   *
   * @param shape One of "sphere" | "halfsphere" | "torus" | "cylinder" | "box"
   * @param showcaseMaterial Material id for the object on top
   */
  function placePlinth(cx, cy, shape, showcaseMaterial) {
    // Plinth — uniform across all 9 to anchor the showcase visually.
    placePart("box",
      [cx, cy, PLINTH_HEIGHT / 2],
      [PLINTH_HALF, PLINTH_HALF, PLINTH_HEIGHT / 2],
      M.GRANITE_TEX);

    // Object centre sits a small lift above the plinth top so it
    // doesn't visually merge with the granite.
    const objBaseZ = PLINTH_HEIGHT + SHOWCASE_RADIUS * 0.05;
    switch (shape) {
      case "sphere":
        placePart("sphere",
          [cx, cy, objBaseZ + SHOWCASE_RADIUS],
          [SHOWCASE_RADIUS, SHOWCASE_RADIUS, SHOWCASE_RADIUS],
          showcaseMaterial);
        break;
      case "halfsphere":
        // Sphere flattened in Z so the equator sits on the plinth top.
        placePart("sphere",
          [cx, cy, objBaseZ],
          [SHOWCASE_RADIUS, SHOWCASE_RADIUS, SHOWCASE_RADIUS * 1.0],
          showcaseMaterial);
        break;
      case "torus":
        // Torus is built around its local +Z (XY plane); rotate so it
        // stands like a ring on edge for a more interesting silhouette.
        placePart("torus",
          [cx, cy, objBaseZ + SHOWCASE_RADIUS],
          [SHOWCASE_RADIUS, SHOWCASE_RADIUS, SHOWCASE_RADIUS],
          showcaseMaterial,
          [90, 0, 0]);
        break;
      case "cylinder":
        // Squat upright cylinder — disc-like, shows the wrap-around
        // texture mapping clearly.
        placePart("cylinder",
          [cx, cy, objBaseZ + SHOWCASE_RADIUS * 0.7],
          [SHOWCASE_RADIUS, SHOWCASE_RADIUS * 0.7, SHOWCASE_RADIUS],
          showcaseMaterial,
          CYL_UPRIGHT);
        break;
      case "box":
        // Cube tilted 30° around Z so the side flat faces the camera
        // — albedo-only demos read more clearly with a face-on view of
        // the texture, not edge-on.
        placePart("box",
          [cx, cy, objBaseZ + SHOWCASE_RADIUS * 0.85],
          [SHOWCASE_RADIUS, SHOWCASE_RADIUS, SHOWCASE_RADIUS * 0.85],
          showcaseMaterial,
          [0, 0, 30]);
        break;
    }
  }

  /**
   * Showcase grid mapped to the central 3×3 slots (i, j) ∈ {2..4}².
   * Each entry pairs a shape with the material that best demonstrates
   * its target pipeline feature. Covers: pure analytical PBR (chrome,
   * marble, matte, gold), single-feature texture isolation (albedo,
   * normal, MR), and full multi-channel coordination (corroded
   * copper, full-PBR marble).
   */
  const SHOWCASE_GRID = [
    // (i-2) + (j-2)*3 → entry index 0..8.
    /* (0,0) */ { shape: "sphere",     material: M.SHOWCASE_CHROME       }, // pristine smooth metal
    /* (1,0) */ { shape: "sphere",     material: M.SHOWCASE_MARBLE_W     }, // smooth dielectric
    /* (2,0) */ { shape: "sphere",     material: M.SHOWCASE_MATTE        }, // fully rough dielectric
    /* (0,1) */ { shape: "box",        material: M.SHOWCASE_ALBEDO_ONLY  }, // colour-texture only
    /* (1,1) */ { shape: "torus",      material: M.MARBLE_TEX            }, // full PBR (colour + MR + normal)
    /* (2,1) */ { shape: "halfsphere", material: M.SHOWCASE_MR_ONLY      }, // MR-gradient sphere
    /* (0,2) */ { shape: "sphere",     material: M.SHOWCASE_NORMAL_ONLY  }, // bumps in isolation
    /* (1,2) */ { shape: "sphere",     material: M.COPPER_TEX            }, // corroded copper
    /* (2,2) */ { shape: "cylinder",   material: M.SHOWCASE_GOLD_PLAIN   }  // pristine coloured-F0 metal
  ];

  // ---------------------------------------------------------------------------
  // Layout — a 6×6 ring of city blocks. Heights and presets are biased
  // by distance to the centre so the downtown is taller and more varied.
  // (Grid constants `slotSize`, `numSlots`, etc. are declared earlier
  // because the plinth helper sizes itself off them.)
  // ---------------------------------------------------------------------------

  // Ground slab — dark slate so the bright metallic finials and white
  // marble drums pop. Flat top means the normals path produces the same
  // result as the flat-shaded fallback would, so the slab serves as a
  // visual reference point for the smoother surfaces around it.
  placePart("box",
    [0, 0, -0.05],
    [cityExtent * 0.55, cityExtent * 0.55, 0.1],
    M.SLATE);

  for (let i = 0; i < numSlots; i++) {
    for (let j = 0; j < numSlots; j++) {
      const cx = i * slotSize - halfCity + slotSize / 2;
      const cy = j * slotSize - halfCity + slotSize / 2;

      // Centre 3×3 (slot indices 2..4 in each axis) is the PBR
      // showcase: each plinth carries a different curved object that
      // demonstrates one feature of the rendering pipeline. Skips the
      // procedural building generation entirely for these slots.
      if (i >= 2 && i <= 4 && j >= 2 && j <= 4) {
        const showcaseIndex = (i - 2) + (j - 2) * 3;
        const showcase = SHOWCASE_GRID[showcaseIndex];
        placePlinth(cx, cy, showcase.shape, showcase.material);
        continue;
      }

      // Distance from city centre, normalised to [0, 1].
      const nx = (i + 0.5) / numSlots - 0.5;
      const ny = (j + 0.5) / numSlots - 0.5;
      const distNorm = Math.min(1, Math.hypot(nx, ny) / 0.5);

      const maxH = 16 - distNorm * 11;            // 16 m downtown → 5 m outskirts
      const h    = Math.max(2.5, rand() * maxH);
      const half = slotSize * 0.36;                // building footprint half-width

      // Type roulette weighted by location — towers and domes cluster
      // downtown for visual variety where the camera will look first.
      // Material pickers internally choose body and accent colours, so the
      // building presets only need geometric inputs from here. Note: the
      // distNorm thresholds below were tuned for the old "downtown is
      // dense" feel; with the centre 3×3 now being plinths, the
      // remaining ring is mostly outskirts, so the towers/domes/spires
      // bands here apply at the edges of the showcase ring.
      const r = rand();
      let preset;
      if (distNorm < 0.42) {
        preset = r < 0.30 ? "tower"
               : r < 0.55 ? "domed"
               : r < 0.75 ? "stepped"
               : r < 0.92 ? "cuboid"
               : "spire";
      } else if (distNorm < 0.7) {
        preset = r < 0.55 ? "cuboid"
               : r < 0.78 ? "stepped"
               : r < 0.92 ? "domed"
               : "tower";
      } else {
        preset = r < 0.85 ? "cuboid" : "stepped";
      }

      switch (preset) {
        case "tower":
          placeTower(cx, cy, half * 0.85, h);
          break;
        case "domed":
          placeDomedHall(cx, cy, half, h * 0.7);
          break;
        case "stepped":
          placeStepped(cx, cy, half, h);
          break;
        case "spire":
          placeOrbSpire(cx, cy, half, h * 1.4);
          break;
        case "cuboid":
        default:
          placeCuboid(cx, cy, half, h);
          break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // View — perspective camera framed on the city, with SAO + cascaded
  // directional shadows + Layer-1 IBL turned on. The hemisphere IBL is what
  // most clearly reveals the smooth-shaded path: ground-facing fragments
  // pick up the warm ground colour while sky-facing ones pick up the cool
  // sky colour, and the gradient flows across each curved surface instead
  // of stair-stepping per face.
  // ---------------------------------------------------------------------------

  const view = studio.viewManager.createView({
    camera: {
      eye:  [halfCity * 1.6, -halfCity * 1.6, halfCity * 1.4],
      look: [0, 0, 5],
      up:   [0, 0, 1]
    },
    effects: {
      edges: {
        renderModes:[]
      },
      shadows: {
       // renderModes: []
      }
    }
  });

  const QR = xeokit.base.constants.DetailedRender;

  view.effects.sao.renderModes = [QR];
  view.effects.sao.intensity = 0.25;
  view.effects.sao.kernelRadius = 60;

  view.effects.shadows.renderModes = [QR];
  view.effects.shadows.intensity = 0.55;
  view.effects.shadows.cascadeCount = 3;
  view.effects.shadows.pcfKernelSize = 3;
  view.effects.shadows.resolution = 2048;
  view.effects.shadows.direction = [-0.45, -0.35, -0.80];

  view.lights.ibl.intensity = 0.1;
  view.lights.hemispheric.skyColor    = [0.62, 0.72, 0.86];
  view.lights.hemispheric.groundColor = [0.42, 0.36, 0.30];
  // Tilt the IBL hemisphere to face the sun so the lit and ambient terms
  // agree on which side of each building is "up toward the light".
  const sd = view.effects.shadows.direction;
  const sl = Math.hypot(sd[0], sd[1], sd[2]) || 1;
  view.lights.hemispheric.worldUp = [-sd[0] / sl, -sd[1] / sl, -sd[2] / sl];

  view.effects.tonemap.mode = "aces";

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
