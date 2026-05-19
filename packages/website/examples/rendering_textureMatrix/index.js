// Rendering-paths matrix.
//
// 4×4 grid of brick-textured spheres laid out so every cell
// exercises a distinct shader variant the renderer ships:
//
//   Rows (geometry attributes):
//     0 — normals + UVs            → smooth + UV-attribute path
//     1 — normals, NO UVs          → smooth + triplanar fallback
//     2 — NO normals, UVs          → flat-shaded + UV-attribute path
//     3 — NO normals, NO UVs       → flat-shaded + triplanar fallback
//
//   Columns (material / texture options):
//     0 — no texture (vColor only) → un-textured shader path
//     1 — textured, mipmap = false → trilinear-off, point-sampled mip 0
//     2 — textured, mipmap = true  → trilinear, mipped atlas
//     3 — textured, mipmap = true, triplanarScale = 4
//                                  → only differs from col 2 on rows 1 and 3
//                                    (triplanar widens the world-space tile)
//
// Layout in scene units:
//   x: column index × 3 metres
//   z: row index × 3 metres (Z is up; rows stack vertically)
//
// Camera is angled so each sphere shows both a head-on face (good
// for comparing close-up texture detail) and a grazing edge (good
// for spotting mip-aliasing on the no-mip column).

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const { scene } = studio;

  // ── View ───────────────────────────────────────────────────────
  // Camera framed at the grid centre, slightly above and to one
  // side so grazing-angle aliasing on the no-mip column shows up.
  studio.viewManager.createView({
    camera: {
      projection: "perspective",
      far: 1000000,
      eye:  [16, -10, 10],
      look: [4.5, 4.5, 4.5],
      up:   [0, 0, 1]
    }
  });

  // ── Brick textures ────────────────────────────────────────────
  // One paint pass produces colour + normal-map + metallic-roughness
  // canvases; reused by every textured cell so all variants sample
  // identical source pixels and any visual difference is purely the
  // shader path / sampler state.
  const brick = xeokit.model.procgen.paintMaterials.paintBrick(256);

  const sceneModel = mustCreate(scene.createModel({
    id: "matrixModel"
  }));

  // ── Geometries: four (normals, uvs) combinations ──────────────
  // The sphere generator produces both arrays; we strip them
  // selectively per geometry id so MeshManager batches each row's
  // meshes through a different (hasNormals, hasUVs) shader variant.
  const sphere = mustBuild(xeokit.model.procgen.buildGeometry.buildSphere({
    radius: 1,
    widthSegments: 32,
    heightSegments: 32
  }));

  const TRI = xeokit.base.constants.TrianglesPrimitive;

  mustCreate(sceneModel.createGeometry({
    id: "sphere_NU",   // Normals + UVs
    primitive: TRI,
    positions: sphere.positions,
    normals:   sphere.normals,
    uvs:       sphere.uv,
    indices:   sphere.indices
  }));
  mustCreate(sceneModel.createGeometry({
    id: "sphere_N",    // Normals only
    primitive: TRI,
    positions: sphere.positions,
    normals:   sphere.normals,
    indices:   sphere.indices
  }));
  mustCreate(sceneModel.createGeometry({
    id: "sphere_U",    // UVs only
    primitive: TRI,
    positions: sphere.positions,
    uvs:       sphere.uv,
    indices:   sphere.indices
  }));
  mustCreate(sceneModel.createGeometry({
    id: "sphere_0",    // Neither
    primitive: TRI,
    positions: sphere.positions,
    indices:   sphere.indices
  }));

  // Geometries indexed by row.
  const geomByRow = ["sphere_NU", "sphere_N", "sphere_U", "sphere_0"];

  // ── Textures × mipmap variants ────────────────────────────────
  // Two flavours of every brick texture — one mipped, one not —
  // because the per-batch atlas's mipmap mode is decided by the
  // textures' mipmap flag.
  function makeTextureSet(suffix, mipmap) {
    // `paintBrick` returns `MaterialPixelBuffer`s (`{data, width,
    // height}`), not canvases — so the textures take them through
    // `imageData`, which the SceneTexture constructor normalises to
    // a DOM `ImageData` for the renderer to upload via
    // `texSubImage2D`. The `image` field is only for already-decoded
    // `HTMLCanvasElement` / `ImageBitmap` / etc.
    mustCreate(sceneModel.createTexture({
      id:        `tex_color_${suffix}`,
      imageData: brick.color,
      encoding:  xeokit.base.constants.sRGBEncoding,
      mipmap
    }));
    mustCreate(sceneModel.createTexture({
      id:        `tex_normal_${suffix}`,
      imageData: brick.normal,
      encoding:  xeokit.base.constants.LinearEncoding,
      mipmap
    }));
    mustCreate(sceneModel.createTexture({
      id:        `tex_mr_${suffix}`,
      imageData: brick.mr,
      encoding:  xeokit.base.constants.LinearEncoding,
      mipmap
    }));
  }
  makeTextureSet("nomip", false);
  makeTextureSet("mip",   true);

  // ── Materials per column ──────────────────────────────────────
  // Col 0 is vColor only (no textures) so the un-textured path
  // gets exercised on every row.
  // Cols 1–3 each bind the brick textures with progressively
  // different sampler state.
  mustCreate(sceneModel.createMaterial({
    id:        "mat_plain",
    color:     [0.85, 0.55, 0.45],   // terracotta-ish, so the
    roughness: 0.7,                   // un-textured cells read as
    metallic:  0.0                    // visibly "the same family"
  }));
  mustCreate(sceneModel.createMaterial({
    id:                         "mat_brick_nomip",
    color:                      [1.0, 1.0, 1.0],
    roughness:                  0.7,
    metallic:                   0.0,
    colorTextureId:             "tex_color_nomip",
    normalsTextureId:           "tex_normal_nomip",
    metallicRoughnessTextureId: "tex_mr_nomip",
    triplanarScale:             1.0
  }));
  mustCreate(sceneModel.createMaterial({
    id:                         "mat_brick_mip",
    color:                      [1.0, 1.0, 1.0],
    roughness:                  0.7,
    metallic:                   0.0,
    colorTextureId:             "tex_color_mip",
    normalsTextureId:           "tex_normal_mip",
    metallicRoughnessTextureId: "tex_mr_mip",
    triplanarScale:             1.0
  }));
  mustCreate(sceneModel.createMaterial({
    id:                         "mat_brick_mip_tri4",
    color:                      [1.0, 1.0, 1.0],
    roughness:                  0.7,
    metallic:                   0.0,
    colorTextureId:             "tex_color_mip",
    normalsTextureId:           "tex_normal_mip",
    metallicRoughnessTextureId: "tex_mr_mip",
    triplanarScale:             4.0
  }));
  const matByCol = [
    "mat_plain",
    "mat_brick_nomip",
    "mat_brick_mip",
    "mat_brick_mip_tri4"
  ];

  // ── Label material ────────────────────────────────────────────
  // Single dark, fully-rough, non-metallic colour material shared by
  // every per-cell text label below. Lines don't sample textures —
  // colour is the only channel that matters here.
  mustCreate(sceneModel.createMaterial({
    id:        "mat_label",
    color:     [0.10, 0.12, 0.18],
    roughness: 1.0,
    metallic:  0.0
  }));

  // Per-axis label fragments. Row labels describe the geometry
  // attributes that drive the smooth-vs-flat / UV-vs-triplanar
  // shader split; column labels describe the texture / material
  // options the column varies.
  const ROW_LABELS = ["N+UV", "N", "UV", "flat"];
  const COL_LABELS = ["untex", "nomip", "mip", "mip-tri4"];

  // ── Place the 4×4 grid ────────────────────────────────────────
  const SPACING = 3.0;
  let nextId = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const meshId = `m${nextId}`;
      const objId  = `o${nextId}`;
      const x = col * SPACING;
      const y = row * SPACING;
      mustCreate(sceneModel.createMesh({
        id:         meshId,
        geometryId: geomByRow[row],
        materialId: matByCol[col],
        matrix:     xeokit.model.scene.buildMat4({
          position: [x, y, 1.2],
          scale:    [1, 1, 1]
        })
      }));
      mustCreate(sceneModel.createObject({ id: objId, meshIds: [meshId] }));

      // ── Per-cell ground label ─────────────────────────────────
      // Two-line vector text laid flat on the ground (XY plane,
      // tiny +Z lift to keep it off the ground plane in case one
      // is added later). Line 1 = geometry variant; line 2 =
      // material variant. The label sits just in front of its
      // sphere (toward -Y, where the camera is) so the sphere
      // doesn't occlude it.
      //
      // `buildVectorText` lays text out with +Y as the reading
      // "up" direction; from the camera at y = -10 looking toward
      // +Y, that puts the top of each letter pointing away from
      // the camera, which is the natural orientation for floor
      // text read while looking down.
      const labelText  = `${ROW_LABELS[row]}\n${COL_LABELS[col]}`;
      const LABEL_SIZE = 0.30;
      // `mag` (1/25) and per-glyph widths come from
      // `procgen/buildGeometry/buildVectorText`. Most caps and
      // digits are width 16, so this approximates each glyph at
      // 16/25 × LABEL_SIZE. Used to centre the text horizontally
      // on the sphere — the geometry origin sits at the bottom-
      // left, so we shift left by half the widest line.
      const charW = (16 / 25) * LABEL_SIZE;
      const widestLine = Math.max(ROW_LABELS[row].length, COL_LABELS[col].length);
      const halfWidth = (widestLine * charW) / 2;
      // `buildVectorText` stacks lines downward — line 1 spans
      // y ∈ [0, ~0.34·SIZE]; line 2 spans y ∈ [-1.4·SIZE, ~-1.06·SIZE].
      // Centre that span vertically on the in-front-of-sphere
      // anchor by lifting the origin half the span.
      const lineSpacing = (35 / 25) * LABEL_SIZE;
      const capHeight   = (21 / 25) * LABEL_SIZE;
      const yMin = -lineSpacing;        // bottom of line 2
      const yMax = capHeight;            // top of line 1
      const halfHeight = (yMax + yMin) / 2;

      const labelGeom = mustBuild(xeokit.model.procgen.buildGeometry.buildVectorText({
        origin: [
          x - halfWidth,
          y - 1.4 - halfHeight,         // 1.4u in front of sphere centre
          0.005                          // hair-line above ground
        ],
        size:  LABEL_SIZE,
        text:  labelText
      }));

      const labelGeomId = `lbl_g_${nextId}`;
      mustCreate(sceneModel.createGeometry({
        id:         labelGeomId,
        primitive:  labelGeom.primitive,
        positions:  labelGeom.positions,
        indices:    labelGeom.indices
      }));
      const labelMeshId = `lbl_m_${nextId}`;
      mustCreate(sceneModel.createMesh({
        id:         labelMeshId,
        geometryId: labelGeomId,
        materialId: "mat_label"
      }));
      mustCreate(sceneModel.createObject({
        id:      `lbl_o_${nextId}`,
        meshIds: [labelMeshId]
      }));

      nextId++;
    }
  }

  studio.finished();
});


// ── Utilities ────────────────────────────────────────────────────

/** Throws on the first failed `SDKResult`; otherwise returns its value. */
function mustCreate(result) {
  if (result.ok === false) throw new Error(result.error);
  return result.value;
}

/** Same shape but for the `buildSphere` / `buildBox` builders. */
function mustBuild(result) {
  if (result.ok === false) throw new Error(result.error);
  return result.value;
}
