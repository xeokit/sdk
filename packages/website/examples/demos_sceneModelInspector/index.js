// Demo of the SDK's `sceneModelInspector` toolkit. URL-driven loader
// (mirrors `ModelLoader_viewModel`): pass `?modelId=<id>&format=<fmt>`
// to load any model + format combo from the demo collection. Once
// the model is in, the rest of the example layers an inspect /
// fix UI on top.
//
// Pipeline (mirrors an IDE's inspect / quick-fix flow):
//
//   1. Read modelId / format from the URL (defaults: FM_LFT / ifc).
//   2. Load the model's coordSys.json + each format into a fresh
//      SceneModel + DataModel via studio.loadModel.
//   3. inspectSceneModel — produces an InspectionReport (issues
//      bucketed by severity and by code, structured `context`
//      payload for fix strategies).
//   4. viewFit + render the model.
//   5. INTERACTIVE: each warning section / type-group panel carries
//      a "Fix all" button. Clicking it filters applyFixes to the
//      relevant code(s), re-inspects, re-renders the panel, and
//      appends a new entry to the Fix Results panel on the right.
import * as xeokit from "../../js/xeokit-studio-bundle.js";


/**
 * Load the per-model coordSys.json that lives next to the model
 * data in `models/<modelId>/coordSys.json`. Lifted from
 * `ModelLoader_viewModel` — keeps the loader behaviour identical.
 */
