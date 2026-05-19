// Live thermography on a procgen industrial-pipework rack.
//
// Suggests a thermal-imaging use case for the dynamic heat-map
// pipeline: a glowing orange sphere weaves through a small ensemble
// of pipes / vessels / valves; per-vertex heat is computed as a
// Lambert term (cos angle between vertex normal and direction to
// source) multiplied by inverse-square distance falloff, then
// repainted into each part's heat-map texture every tick. Surfaces
// close to the source AND facing it light up; surfaces in the
// shadow of the rack stay cold.
//
// Ensemble (one SceneGeometry + heat map per part):
//   • Hemispherical-capped pressure vessel    (buildLathe)
//   • Bulged valve body                       (buildLathe)
//   • Concentric pipe reducer                 (buildLathe)
//   • Flanged spool                           (buildLathe)
//   • Arched conduit run                      (buildExtrude)
//   • Heat-exchanger coil                     (buildExtrude)
//
// The natural UVs from buildExtrude / buildLathe (arc-length ×
// circumferential) are preserved through the painter
// (`preserveExistingUvs: true`) — re-projecting onto a planar UV
// plane would collapse half of every pipe's surface to a line.
//
// The heat source itself is a small sphere SceneObject created
// AFTER `applyHeatMapMaterials` finishes, so it doesn't get its
// own heat map — it stays a constant orange "glow" and just gets
// its transform updated each tick to move around.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

// Cool end is a saturated mid-blue rather than near-black so the
// debug grid (≈ 40% black) reads clearly against unheated surfaces.
// Warm end is unchanged.
const SOLAR_RAMP = [
    { position: 0.00, color: [0.15, 0.40, 0.90] },   // bright cyan-blue (cold)
    { position: 0.25, color: [0.30, 0.30, 0.65] },   // cooling
    { position: 0.50, color: [0.75, 0.35, 0.25] },   // warming
    { position: 0.75, color: [1.00, 0.80, 0.30] },   // mid-day amber
    { position: 1.00, color: [1.00, 0.98, 0.85] }    // bright noon
];

const TEXTURE_SIZE       = 256;
const UPDATE_INTERVAL_MS = 100;


