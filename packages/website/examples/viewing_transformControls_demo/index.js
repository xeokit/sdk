// TransformControls demo — exercises every feature of TransformControls:
//   * three modes (G / R / S) + hide ("N")
//   * world / local space toggle (Q)
//   * runtime size adjustment (+ / -) — handles stay constant pixel size
//   * translation / rotation / scale snap (T / U / V)
//   * showX / showY / showZ toggles
//   * click a box to re-attach
//   * onDragStart / onDragEnd / onObjectChange events streamed to the log

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const {scene, renderer} = studio;

  const view = studio.viewManager.createView({
    camera: {
      projection: "perspective",
      far:  1000,
      eye:  [16, -22, 16],
      look: [0,   0,   2],
      up:   [0,   0,   1],
    },
  });

  // ---- 4 colour-coded boxes ------------------------------------
  const sceneModelResult = scene.createModel({id: "demoModel"});
  if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
  const sceneModel = sceneModelResult.value;

  const cubePositions = [
    1,1,1, -1,1,1, -1,-1,1, 1,-1,1,  1,1,1, 1,-1,1, 1,-1,-1, 1,1,-1,
    1,1,1, 1,1,-1, -1,1,-1, -1,1,1,  -1,1,1, -1,1,-1, -1,-1,-1, -1,-1,1,
    -1,-1,-1, 1,-1,-1, 1,-1,1, -1,-1,1, 1,-1,-1, -1,-1,-1, -1,1,-1, 1,1,-1,
  ];
  const cubeIndices = [0,1,2,0,2,3, 4,5,6,4,6,7, 8,9,10,8,10,11, 12,13,14,12,14,15, 16,17,18,16,18,19, 20,21,22,20,22,23];

  const boxes = [
    {id: "boxRed",    pos: [-4, -4, 2], color: [0.92, 0.32, 0.32]},
    {id: "boxGreen",  pos: [ 4, -4, 2], color: [0.42, 0.78, 0.32]},
    {id: "boxBlue",   pos: [-4,  4, 2], color: [0.30, 0.55, 0.95]},
    {id: "boxYellow", pos: [ 4,  4, 2], color: [0.95, 0.85, 0.20]},
  ];

  const fromParamsResult = sceneModel.fromParams({
    geometries: [{id: "cube", primitive: xeokit.base.constants.TrianglesPrimitive, positions: cubePositions, indices: cubeIndices}],
    meshes:  boxes.map(b => ({id: `${b.id}-mesh`, geometryId: "cube", position: b.pos, scale: [1.5, 1.5, 1.5], color: b.color})),
    objects: boxes.map(b => ({id: b.id, meshIds: [`${b.id}-mesh`]})),
  });
  if (!fromParamsResult.ok) throw new Error(fromParamsResult.error);

  // ---- Controls ------------------------------------------------
  const controls = new xeokit.viewing.transformControls.TransformControls({
    view,
    picker: studio.picker,                              // PickStrategy from ./spatial/picking
    viewController: studio.views[view.id].viewController, // suspended during drag
    size: 120,
  });
  controls.attach(scene.objects["boxRed"]);
  let currentTargetId = "boxRed";

  // ---- HUD -----------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const log = (msg) => {
    const line = document.createElement("div"); line.className = "l";
    line.textContent = msg;
    $("log").prepend(line);
    while ($("log").childElementCount > 25) $("log").lastElementChild.remove();
  };
  let translationSnapOn = false, rotationSnapOn = false, scaleSnapOn = false;
  const refreshHUD = () => {
    $("sTarget").textContent = currentTargetId || "—";
    $("sMode").textContent   = controls.mode;
    $("sSpace").textContent  = controls.space;
    $("sSize").textContent   = String(controls.size);
    $("sShow").textContent   = `${controls.showX ? "X" : "·"} ${controls.showY ? "Y" : "·"} ${controls.showZ ? "Z" : "·"}`;
    const flags = [];
    if (translationSnapOn) flags.push("T=1");
    if (rotationSnapOn) flags.push("R=15°");
    if (scaleSnapOn) flags.push("S=10%");
    $("sSnap").textContent = flags.length ? flags.join("  ") : "off";
    $("sHover").textContent = controls.hoveredAxis || "—";
  };
  controls.events.onChange.subscribe(refreshHUD);
  controls.events.onDragStart.subscribe((_, e) => { log(`drag start: ${e.mode} ${e.axis} (${e.space})`); refreshHUD(); });
  controls.events.onDragEnd.subscribe((_,   e) => { log(`drag end:   ${e.mode} ${e.axis}`);  refreshHUD(); });
  controls.events.onObjectChange.subscribe(() => refreshHUD());
  refreshHUD();

  // ---- Click a box to re-attach --------------------------------
  view.htmlElement.addEventListener("pointerdown", (e) => {
    if (controls.dragging) return;          // never re-attach mid-drag
    const result = renderer.pick(view, {canvasPos: [e.offsetX, e.offsetY], pickViewObject: true});
    if (!(result.ok && result.value)) return;
    const hit = result.value.sceneObject || result.value.sceneMesh;
    if (!hit) return;
    const id = hit.id || (hit.object && hit.object.id);
    const box = boxes.find(b => id === b.id || id === `${b.id}-mesh`);
    if (!box) return;
    currentTargetId = box.id;
    controls.attach(scene.objects[box.id]);
  });

  // ---- Keyboard ------------------------------------------------
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if      (k === "g") controls.setMode("translate");
    else if (k === "r") controls.setMode("rotate");
    else if (k === "s") controls.setMode("scale");
    else if (k === "n") controls.setMode("none");
    else if (k === "q") controls.setSpace(controls.space === "world" ? "local" : "world");
    else if (k === "+" || k === "=") controls.setSize(controls.size + 15);
    else if (k === "-" || k === "_") controls.setSize(controls.size - 15);
    else if (k === "x") controls.setShowX(!controls.showX);
    else if (k === "y") controls.setShowY(!controls.showY);
    else if (k === "z") controls.setShowZ(!controls.showZ);
    else if (k === "t") { translationSnapOn = !translationSnapOn; controls.setTranslationSnap(translationSnapOn ? 1   : null); }
    else if (k === "u") { rotationSnapOn    = !rotationSnapOn;    controls.setRotationSnap(rotationSnapOn       ? Math.PI / 12 : null); }
    else if (k === "v") { scaleSnapOn       = !scaleSnapOn;       controls.setScaleSnap(scaleSnapOn             ? 0.1 : null); }
    else if (k === "escape") { currentTargetId = null; controls.detach(); }
    else if (k === "1") { currentTargetId = boxes[0].id; controls.attach(scene.objects[boxes[0].id]); }
    else if (k === "2") { currentTargetId = boxes[1].id; controls.attach(scene.objects[boxes[1].id]); }
    else if (k === "3") { currentTargetId = boxes[2].id; controls.attach(scene.objects[boxes[2].id]); }
    else if (k === "4") { currentTargetId = boxes[3].id; controls.attach(scene.objects[boxes[3].id]); }
    else return;
    refreshHUD();
  });

  studio.finished();
});
