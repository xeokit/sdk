// Profile capture for the WebGL renderer using the OTC Conference Center
// XGF model. Loads the model, slowly orbits the camera so frames keep
// coming, and uses RenderInspector.captureFrames to record per-bin GPU +
// CPU time, draw counts, and primitive counts.
//
// Captures the same window twice:
//   1) at the canvas's natural size — the real workload
//   2) at 32x32 px            — the fragment-bound diagnostic
//
// Reading the result:
// - If aggregate frame GPU ms barely changes between (1) and (2), the
//   workload is NOT fragment-bound; LOD won't move the needle and the
//   next perf lever to try is something draw-call or upload-side.
// - If aggregate frame GPU ms drops sharply at 32x32, the workload is
//   fragment-bound and LOD / adaptive quality is the right next bet.
//
// Output goes to devtools console as console.table blocks. Copy them
// back to share the profile.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const FRAMES_PER_CAPTURE = 60;
// 0.05 is the renderer's clamp floor; at a 1920px viewport that is a
// ~96×96 backing store — small enough to remove fragment cost as a
// factor while leaving everything else (vertex throughput, draw-call
// overhead, JS) unchanged.
const TINY_RESOLUTION_SCALE = 0.05;

const infoEl = document.getElementById("info");

const studio = new xeokit.studio.Studio({});
window.studio = studio;  // expose for devtools snippets

const log = (...args) => console.log("[profile]", ...args);

