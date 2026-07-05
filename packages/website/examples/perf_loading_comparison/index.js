// Loading-performance comparison: IFC vs glTF vs XGF (same model) + .splat.
//
// Measures the CPU cost of turning each delivery format into a live SceneModel:
// the time for `loader.load()` to resolve on an already-fetched, in-memory
// ArrayBuffer, loading into a *renderer-less* Scene. No Viewer/WebGLRenderer is
// attached, so there is zero GPU upload — this isolates the format's parse +
// SceneModel-build cost and is the low-variance, reproducible number that holds
// across machines and headless runs alike.
//
// Reliability controls:
//   - Network excluded: each file is fetched ONCE up front; timed runs operate
//     on a fresh copy of the in-memory buffer (loaders may neuter their input).
//   - Warm-up runs discarded (JIT; and the first IFC load pays one-time web-ifc
//     WASM init, which is amortised out here).
//   - N timed iterations, each into a fresh Scene that's destroyed afterwards.
//   - Robust stats: median + min + MAD (median absolute deviation), not mean,
//     so a GC pause in one run doesn't smear the result.
//   - Cooperative yielding minimised during measurement (large yieldIntervalMs)
//     so we time compute, not the host scheduler.
//
// Fairness notes (shown in the results):
//   - IFC is *source BIM*: it parses, generates geometry AND builds a semantic
//     DataModel — strictly more work than the geometry-only delivery formats.
//     glTF and XGF (xeokit-native, quantised) are pre-baked geometry.
//   - .splat is different content (reality-capture gaussians, not BIM triangles)
//     and only one splat model exists — it is reported as throughput on its own
//     row, NOT ranked against the BIM formats.
//
// Secondary metric (GPU draw time): a per-format "GPU draw ms" column times the
// GPU work to draw the loaded scene, read from the renderer's built-in
// EXT_disjoint_timer_query_webgl2 instrumentation (RenderInspector.captureFrames).
// Timer queries are GPU-accurate and immune to rAF jitter — but only exist on a
// real GPU, so this is feature-detected and shown as "n/a" under headless /
// SwiftShader rather than guessed at. It measures draw cost, not buffer upload.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// ── Config ──────────────────────────────────────────────────────────────────
const MODEL = "Duplex";        // present as ifc + gltf + xgf
const MODEL_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};
const ITERATIONS = 6;          // timed runs per format
const WARMUP = 1;              // discarded runs per format
const YIELD_MS = 1e9;          // minimise loader cooperative-yields while timing
const MEASURE_GPU = true;      // also time GPU draw of the loaded scene (timer queries)
const GPU_CAPTURE_FRAMES = 8;  // frames sampled once the model is loaded + framed

const BIM_FORMATS = [
  {id: "ifc",  label: "IFC — source BIM → scene",   url: `../../models/${MODEL}/ifc/model.ifc`,  make: () => new xeokit.formats.ifc.IFCLoader(),               semantic: true},
  {id: "gltf", label: "glTF — delivery → scene",     url: `../../models/${MODEL}/gltf/model.glb`, make: () => new xeokit.formats.gltf.GLTFLoader()},
  {id: "xgf",  label: "XGF — native → scene",        url: `../../models/${MODEL}/xgf/model.xgf`,  make: () => new xeokit.formats.xgf.XGFLoader()},
];
const SPLAT_FORMAT =
  {id: "splat", label: ".splat — reality capture",   url: "../../models/Train/splat/model.splat", make: () => new xeokit.formats.gaussiansplat.GaussianSplatLoader(), splat: true};

// ── Helpers ───────────────────────────────────────────────────────────────────
const setStatus = (t) => { const el = document.getElementById("status"); if (el) el.textContent = t; };

async function prefetch(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return await resp.arrayBuffer();
}

// Counts triangles (BIM) and splats in a freshly-loaded SceneModel.
function countPrimitives(sceneModel) {
  let triangles = 0, splats = 0;
  for (const geom of Object.values(sceneModel.geometries)) {
    if (geom.rotations) {
      splats += geom.positionsCompressed.length / 3;       // splat geometry
    } else if (geom.indices) {
      triangles += geom.indices.length / 3;                // triangle geometry
    }
  }
  return {triangles, splats};
}