async function loadCoordinateSystemFromFile(modelId) {
  const coordSysPath = `../../models/${encodeURIComponent(modelId)}/coordSys.json`;
  const response = await fetch(coordSysPath, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load coordSys.json at ${coordSysPath}`);
  }
  const json = await response.json();
  if (
    !json ||
    !Array.isArray(json.basis) ||
    !Array.isArray(json.origin) ||
    typeof json.units !== "string"
  ) {
    throw new Error(`Invalid coordSys.json at ${coordSysPath}`);
  }
  return json;
}

const studio = new xeokit.studio.Studio({});

// ─────────────────────────────────────────────────────────────────
// Code → category + friendly-label maps. Used by both the Inspector
// (type-group panels) and Fix Results (entries + per-issue rows)
// so a code reads the same way wherever it appears, and matching
// codes carry the same coloured stripe across panels.
// ─────────────────────────────────────────────────────────────────

// Categories — six muted hues + grey for misc. Edit at will; the
// CSS picks them up via [data-category="..."] attribute selectors.
const CODE_CATEGORY_BY_PREFIX = {
  GEOMETRY:  "geometry",
  MESH:      "mesh",
  OBJECT:    "object",
  MATERIAL:  "material",
  TEXTURE:   "texture",
  TRANSFORM: "transform",
  SCENE:     "misc",
};

function categoryForCode(code) {
  const prefix = String(code).split("_", 1)[0];
  return CODE_CATEGORY_BY_PREFIX[prefix] || "misc";
}

// Friendly per-code labels live on each Inspection's `labels` map
// in the SDK. Resolved here through the SDK helper so plugin
// authors who add a custom inspection with new codes see their
// labels in the UI without touching the example.
function labelForCode(code) {
  if (!inspectorRef) return code;
  return inspectorRef.labelForCode(code);
}

// Per-code "what is this issue?" prose from each Inspection's
// `descriptions` map. Falls back to "" when no description is
// registered — UI treats that as "skip the description card".
function descriptionForCode(code) {
  if (!inspectorRef || !inspectorRef.descriptionForCode) return "";
  return inspectorRef.descriptionForCode(code);
}


// Module-scope handles so button click handlers can reach them
// without rebuilding closures every render.
let sceneModelRef = null;
let inspectorRef  = null;
let viewRef       = null;
let demoHelperRef = null;
// AbortController for the inspect / fix run currently in flight.
// Only one run can be active at a time — concurrent fix dispatches
// would race on SceneModel mutations. Buttons short-circuit while
// activeController is non-null; the Cancel button calls .abort().
let activeController = null;
// Latest InspectionReport rendered in the panel — captured here so
// the Inspector "Get Report" button can serialize it on demand.
let lastReport = null;
// Per-run log appended on every logFixRun / logFixError call. The
// Fix Results "Get Report" button serializes the whole array.
const fixRunLog = [];
// Snapshot of `sceneModel.stats` at the moment of the initial
// inspect — used by the Fix Results savings panel as the
// "before fixing" baseline so deltas across multiple fix runs
// are reported against the same anchor (not the previous fix).
let baselineStats = null;
const inspectParams = {
  checkDuplicateGeometries: true,
  checkSimilarGeometries:   true,
  checkDanglingMeshes:     true,
  checkOverBudget:         true,
  checkOverExtent:         true,
  checkTexturedGeometryUVs: true,
  checkPBRGeometryNormals: true
};

studio.init({logging: false}).then(async () => {

  const { scene, data } = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [-3.23, -3.49, 2.58],
      look: [-0.03,  0.05, 0.5],
      up:   [ 0.26,  0.29, 0.91]
    }
  });

  const status    = document.getElementById("status");
  const reportEl  = document.getElementById("report");
  const resultsEl = document.getElementById("fixResults");

  // ── URL parameters ──────────────────────────────────────────
  // ?modelId=<id>&format=<fmt[,fmt2,...]>
  // Defaults preserve the original FM_LFT/IFC behaviour when the
  // example is opened with no query string.
  const params      = new URLSearchParams(window.location.search);
  const modelId     = params.get("modelId") || "FM_LFT";
  const formatParam = params.get("format")  || "ifc";
  const formats = formatParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  status.textContent = `Loading ${modelId} (${formats.join(", ")})…`;

  try {
    const coordinateSystem = await loadCoordinateSystemFromFile(modelId);
    const sceneModel = mustCreate(scene.createModel({
      id: "demoModel",
      coordinateSystem,
    }));
    const dataModel  = mustCreate(data.createModel({id: "demoModel"}));

    for (const format of formats) {
      await studio.loadModel(
        {modelId, format, sceneModel, dataModel},
        {},
      );
    }

    sceneModelRef = sceneModel;
    inspectorRef  = xeokit.inspect.sceneModel;
    viewRef       = view;
    demoHelperRef = studio;

    document.getElementById("clearLocate").addEventListener("click", () => {
      clearLocate();
      studio.viewFit(view);
    });
    document.getElementById("runProgressCancel").addEventListener("click", () => {
      if (activeController) activeController.abort();
    });
    document.getElementById("inspectionsEnableAll").addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      setAllInspectionsEnabled(true);
    });
    document.getElementById("inspectionsDisableAll").addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      setAllInspectionsEnabled(false);
    });
    document.getElementById("getInspectorReport").addEventListener("click", () => {
      if (!lastReport || !inspectorRef) return;
      const json = inspectorRef.inspectionReportToJson(lastReport);
      downloadJson(json, `inspection-report-${nowStamp()}.json`);
    });
    document.getElementById("getFixResultsReport").addEventListener("click", () => {
      if (!inspectorRef) return;
      const json = buildFixResultsReport();
      downloadJson(json, `fix-results-${nowStamp()}.json`);
    });
    setupCrossPanelHoverDim();

    // Reveal the panels first so the progress strip renders while
    // the initial inspect is in flight (the user gets a Cancel
    // affordance even on first run).
    initInspectionToggles();
    renderInspectionsPanel();
    status.style.display    = "none";
    reportEl.style.display  = "flex";
    resultsEl.style.display = "flex";

    // ── Inspect once on load (no auto-fix) ──────────────────────
    // Every remediation is user-driven — click the "Fix all"
    // buttons in the inspector panel to dispatch through
    // applyFixes; outcomes land in the Fix Results panel.
    const report = await runInspect("Inspecting model");
    if (!report) return;   // user cancelled the initial inspect

    // Snapshot the model's stats now — this is the "before fixing"
    // anchor the Fix Results savings panel measures every later
    // fix run against.
    baselineStats = collectStats(sceneModel);
    studio.viewFit(view);
    renderReport(report);

    studio.finished();
  } catch (err) {
    status.textContent = `Failed to load ${modelId} (${formats.join(", ")}): ${err.message || err}`;
    console.error(err);
  }
});

function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

// ─────────────────────────────────────────────────────────────────
// Fix-button click handlers — each calls applyFixes with a code
// filter, re-inspects, re-renders the report, and appends an
// entry to the Fix Results panel.
// ─────────────────────────────────────────────────────────────────

async function fixCodes(codes, actionLabel) {
  if (!sceneModelRef || !inspectorRef) return;
  if (activeController) return;     // another run already in flight

  const controller = new AbortController();
  activeController = controller;
  try {
    const registry = buildInspectionRegistry();

    showProgress({label: "Inspecting (pre-fix)…", indeterminate: true});
    const report = await inspectorRef.inspectSceneModelAsync({
      sceneModel: sceneModelRef,
      registry,
      ...inspectParams,
      signal: controller.signal,
      onProgress: ({current, total, label, phase}) => {
        if (phase === "before") {
          showProgress({label: `Inspecting: ${label}`, current, total});
        }
      },
    });

    showProgress({label: "Applying fixes…", current: 0, total: report.issues.length});
    const fixRes = await inspectorRef.applyFixesAsync({
      sceneModel: sceneModelRef,
      report,
      codes,
      signal: controller.signal,
      onProgress: ({current, total, label, phase}) => {
        if (phase === "before") {
          showProgress({label: `Fixing: ${label}`, current, total});
        }
      },
    });
    if (!fixRes.ok) {
      logFixError(actionLabel, fixRes.error, codes);
      return;
    }
    logFixRun(actionLabel, fixRes.value, codes);

    // Highlighted / xrayed state from any previous Locate click is
    // stale now — the fix may have destroyed or replaced the meshes
    // that were lit up. Clear so the next view matches the new
    // SceneModel state.
    clearLocate();

    // Re-inspect for the up-to-date state and re-render the panel.
    showProgress({label: "Re-inspecting (post-fix)…", indeterminate: true});
    const after = await inspectorRef.inspectSceneModelAsync({
      sceneModel: sceneModelRef,
      registry,
      ...inspectParams,
      signal: controller.signal,
      onProgress: ({current, total, label, phase}) => {
        if (phase === "before") {
          showProgress({label: `Inspecting: ${label}`, current, total});
        }
      },
    });
    renderReport(after);
  } catch (err) {
    if (err && err.name === "AbortError") {
      logFixError(actionLabel, "Cancelled by user — model state may be partially mutated", codes);
      // Best-effort sync re-inspect so the panel reflects whatever
      // landed before the abort. Sync (uncancellable) on this branch
      // to avoid a re-cancellation race.
      try {
        const after = inspectorRef.inspectSceneModel({
          sceneModel: sceneModelRef,
          registry: buildInspectionRegistry(),
          ...inspectParams,
        });
        renderReport(after);
      } catch (_) { /* swallow */ }
    } else {
      logFixError(actionLabel, (err && err.message) || String(err), codes);
    }
  } finally {
    hideProgress();
    activeController = null;
  }
}


/**
 * Apply the registered fix to a single issue. Builds a synthetic
 * one-issue InspectionReport (so the framework's progress / cancel
 * / outcome bucketing all work the same as for "Fix all") and
 * routes it through applyFixesAsync. Logs to Fix Results, clears
 * any previous Locate highlight, and re-inspects.
 */
async function fixSingleIssue(issue) {
  if (!sceneModelRef || !inspectorRef) return;
  if (activeController) return;
  const actionLabel = `Fix '${issue.resourceId || "?"}' — ${labelForCode(issue.code)}`;

  const controller = new AbortController();
  activeController = controller;
  try {
    // One-issue report — applyFixesAsync iterates report.issues.
    const oneReport = {
      issues:   [issue],
      errors:   issue.severity === "error"   ? [issue] : [],
      warnings: issue.severity === "warning" ? [issue] : [],
      info:     issue.severity === "info"    ? [issue] : [],
      byCode:   new Map([[issue.code, [issue]]]),
    };

    showProgress({label: `Fixing: ${issue.code}`, current: 0, total: 1});
    const fixRes = await inspectorRef.applyFixesAsync({
      sceneModel: sceneModelRef,
      report: oneReport,
      signal: controller.signal,
      onProgress: ({current, total, label, phase}) => {
        if (phase === "before") {
          showProgress({label: `Fixing: ${label}`, current, total});
        }
      },
    });
    if (!fixRes.ok) {
      logFixError(actionLabel, fixRes.error, [issue.code]);
      return;
    }
    logFixRun(actionLabel, fixRes.value, [issue.code]);

    clearLocate();

    showProgress({label: "Re-inspecting (post-fix)…", indeterminate: true});
    const after = await inspectorRef.inspectSceneModelAsync({
      sceneModel: sceneModelRef,
      registry: buildInspectionRegistry(),
      ...inspectParams,
      signal: controller.signal,
      onProgress: ({current, total, label, phase}) => {
        if (phase === "before") {
          showProgress({label: `Inspecting: ${label}`, current, total});
        }
      },
    });
    renderReport(after);
  } catch (err) {
    if (err && err.name === "AbortError") {
      logFixError(actionLabel, "Cancelled by user", [issue.code]);
    } else {
      logFixError(actionLabel, (err && err.message) || String(err), [issue.code]);
    }
  } finally {
    hideProgress();
    activeController = null;
  }
}


/**
 * Run inspectSceneModelAsync against the current SceneModel, with
 * progress + cancel UI wired up. Returns the report on success or
 * `null` when the user cancelled. Used both for the initial load
 * inspect and for re-inspect-after-toggle.
 */
async function runInspect(stageLabel) {
  if (!sceneModelRef || !inspectorRef) return null;
  if (activeController) return null;
  const controller = new AbortController();
  activeController = controller;
  try {
    showProgress({label: `${stageLabel}…`, indeterminate: true});
    return await inspectorRef.inspectSceneModelAsync({
      sceneModel: sceneModelRef,
      registry: buildInspectionRegistry(),
      ...inspectParams,
      signal: controller.signal,
      onProgress: ({current, total, label, phase}) => {
        if (phase === "before") {
          showProgress({label: `${stageLabel}: ${label}`, current, total});
        }
      },
    });
  } catch (err) {
    if (err && err.name === "AbortError") return null;
    console.error(err);
    return null;
  } finally {
    hideProgress();
    activeController = null;
  }
}


// ─────────────────────────────────────────────────────────────────
// Progress strip — shown only while an async run is in flight.
// ─────────────────────────────────────────────────────────────────

function showProgress({label, current, total, indeterminate}) {
  const el      = document.getElementById("runProgress");
  const labelEl = document.getElementById("runProgressLabel");
  const barEl   = document.getElementById("runProgressBar");
  if (!el) return;
  el.hidden = false;
  // Disable interaction with the rest of the Inspector while a
  // run is in flight — toggles + Fix / Locate buttons would race
  // against the active applyFixes / inspect mutation. The Cancel
  // button inside #runProgress is kept clickable by a CSS
  // override on .busy #runProgress.
  const reportEl = document.getElementById("report");
  if (reportEl) reportEl.classList.add("busy");
  if (label !== undefined) labelEl.textContent = label;
  if (indeterminate || typeof total !== "number" || total <= 0) {
    barEl.removeAttribute("value");   // <progress> with no value renders indeterminate
  } else {
    barEl.max   = total;
    barEl.value = current;
  }
}

function hideProgress() {
  const el = document.getElementById("runProgress");
  if (el) el.hidden = true;
  const reportEl = document.getElementById("report");
  if (reportEl) reportEl.classList.remove("busy");
}

// ─────────────────────────────────────────────────────────────────
// Locate handlers — read Issue.highlight (set by the inspector for
// codes whose target is renderable: GEOMETRY_DUPLICATE / SIMILAR /
// OVER_BUDGET / OVER_EXTENT, MATERIAL_TEXTURED_GEOMETRY_NO_UVS,
// MATERIAL_PBR_GEOMETRY_NO_NORMALS, OBJECT_DANGLING_MESH) and
// project the affected SceneObjects in the Viewer.
//
// Idiom: xray every ViewObject, un-xray + highlight the targets,
// fly camera to the union AABB. "Clear" restores the default state.
// ─────────────────────────────────────────────────────────────────

function locate(objectIds) {
  if (!viewRef || !demoHelperRef || objectIds.length === 0) return;
  const allIds = Object.keys(viewRef.objects);
  viewRef.setObjectsHighlighted(allIds, false);
  viewRef.setObjectsXRayed(allIds, true);
  viewRef.setObjectsXRayed(objectIds, false);
  viewRef.setObjectsHighlighted(objectIds, true);

  // Union the per-object AABBs out of the SDK's spatial index.
  const idx = demoHelperRef.collisionIndex;
  let union = null;
  for (const id of objectIds) {
    const a = idx.getObjectAABB(id);
    if (!a) continue;
    if (!union) {
      union = [a[0], a[1], a[2], a[3], a[4], a[5]];
    } else {
      if (a[0] < union[0]) union[0] = a[0];
      if (a[1] < union[1]) union[1] = a[1];
      if (a[2] < union[2]) union[2] = a[2];
      if (a[3] > union[3]) union[3] = a[3];
      if (a[4] > union[4]) union[4] = a[4];
      if (a[5] > union[5]) union[5] = a[5];
    }
  }
  if (union) {
    const cf = demoHelperRef.views[viewRef.id].cameraFlight;
    cf.flyTo({aabb: union, duration: 0.5, fitFOV: 50});
  }
}

function clearLocate() {
  if (!viewRef) return;
  const allIds = Object.keys(viewRef.objects);
  viewRef.setObjectsHighlighted(allIds, false);
  viewRef.setObjectsXRayed(allIds, false);
}

// Union `Issue.highlight.objectIds` across an issue list, skipping
// issues that have no highlight payload.
function unionHighlightIds(issues) {
  const seen = new Set();
  const out = [];
  for (const i of issues) {
    if (!i.highlight) continue;
    for (const id of i.highlight.objectIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Fix Results panel.
// ─────────────────────────────────────────────────────────────────

function logFixRun(actionLabel, result, codes) {
  // Append to the session log first — the JSON report needs a
  // structured copy of every run, including timestamp + codes
  // filter, not just whatever's painted in the DOM.
  fixRunLog.push({
    timestamp: new Date().toISOString(),
    actionLabel,
    codes: codes ? codes.slice() : undefined,
    result,
  });

  const entriesEl = document.getElementById("fixEntries");
  // For per-code runs ("Fix all GEOMETRY_DUPLICATE", per-issue ✦),
  // applyFixes records every report issue that didn't match the
  // codes filter as a strategy-less skipped outcome. Those aren't
  // failures — they're "not applicable to this filter" — and
  // surfacing them as "skipped" is misleading. Hide them from the
  // displayed entry; the raw result still lives in fixRunLog so
  // the downloadable JSON report keeps the full audit trail.
  const codesFilter = codes ? new Set(codes) : null;
  const displaySkipped = codesFilter
    ? result.skipped.filter(o => codesFilter.has(o.issue.code))
    : result.skipped;
  const fixed   = result.fixed.length;
  const skipped = displaySkipped.length;
  const errors  = result.errors.length;

  const det = document.createElement("details");
  det.className = "fix-entry";
  applyEntryCategory(det, codes);

  const summary = document.createElement("summary");
  summary.appendChild(buildEntryHeader(actionLabel, codes));

  // Break down displayed skips by reason so the count tooltip
  // tells the user *why* — "X skipped (target-missing: 4,
  // no-op: 7)" reads better than a flat "11 skipped".
  const reasonCounts = {};
  for (const o of displaySkipped) {
    const r = o.reason || "unknown";
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  }
  const reasonSummary = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([r, n]) => `${r}: ${n}`)
    .join(", ");

  const counts = document.createElement("span");
  counts.className = "counts";
  counts.innerHTML = `
    <span class="fixed">${fixed} fixed</span> ·
    <span class="skipped" title="${escapeHtml(reasonSummary || "no skips")}">${skipped} skipped</span> ·
    <span class="errors">${errors} errors</span>
  `;
  summary.appendChild(counts);
  det.appendChild(summary);

  const body = document.createElement("div");
  body.className = "body";

  const append = (cls, label, outcomes) => {
    for (const o of outcomes) {
      const row = document.createElement("div");
      row.className = `row ${cls}`;
      row.setAttribute("data-category", categoryForCode(o.issue.code));
      const detail = o.error
        ? o.error
        : (o.strategy
            ? `via ${o.strategy}`
            : "no matching fix strategy");
      // Trace populated by the fix's apply() on success; for
      // skipped / errored outcomes fall back to the bare
      // resourceId so the audit line still tells you what was
      // touched.
      const trace = o.trace || o.issue.resourceId || "";
      // Skipped rows surface the FixSkipReason as a small chip so
      // the user sees why (target-missing, no-op, …) rather than a
      // flat "skipped".
      const reasonChip = (cls === "skipped" && o.reason)
        ? `<span class="reason-chip reason-${escapeHtml(o.reason)}">${escapeHtml(o.reason)}</span>`
        : "";
      row.innerHTML = `
        <span class="outcome">${label}</span>
        ${reasonChip}
        <span class="code">${escapeHtml(o.issue.code)}</span>
        <span class="detail">${escapeHtml(detail)}</span>
        ${trace ? `<span class="trace">${escapeHtml(trace)}</span>` : ""}
      `;
      body.appendChild(row);
    }
  };
  append("fixed",   "fixed",   result.fixed);
  append("errors",  "error",   result.errors);
  append("skipped", "skipped", displaySkipped);

  if (body.childElementCount === 0) {
    body.innerHTML = `<div class="row"><span class="detail">No issues matched the filter.</span></div>`;
  }

  det.appendChild(body);
  entriesEl.insertBefore(det, entriesEl.firstChild);

  renderFixSavings(sceneModelRef);
  pulseInspectorMatches(codes);
}

// ─────────────────────────────────────────────────────────────────
// Fix Results JSON report — wraps every recorded applyFixes run
// since page load. Uses the SDK's applyFixesResultToJson helper
// to serialize each individual ApplyFixesResult.
// ─────────────────────────────────────────────────────────────────
function buildFixResultsReport() {
  const runs = fixRunLog.map((entry) => {
    const out = {
      timestamp:   entry.timestamp,
      actionLabel: entry.actionLabel,
    };
    if (entry.codes !== undefined) out.codes = entry.codes;
    if (entry.result) out.result = inspectorRef.applyFixesResultToJson(entry.result);
    if (entry.error)  out.error  = entry.error;
    return out;
  });
  return {
    generatedAt: new Date().toISOString(),
    runCount: runs.length,
    runs,
  };
}


// Trigger a JSON download in the browser. Uses an ephemeral
// Blob URL + temporary <a download> click. Works without any
// extra runtime deps.
function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type: "application/json"});
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Spec says revoke after the load completes; the click() above
  // is synchronous so revoking on the next microtask is safe.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}


// Compact filesystem-friendly timestamp (no colons) for filenames.
function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}


function logFixError(actionLabel, error, codes) {
  // Errored runs go into the session log too, with no result body —
  // distinguishable by `error` in the JSON.
  fixRunLog.push({
    timestamp: new Date().toISOString(),
    actionLabel,
    codes: codes ? codes.slice() : undefined,
    error,
  });

  const entriesEl = document.getElementById("fixEntries");
  const det = document.createElement("details");
  det.className = "fix-entry";
  det.open = true;
  applyEntryCategory(det, codes);

  const summary = document.createElement("summary");
  summary.appendChild(buildEntryHeader(actionLabel, codes));

  const counts = document.createElement("span");
  counts.className = "counts";
  counts.innerHTML = `<span class="errors">apply error</span>`;
  summary.appendChild(counts);
  det.appendChild(summary);

  const body = document.createElement("div");
  body.className = "body";
  body.innerHTML = `
    <div class="row errors">
      <span class="outcome">error</span>
      <span class="detail">${escapeHtml(error)}</span>
    </div>
  `;
  det.appendChild(body);
  entriesEl.insertBefore(det, entriesEl.firstChild);

  renderFixSavings(sceneModelRef);
}


// Build the friendly-label + (optional) mono code badge that goes
// at the start of a Fix Results entry's summary row. When the run
// touched a single code, we switch the label to "Fix all: {friendly}"
// and surface the technical code as a badge; for multi-code runs
// (e.g. "Fix all warnings") we keep the caller's label as-is.
function buildEntryHeader(actionLabel, codes) {
  const wrap = document.createElement("span");
  wrap.className = "entry-header";
  if (codes && codes.length === 1) {
    const friendly = labelForCode(codes[0]);
    wrap.innerHTML = `
      <span class="action-label friendly-label">Fix all: ${escapeHtml(friendly)}</span>
      <span class="code-badge" title="Issue code">${escapeHtml(codes[0])}</span>
    `;
  } else {
    wrap.innerHTML = `<span class="action-label friendly-label">${escapeHtml(actionLabel)}</span>`;
  }
  return wrap;
}


// ─────────────────────────────────────────────────────────────────
// Cross-panel reconciliation — pulse the Inspector type-group(s)
// that match a Fix Results entry just landed, and dim non-matching
// rows on hover so the user can quickly tie an issue in one panel
// to the action that touched it in the other.
// ─────────────────────────────────────────────────────────────────

function pulseInspectorMatches(codes) {
  if (!codes || codes.length === 0) return;
  const issuesEl = document.getElementById("issues");
  if (!issuesEl) return;
  for (const code of codes) {
    const groups = issuesEl.querySelectorAll(`.issue-type-group[data-code="${cssEscape(code)}"]`);
    for (const g of groups) {
      // Re-trigger the CSS animation by removing + re-adding the
      // class on the next frame (CSS animations don't restart if
      // the class was already there).
      g.classList.remove("pulse");
      // eslint-disable-next-line no-void
      void g.offsetWidth;
      g.classList.add("pulse");
      setTimeout(() => g.classList.remove("pulse"), 1300);
    }
  }
}

// Hover-dim wiring. Hovering an Inspector type-group dims every
// non-matching Fix Results entry; hovering a Fix Results entry
// does the symmetric dim on the Inspector. Single delegated
// listener per panel.
function setupCrossPanelHoverDim() {
  const issuesEl     = document.getElementById("issues");
  const fixEntriesEl = document.getElementById("fixEntries");
  const reportEl     = document.getElementById("report");
  const fixResultsEl = document.getElementById("fixResults");
  if (!issuesEl || !fixEntriesEl || !reportEl || !fixResultsEl) return;

  // Inspector → Fix Results
  issuesEl.addEventListener("mouseover", (ev) => {
    const group = ev.target.closest(".issue-type-group[data-code]");
    if (!group) return;
    const code = group.getAttribute("data-code");
    const matches = fixEntriesEl.querySelectorAll(`.fix-entry[data-codes]`);
    let any = false;
    for (const e of matches) {
      const codes = (e.getAttribute("data-codes") || "").split(",");
      if (codes.indexOf(code) !== -1) {
        e.classList.add("match-hover");
        any = true;
      }
    }
    if (any) fixResultsEl.classList.add("dim-non-matching");
  });
  issuesEl.addEventListener("mouseout", (ev) => {
    const group = ev.target.closest(".issue-type-group[data-code]");
    if (!group) return;
    fixResultsEl.classList.remove("dim-non-matching");
    fixEntriesEl.querySelectorAll(".fix-entry.match-hover").forEach((e) => e.classList.remove("match-hover"));
  });

  // Fix Results → Inspector
  fixEntriesEl.addEventListener("mouseover", (ev) => {
    const entry = ev.target.closest(".fix-entry[data-codes]");
    if (!entry) return;
    const codes = (entry.getAttribute("data-codes") || "").split(",");
    let any = false;
    for (const code of codes) {
      const groups = issuesEl.querySelectorAll(`.issue-type-group[data-code="${cssEscape(code)}"]`);
      for (const g of groups) { g.classList.add("match-hover"); any = true; }
    }
    if (any) reportEl.classList.add("dim-non-matching");
  });
  fixEntriesEl.addEventListener("mouseout", (ev) => {
    const entry = ev.target.closest(".fix-entry[data-codes]");
    if (!entry) return;
    reportEl.classList.remove("dim-non-matching");
    issuesEl.querySelectorAll(".issue-type-group.match-hover").forEach((g) => g.classList.remove("match-hover"));
  });
}

// CSS.escape isn't available in older browsers; trivial fallback
// for our purposes (codes only contain ASCII / underscores).
function cssEscape(s) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}


// Annotate a Fix Results <details> with data attributes so the CSS
// can stripe its left edge and the cross-panel hover dim can match
// it against Inspector type-groups by code.
function applyEntryCategory(det, codes) {
  if (!codes || codes.length === 0) {
    det.setAttribute("data-category", "misc");
    return;
  }
  det.setAttribute("data-codes", codes.join(","));
  // Single category iff every code shares the same prefix-derived
  // category; otherwise misc (so the stripe stays neutral).
  const first = categoryForCode(codes[0]);
  let shared = first;
  for (const c of codes) {
    if (categoryForCode(c) !== first) { shared = "misc"; break; }
  }
  det.setAttribute("data-category", shared);
}

// ─────────────────────────────────────────────────────────────────
// Inspector report → DOM.
//
// Three-tier collapsible layout:
//
//   Severity section (Errors / Warnings)        — open by default
//     └ Issue type group (one per Issue.code)   — open by default
//         └ Individual issue card               — closed by default
//
// Warnings section + per-code groups carry a "Fix all" button that
// dispatches through applyFixes with a `codes` filter.
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// Inspection toggle subpanel — every Inspection in
// DEFAULT_INSPECTION_REGISTRY rendered as a checkbox row. Toggling
// rebuilds a custom InspectionRegistry of the enabled set, syncs
// the matching `params[paramsKey]` flag for opt-in inspections,
// and re-runs inspectSceneModel so the report tracks the new
// registry composition immediately.
// ─────────────────────────────────────────────────────────────────

const enabledInspections = new Set();   // Inspection objects

function initInspectionToggles() {
  if (!inspectorRef) return;
  enabledInspections.clear();
  for (const insp of inspectorRef.DEFAULT_INSPECTION_REGISTRY.inspections()) {
    if (insp.optIn) {
      // Opt-in inspections start enabled iff the user already set
      // the matching flag in inspectParams.
      if (insp.paramsKey && inspectParams[insp.paramsKey]) {
        enabledInspections.add(insp);
      }
    } else {
      // Always-on inspections start enabled.
      enabledInspections.add(insp);
    }
  }
}

function buildInspectionRegistry() {
  // A fresh registry containing just the enabled inspections, in
  // their canonical registration order.
  if (!inspectorRef) return undefined;
  const list = [];
  for (const insp of inspectorRef.DEFAULT_INSPECTION_REGISTRY.inspections()) {
    if (enabledInspections.has(insp)) list.push(insp);
  }
  return new inspectorRef.InspectionRegistry(list);
}

function renderInspectionsPanel() {
  if (!inspectorRef) return;
  const bodyEl  = document.getElementById("inspectionsBody");
  const countEl = document.getElementById("inspectionsCount");
  const all = Array.from(inspectorRef.DEFAULT_INSPECTION_REGISTRY.inspections());

  let on = 0;
  for (const insp of all) if (enabledInspections.has(insp)) on++;
  countEl.textContent = `${on} / ${all.length}`;

  bodyEl.innerHTML = "";
  for (const insp of all) {
    const row = document.createElement("label");
    row.className = "inspection-row" + (insp.optIn ? " opt-in" : "");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = enabledInspections.has(insp);
    cb.addEventListener("change", () => {
      if (cb.checked) enabledInspections.add(insp);
      else            enabledInspections.delete(insp);
      // Keep `inspectParams[paramsKey]` in sync so the inspection's
      // own internal flag-check (which still runs) matches the
      // toggle state. Always-on inspections have no paramsKey.
      if (insp.paramsKey) inspectParams[insp.paramsKey] = cb.checked;
      reInspectAfterToggle();
    });
    row.appendChild(cb);

    const text = document.createElement("span");
    text.className = "inspection-text";
    const desc = document.createElement("span");
    desc.className = "inspection-desc";
    desc.textContent = insp.description;
    text.appendChild(desc);
    // One bulleted line per code: "• Friendly name (CODE)" —
    // friendly name bold for visual weight; mono code in
    // brackets for the technical identifier. Bullets come from
    // the CSS `::before` on each child span.
    const codes = document.createElement("span");
    codes.className = "inspection-codes";
    for (const c of insp.codes) {
      const line = document.createElement("span");
      const friendly = (insp.labels && insp.labels[c]) || c;
      line.innerHTML =
        `<strong>${escapeHtml(friendly)}</strong>` +
        ` <span class="inspection-code-id">(${escapeHtml(c)})</span>`;
      codes.appendChild(line);
    }
    text.appendChild(codes);
    row.appendChild(text);

    bodyEl.appendChild(row);
  }
}

async function reInspectAfterToggle() {
  if (!sceneModelRef || !inspectorRef) return;
  // Update the count badge eagerly so it reflects the new
  // checkbox state even before the (slower) re-inspect lands.
  const countEl = document.getElementById("inspectionsCount");
  const all = Array.from(inspectorRef.DEFAULT_INSPECTION_REGISTRY.inspections());
  let on = 0;
  for (const insp of all) if (enabledInspections.has(insp)) on++;
  countEl.textContent = `${on} / ${all.length}`;

  const report = await runInspect("Re-inspecting");
  if (report) renderReport(report);
}


/**
 * Toggle every registered inspection on or off in one shot. Called
 * from the All / None buttons in the Inspections summary row. Also
 * keeps inspectParams[paramsKey] in sync for opt-in inspections so
 * the per-inspection internal flag-check tracks the toggle state.
 */
function setAllInspectionsEnabled(enabled) {
  if (!inspectorRef) return;
  const all = Array.from(inspectorRef.DEFAULT_INSPECTION_REGISTRY.inspections());
  for (const insp of all) {
    if (enabled) enabledInspections.add(insp);
    else         enabledInspections.delete(insp);
    if (insp.paramsKey) inspectParams[insp.paramsKey] = enabled;
  }
  renderInspectionsPanel();
  reInspectAfterToggle();
}


// ─────────────────────────────────────────────────────────────────
// SceneModel stats panel — twelve compact key/value chips above the
// issues list. Eleven counts come straight off `sceneModel.stats`
// (maintained live by the SDK as objects / meshes / textures
// mutate). The two attribute-coverage counts (geometries with UVs /
// normals) are derived in a quick walk here, since
// SceneModelStats doesn't track them.
// ─────────────────────────────────────────────────────────────────

// Walk the SceneModel once and return the same twelve key/value
// rows the stats panel and the savings panel both consume. Pulled
// out so the savings panel can capture an immutable baseline
// snapshot at load time.
function collectStats(sceneModel) {
  const s = sceneModel.stats;
  let withNormals = 0;
  let withUVs = 0;
  for (const id in sceneModel.geometries) {
    const g = sceneModel.geometries[id];
    if (g.destroyed) continue;
    if (g.normalsCompressed && g.normalsCompressed.length > 0) withNormals++;
    if (g.uvsCompressed     && g.uvsCompressed.length     > 0) withUVs++;
  }
  // Order: scene-graph counts → geometry counts → primitive counts →
  // attribute coverage. Keeps related stats adjacent so the user's
  // eye groups them naturally.
  return [
    ["Objects",     s.numObjects],
    ["Meshes",      s.numMeshes],
    ["Geometries",  s.numGeometries],
    ["Transforms",  s.numTransforms],
    ["Materials",   s.numMaterials],
    ["Textures",    s.numTextures],
    ["Vertices",    s.numVertices],
    ["Triangles",   s.numTriangles],
    ["Lines",       s.numLines],
    ["Points",      s.numPoints],
    ["With UVs",    withUVs],
    ["With Normals", withNormals],
  ];
}

function renderStats(sceneModel) {
  const statsEl = document.getElementById("stats");
  if (!statsEl || !sceneModel || sceneModel.destroyed) {
    if (statsEl) statsEl.innerHTML = "";
    return;
  }
  const items = collectStats(sceneModel);
  const fmt = (n) => n.toLocaleString();
  const html = items.map(([label, n]) => `
    <div class="stat">
      <span class="label">${escapeHtml(label)}</span>
      <span class="value${n === 0 ? " zero" : ""}">${escapeHtml(fmt(n))}</span>
    </div>
  `).join("");
  statsEl.innerHTML = html;
}


// Fix Results savings panel — same chip layout as the Inspector
// stats panel, but each value pairs the current count with a
// signed delta against the pre-fix baseline. Hidden until both a
// baseline has been captured and at least one fix run has been
// logged.
function renderFixSavings(sceneModel) {
  const savingsEl = document.getElementById("savings");
  if (!savingsEl) return;
  if (!baselineStats || !sceneModel || sceneModel.destroyed || fixRunLog.length === 0) {
    savingsEl.innerHTML = "";
    savingsEl.style.display = "none";
    return;
  }
  savingsEl.style.display = "";
  const fmt = (n) => n.toLocaleString();
  const current = collectStats(sceneModel);
  const html = current.map(([label, now], i) => {
    const before = baselineStats[i][1];
    const delta  = now - before;
    let deltaCls = "stat-delta";
    let deltaTxt = "";
    if (delta < 0)      { deltaCls += " saved";   deltaTxt = `−${fmt(-delta)}`; }
    else if (delta > 0) { deltaCls += " added";   deltaTxt = `+${fmt(delta)}`;  }
    else                { deltaCls += " neutral"; deltaTxt = "±0"; }
    return `
      <div class="stat stat-savings">
        <span class="label">${escapeHtml(label)}</span>
        <span class="stat-row">
          <span class="value${now === 0 ? " zero" : ""}">${escapeHtml(fmt(now))}</span>
          <span class="${deltaCls}" title="Was ${escapeHtml(fmt(before))} before fixing">${escapeHtml(deltaTxt)}</span>
        </span>
      </div>
    `;
  }).join("");
  savingsEl.innerHTML = html;
}


function renderReport(report) {
  const summaryEl = document.getElementById("summary");
  const issuesEl  = document.getElementById("issues");

  // Latest report — used by the Inspector "Get Report" button.
  lastReport = report;

  // Always refresh the SceneModel stats panel — counts track every
  // applyFixes mutation (dedupe drops geometries, splits add them).
  renderStats(sceneModelRef);

  // Capture which type-groups + severity sections were open before
  // we wipe the DOM, so re-render after a fix doesn't collapse the
  // group the user was looking at.
  const previousOpen = capturePanelOpenState(issuesEl);

  const errors   = report.errors.length;
  const warnings = report.warnings.length;

  if (errors === 0 && warnings === 0) {
    summaryEl.innerHTML = `<span class="ok">No issues found — SceneModel passes every check.</span>`;
    issuesEl.innerHTML = `<div class="empty">Nothing to report. ✓</div>`;
    return;
  }

  const chips = [];
  if (errors > 0) {
    chips.push(`<span class="summary-count error">${errors} error${errors === 1 ? "" : "s"}</span>`);
  }
  if (warnings > 0) {
    chips.push(`<span class="summary-count warning">${warnings} warning${warnings === 1 ? "" : "s"}</span>`);
  }
  summaryEl.innerHTML = chips.join(" ");

  const frag = document.createDocumentFragment();
  if (errors > 0) {
    frag.appendChild(buildSeverityNode("error", "Errors", report.errors, previousOpen));
  }
  if (warnings > 0) {
    frag.appendChild(buildSeverityNode("warning", "Warnings", report.warnings, previousOpen));
  }
  issuesEl.innerHTML = "";
  issuesEl.appendChild(frag);
}


/**
 * Snapshot which severity sections + type-group panels are currently
 * open inside `#issues`, so the next render can restore them. Lets a
 * post-fix re-inspect leave the user's expand state alone — they
 * don't lose their place mid-triage.
 */
function capturePanelOpenState(issuesEl) {
  const openCodes = new Set();           // type-group data-code values
  const closedSeverities = new Set();    // severity-section classes that were collapsed
  if (!issuesEl) return {openCodes, closedSeverities, isFirstRender: true};
  for (const det of issuesEl.querySelectorAll(".issue-type-group[open]")) {
    const code = det.getAttribute("data-code");
    if (code) openCodes.add(code);
  }
  for (const det of issuesEl.querySelectorAll(".severity-section")) {
    if (!det.open) {
      if (det.classList.contains("error"))   closedSeverities.add("error");
      if (det.classList.contains("warning")) closedSeverities.add("warning");
    }
  }
  return {openCodes, closedSeverities, isFirstRender: false};
}

/**
 * Outer collapsible section — one per severity. Warnings panel
 * carries a "Fix all warnings" button in its summary; clicking
 * dispatches applyFixes filtered to every code present in the
 * section. Errors panel deliberately has no fix-all button —
 * errors should be triaged manually.
 */
function buildSeverityNode(severity, label, issues, previousOpen) {
  const det = document.createElement("details");
  det.className = `severity-section ${severity}`;
  // Restore the user's collapse state on re-render. First render
  // (no captured state) defaults open.
  det.open = !previousOpen || !previousOpen.closedSeverities.has(severity);

  const summary = document.createElement("summary");
  // Errors keep their red badge (a glance signal even when the
  // section is collapsed). Warnings drop the badge — "Warnings"
  // already labels the section.
  const badgeHtml = severity === "error"
    ? `<span class="badge ${severity}">${severity}</span>`
    : "";
  summary.innerHTML = `
    ${badgeHtml}
    <span class="section-label">${label}</span>
    <span class="count">${issues.length}</span>
  `;

  if (severity === "warning") {
    const codes = uniqueCodes(issues);
    if (codes.length > 0) {
      const btn = document.createElement("button");
      btn.className = "fix-action";
      btn.type = "button";
      btn.textContent = "Fix all";
      btn.title = `Run applyFixes filtered to: ${codes.join(", ")}`;
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        fixCodes(codes, "Fix all warnings");
      });
      summary.appendChild(btn);
    }
  }

  // "Locate all" — only when at least one issue in the section
  // carries a viewer-highlight payload. Errors with renderable
  // targets (e.g. OBJECT_DANGLING_MESH) qualify too.
  const sectionIds = unionHighlightIds(issues);
  if (sectionIds.length > 0) {
    const btn = document.createElement("button");
    btn.className = "locate-action";
    btn.type = "button";
    btn.textContent = "Locate all";
    btn.title = `Highlight ${sectionIds.length} affected SceneObject${sectionIds.length === 1 ? "" : "s"} in the Viewer`;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      locate(sectionIds);
    });
    summary.appendChild(btn);
  }
  det.appendChild(summary);

  const body = document.createElement("div");
  body.className = "body";

  const groupsByCode = new Map();
  for (const issue of issues) {
    let g = groupsByCode.get(issue.code);
    if (!g) {
      g = {code: issue.code, severity, issues: []};
      groupsByCode.set(issue.code, g);
    }
    g.issues.push(issue);
  }
  for (const group of groupsByCode.values()) {
    body.appendChild(buildTypeGroupNode(group, previousOpen));
  }

  det.appendChild(body);
  return det;
}

