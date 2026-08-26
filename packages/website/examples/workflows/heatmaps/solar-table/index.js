import * as presentations from "../../../../libs/presentations/dist/index.js";
// Animates a solar-analysis heat map by updating surface irradiance as a
// synthetic sun moves around a simple table model.

import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const SOLAR_RAMP = [
    { position: 0.00, color: [0.04, 0.05, 0.18] },   // night
    { position: 0.20, color: [0.18, 0.12, 0.30] },   // dim purple shadow
    { position: 0.45, color: [0.70, 0.30, 0.20] },   // dawn / dusk
    { position: 0.75, color: [1.00, 0.80, 0.30] },   // mid-day amber
    { position: 1.00, color: [1.00, 0.98, 0.85] }    // bright noon
];

const TEXTURE_SIZE       = 256;
const UPDATE_INTERVAL_MS = 100;

// Heat-source orbit. Centre is mid-table-height in model-frame Y;
// radii (X, Z) clear the tabletop's 6 m half-extent so the sphere
// circles the table without grazing it. `BOB_Y` adds a small vertical
// wobble so the orbit reads as a 3D sweep rather than a flat ring.
// Falloff radius tuned so a leg / tabletop face directly under the
// sphere lights to ~saturated, while the opposite face stays cool.
const ORBIT_PERIOD_MS = 8000;
const PATH_CENTER     = [0, 4, 0];
const PATH_RADIUS_X   = 8;
const PATH_RADIUS_Z   = 8;
const PATH_BOB_Y      = 0.5;
const FALLOFF_R       = 5.5;

// Five-part table laid out above the ground plane (worldUp = +Y, so
// y = 0 is the floor). Each leg is a unit cube scaled `[1, 3, 1]` →
// 6 m tall, with its base at y = 0 and its top at y = 6. The
// tabletop is a flat slab scaled `[6, 0.5, 6]` → 1 m thick, centred
// at y = 6 so its lower half overlaps the leg tops — the table
// sits on the ground rather than clipping through it.
const PARTS = [
    { id: "redLeg",    position: [-4, 3, -4], scale: [1, 3, 1] },
    { id: "greenLeg",  position: [ 4, 3, -4], scale: [1, 3, 1] },
    { id: "blueLeg",   position: [ 4, 3,  4], scale: [1, 3, 1] },
    { id: "yellowLeg", position: [-4, 3,  4], scale: [1, 3, 1] },
    { id: "tableTop",  position: [ 0, 6,  0], scale: [6, 0.5, 6] }
];