// One timed load into a fresh, renderer-less Scene. Returns {ms, counts}.
async function timedLoad(fmt, buffer) {
  const scene = new xeokit.model.scene.Scene();
  const data = fmt.semantic ? new xeokit.model.data.Data() : null;
  const sceneModel = scene.createModel({
    id: "m",
    ...(!fmt.splat ? {coordinateSystem: MODEL_COORDINATE_SYSTEM} : {})
  }).value;
  const dataModel = data ? data.createModel({id: "m"}).value : undefined;

  const params = {fileData: buffer.slice(0), sceneModel};  // fresh copy per run
  if (dataModel) params.dataModel = dataModel;

  const t0 = performance.now();
  await fmt.make().load(params, {yieldIntervalMs: YIELD_MS});
  const ms = performance.now() - t0;

  const counts = countPrimitives(sceneModel);
  scene.destroy?.();
  data?.destroy?.();
  return {ms, counts};
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const devs = sorted.map(v => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = devs.length % 2 ? devs[mid] : (devs[mid - 1] + devs[mid]) / 2;
  return {median, min: sorted[0], max: sorted[sorted.length - 1], mad, samples: sorted};
}

function collectEnv() {
  let renderer = "unknown";
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    if (gl && ext) renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  } catch { /* ignore */ }
  return {
    userAgent: navigator.userAgent,
    deviceMemoryGB: navigator.deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    webglRenderer: renderer,
  };
}

async function benchmark(fmt) {
  // Fetch once; every timed run loads a fresh slice() of this buffer, so the
  // network is out of the measurement and loaders can't neuter the source.
  const buffer = await prefetch(fmt.url);
  const fileBytes = buffer.byteLength;

  for (let i = 0; i < WARMUP; i++) {
    setStatus(`${fmt.label}: warm-up ${i + 1}/${WARMUP}…`);
    await timedLoad(fmt, buffer);
  }
  const samples = [];
  let counts;
  for (let i = 0; i < ITERATIONS; i++) {
    setStatus(`${fmt.label}: run ${i + 1}/${ITERATIONS}…`);
    const r = await timedLoad(fmt, buffer);
    samples.push(r.ms);
    counts = r.counts;
  }

  const s = stats(samples);
  const sec = s.median / 1000;
  const prims = fmt.splat ? counts.splats : counts.triangles;
  return {
    id: fmt.id, label: fmt.label, splat: !!fmt.splat,
    fileMB: fileBytes / (1024 * 1024),
    ...s,
    mbPerSec: (fileBytes / (1024 * 1024)) / sec,
    prims,
    primsPerSec: prims / sec,
    primLabel: fmt.splat ? "splats" : "triangles",
  };
}

function renderTable(results, env, gpuSupported) {
  const fmt1 = (n) => n.toFixed(1);
  const fmtK = (n) => Math.round(n).toLocaleString();
  const gpuCell = (r) =>
    !gpuSupported ? '<span class="dim">n/a</span>'
      : r.gpuMs != null ? r.gpuMs.toFixed(2)
        : "—";
  const rows = results.map(r => {
    if (r.error) {
      return `<tr><td>${r.label}</td><td colspan="7" class="err">${r.error}</td></tr>`;
    }
    const cls = r.splat ? ' class="splat"' : "";
    return `<tr${cls}>
      <td>${r.label}</td>
      <td>${fmt1(r.fileMB)}</td>
      <td><b>${fmt1(r.median)}</b></td>
      <td>${fmt1(r.min)}</td>
      <td>±${fmt1(r.mad)}</td>
      <td>${fmt1(r.mbPerSec)}</td>
      <td>${fmtK(r.prims)} ${r.primLabel} · ${fmtK(r.primsPerSec)}/s</td>
      <td>${gpuCell(r)}</td>
    </tr>`;
  }).join("");

  const gpuNote = gpuSupported
    ? `<b>GPU draw ms</b> = median TIME_ELAPSED_EXT to draw the loaded scene (real GPU only).`
    : `<b>GPU draw ms</b> = n/a — no EXT_disjoint_timer_query_webgl2 (e.g. headless / SwiftShader).`;

  document.getElementById("results").innerHTML = `
    <table>
      <thead><tr>
        <th>Format</th><th>File MB</th><th>Median ms</th><th>Min ms</th>
        <th>MAD</th><th>MB/s</th><th>Primitives · throughput</th><th>GPU draw ms</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">Model <b>${MODEL}</b> (same scene for IFC/glTF/XGF). ${ITERATIONS} timed runs/format,
      ${WARMUP} warm-up discarded; <b>Median ms</b> is CPU decode → SceneModel, renderer-less (no GPU upload).
      IFC also builds a semantic DataModel. The <span class="splat">.splat</span> row is different content —
      throughput only, not ranked against the BIM formats. ${gpuNote}</p>
    <p class="env">${env.webglRenderer} · ${env.hardwareConcurrency ?? "?"} cores ·
      ${env.deviceMemoryGB ? env.deviceMemoryGB + " GB" : "mem ?"}</p>`;
}