/**
 * Middle-tier panel — one per issue code. Warning groups carry a
 * "Fix all" button that filters applyFixes to just this code.
 * Error groups omit the button.
 */
function buildTypeGroupNode(group, previousOpen) {
  const det = document.createElement("details");
  det.className = "issue-type-group";
  det.setAttribute("data-code", group.code);
  det.setAttribute("data-category", categoryForCode(group.code));
  // Collapsed by default on first render. On re-render after a
  // fix, restore whichever groups the user had expanded so they
  // don't lose their place mid-triage.
  if (previousOpen && previousOpen.openCodes.has(group.code)) {
    det.open = true;
  }

  const summary = document.createElement("summary");

  // Summary stacks: [title row] over [rule description]. Both stay
  // visible whether the group is collapsed or expanded — the user
  // wanted the description always present under the code title.
  const content = document.createElement("span");
  content.className = "group-summary-content";

  const titleRow = document.createElement("span");
  titleRow.className = "title-row";
  // Friendly label = primary text, mono code = secondary badge.
  // The (?) icon carries the per-code description from the
  // Inspection's descriptions map as a tooltip — only rendered
  // when a description is registered.
  const description = descriptionForCode(group.code);
  const helpIcon = description
    ? `<span class="help-icon" title="${escapeHtml(description)}" aria-label="About this issue">?</span>`
    : "";
  titleRow.innerHTML = `
    <span class="friendly-label">${escapeHtml(labelForCode(group.code))}</span>
    ${helpIcon}
    <span class="code-badge" title="Issue code">${escapeHtml(group.code)}</span>
    <span class="count">${group.issues.length}</span>
  `;
  if (group.severity === "warning") {
    const btn = document.createElement("button");
    btn.className = "fix-action";
    btn.type = "button";
    btn.textContent = "Fix all";
    btn.title = `Run applyFixes filtered to ${group.code}`;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      fixCodes([group.code], `Fix all ${group.code}`);
    });
    titleRow.appendChild(btn);
  }

  const groupIds = unionHighlightIds(group.issues);
  if (groupIds.length > 0) {
    const btn = document.createElement("button");
    btn.className = "locate-action";
    btn.type = "button";
    btn.textContent = "Locate";
    btn.title = `Highlight ${groupIds.length} affected SceneObject${groupIds.length === 1 ? "" : "s"} in the Viewer`;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      locate(groupIds);
    });
    titleRow.appendChild(btn);
  }
  content.appendChild(titleRow);

  summary.appendChild(content);
  det.appendChild(summary);

  const body = document.createElement("div");
  body.className = "body";

  // Paginate — dumping 200+ rows in one panel makes the report
  // visually impossible to scan. Show the first PAGE_SIZE rows;
  // expose the rest behind a one-shot "Show N more" footer.
  const PAGE_SIZE = 25;
  const total = group.issues.length;
  const initial = Math.min(total, PAGE_SIZE);
  for (let i = 0; i < initial; i++) {
    body.appendChild(buildIssueNode(group.issues[i]));
  }
  if (total > PAGE_SIZE) {
    const more = document.createElement("button");
    more.className = "show-more";
    more.type = "button";
    const remaining = total - PAGE_SIZE;
    more.textContent = `Show ${remaining} more`;
    more.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      const frag = document.createDocumentFragment();
      for (let i = PAGE_SIZE; i < total; i++) {
        frag.appendChild(buildIssueNode(group.issues[i]));
      }
      body.insertBefore(frag, more);
      more.remove();
    });
    body.appendChild(more);
  }
  det.appendChild(body);

  return det;
}