async function main() {

    const studio = new xeokit.studio.Studio({});
    await studio.init();
    const { scene } = studio;

    // ── Unit cube — 24 vertices (4 per face × 6 faces, no welding so
    // each face owns its own vertices) plus a per-face UV unwrap.
    //
    // Why we can't just use the cube and let paintHeatMap project: its
    // planar projection drops one of the three world axes, and four
    // of the six axis-aligned faces collapse to lines (zero area) in
    // UV space. The rasteriser's degenerate-triangle skip throws those
    // out, leaving only top + bottom painted — and they happen to
    // face perpendicular to most sun positions, so every face renders
    // night-blue.
    //
    // The fix: hand-baked UVs that lay each face into its own slot of
    // a 3 × 2 grid in [0, 1]². Every face gets 1/6 of the texture, no
    // overlap, no degeneracy. applyHeatMapMaterials's
    // `preserveExistingUvs: true` option below tells the painter to
    // honour these UVs instead of re-projecting.
    const CUBE_POSITIONS = [
        // front (+Z)
         1,  1,  1,  -1,  1,  1,  -1, -1,  1,   1, -1,  1,
        // right (+X)
         1,  1,  1,   1, -1,  1,   1, -1, -1,   1,  1, -1,
        // top (+Y)
         1,  1,  1,   1,  1, -1,  -1,  1, -1,  -1,  1,  1,
        // left (-X)
        -1,  1,  1,  -1,  1, -1,  -1, -1, -1,  -1, -1,  1,
        // bottom (-Y)
        -1, -1, -1,   1, -1, -1,   1, -1,  1,  -1, -1,  1,
        // back (-Z)
         1, -1, -1,  -1, -1, -1,  -1,  1, -1,   1,  1, -1
    ];
    const CUBE_INDICES = [
        0,  1,  2,   0,  2,  3,
        4,  5,  6,   4,  6,  7,
        8,  9, 10,   8, 10, 11,
       12, 13, 14,  12, 14, 15,
       16, 17, 18,  16, 18, 19,
       20, 21, 22,  20, 22, 23
    ];
    // Cross unwrap, sized per-part so each face's UV rect aspect
    // ratio matches its world face dimensions. With a uniform pack
    // scale across all six faces, the texel-per-meter density is the
    // same on every face — so the grid renders as actual squares in
    // world space rather than getting stretched along the long axes
    // of the legs / tabletop. See `buildCubeUvs` below.

    // ── Build the SceneModel. Identity basis explicitly so worldUp
    // resolves to [0, 1, 0] (matches the camera's `up: [0, 1, 0]` and
    // the table positions, which are built around y = -6 for the
    // legs' base). Without this the SceneModel's default coordinate
    // system was Z-up, so the synthetic sun arced in the wrong plane
    // and the table never caught the light.
    const sceneModelResult = scene.createModel({
        id: "demoTable",
        coordinateSystem: {
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            origin: [0, 0, 0],
            units: "meters"
        }
    });
    if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
    const sceneModel = sceneModelResult.value;

    for (const part of PARTS) {
        const gres = sceneModel.createGeometry({
            id: `${part.id}-geom`,
            primitive: xeokit.base.constants.TrianglesPrimitive,
            positions: CUBE_POSITIONS,
            indices:   CUBE_INDICES,
            uvs:       buildCubeUvs(part.scale[0], part.scale[1], part.scale[2])
        });
        if (!gres.ok) throw new Error(gres.error);

        const tres = sceneModel.createTransform({
            id: `${part.id}-xform`,
            position: part.position,
            rotation: [0, 0, 0],
            scale:    part.scale
        });
        if (!tres.ok) throw new Error(tres.error);

        const mres = sceneModel.createMesh({
            id: `${part.id}-mesh`,
            geometryId: `${part.id}-geom`,
            parentTransformId: `${part.id}-xform`
        });
        if (!mres.ok) throw new Error(mres.error);

        const ores = sceneModel.createObject({
            id: part.id,
            meshIds: [`${part.id}-mesh`]
        });
        if (!ores.ok) throw new Error(ores.error);
    }

    // ── Initial paint with all-zero scalars so applyHeatMapMaterials
    // sets up textures / materials / UVs (then we drive the live
    // updates via repaintHeatMapColor below).
    const paintInitial = presentations.heatmaps.applyHeatMapMaterials({
        sceneModel,
        scalars: (geom) => new Float32Array((geom.positionsCompressed.length / 3) | 0),
        range: [0, 1],
        textureSize: TEXTURE_SIZE,
        ramp: SOLAR_RAMP,
        roughness: 0.6,
        backgroundColor: [0, 0, 0],
        // Honour the cube-map unwrap we baked into each geometry's
        // uvsCompressed; without this the painter would replace those
        // UVs with a planar projection and the cubes would go dark.
        preserveExistingUvs: true,
        // Debug grid overlay so the per-face cube-map unwrap is
        // visible (one cell per ~1/16 of each face's UV rect).
        grid: true
    });
    if (!paintInitial.ok) throw new Error(paintInitial.error);

    // ── Visible heat source — a small glowing orange sphere
    // animated by updating its SceneTransform's `position` each
    // tick. Created *after* applyHeatMapMaterials so the painter
    // doesn't walk it (heat maps are only built for geometries that
    // exist when the painter runs); the sphere therefore keeps a
    // plain mesh-color material and reads as a constant warm glow
    // moving over the heat-mapped table.
    const sphereResult = xeokit.model.generation.buildGeometry.buildSphere({
        radius: 0.4,
        widthSegments: 24,
        heightSegments: 18
    });
    if (!sphereResult.ok) throw new Error(sphereResult.error);
    {
        const sg = sceneModel.createGeometry({
            id: "heatSource-geom",
            primitive: xeokit.base.constants.TrianglesPrimitive,
            positions: sphereResult.value.positions,
            indices:   sphereResult.value.indices,
            uvs:       sphereResult.value.uv
        });
        if (!sg.ok) throw new Error(sg.error);

        const sxform = sceneModel.createTransform({
            id: "heatSource-xform",
            position: [PATH_CENTER[0] + PATH_RADIUS_X, PATH_CENTER[1], PATH_CENTER[2]],
            rotation: [0, 0, 0],
            scale:    [1, 1, 1]
        });
        if (!sxform.ok) throw new Error(sxform.error);

        const sm = sceneModel.createMesh({
            id: "heatSource-mesh",
            geometryId: "heatSource-geom",
            parentTransformId: "heatSource-xform",
            color: [1.0, 0.55, 0.10]    // saturated orange — reads as warm
        });
        if (!sm.ok) throw new Error(sm.error);

        const so = sceneModel.createObject({
            id: "heatSource",
            meshIds: ["heatSource-mesh"]
        });
        if (!so.ok) throw new Error(so.error);
    }
    const heatSourceTransform = sceneModel.transforms["heatSource-xform"];


    // ── Build the live-update cache.
    //
    // Per part: synthesise local-frame smooth normals (the cube's
    // CCW indices give CCW-for-outward, so no flip — different from
    // the IFC variant), then transform to world space using the
    // mesh's worldMatrix and renormalise. Caching world normals
    // means the per-tick Lambert is a straight `dot(worldNormal,
    // worldSun)` with no per-mesh frame conversion.
    // Walk meshes directly — each painted mesh's material carries
    // the heat-map texture and its (re-bound, sibling) geometry
    // carries the UVs the renderer actually samples. Iterating
    // geometries-by-id would miss because `applyHeatMapMaterials`
    // routes meshes through a sibling geometry (`__heat`-suffixed)
    // while the texture is namespaced by the *original* geometry
    // id; walking via the mesh's `material.colorTexture` and
    // `geometry` sidesteps both naming conventions.
    const liveTargets = [];
    for (const objId in sceneModel.objects) {
        if (objId === "heatSource") continue;   // skip the source itself
        const obj = sceneModel.objects[objId];
        for (const mesh of obj.meshes) {
            const geom = mesh.geometry;
            if (!geom || !geom.indices || !geom.positionsCompressed || !geom.uvsCompressed) continue;
            const tex = mesh.material?.colorTexture;
            if (!tex || !tex.imageData) continue;

            const localNormals = synthesizeSmoothNormals(geom.positionsCompressed, geom.indices, geom.aabb);
            if (!localNormals) continue;
            const worldNormals   = transformNormalsToWorld(localNormals, mesh.worldMatrix);
            const worldPositions = transformPositionsToWorld(geom.positionsCompressed, geom.aabb, mesh.worldMatrix);

            liveTargets.push({
                geom,
                tex,
                worldNormals,
                worldPositions,
                scalars: new Float32Array((geom.positionsCompressed.length / 3) | 0)
            });
        }
    }

    const coveredScratch = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE);

    // ── View, lighting, HDR IBL.
    //
    // viewFit auto-frames the scene's AABB so the whole table fits
    // and the camera sits on a 3/4 angle that shows the top plus two
    // sides — the right framing for an orbital sun demo where every
    // face takes its turn lit.
    const view = studio.viewManager.createView({
      camera: {
        "eye": [11.023784938577824,15.123313784599718,11.10107592177248],
        "look": [5.515164676431828,6.546481013298449,6.87662056517458],
        "up": [-0.2068956773485241,-0.32213324940329763,0.923809692698322]
      },
        effects: {
            tonemap: { sRGBEncode: true }
        }
    });

    studio.viewManager.fitToAabb(view, studio.picking.collisionIndex.getSceneAABB());
    studio.openInfoPanelFromMeta();
    studio.finished();

    // ── Heat-source orbit.
    //
    // The sphere drives an ellipse in model-frame XZ at a fixed Y
    // (mid-table-height), with a small vertical bob. The
    // SceneModel's identity basis differs from the Scene's default
    // (Y↔Z swap), so the visible sphere ends up at
    // `coordinateSystemMatrix · modelPos` in *scene* space — which
    // is the same frame the cached `worldPositions` and
    // `worldNormals` live in. We read the source's post-transform
    // world translation directly out of `heatSourceTransform.worldMatrix`
    // so distances are computed in matching frames.
    const tStart = performance.now();
    let tLastUpdate = -Infinity;

    function tick(now) {
        if (now - tLastUpdate >= UPDATE_INTERVAL_MS) {
            const u = ((now - tStart) % ORBIT_PERIOD_MS) / ORBIT_PERIOD_MS;
            const angle = u * Math.PI * 2;
            const modelPos = [
                PATH_CENTER[0] + Math.cos(angle) * PATH_RADIUS_X,
                PATH_CENTER[1] + Math.sin(angle * 2) * PATH_BOB_Y,
                PATH_CENTER[2] + Math.sin(angle) * PATH_RADIUS_Z
            ];
            heatSourceTransform.position = modelPos;

            const wm = heatSourceTransform.worldMatrix;
            const worldSourcePos = [wm[12], wm[13], wm[14]];

            for (let t = 0; t < liveTargets.length; t++) {
                const tgt = liveTargets[t];
                computeRadialHeatScalars(
                    tgt.worldPositions,
                    tgt.worldNormals,
                    worldSourcePos,
                    FALLOFF_R,
                    tgt.scalars
                );

                xeokit.model.generation.paintMaterials.repaintHeatMapColor({
                    indices:   tgt.geom.indices,
                    uvs:       tgt.geom.uvsCompressed,
                    scalars:   tgt.scalars,
                    imageData: tgt.tex.imageData
                }, {
                    ramp: SOLAR_RAMP,
                    range: [0, 1],
                    backgroundColor: [0, 0, 0],
                    coveredScratch,
                    // Each tick clears + re-rasterises the texture;
                    // pass the grid through so it stays visible across
                    // frames (without this it would only show on the
                    // initial bake, then vanish on tick 1).
                    grid: true
                });

                // Re-trigger the SceneTexture's setter so the renderer's
                // atlas re-uploads. ViewManager's handler also schedules
                // a redraw on every registered view.
                tgt.tex.imageData = tgt.tex.imageData;
            }

            tLastUpdate = now;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}


// Per-vertex heat scalar = Lambert(N, dirToSource) × inverse-square
// distance falloff. Closer + facing = hotter; far / facing-away → 0.
// The falloff `1 / (1 + (d/r)²)` is finite at d=0 and asymptotes
// toward 0 at d ≫ r — same shape as a softened point light.
function computeRadialHeatScalars(worldPositions, worldNormals, sourcePos, falloffR, out) {
    const sx = sourcePos[0], sy = sourcePos[1], sz = sourcePos[2];
    const fR2 = falloffR * falloffR;
    const v = (worldPositions.length / 3) | 0;
    for (let i = 0; i < v; i++) {
        const dx = sx - worldPositions[i * 3];
        const dy = sy - worldPositions[i * 3 + 1];
        const dz = sz - worldPositions[i * 3 + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 === 0) { out[i] = 1; continue; }
        const inv = 1 / Math.sqrt(d2);
        const dotN = (worldNormals[i * 3]     * dx
                    + worldNormals[i * 3 + 1] * dy
                    + worldNormals[i * 3 + 2] * dz) * inv;
        const lambert = dotN > 0 ? dotN : 0;
        const falloff = 1 / (1 + d2 / fR2);
        out[i] = lambert * falloff;
    }
}


// Decompress positions from u16 quantised against `aabb` and apply
// the mesh's local-to-world matrix (with translation). Result is a
// flat Float32Array of world-space positions, length 3 × vertCount.
function transformPositionsToWorld(positionsCompressed, aabb, m) {
    const v = (positionsCompressed.length / 3) | 0;
    const out = new Float32Array(v * 3);
    const minX = aabb[0], minY = aabb[1], minZ = aabb[2];
    const rngX = aabb[3] - minX, rngY = aabb[4] - minY, rngZ = aabb[5] - minZ;
    for (let i = 0; i < v; i++) {
        const lx = minX + rngX * (positionsCompressed[i * 3]     / 65535);
        const ly = minY + rngY * (positionsCompressed[i * 3 + 1] / 65535);
        const lz = minZ + rngZ * (positionsCompressed[i * 3 + 2] / 65535);
        out[i * 3]     = m[0] * lx + m[4] * ly + m[8]  * lz + m[12];
        out[i * 3 + 1] = m[1] * lx + m[5] * ly + m[9]  * lz + m[13];
        out[i * 3 + 2] = m[2] * lx + m[6] * ly + m[10] * lz + m[14];
    }
    return out;
}


// Per-part cube-map unwrap: lays the six faces into a "cross" in
// `[0, 1]²` whose face cells are sized proportionally to their world
// dimensions. With a single pack scale across all faces, the
// texels-per-meter density is uniform, so a fixed-pixel grid drawn
// onto the heat map renders as squares in world space.
//
// Cross layout (rows top → bottom):
//
//   .          [+Y: sx × sz]            .
//   [-X: sz×sy][+Z: sx×sy][+X: sz×sy][-Z: sx×sy]
//   .          [-Y: sx × sz]            .
//
// Bounding box of the cross: (2·sx + 2·sz) wide × (sy + 2·sz) tall.
// `s` scales it to fit into [0, 1]² (clipped 1% inside the borders
// to avoid bilinear bleed at the texture edge).
function buildCubeUvs(sx, sy, sz) {
    const out = new Float32Array(24 * 2);

    const totalW = 2 * (sx + sz);
    const totalH = sy + 2 * sz;
    const s = Math.min(1 / totalW, 1 / totalH) * 0.99;
    const xOff = (1 - totalW * s) / 2;
    const yOff = (1 - totalH * s) / 2;

    // Each face's UV rect [uMin, vMin, uMax, vMax]. Order matches the
    // CUBE_POSITIONS face order: 0=+Z, 1=+X, 2=+Y, 3=-X, 4=-Y, 5=-Z.
    const rects = [
        [xOff +     sz       *s, yOff + sz*s,    xOff + (sz +  sx )*s, yOff + (sz + sy)*s], // +Z
        [xOff + (sz + sx)    *s, yOff + sz*s,    xOff + (2*sz + sx)*s, yOff + (sz + sy)*s], // +X
        [xOff +     sz       *s, yOff,           xOff + (sz +  sx )*s, yOff +  sz       *s], // +Y
        [xOff,                   yOff + sz*s,    xOff +     sz     *s, yOff + (sz + sy)*s], // -X
        [xOff +     sz       *s, yOff + (sz+sy)*s, xOff + (sz + sx )*s, yOff + (2*sz+sy)*s], // -Y
        [xOff + (2*sz + sx)  *s, yOff + sz*s,    xOff + (2*sz + 2*sx)*s, yOff + (sz + sy)*s] // -Z
    ];

    // Per-face vertex winding — which corner of the UV rect each of
    // the four CUBE_POSITIONS verts maps to. Worked out manually from
    // the unwrap geometry; see comments in the source for the
    // derivation.
    const TL = 0, TR = 1, BR = 2, BL = 3;
    const windings = [
        [TR, TL, BL, BR],  // +Z
        [TL, BL, BR, TR],  // +X
        [BR, TR, TL, BL],  // +Y
        [TR, TL, BL, BR],  // -X
        [BL, BR, TR, TL],  // -Y
        [BL, BR, TR, TL]   // -Z
    ];

    for (let f = 0; f < 6; f++) {
        const [u0, v0, u1, v1] = rects[f];
        const w = windings[f];
        for (let v = 0; v < 4; v++) {
            const corner = w[v];
            const k = (f * 4 + v) * 2;
            out[k]     = (corner === TR || corner === BR) ? u1 : u0;
            out[k + 1] = (corner === BL || corner === BR) ? v1 : v0;
        }
    }
    return out;
}


// Apply the worldMatrix's 3×3 to each local normal and renormalise.
// Strictly correct only for orthogonal × uniform-scale matrices, but
// also gives the right answer when local normals are axis-aligned —
// which they are for the cube faces (±X, ±Y, ±Z). If you swap in a
// model with non-axis-aligned normals AND non-uniform scale, switch
// to inverse-transpose instead.
function transformNormalsToWorld(localNormals, m) {
    const v = (localNormals.length / 3) | 0;
    const out = new Float32Array(v * 3);
    for (let i = 0; i < v; i++) {
        const lx = localNormals[i * 3];
        const ly = localNormals[i * 3 + 1];
        const lz = localNormals[i * 3 + 2];
        const wx = m[0] * lx + m[4] * ly + m[8]  * lz;
        const wy = m[1] * lx + m[5] * ly + m[9]  * lz;
        const wz = m[2] * lx + m[6] * ly + m[10] * lz;
        const len = Math.sqrt(wx * wx + wy * wy + wz * wz);
        if (len > 0) {
            const inv = 1 / len;
            out[i * 3]     = wx * inv;
            out[i * 3 + 1] = wy * inv;
            out[i * 3 + 2] = wz * inv;
        } else {
            out[i * 3]     = 0;
            out[i * 3 + 1] = 1;
            out[i * 3 + 2] = 0;
        }
    }
    return out;
}


// Area-weighted smooth-normal synthesis from positions + indices.
// Same algorithm as the SDK's private `generateSmoothNormals` and the
// IfcOpenHouse4 demo's helper. The cube indices in CUBE_INDICES wind
// CCW for outward — no flip needed (unlike IfcOpenHouse4's IFC
// indices). Returns a `Float32Array` of unit normals or `null` for a
// fully-degenerate mesh.
function synthesizeSmoothNormals(positionsCompressed, indices, aabb) {
    const v = (positionsCompressed.length / 3) | 0;
    const triCount = (indices.length / 3) | 0;
    if (v === 0 || triCount === 0 || (indices.length % 3) !== 0) return null;

    const minX = aabb[0], minY = aabb[1], minZ = aabb[2];
    const rngX = aabb[3] - minX, rngY = aabb[4] - minY, rngZ = aabb[5] - minZ;
    const positions = new Float32Array(v * 3);
    for (let i = 0; i < v; i++) {
        positions[i * 3]     = minX + rngX * (positionsCompressed[i * 3]     / 65535);
        positions[i * 3 + 1] = minY + rngY * (positionsCompressed[i * 3 + 1] / 65535);
        positions[i * 3 + 2] = minZ + rngZ * (positionsCompressed[i * 3 + 2] / 65535);
    }

    const acc = new Float32Array(v * 3);
    for (let t = 0; t < triCount; t++) {
        const i0 = indices[t * 3];
        const i1 = indices[t * 3 + 1];
        const i2 = indices[t * 3 + 2];
        const ax = positions[i0 * 3];
        const ay = positions[i0 * 3 + 1];
        const az = positions[i0 * 3 + 2];
        const ex1 = positions[i1 * 3]     - ax;
        const ey1 = positions[i1 * 3 + 1] - ay;
        const ez1 = positions[i1 * 3 + 2] - az;
        const ex2 = positions[i2 * 3]     - ax;
        const ey2 = positions[i2 * 3 + 1] - ay;
        const ez2 = positions[i2 * 3 + 2] - az;
        const nx = ey1 * ez2 - ez1 * ey2;
        const ny = ez1 * ex2 - ex1 * ez2;
        const nz = ex1 * ey2 - ey1 * ex2;
        acc[i0 * 3]     += nx; acc[i0 * 3 + 1] += ny; acc[i0 * 3 + 2] += nz;
        acc[i1 * 3]     += nx; acc[i1 * 3 + 1] += ny; acc[i1 * 3 + 2] += nz;
        acc[i2 * 3]     += nx; acc[i2 * 3 + 1] += ny; acc[i2 * 3 + 2] += nz;
    }

    let any = false;
    for (let i = 0; i < v; i++) {
        const x = acc[i * 3], y = acc[i * 3 + 1], z = acc[i * 3 + 2];
        const len = Math.sqrt(x * x + y * y + z * z);
        if (len > 0) {
            any = true;
            const inv = 1 / len;
            acc[i * 3]     = x * inv;
            acc[i * 3 + 1] = y * inv;
            acc[i * 3 + 2] = z * inv;
        } else {
            acc[i * 3]     = 0;
            acc[i * 3 + 1] = 1;
            acc[i * 3 + 2] = 0;
        }
    }
    return any ? acc : null;
}


main().catch(err => {
    console.error("[SolarSweep_Table]", err);
});