studio.init().then(async () => {
    log("studio.init resolved");

    const {scene, data} = studio;

    const view = studio.viewManager.createView({
        camera: {
            perspectiveProjection: {fov: 60},
        },
    });
    // Studio enables AdaptiveQuality by default for interactive examples.
    // This profiler needs an explicit RealisticRender baseline first, then
    // creates its own adapter for the measured adaptive pass below.
    xeokit.viewing.adaptiveQuality.AdaptiveQuality.getFor(view)?.destroy();
    log("view created", view?.id);

    const MODEL_ID = "OTC";
    const MODEL_BASE = "../../models/OTCConferenceCenter";

    // Mirror the working presentations_cameraTour_conferenceCenter
    // example: create both scene and data models with an explicit
    // coordinate system, then load both formats in parallel.
    const sceneModelRes = scene.createModel({
        id: MODEL_ID,
        coordinateSystem: {
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            origin: [0, 0, 0],
            units: "meters",
            scaleToMeters: 1,
        },
    });
    if (!sceneModelRes.ok) throw new Error(sceneModelRes.error);

    const dataModelRes = data.createModel({id: MODEL_ID});
    if (!dataModelRes.ok) throw new Error(dataModelRes.error);

    infoEl.textContent = "Loading OTC Conference Center XGF…";
    log("loadModel: starting fetch + parse");

    await Promise.all([
        studio.loadModel({
            id:     MODEL_ID,
            src:    `${MODEL_BASE}/datamodel/model.json`,
            format: "datamodel",
            dataModel: dataModelRes.value,
        }),
        studio.loadModel({
            id:     MODEL_ID,
            src:    `${MODEL_BASE}/xgf/model.xgf`,
            format: "xgf",
            sceneModel: sceneModelRes.value,
        }),
    ]);
    log("loadModel: both formats resolved");

    // Frame the loaded geometry. The scene collision index has the
    // authoritative whole-scene AABB now that the model is in.
    const aabb = studio.picking.collisionIndex.getSceneAABB();
    log("scene AABB", aabb);
    studio.viewManager.fitToAabb(view, aabb);

    // Close Studio's loading dialog NOW — the captures below are
    // long-running and the dialog is gated by sdkProgress.completeTask
    // which only fires inside studio.finished(). Letting it block until
    // both captures finished was the "never stops loading" bug.
    studio.finished();
    log("studio.finished() called");

    // Expose for devtools tinkering. Use these from console:
    //   bloom.threshold = 0.5; view.needsRender();
    //   bloom.intensity = 0.4; view.needsRender();
    window.view    = view;
    window.bloom   = view.effects.bloom;
    window.tonemap = view.effects.tonemap;

    // Bloom / HDR diagnostic — dumps the state at one quiescent point so
    // we can tell whether the post-process chain is even running.
    try {
        const canvas = document.querySelector("canvas");
        const gl = canvas && canvas.getContext("webgl2");
        const haveExt = !!(gl && gl.getExtension("EXT_color_buffer_float"));
        const bloom = view.effects.bloom;
        const tonemap = view.effects.tonemap;
        console.log("[bloom-diag]", {
            haveExt,
            viewRenderMode:   view.renderMode,
            bloomApplied:     bloom.applied,
            bloomPossible:    bloom.possible,
            bloomRenderModes: Array.from(bloom.renderModes),
            bloomThreshold:   bloom.threshold,
            bloomIntensity:   bloom.intensity,
            tonemapApplied:   tonemap.applied,
        });
    } catch (e) {
        console.error("[bloom-diag] failed:", e);
    }

    const inspectorRes = studio.renderer.getRenderInspector();
    if (inspectorRes.ok === false) {
        fail(inspectorRes.error);
        return;
    }
    const inspector = inspectorRes.value;

    // Studio creates and appends its own canvas — grab it from the DOM
    // so we can resize it for the tiny-canvas pass.
    const canvas = document.querySelector("canvas");
    if (!canvas) {
        fail("Could not locate WebGL canvas");
        return;
    }

    // Keep frames flowing during capture. The viewer renders on demand,
    // so a slow continuous orbit guarantees the inspector sees real
    // frames and the per-bin queries land in time. The orbit also
    // simulates the interactive-camera case, which is when LOD / adaptive
    // quality would matter most.
    const orbit = startOrbit(view);
    log("orbit started");

    // Burn a few frames after load so caches warm up and the first
    // captured frame isn't an outlier.
    await waitFrames(view, 30);
    log("warm-up frames done");

    const gl = canvas.getContext("webgl2");
    const glRenderer = gl?.getParameter(gl.RENDERER) ?? "(unknown)";
    const glVendor   = gl?.getParameter(gl.VENDOR)   ?? "(unknown)";
    const timerSupported = !!gl?.getExtension("EXT_disjoint_timer_query_webgl2");

    infoEl.textContent =
        `GL_VENDOR:   ${glVendor}\n` +
        `GL_RENDERER: ${glRenderer}\n` +
        `EXT_disjoint_timer_query_webgl2: ${timerSupported ? "yes" : "NO (gpuTimeMs will be empty)"}\n\n` +
        `Capturing ${FRAMES_PER_CAPTURE} frames at full size…`;

    log("captureFrames(full) start");
    const fullFrames = await inspector.captureFrames(FRAMES_PER_CAPTURE);
    log("captureFrames(full) done", fullFrames.length);

    // Adaptive-quality pass: same orbit, but with AdaptiveQuality flipping
    // the view into NavigationRender on every camera change. SAO + shadows
    // should drop out (and the color pass should switch from
    // opaqueSAOShadow to plain opaque).
    infoEl.textContent =
        infoEl.textContent.replace(/Capturing.*$/, "") +
        `Full-size capture: done (${fullFrames.length} frames)\n` +
        `Capturing ${FRAMES_PER_CAPTURE} frames with AdaptiveQuality…`;
    log("captureFrames(adaptive) start");
    const adaptiveQuality = new xeokit.viewing.adaptiveQuality.AdaptiveQuality({
        view,
        restMs: 1_000_000,  // never rest during the capture — the orbit is continuous
    });
    let adaptiveFrames;
    try {
        // Let the first orbit tick flip view.renderMode → NavigationRender before
        // we start measuring, so no captured frame straddles the transition.
        await waitFrames(view, 5);
        adaptiveFrames = await inspector.captureFrames(FRAMES_PER_CAPTURE);
    } finally {
        adaptiveQuality.destroy();  // restores RealisticRender for the next pass
    }
    await waitFrames(view, 5);
    log("captureFrames(adaptive) done", adaptiveFrames.length);

    infoEl.textContent =
        infoEl.textContent.replace(/Capturing.*$/, "") +
        `Adaptive capture: done (${adaptiveFrames.length} frames)\n` +
        `Capturing ${FRAMES_PER_CAPTURE} frames at ${(TINY_RESOLUTION_SCALE * 100).toFixed(0)}% resolution…`;

    // Tiny pass for the fragment-bound diagnostic. We can't just resize
    // the canvas backing store — the renderer's ViewManager realigns
    // canvas.width/height to the View's CSS rect every rAF and would
    // undo us. Drive it through resolutionScale, which the alignment
    // path already honours. Force the render mode into the configured
    // renderModes list so `applied` flips to true.
    const rs = view.resolutionScale;
    const savedScale = rs.resolutionScale;
    const savedModes = rs.renderModes;
    rs.renderModes = [
        xeokit.base.constants.NavigationRender,
        xeokit.base.constants.DetailedRender,
        xeokit.base.constants.RealisticRender,
    ];
    rs.resolutionScale = TINY_RESOLUTION_SCALE;
    view.needsRender();
    await waitFrames(view, 5);

    log("captureFrames(tiny) start");
    const tinyFrames = await inspector.captureFrames(FRAMES_PER_CAPTURE);
    log("captureFrames(tiny) done", tinyFrames.length);

    // Restore.
    rs.resolutionScale = savedScale;
    rs.renderModes = savedModes;
    view.needsRender();

    orbit.stop();

    const fullAgg     = aggregate(fullFrames);
    const adaptiveAgg = aggregate(adaptiveFrames);
    const tinyAgg     = aggregate(tinyFrames);

    console.group("[profile] OTC Conference Center — WebGL renderer");
    console.log("GL_VENDOR:  ", glVendor);
    console.log("GL_RENDERER:", glRenderer);
    console.log("EXT_disjoint_timer_query_webgl2:", timerSupported);
    console.log("Frames per capture:", FRAMES_PER_CAPTURE);

    const summarize = (label, agg) => {
        console.log(`\n--- ${label} ---`);
        console.log("avg frame GPU ms:", agg.frame.gpuMs.toFixed(2),
                    "avg frame CPU ms:", agg.frame.cpuMs.toFixed(2),
                    "avg draws:",        agg.frame.draws.toFixed(0),
                    "avg prims:",        agg.frame.prims.toFixed(0));
        console.table(agg.perBin);
    };
    summarize("FULL SIZE (RealisticRender, full canvas)", fullAgg);
    summarize("ADAPTIVE (NavigationRender, full canvas)", adaptiveAgg);
    summarize(`TINY ${(TINY_RESOLUTION_SCALE * 100).toFixed(0)}% RES (RealisticRender, tiny canvas)`, tinyAgg);

    const fragRatio = fullAgg.frame.gpuMs > 0 ? tinyAgg.frame.gpuMs / fullAgg.frame.gpuMs : NaN;
    const adapRatio = fullAgg.frame.gpuMs > 0 ? adaptiveAgg.frame.gpuMs / fullAgg.frame.gpuMs : NaN;
    console.log(
        `\nFragment-bound verdict: tiny GPU is ${(fragRatio * 100).toFixed(0)}% of full GPU` +
        ` (delta ${(fullAgg.frame.gpuMs - tinyAgg.frame.gpuMs).toFixed(2)} ms).`
    );
    console.log(
        `AdaptiveQuality verdict:  adaptive GPU is ${(adapRatio * 100).toFixed(0)}% of full GPU` +
        ` (delta ${(fullAgg.frame.gpuMs - adaptiveAgg.frame.gpuMs).toFixed(2)} ms).`
    );
    console.groupEnd();

    infoEl.textContent =
        `Done. Open devtools console for the tables.\n\n` +
        `Full     frame GPU avg: ${fullAgg.frame.gpuMs.toFixed(2)} ms\n` +
        `Adaptive frame GPU avg: ${adaptiveAgg.frame.gpuMs.toFixed(2)} ms (${(adapRatio * 100).toFixed(0)}%)\n` +
        `Tiny     frame GPU avg: ${tinyAgg.frame.gpuMs.toFixed(2)} ms (${(fragRatio * 100).toFixed(0)}%)`;
}).catch(err => {
    fail(String(err));
    console.error(err);
});

