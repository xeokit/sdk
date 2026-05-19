// Animated solar irradiance heat maps on the IfcOpenHouse4 model.
//
// A synthetic sun arcs through the sky from "east" → up → "west"
// (whichever two world axes the SceneModel's basis maps to). Each
// tick we recompute a per-vertex Lambert scalar (max(0, n·sunDir))
// for every triangle SceneObject and re-rasterise just the colour
// channel of its heat-map texture into the existing ImageData. The
// SceneTexture's setter then dispatches `onSceneTextureImageDataChanged`,
// which the renderer routes to the per-batch atlases — only the
// affected sub-rects are re-uploaded via texSubImage2D, no mesh or
// material rebuild.
//
// Initial setup uses applyHeatMapMaterials (the heavy path that
// generates UVs, materials, textures, and reskins meshes). Each
// subsequent tick uses repaintHeatMapColor (the slim path that only
// touches the colour bytes).
//
// Notes on what's deliberately simplified:
//   • Lambert only — no occlusion / shadow casting. The gable casts
//     no shadow; only surface orientation matters. Real daylight
//     studies use raycast occlusion, which would multiply per-vertex
//     cost by the BVH traversal time. Cheap-and-cheerful is the
//     point here.
//   • Sun arcs in a single vertical plane (one horizontal axis
//     only) — no north / south swing. Reads as an equinox sweep
//     rather than a calendared analysis.
//   • Update rate is throttled to ~10 fps (every 100 ms). At that
//     cadence the rasteriser/blur cost stays well under frame
//     budget for a ~50-mesh model.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

// ── A solar-themed colour ramp ──────────────────────────────────
// 0 = full shadow / night, 1 = direct sun. Sweeps cool→warm→bright
// so animated frames read as "the sun moves across the model."
const SOLAR_RAMP = [
    { position: 0.00, color: [0.04, 0.05, 0.18] },   // night blue
    { position: 0.20, color: [0.18, 0.12, 0.30] },   // dim purple shadow
    { position: 0.45, color: [0.70, 0.30, 0.20] },   // dawn / dusk orange
    { position: 0.75, color: [1.00, 0.80, 0.30] },   // mid-day amber
    { position: 1.00, color: [1.00, 0.98, 0.85] }    // bright noon
];

const TEXTURE_SIZE   = 256;     // square; 256 keeps per-frame raster cost manageable
const UPDATE_INTERVAL_MS = 100; // ~10 fps sun ticks
const DAY_PERIOD_MS  = 12000;   // 12-second loop per simulated day