/**
 * Innermost issue row — flat, not collapsible. The rule description
 * lives one level up on the type-group; an individual issue is
 * just its resourceId (or message excerpt) plus a hover-only "↗"
 * affordance when the issue carries a viewer-highlight payload.
 *
 * The whole row is the click target for locate, so the eye isn't
 * fighting a per-row button on every line of a 200-row group. Rows
 * without a highlight payload render as plain (non-clickable) text.
 */
function buildIssueNode(issue) {
  const row = document.createElement("div");
  row.className = "issue";

  // Friendly resource name (when the SDK knows one) + small mono
  // id badge after. Falls back to message excerpt when there's no
  // resourceId.
  const headlineEl = document.createElement("span");
  headlineEl.className = "issue-headline";
  if (issue.resourceId) {
    const labelInfo = (sceneModelRef && inspectorRef)
      ? inspectorRef.findResourceLabel(sceneModelRef, issue.resourceId)
      : null;
    const friendly = labelInfo && labelInfo.name ? labelInfo.name : formatId(issue.resourceId);
    const showBadge = labelInfo && labelInfo.name;     // only when we have a friendly name distinct from the id
    headlineEl.innerHTML =
      `<strong>${escapeHtml(friendly)}</strong>` +
      (showBadge ? ` <span class="issue-id-badge">${escapeHtml(formatId(issue.resourceId))}</span>` : "");
  } else {
    headlineEl.textContent = excerpt(issue.message, 80);
  }
  row.appendChild(headlineEl);

  // Inspection-supplied summary — small muted suffix like
  // "1.2M units from origin" or "→ collapses 3 others". Set at
  // emit time by the inspection that produced the issue; absent
  // when the inspection didn't supply one (clean fallback).
  if (issue.summary) {
    const blurbEl = document.createElement("span");
    blurbEl.className = "issue-blurb";
    blurbEl.textContent = issue.summary;
    row.appendChild(blurbEl);
  }

  // Per-issue Fix button — only rendered when a fix is registered
  // for this code. Runs applyFixesAsync against a synthetic
  // one-issue report so the framework's progress / cancel /
  // outcome bucketing all work the same as for "Fix all".
  if (inspectorRef && inspectorRef.DEFAULT_FIX_REGISTRY.get(issue.code)) {
    const btn = document.createElement("button");
    btn.className = "fix-action-row";
    btn.type = "button";
    btn.innerHTML = `<span class="fix-action-row-icon" aria-hidden="true">✦</span>Fix`;
    btn.title = `Apply ${labelForCode(issue.code)} fix to this issue`;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      fixSingleIssue(issue);
    });
    row.appendChild(btn);
  }

  // Hover tooltip with the full inspection message — the source
  // of truth for *why* the issue fired. Set whether or not the
  // row is locatable; locatable rows override later with their
  // own title.
  if (issue.message) row.title = issue.message;

  if (issue.highlight && issue.highlight.objectIds.length > 0) {
    const ids = issue.highlight.objectIds;
    row.classList.add("locatable");
    row.title = `${issue.message || ""}\nClick to locate in the Viewer`.trim();
    row.tabIndex = 0;
    row.setAttribute("role", "button");

    const hint = document.createElement("span");
    hint.className = "locate-hint";
    hint.textContent = "↗";
    hint.setAttribute("aria-hidden", "true");
    row.appendChild(hint);

    const fire = () => locate(ids);
    row.addEventListener("click", fire);
    row.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        fire();
      }
    });
  }
  return row;
}


// Issue blurbs and fix traces are now produced at their source —
// `issue.summary` set by the inspection that emitted the issue,
// `outcome.trace` set by the fix that handled it. The example just
// reads them. See the matching SDK files under
// `demo/sceneModelInspector/inspections` and `demo/sceneModelInspector/fixes`.

function uniqueCodes(issues) {
  const seen = new Set();
  const out = [];
  for (const i of issues) {
    if (!seen.has(i.code)) {
      seen.add(i.code);
      out.push(i.code);
    }
  }
  return out;
}

function excerpt(s, n) {
  s = String(s);
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

// Numeric resource ids read better with a leading "#" — "3" looks
// like a count or position, "#3" reads as "id 3". GUIDs / prefixed
// ids ("geom-47", "1qSqV0K0PCHQwwBM3MqKkY") pass through as-is.
function formatId(id) {
  const s = String(id);
  return /^\d+$/.test(s) ? `#${s}` : s;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[c]));
}