// ───────── helpers ─────────

function fail(msg) {
    infoEl.innerHTML = `<span class="fail">Failed: ${escapeHtml(msg)}</span>`;
}

// Drives an indefinite slow orbit at rAF cadence; the camera mutation
// flips needsRender on its own, keeping frames flowing through the
// inspector. Returns a `.stop()` handle.
function startOrbit(view) {
    let stopped = false;
    function tick() {
        if (stopped) return;
        view.camera.orbitYaw(0.3);
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return {stop() { stopped = true; }};
}

function waitFrames(view, n) {
    return new Promise(resolve => {
        let left = n;
        function tick() {
            if (--left <= 0) return resolve();
            view.needsRender();
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    });
}

function aggregate(frames) {
    const perBin = {};
    let totalGpu = 0, totalCpu = 0, totalDraws = 0, totalPrims = 0;
    const n = frames.length || 1;
    for (const f of frames) {
        totalGpu  += f.gpuTimeMs ?? 0;
        totalCpu  += f.timeMs?.duration ?? 0;
        totalDraws += f.numDrawCalls ?? 0;
        totalPrims += f.numPrims ?? 0;
        for (const b of f.renderBins) {
            const row = perBin[b.name] ??= {gpuMs: 0, cpuMs: 0, draws: 0, prims: 0, count: 0};
            row.gpuMs += b.gpuTimeMs ?? 0;
            row.cpuMs += b.timeMs?.duration ?? 0;
            row.draws += b.drawCalls.length;
            for (const d of b.drawCalls) row.prims += d.primRange?.numPrims ?? 0;
            row.count++;
        }
    }
    const perBinAvg = {};
    for (const [k, r] of Object.entries(perBin)) {
        const c = r.count || 1;
        perBinAvg[k] = {
            gpuMs_avg: +(r.gpuMs / c).toFixed(3),
            cpuMs_avg: +(r.cpuMs / c).toFixed(3),
            draws_avg: +(r.draws / c).toFixed(0),
            prims_avg: +(r.prims / c).toFixed(0),
        };
    }
    return {
        frame: {
            gpuMs: totalGpu / n,
            cpuMs: totalCpu / n,
            draws: totalDraws / n,
            prims: totalPrims / n,
        },
        perBin: perBinAvg,
    };
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;",
    })[c]);
}