async function main() {

    const studio = new xeokit.studio.Studio({});
    await studio.init();

    const { scene, data } = studio;

    // ── DataModel + SceneModel populated from the IfcOpenHouse4 IFC.

    const dataModelResult = data.createModel({ id: "ifcOpenHouse4" });
    if (!dataModelResult.ok) throw new Error(dataModelResult.error);
    const dataModel = dataModelResult.value;

    const sceneModelResult = scene.createModel({
        id: "ifcOpenHouse4",
        coordinateSystem: {
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            origin: [0, 0, 0],
            units: "meters"
        }
    });
    if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
    const sceneModel = sceneModelResult.value;

    const ifcLoader = new xeokit.formats.ifc.IFCLoader();
    const ifcResponse = await fetch("../../models/IfcOpenHouse4/ifc/model.ifc");
    if (!ifcResponse.ok) {
        throw new Error(`HTTP ${ifcResponse.status} fetching IfcOpenHouse4 IFC`);
    }
    await ifcLoader.load({
        fileData: await ifcResponse.arrayBuffer(),
        sceneModel,
        dataModel
    });

    // ── Sun model.
    //
    // Pick the model's worldUp axis index, then a horizontal axis
    // perpendicular to it as the "east" direction. The sun arcs in
    // the (east, up) plane from u = 0 (east horizon) → 0.5 (zenith)
    // → 1 (west horizon). When sin(angle) <= 0 the sun is below the
    // horizon — Lambert returns zero everywhere, model goes dark.
    const worldUp = sceneModel.coordinateSystem
        ? sceneModel.coordinateSystem.worldUp
        : [0, 0, 1];
    const upAxisIdx = pickAxis(worldUp);
    const eastAxisIdx = (upAxisIdx + 1) % 3;

    let sun = computeSunDir(0.5, eastAxisIdx, upAxisIdx);   // start at noon

    // ── Per-mesh state cache.
    //
    // `applyHeatMapMaterials` writes a colour SceneTexture per
    // SceneGeometry, named `_heat_${geom.id}_color`. We need three
    // things per paintable geometry to drive the live update:
    //   - decoded per-vertex local-space normals (octahedral → unit
    //     Vec3, computed once)
    //   - the SceneMesh that anchors the geometry into world space
    //     (gives us the rotation that lets us transform sun → local)
    //   - the colour SceneTexture (whose imageData we mutate + reassign
    //     to fire onSceneTextureImageDataChanged)
    //
    // For geometries shared by multiple meshes we just keep the first
    // mesh — heat-map textures are per-geometry, so any other mesh
    // sharing the same geometry sees the same heat map regardless.
    // Initial paint with an all-zero scalar field so applyHeatMapMaterials
    // wires up the textures / materials / UV layout; we'll start the live
    // animation from that baseline. Custom ramp + fixed [0,1] range so
    // every tick produces a comparable irradiance scale.
    const paintInitial = xeokit.presentations.heatmaps.applyHeatMapMaterials({
        sceneModel,
        scalars: (geom) => {
            const v = (geom.positionsCompressed.length / 3) | 0;
            return new Float32Array(v);
        },
        range: [0, 1],
        textureSize: TEXTURE_SIZE,
        ramp: SOLAR_RAMP,
        roughness: 0.6,
        backgroundColor: [0, 0, 0]
    });
    if (!paintInitial.ok) throw new Error(paintInitial.error);


    // Build the live-update cache by walking objects → meshes
    // *after* applyHeatMapMaterials has re-bound each painted mesh
    // to its sibling (`__heat`-suffixed) geometry. Reaching the
    // texture via `mesh.material.colorTexture` sidesteps the
    // namespace mismatch between the original geom id (used for
    // texture naming) and the sibling geom id (now on the mesh).
    //
    // IFC-loaded geometries don't carry pre-computed normals — the
    // IFCLoader emits positions/indices/UVs but not normalsCompressed
    // — so for any geometry without normals we synthesise per-vertex
    // smooth normals from positions + indices once at setup. The
    // result is the same shape (Float32Array of unit normals, length
    // 3 × vertexCount) the oct-decode path produces.
    const liveTargets = [];
    const seenGeoms = new Set();
    for (const objId in sceneModel.objects) {
        const obj = sceneModel.objects[objId];
        for (const mesh of obj.meshes) {
            const geom = mesh.geometry;
            if (!geom || !geom.indices || !geom.positionsCompressed || !geom.uvsCompressed) continue;
            // Geometries shared across meshes get one entry — heat
            // maps are per-geometry, so painting the texture once is
            // enough.
            if (seenGeoms.has(geom.id)) continue;
            const tex = mesh.material?.colorTexture;
            if (!tex || !tex.imageData) continue;
            seenGeoms.add(geom.id);
            let normals;
            if (geom.normalsCompressed && geom.normalsCompressed.length > 0) {
                // Real per-vertex normals (e.g. from glTF / XGF) — already
                // oriented outward by the source format spec.
                normals = octDecodeToFloats(geom.normalsCompressed);
            } else {
                // No normals on the geometry → synthesise from
                // positions + indices via cross product.
                normals = synthesizeSmoothNormals(geom.positionsCompressed, geom.indices, geom.aabb);
                if (!normals) continue;
                // IfcOpenHouse4 (as parsed by xeokit's IFCLoader) winds
                // triangles CW-for-outward in geometry-local space, so the
                // standard CCW cross-product convention produces inward
                // normals. Negate so the sun-facing side is the one that
                // lights up. If you swap in a dataset with CCW-for-outward
                // indices, drop this flip.
                for (let i = 0; i < normals.length; i++) normals[i] = -normals[i];
            }
            liveTargets.push({
                geom,
                mesh,
                tex,
                normals,
                scalars: new Float32Array((geom.positionsCompressed.length / 3) | 0)
            });
        }
    }

    // Shared scratch buffer for repaintHeatMapColor; sized to the
    // largest texture (all heat maps are TEXTURE_SIZE here).
    const coveredScratch = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE);

    // ── View, lighting, HDR IBL.

    const view = studio.viewManager.createView({
        renderMode: xeokit.base.constants.RealisticRender,
        effects: {
            tonemap: { sRGBEncode: true }
        }
    });

    studio.viewFit(view);

    const status = document.getElementById("status");
    const panel  = document.getElementById("panel");
    if (status) status.style.display = "none";
    if (panel)  panel.style.display = "block";
    wireUpPanel(view);

    studio.finished();

    // ── Animation loop.
    //
    // Throttled tick: recompute sun direction, walk every live target,
    // compute per-vertex Lambert in the geometry's local frame (we
    // transform the sun rather than every normal — one matrix-vector
    // mult per geometry instead of one per vertex), and re-rasterise
    // the colour map straight into the existing ImageData. Reassigning
    // `tex.imageData` fires the change event; the renderer's atlas
    // refreshes via texSubImage2D.
    const tStart = performance.now();
    let tLastUpdate = -Infinity;

    function tick(now) {
        if (now - tLastUpdate >= UPDATE_INTERVAL_MS) {
            const u = ((now - tStart) % DAY_PERIOD_MS) / DAY_PERIOD_MS;
            sun = computeSunDir(u, eastAxisIdx, upAxisIdx);
            updateAll(sun, liveTargets, coveredScratch);
            // No view.needsRender() — each `tex.imageData = ...`
            // assignment fires onSceneTextureImageDataChanged, which
            // the renderer's ViewManager routes through both the
            // atlas update AND a redraw nudge for every registered
            // view.
            tLastUpdate = now;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}


function updateAll(sun, liveTargets, coveredScratch) {
    for (let t = 0; t < liveTargets.length; t++) {
        const tgt = liveTargets[t];
        const localSun = worldDirToLocal(tgt.mesh.worldMatrix, sun);
        computeLambertScalars(tgt.normals, localSun, tgt.scalars);

        xeokit.model.procgen.paintMaterials.repaintHeatMapColor({
            indices:   tgt.geom.indices,
            uvs:       tgt.geom.uvsCompressed,
            scalars:   tgt.scalars,
            imageData: tgt.tex.imageData
        }, {
            ramp: SOLAR_RAMP,
            range: [0, 1],
            backgroundColor: [0, 0, 0],
            coveredScratch
        });

        // Reassign through the setter so SceneTexture fires the
        // change event — this is the cue the renderer's atlas needs
        // to re-upload our sub-rect.
        tgt.tex.imageData = tgt.tex.imageData;
    }
}


function computeLambertScalars(normals, lightDir, out) {
    const lx = lightDir[0], ly = lightDir[1], lz = lightDir[2];
    const v = (normals.length / 3) | 0;
    for (let i = 0; i < v; i++) {
        const n0 = normals[i * 3];
        const n1 = normals[i * 3 + 1];
        const n2 = normals[i * 3 + 2];
        const d = n0 * lx + n1 * ly + n2 * lz;
        out[i] = d > 0 ? d : 0;
    }
}


// Sun direction in world space at parameter u ∈ [0, 1].
//
// Sweeps a half-circle from +eastAxis through +upAxis to -eastAxis.
// `u % 1` semantics give a continuous loop with night = the wrap
// from sunset back to sunrise where the sun's up-component is zero.
// (We don't model nighttime explicitly — the surfaces just go dark
// because the sun's at the horizon.)
function computeSunDir(u, eastAxisIdx, upAxisIdx) {
    const angle = u * Math.PI * 2;
    const sun = [0, 0, 0];
    sun[eastAxisIdx] = Math.cos(angle);
    sun[upAxisIdx]   = Math.sin(angle);
    return sun;
}


// Pick the axis index (0 | 1 | 2) most aligned with `v`.
function pickAxis(v) {
    const ax = Math.abs(v[0]);
    const ay = Math.abs(v[1]);
    const az = Math.abs(v[2]);
    if (ax >= ay && ax >= az) return 0;
    if (ay >= az)              return 1;
    return 2;
}


// Transform a world-space direction into a SceneMesh's local frame
// using the transpose of its worldMatrix's upper-left 3×3, then
// renormalise.
//
// Why renormalise: in xeokit, `mesh.worldMatrix` bakes the SceneModel's
// `coordinateSystemMatrix` into every mesh. For an IFC file in
// millimetres loaded into a metre-scale SceneModel, that matrix
// carries a uniform scale of 0.001 alongside its rotation/swap. The
// 3×3 transpose then maps a unit world direction to a length-0.001
// local one, which would silently kill every Lambert dot product (the
// symptom: heat maps that never leave the first ramp stop). For
// uniform scale, renormalising restores unit length and the proper
// inverse-rotation behaviour.
function worldDirToLocal(m, world) {
    const wx = world[0], wy = world[1], wz = world[2];
    let lx = m[0] * wx + m[1] * wy + m[2]  * wz;
    let ly = m[4] * wx + m[5] * wy + m[6]  * wz;
    let lz = m[8] * wx + m[9] * wy + m[10] * wz;
    const len = Math.sqrt(lx * lx + ly * ly + lz * lz);
    if (len > 0) {
        const inv = 1 / len;
        lx *= inv; ly *= inv; lz *= inv;
    }
    return [lx, ly, lz];
}


// Decode an octahedral-encoded Uint16 normals buffer (as produced
// by attachSceneModelMaterials / IFCLoader) into a flat Float32
// array of unit vectors, length = 3 × vertexCount. Standard oct
// decode: map [0, 65535]² → [-1, 1]², compute z = 1 − |x| − |y|,
// fold negative z back into the upper octahedron, normalise.
function octDecodeToFloats(enc) {
    const v = (enc.length / 2) | 0;
    const out = new Float32Array(v * 3);
    for (let i = 0; i < v; i++) {
        const fx = (enc[i * 2]     / 32767.5) - 1;
        const fy = (enc[i * 2 + 1] / 32767.5) - 1;
        let nx = fx;
        let ny = fy;
        let nz = 1 - Math.abs(fx) - Math.abs(fy);
        if (nz < 0) {
            const tx = nx;
            nx = (1 - Math.abs(ny)) * (tx >= 0 ? 1 : -1);
            ny = (1 - Math.abs(tx)) * (ny >= 0 ? 1 : -1);
        }
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const inv = len > 0 ? 1 / len : 1;
        out[i * 3]     = nx * inv;
        out[i * 3 + 1] = ny * inv;
        out[i * 3 + 2] = nz * inv;
    }
    return out;
}


// Build per-vertex smooth normals from positions + triangle indices.
// Used for geometries that arrive without `normalsCompressed` (IFC-
// loaded meshes typically don't carry encoded normals — the IFCLoader
// only emits positions / indices / UVs). Same area-weighted scheme as
// `attachSceneModelMaterials`'s private helper: face normals
// accumulated unnormalised (so larger triangles dominate small slivers
// in shared-vertex averages), then renormalised. Returns null on a
// fully-degenerate mesh; the caller drops that geometry from the
// live-update set.
function synthesizeSmoothNormals(positionsCompressed, indices, aabb) {
    const v = (positionsCompressed.length / 3) | 0;
    const triCount = (indices.length / 3) | 0;
    if (v === 0 || triCount === 0 || (indices.length % 3) !== 0) return null;

    // Decompress positions to Float32 in geometry-local metres so the
    // cross products operate on real-scale magnitudes (otherwise short
    // edges + Uint16 quantisation would dominate the round-off).
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
            // Isolated vertex — point along +Y as a safe default; it
            // won't get sampled in any triangle anyway.
            acc[i * 3]     = 0;
            acc[i * 3 + 1] = 1;
            acc[i * 3 + 2] = 0;
        }
    }
    return any ? acc : null;
}