async function main() {

    const studio = new xeokit.studio.Studio({});
    await studio.init();
    const { scene } = studio;

    const sceneModelResult = scene.createModel({
        id: "demoPipes",
        coordinateSystem: {
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            origin: [0, 0, 0],
            units: "meters"
        }
    });
    if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
    const sceneModel = sceneModelResult.value;

    // ── Define the parts.
    //
    // Industrial-pipework ensemble: a pressure vessel, a valve body,
    // a pipe reducer, a flanged spool, an arched conduit run, and a
    // heat-exchanger coil. Heat radiating from a moving source onto
    // each part suggests a thermography-style visualisation of plant
    // pipework / process equipment.
    //
    // Each entry contributes one SceneGeometry + one SceneMesh + one
    // SceneObject. The `geom` field is the result of a procgen build;
    // `position` translates the mesh into its slot on the ground.
    const parts = [];

    // ── Lathed industrial elements ─────────────────────────────────
    // Vertical pressure vessel / process tank — straight cylinder
    // with hemispherical caps top and bottom. Profile traces (r, y)
    // counter-clockwise from the bottom pole up to the top pole.
    parts.push({
        id: "pressureVessel",
        position: [-6, 0, 0],
        geom: xeokit.model.procgen.buildGeometry.buildLathe({
            profile: hemiCappedCylinder({
                radius: 1.2, straightHeight: 3.0, capSegments: 8
            }),
            segments: 36,
            closedProfile: false
        })
    });

    // Valve body — narrow inlet/outlet pipe with a bulged middle
    // (the actuator housing). The bulge gives a face that catches
    // the moving heat source dramatically as it passes by.
    parts.push({
        id: "valveBody",
        position: [-4, 0, 3],
        geom: xeokit.model.procgen.buildGeometry.buildLathe({
            profile: [
                0.30, 0.00,
                0.30, 0.50,
                0.45, 0.65,
                0.85, 0.90,
                1.00, 1.30,
                0.85, 1.70,
                0.45, 1.95,
                0.30, 2.10,
                0.30, 2.60
            ],
            segments: 32,
            closedProfile: false
        })
    });

    // Concentric reducer — narrow pipe → wide pipe via a conical
    // step. Two short cylinders sandwiching a 1m taper.
    parts.push({
        id: "reducer",
        position: [-4, 0, -3],
        geom: xeokit.model.procgen.buildGeometry.buildLathe({
            profile: [
                0.35, 0.00,
                0.35, 0.50,
                0.85, 1.50,
                0.85, 2.00
            ],
            segments: 32,
            closedProfile: false
        })
    });

    // Flanged spool — a length of pipe with raised-face flanges at
    // each end. The flange disks are radius-0.65 collars over a
    // radius-0.30 pipe. Reads as the kind of bolted segment that
    // bolts into the rest of a process line.
    parts.push({
        id: "flangedSpool",
        position: [3, 0, 3],
        geom: xeokit.model.procgen.buildGeometry.buildLathe({
            profile: [
                0.30, 0.00,
                0.30, 0.15,
                0.65, 0.15,
                0.65, 0.45,
                0.30, 0.45,
                0.30, 2.05,
                0.65, 2.05,
                0.65, 2.35,
                0.30, 2.35,
                0.30, 2.50
            ],
            segments: 32,
            closedProfile: false
        })
    });

    // ── Extruded conduits ──────────────────────────────────────────
    // Semicircle arch — a long bent conduit, e.g. a pipe-rack run
    // cresting over a piece of equipment. Spans +X.
    parts.push({
        id: "archPipe",
        position: [6, 0, 0],
        geom: xeokit.model.procgen.buildGeometry.buildExtrude({
            shape: makeCircleShape(0.4, 12),
            path:  archPath({ span: 5, peak: 3, segments: 60 }),
            closedShape: true,
            closedPath:  false,
            caps: true
        })
    });

    // Heat-exchanger coil — a helical tube, the classic shape for
    // showing thermal imaging on a wound heat-transfer surface. The
    // parallel-transport-derived normals come out inward on tightly-
    // wound helixes; `flipNormals` negates them so the heat source
    // lights the side of the coil that's actually facing it.
    parts.push({
        id: "exchangerCoil",
        position: [3, 0, -3],
        flipNormals: true,
        geom: xeokit.model.procgen.buildGeometry.buildExtrude({
            shape: makeCircleShape(0.22, 10),
            path:  helixPath({ radius: 1.2, height: 4, turns: 4, segments: 160 }),
            closedShape: true,
            closedPath:  false,
            caps: true
        })
    });

    // ── Wire the procgen output into SceneGeometries / Meshes.
    // Per-geometry cache of the procgen-provided local-space normals.
    // We use these instead of synthesising — buildExtrude winds
    // CCW-for-outward but buildLathe winds CCW-for-inward, and the
    // cross-product synthesiser can't tell the two apart. The
    // procgen builders both emit correctly-oriented outward normals,
    // so passing them through skips the inversion problem entirely.
    const localNormalsByGeomId = new Map();

    for (const part of parts) {
        if (!part.geom.ok) throw new Error(`[${part.id}] ${part.geom.error}`);
        const g = part.geom.value;

        const gres = sceneModel.createGeometry({
            id: `${part.id}-geom`,
            primitive: xeokit.base.constants.TrianglesPrimitive,
            positions: g.positions,
            indices:   g.indices,
            uvs:       g.uv
        });
        if (!gres.ok) throw new Error(gres.error);

        const ln = new Float32Array(g.normals);
        if (part.flipNormals) {
            for (let i = 0; i < ln.length; i++) ln[i] = -ln[i];
        }
        localNormalsByGeomId.set(`${part.id}-geom`, ln);

        const tres = sceneModel.createTransform({
            id: `${part.id}-xform`,
            position: part.position,
            rotation: [0, 0, 0],
            scale:    [1, 1, 1]
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

    // ── Initial paint with all-zero scalars — sets up textures /
    // materials / UVs. preserveExistingUvs honours the procgen UVs;
    // re-projecting would collapse half of every pipe to a line.
    const paintInitial = xeokit.presentations.heatmaps.applyHeatMapMaterials({
        sceneModel,
        scalars: (geom) => new Float32Array((geom.positionsCompressed.length / 3) | 0),
        range: [0, 1],
        textureSize: TEXTURE_SIZE,
        ramp: SOLAR_RAMP,
        roughness: 0.6,
        backgroundColor: [0, 0, 0],
        preserveExistingUvs: true,
        grid: true
    });
    if (!paintInitial.ok) throw new Error(paintInitial.error);

    // ── Visible heat source — a glowing orange sphere we'll move
    // around per tick. Created *after* applyHeatMapMaterials so it
    // gets a plain mesh-color material instead of a heat-map texture
    // (the painter only walks geometries that exist when it runs).
    const sphereResult = xeokit.model.procgen.buildGeometry.buildSphere({
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
            position: [0, 2, 0],
            rotation: [0, 0, 0],
            scale:    [1, 1, 1]
        });
        if (!sxform.ok) throw new Error(sxform.error);

        const sm = sceneModel.createMesh({
            id: "heatSource-mesh",
            geometryId: "heatSource-geom",
            parentTransformId: "heatSource-xform",
            color: [1.0, 0.55, 0.10]   // saturated orange, reads as warm
        });
        if (!sm.ok) throw new Error(sm.error);

        const so = sceneModel.createObject({
            id: "heatSource",
            meshIds: ["heatSource-mesh"]
        });
        if (!so.ok) throw new Error(so.error);
    }
    const heatSourceTransform = sceneModel.transforms["heatSource-xform"];


    // ── Live-update cache. Per part: world-space per-vertex normals
    // (synthesised from positions + indices, then transformed through
    // the mesh's worldMatrix) plus a scratch scalars buffer. The
    // procgen builders DO emit `normals`, but we don't pass those into
    // createGeometry — the SDK then has nothing to oct-encode-and-
    // decode for us, and synthesised cross-product normals are good
    // enough for Lambert on these shapes (positions + indices are
    // CCW-for-outward by construction).
    // Walk objects → meshes *after* applyHeatMapMaterials rebuilt
    // the meshes against sibling geometries. Reaching the texture
    // via `mesh.material.colorTexture` sidesteps the namespace
    // mismatch between original-id texture naming and sibling-id
    // geometry binding; the sibling shares positions/indices/aabb
    // with the original, so `localNormalsByGeomId` lookups stay
    // valid after stripping the `__heat` suffix.
    const liveTargets = [];
    for (const objId in sceneModel.objects) {
        if (objId === "heatSource") continue;
        const obj = sceneModel.objects[objId];
        for (const mesh of obj.meshes) {
            const geom = mesh.geometry;
            if (!geom || !geom.indices || !geom.positionsCompressed || !geom.uvsCompressed) continue;
            const tex = mesh.material?.colorTexture;
            if (!tex || !tex.imageData) continue;
            const sourceGeomId = geom.id.endsWith("__heat") ? geom.id.slice(0, -"__heat".length) : geom.id;
            const localNormals = localNormalsByGeomId.get(sourceGeomId);
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
    const view = studio.viewManager.createView({
        renderMode: xeokit.base.constants.RealisticRender,
        effects: {
            tonemap: { sRGBEncode: true }
        }
    });

    studio.viewFit(view);
    studio.finished();

    // ── Heat source path. Sized to encircle the rack with a safe
    // clearance — the source never enters or touches any object.
    // Layout extents (X, Z): vessel at X=-6 (radius 1.2), valve /
    // reducer at X=-3 (Z=±3), coil / spool at X=+3 (Z=±3), arch at
    // X=+6 (X-range 3.5…8.5, peak Y≈3). An ellipse at radius
    // (10, 6) leaves at least ~1.5 m of free air between the
    // sphere's surface and the nearest object surface throughout
    // the cycle. Vertical bob is small (±1 m) so the sphere stays
    // well below the vessel / arch crowns and well above the floor.
    const PATH_CENTER   = [0, 2.5, 0];
    const PATH_RADIUS_X = 10;
    const PATH_RADIUS_Z = 6;
    const PATH_BOB_Y    = 1.0;
    const ORBIT_PERIOD_MS = 12000;
    const FALLOFF_R     = 4.5;

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

            // The Scene's default coordinateSystem basis differs from
            // the SceneModel's (Y↔Z swap by default), so the visible
            // sphere ends up at coordinateSystemMatrix * modelPos in
            // *scene* space — which is the same frame the cached
            // pipe `worldPositions` live in. Read the source's
            // post-transform world translation directly so distances
            // are computed in matching frames.
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

                xeokit.model.procgen.paintMaterials.repaintHeatMapColor({
                    indices:   tgt.geom.indices,
                    uvs:       tgt.geom.uvsCompressed,
                    scalars:   tgt.scalars,
                    imageData: tgt.tex.imageData
                }, {
                    ramp: SOLAR_RAMP,
                    range: [0, 1],
                    backgroundColor: [0, 0, 0],
                    coveredScratch,
                    // Same grid as the initial paint so the texture
                    // doesn't lose its lines when this tick rewrites
                    // the colour bytes.
                    grid: true
                });

                tgt.tex.imageData = tgt.tex.imageData;
            }
            tLastUpdate = now;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}


// ── Procgen path / shape helpers ───────────────────────────────────

// Closed regular n-gon used as the pipe cross-section. Returned flat
// `[x0, y0, x1, y1, ...]` traced CCW so buildExtrude reads outward
// normals correctly.
function makeCircleShape(radius, segments) {
    const out = [];
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        out.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    return out;
}

function helixPath({ radius, height, turns, segments }) {
    const out = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = t * Math.PI * 2 * turns;
        out.push(Math.cos(angle) * radius, t * height, Math.sin(angle) * radius);
    }
    return out;
}

function archPath({ span, peak, segments }) {
    const out = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = t * Math.PI; // 0 → π
        out.push(-span / 2 * Math.cos(angle), peak * Math.sin(angle), 0);
    }
    return out;
}

// Profile for a hemispherical-capped cylinder lathe (pressure
// vessel). Returns flat `[r0, y0, r1, y1, ...]` from the bottom pole
// up to the top pole. `capSegments` controls hemisphere smoothness.
function hemiCappedCylinder({ radius, straightHeight, capSegments }) {
    const out = [];
    // Bottom hemisphere — quarter-circle from (0, 0) up to (radius, radius).
    for (let i = 0; i <= capSegments; i++) {
        const t = i / capSegments;
        const angle = -Math.PI / 2 + t * Math.PI / 2;       // -π/2 → 0
        out.push(radius * Math.cos(angle), radius + radius * Math.sin(angle));
    }
    // Top hemisphere — quarter-circle from (radius, radius+H) up to (0, 2r+H).
    for (let i = 1; i <= capSegments; i++) {
        const t = i / capSegments;
        const angle = t * Math.PI / 2;                       // 0 → π/2
        out.push(radius * Math.cos(angle), radius + straightHeight + radius * Math.sin(angle));
    }
    return out;
}


// ── Heat-from-radial-source helpers ────────────────────────────────

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

main().catch(err => {
    console.error("[SolarSweep_Pipes]", err);
});