// ── Optional GPU first-frame metric (EXT_disjoint_timer_query_webgl2) ─────────
// Times the GPU work to DRAW the loaded scene, using the renderer's built-in
// RenderInspector timer-query instrumentation (a TIME_ELAPSED_EXT query wraps the
// renderer's own draw bins — example code can't bracket those itself). This is
// GPU draw time, not buffer-upload time. Real-GPU only: headless Chrome /
// SwiftShader has no timer-query extension, so we feature-detect and skip.

function timerQuerySupported() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    return !!(gl && gl.getExtension("EXT_disjoint_timer_query_webgl2"));
  } catch { return false; }
}

// RenderInspector.captureFrames resolves only as frames keep rendering (the
// renderer is on-demand) AND once the async query results land 1–2 frames later.
// So we pump renders each rAF until it resolves, bounded by a timeout so a
// missing extension or idle loop can never hang the page.
function captureGpuFrames(view, inspector, frames, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (vals) => { if (!settled) { settled = true; resolve(vals); } };
    inspector.captureFrames(frames)
      .then(fs => finish(fs.map(f => f.gpuTimeMs).filter(v => typeof v === "number")))
      .catch(() => finish([]));
    const t0 = performance.now();
    const pump = () => {
      if (settled) return;
      if (performance.now() - t0 > timeoutMs) return finish([]);
      view.needsRender();   // internal hook: keep the on-demand render loop ticking
      requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);
  });
}

async function measureGpuDraw(studio, view, inspector, fmt, buffer) {
  const sceneModel = studio.scene.createModel({
    id: "gpu",
    ...(!fmt.splat ? {coordinateSystem: MODEL_COORDINATE_SYSTEM} : {})
  }).value;
  const dataModel = fmt.semantic ? studio.data.createModel({id: "gpu"}).value : undefined;
  const params = {fileData: buffer.slice(0), sceneModel};
  if (dataModel) params.dataModel = dataModel;
  await fmt.make().load(params, {yieldIntervalMs: YIELD_MS});

  const aabb = studio.picking.collisionIndex.getSceneAABB?.();
  if (aabb) studio.viewManager.fitToAabb(view, aabb);   // frame it, else draws are culled

  const vals = await captureGpuFrames(view, inspector, GPU_CAPTURE_FRAMES);
  sceneModel.destroy?.();
  dataModel?.destroy?.();
  return vals.length ? stats(vals).median : undefined;  // median per-frame GPU draw ms
}

async function gpuPass(results, studio) {
  const view = studio.viewManager.createView({camera: {eye: [0, 0, 10], look: [0, 0, 0], up: [0, 1, 0]}});
  const inspector = studio.renderer.getRenderInspector().value;
  for (const fmt of [...BIM_FORMATS, SPLAT_FORMAT]) {
    const row = results.find(r => r.id === fmt.id);
    if (!row || row.error) continue;
    try {
      setStatus(`${fmt.label}: GPU draw…`);
      row.gpuMs = await measureGpuDraw(studio, view, inspector, fmt, await prefetch(fmt.url));
    } catch (e) {
      console.warn(`[perf] GPU ${fmt.id} failed:`, e);
    }
  }
}

async function run() {
  const env = collectEnv();
  const results = [];
  let studio = null;

  for (const fmt of [...BIM_FORMATS, SPLAT_FORMAT]) {
    try {
      results.push(await benchmark(fmt));
    } catch (e) {
      console.error(`[perf] ${fmt.id} failed:`, e);
      results.push({id: fmt.id, label: fmt.label, splat: !!fmt.splat, error: e.message || String(e)});
    }
  }

  const gpuSupported = MEASURE_GPU && timerQuerySupported();
  if (gpuSupported) {
    setStatus("GPU draw timing…");
    studio = new xeokit.studio.Studio({});
    await studio.init();
    try { await gpuPass(results, studio); } catch (e) { console.warn("[perf] GPU pass failed:", e); }
  }

  setStatus("");
  renderTable(results, env, gpuSupported);
  console.table(results.filter(r => !r.error).map(r => ({
    format: r.id, fileMB: +r.fileMB.toFixed(1), medianMs: +r.median.toFixed(1),
    mad: +r.mad.toFixed(1), mbPerSec: +r.mbPerSec.toFixed(1),
    gpuMs: r.gpuMs != null ? +r.gpuMs.toFixed(2) : null,
  })));

  // Signal completion through Studio so snapshots use the same ready path as
  // the other examples. Preserve the benchmark payload inside Studio's stats.
  if (!studio) {
    studio = new xeokit.studio.Studio({});
    await studio.init();
  }
  studio.stats.benchmark = {model: MODEL, iterations: ITERATIONS, env, gpuSupported, results};
  studio.finished();
}

run();