main().catch(err => {
    console.error("[SolarSweep_IfcOpenHouse4]", err);
});


// ---------------------------------------------------------------------
// Rendering panel
//
// Lifted from XGFLoader_Realistic_HousePlan so all examples that use
// this panel layout share a single behaviour. Effect parameters are
// not overridden — the SDK constructor defaults stand and the panel
// HTML mirrors them.
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

    updateSubpanelDisabledStates(view);
}

function updateSubpanelDisabledStates(view) {
    const effects = {
        tonemap:           view.effects.tonemap,
        hemispheric: view.lights.hemispheric,
        ibl:               view.lights.ibl,
        shadows:           view.effects.shadows,
        sao:               view.effects.sao,
        bloom:             view.effects.bloom,
        aa:                view.effects.antiAliasing,
        edges:             view.effects.edges
    };
    for (const [name, effect] of Object.entries(effects)) {
        const details = document.querySelector(`#panel details[data-effect="${name}"]`);
        if (!details || !effect) continue;
        const active = effect.applied && (effect.possible !== false);
        details.classList.toggle("disabled", !active);
        if (!active) details.open = false;
    }
}

function populatePanelFromView(view) {
    setSelect("renderMode", nameForRenderMode(view.renderMode));

    setSelect("tonemapMode", view.effects.tonemap.mode);
    setRange ("exposure",    view.effects.tonemap.exposure, 2);
    setCheck ("tonemapSRGB", view.effects.tonemap.sRGBEncode);
    setRange ("renderScale", view.effects.tonemap.renderScale, 1);

    setRange ("hemisphereIntensity", view.lights.hemispheric.intensity, 2);
    setColor ("hemisphereSky",       view.lights.hemispheric.skyColor);
    setColor ("hemisphereGround",    view.lights.hemispheric.groundColor);

    setRange ("iblIntensity", view.lights.ibl.intensity, 2);

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

    setRange ("saoIntensity",     view.effects.sao.intensity, 2);
    setRange ("saoKernelRadius",  view.effects.sao.kernelRadius, 0);
    setRange ("saoNumSamples",    view.effects.sao.numSamples, 0);
    setCheck ("saoBlur",          view.effects.sao.blur);
    setRange ("saoBias",          view.effects.sao.bias, 2);
    setRange ("saoScale",         view.effects.sao.scale, 2);
    setRange ("saoBlendCutoff",   view.effects.sao.blendCutoff, 2);
    setRange ("saoBlendFactor",   view.effects.sao.blendFactor, 2);
    setRange ("saoMinResolution", view.effects.sao.minResolution, 2);

    setRange ("bloomIntensity",  view.effects.bloom.intensity, 2);
    setRange ("bloomThreshold",  view.effects.bloom.threshold, 2);
    setRange ("bloomKnee",       view.effects.bloom.knee, 2);

    setSelect("aaMode", view.effects.antiAliasing.mode);

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
