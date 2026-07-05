// Interactive in-browser ModelConverter demo.
//
// Drop any supported file -> pick an output format -> Convert ->
// download the converted bytes + reload them back into the viewer
// to verify the round trip.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const {scene, data} = studio;

  const view = studio.viewManager.createView({
    camera: {
      eye:  [10, 10, 10],
      look: [0, 0, 0],
      up:   [0, 1, 0]
    }
  });

  const cameraFlight = new xeokit.viewing.cameraFlight.CameraFlightAnimation(view, {duration: 0.6});

  // ---------------------------------------------------------------
  // Format tables
  // ---------------------------------------------------------------

  // Extension -> input descriptor.
  // readAs matches the loader's `fileDataType`.
  const INPUT_FORMATS = {
    bim:      {id: "dotbim",     readAs: "json",        LoaderClass: xeokit.formats.dotbim.DotBIMLoader},
    ifc:      {id: "ifc",        readAs: "arraybuffer", LoaderClass: xeokit.formats.ifc.IFCLoader},
    gltf:     {id: "gltf",       readAs: "arraybuffer", LoaderClass: xeokit.formats.gltf.GLTFLoader},
    glb:      {id: "gltf",       readAs: "arraybuffer", LoaderClass: xeokit.formats.gltf.GLTFLoader},
    cityjson: {id: "cityjson",   readAs: "json",        LoaderClass: xeokit.formats.cityjson.CityJSONLoader},
    xgf:      {id: "xgf",        readAs: "arraybuffer", LoaderClass: xeokit.formats.xgf.XGFLoader},
    las:      {id: "las",        readAs: "arraybuffer", LoaderClass: xeokit.formats.las.LASLoader},
    laz:      {id: "las",        readAs: "arraybuffer", LoaderClass: xeokit.formats.las.LASLoader},
    obj:      {id: "obj",        readAs: "text",        LoaderClass: xeokit.formats.obj.OBJLoader},
    scenemodel: {id: "scenemodel", readAs: "json",        LoaderClass: xeokit.formats.scenemodel.SceneModelImporter},
    datamodel:  {id: "datamodel",  readAs: "json",        LoaderClass: xeokit.formats.datamodel.DataModelImporter}
  };

  // Output format -> exporter descriptor + the loader that can
  // reload the converted result back into the viewer.
  const OUTPUT_FORMATS = {
    dotbim: {
      ExporterClass: xeokit.formats.dotbim.DotBIMExporter,
      LoaderClass:   xeokit.formats.dotbim.DotBIMLoader,
      extension:     "bim",
      mime:          "application/json",
      payloadKind:   "json"
    },
    xgf: {
      ExporterClass: xeokit.formats.xgf.XGFExporter,
      LoaderClass:   xeokit.formats.xgf.XGFLoader,
      extension:     "xgf",
      mime:          "application/octet-stream",
      payloadKind:   "arraybuffer"
    },
    scenemodel: {
      ExporterClass: xeokit.formats.scenemodel.SceneModelExporter,
      LoaderClass:   xeokit.formats.scenemodel.SceneModelImporter,
      extension:     "scenemodel.json",
      mime:          "application/json",
      payloadKind:   "json"
    },
    datamodel: {
      ExporterClass: xeokit.formats.datamodel.DataModelExporter,
      LoaderClass:   xeokit.formats.datamodel.DataModelImporter,
      extension:     "datamodel.json",
      mime:          "application/json",
      payloadKind:   "json"
    },
    ifc: {
      ExporterClass: xeokit.formats.ifc.IFCExporter,
      LoaderClass:   xeokit.formats.ifc.IFCLoader,
      extension:     "ifc",
      mime:          "text/plain",
      payloadKind:   "text"
    }
  };

  // ---------------------------------------------------------------
  // Coordinate-frame presets
  //
  // Mirrors demo/panels/importDialog/IMPORT_BASES.ts. Each basis is a
  // 3x3 row-major matrix mapping the file's authoring axes onto the
  // Scene's right/up/forward axes. `null` means "use the default".
  // ---------------------------------------------------------------

  const COORD_FRAMES = [
    {id: "unknown",        label: "Unknown",                                            basis: null},
    {id: "z-up",           label: "Z-up — Revit / IFC / AutoCAD / ArchiCAD / SketchUp", basis: [1, 0, 0,   0, 1, 0,   0, 0, 1]},
    {id: "y-up",           label: "Y-up — glTF / Three.js / Unity / Maya / Blender",    basis: [1, 0, 0,   0, 0, 1,   0, 1, 0]},
    {id: "z-up-y-forward", label: "Z-up, Y-forward — Blender native",                   basis: [1, 0, 0,   0, 1, 0,   0, 0, 1]},
    {id: "z-up-x-forward", label: "Z-up, X-forward — Rhino / Civil 3D",                 basis: [0, 1, 0,  -1, 0, 0,   0, 0, 1]}
  ];

  // ---------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------

  const $ = id => document.getElementById(id);
  const dropZone = $("dropZone");
  const fileInput = $("fileInput");
  const inputFileEl = $("inputFile");
  const inputFormatEl = $("inputFormat");
  const inputSizeEl = $("inputSize");
  const inputBasisEl = $("inputBasis");
  const outputFormatEl = $("outputFormat");
  const outputBasisEl = $("outputBasis");
  const convertBtn = $("convertBtn");
  const downloadBtn = $("downloadBtn");
  const statusEl = $("status");

  function populateCoordFrames(selectEl, defaultId) {
    for (const frame of COORD_FRAMES) {
      const opt = document.createElement("option");
      opt.value = frame.id;
      opt.textContent = frame.label;
      if (frame.id === defaultId) opt.selected = true;
      selectEl.appendChild(opt);
    }
  }
  populateCoordFrames(inputBasisEl,  "unknown");
  populateCoordFrames(outputBasisEl, "unknown");

  function coordinateSystemFor(selectEl) {
    const id = selectEl.value;
    const frame = COORD_FRAMES.find(f => f.id === id);
    if (!frame || !frame.basis) return undefined;
    return {
      basis:         frame.basis,
      units:         "meters",
      origin:        [0, 0, 0],
      scaleToMeters: 1.0
    };
  }

  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------

  let pending = null;          // {file, fileData, inputFormat}
  let lastDownloadUrl = null;
  let lastDownloadName = null;
  let modelCounter = 0;

  function setStatus(msg, kind = "") {
    statusEl.textContent = msg;
    statusEl.className = kind;
  }

  function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
    return `${(n / 1024 / 1024).toFixed(2)} MiB`;
  }

  function extensionOf(name) {
    const lower = name.toLowerCase();
    // Handle multi-segment names like model.scenemodel.json
    if (lower.endsWith(".scenemodel.json")) return "scenemodel";
    if (lower.endsWith(".datamodel.json")) return "datamodel";
    if (lower.endsWith(".city.json"))      return "cityjson";
    const dot = lower.lastIndexOf(".");
    return dot >= 0 ? lower.slice(dot + 1) : "";
  }

  // ---------------------------------------------------------------
  // File reading
  // ---------------------------------------------------------------

  async function readFile(file, kind) {
    switch (kind) {
      case "arraybuffer":
        return await file.arrayBuffer();
      case "text":
        return await file.text();
      case "json":
        return JSON.parse(await file.text());
      default:
        throw new Error(`Unknown readAs kind: ${kind}`);
    }
  }

  async function loadDroppedFile(file) {
    setStatus(`Reading ${file.name}…`);
    convertBtn.disabled = true;
    downloadBtn.disabled = true;

    const ext = extensionOf(file.name);
    const inputFormat = INPUT_FORMATS[ext];
    if (!inputFormat) {
      setStatus(`Unsupported extension ".${ext}". Supported: ${Object.keys(INPUT_FORMATS).join(", ")}`, "error");
      pending = null;
      inputFileEl.textContent = file.name;
      inputFormatEl.textContent = "—";
      inputSizeEl.textContent = "—";
      return;
    }

    let fileData;
    try {
      fileData = await readFile(file, inputFormat.readAs);
    } catch (err) {
      setStatus(`Read failed: ${err.message}`, "error");
      return;
    }

    pending = {file, fileData, inputFormat};
    inputFileEl.textContent = file.name;
    inputFormatEl.textContent = `${inputFormat.id} (${inputFormat.readAs})`;
    inputSizeEl.textContent = formatBytes(file.size);
    convertBtn.disabled = false;
    setStatus("Ready to convert.");
  }

  // ---------------------------------------------------------------
  // Conversion
  // ---------------------------------------------------------------

  async function runConversion() {
    if (!pending) return;
    convertBtn.disabled = true;
    downloadBtn.disabled = true;
    revokeDownload();
    setStatus("Converting…");

    const {fileData, inputFormat} = pending;
    const outKey = outputFormatEl.value;
    const outDesc = OUTPUT_FORMATS[outKey];

    const loaderId = inputFormat.id;
    const exporterId = outKey;
    const pipelineId = `${loaderId}2${exporterId}`;

    const inputCoordSys  = coordinateSystemFor(inputBasisEl);
    const outputCoordSys = coordinateSystemFor(outputBasisEl);

    const modelConverter = new xeokit.convert.modelConverter.ModelConverter({
      loaders:   {[loaderId]:   new inputFormat.LoaderClass()},
      exporters: {[exporterId]: new outDesc.ExporterClass()},
      pipelines: {
        [pipelineId]: {
          inputs:  {input:  {loader:   loaderId,
                             options:  {coordinateSystem: inputCoordSys}}},
          outputs: {output: {exporter: exporterId,
                             options:  {coordinateSystem: outputCoordSys}}}
        }
      }
    });

    let result;
    try {
      result = await modelConverter.convert({
        pipeline: pipelineId,
        inputs: {
          input: {fileData}
        }
      });
    } catch (err) {
      setStatus(`Convert failed: ${err.message || err}`, "error");
      convertBtn.disabled = false;
      return;
    }

    const out = result.outputs.output;
    if (!out || out.fileData == null) {
      setStatus("Converter returned no output.", "error");
      convertBtn.disabled = false;
      return;
    }

    // Build a Blob from the converted bytes for download.
    const fileName = baseName(pending.file.name) + "." + outDesc.extension;
    const blob = makeBlob(out.fileData, outDesc);
    lastDownloadUrl = URL.createObjectURL(blob);
    lastDownloadName = fileName;
    downloadBtn.disabled = false;

    setStatus(`Converted ${formatBytes(blob.size)}. Reloading into viewer…`, "ok");

    // Reload the converted output back into the viewer to prove
    // the round trip. Render only when the chosen output is a
    // geometry-bearing format; for DataModelParams JSON, populate
    // the Data side and skip the SceneModel reload.

    try {
      await reloadIntoViewer(outKey, out.fileData);
      setStatus(`Done. Converted ${formatBytes(blob.size)} — ready to download.`, "ok");
    } catch (err) {
      setStatus(`Converted, but reload failed: ${err.message || err}`, "error");
    }

    convertBtn.disabled = false;
  }

  function makeBlob(fileData, outDesc) {
    switch (outDesc.payloadKind) {
      case "arraybuffer":
        return new Blob([fileData], {type: outDesc.mime});
      case "text":
        return new Blob([fileData], {type: outDesc.mime});
      case "json":
        return new Blob([JSON.stringify(fileData, null, 2)], {type: outDesc.mime});
      default:
        return new Blob([String(fileData)], {type: outDesc.mime});
    }
  }

  function baseName(fileName) {
    const dot = fileName.lastIndexOf(".");
    return dot > 0 ? fileName.slice(0, dot) : fileName;
  }

  // ---------------------------------------------------------------
  // Reload converted output into the viewer
  // ---------------------------------------------------------------

  async function reloadIntoViewer(outKey, fileData) {
    const desc = OUTPUT_FORMATS[outKey];
    const id = `converted_${++modelCounter}`;

    // Tear down any previous converted models so each conversion
    // gets a clean slate (otherwise the second conversion would
    // collide on id).
    for (const m of Object.values(scene.models)) m.destroy();
    for (const m of Object.values(data.models))  m.destroy();

    const sceneModelResult = scene.createModel({id});
    if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
    const sceneModel = sceneModelResult.value;

    const dataModelResult = data.createModel({id});
    if (!dataModelResult.ok) throw new Error(dataModelResult.error);
    const dataModel = dataModelResult.value;

    const loader = new desc.LoaderClass();

    if (outKey === "datamodel") {
      // Semantics-only output: there is no SceneModel to render.
      await loader.load({fileData, dataModel});
      sceneModel.destroy();
      return;
    }

    await loader.load({fileData, sceneModel, dataModel});

    // Frame the loaded model. SceneCollisionIndex maintains a
    // running world-space AABB across every SceneModel in the
    // Scene, which is the cheapest way to fit the camera to
    // whatever was just loaded.
    const collisionIndex = xeokit.spatial.collision.getSceneCollisionIndex(scene);
    const aabb = collisionIndex.getSceneAABB();
    if (aabb && isFinite(aabb[0]) && isFinite(aabb[3])) {
      cameraFlight.jumpTo({aabb});
    }
  }

  function revokeDownload() {
    if (lastDownloadUrl) {
      URL.revokeObjectURL(lastDownloadUrl);
      lastDownloadUrl = null;
      lastDownloadName = null;
    }
    downloadBtn.disabled = true;
  }

  // ---------------------------------------------------------------
  // Wire up UI events
  // ---------------------------------------------------------------

  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("hover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("hover"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("hover");
    const file = e.dataTransfer.files[0];
    if (file) loadDroppedFile(file);
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) loadDroppedFile(file);
    fileInput.value = "";
  });

  convertBtn.addEventListener("click", runConversion);

  downloadBtn.addEventListener("click", () => {
    if (!lastDownloadUrl) return;
    const a = document.createElement("a");
    a.href = lastDownloadUrl;
    a.download = lastDownloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  studio.openInfoPanelFromMeta();
  studio.finished();
});
