// Wireframe-projection demo — loads the Duplex IFC into a Y-up
// SceneModel inside a Z-up Scene, then projects three drawing
// SceneModels onto the AABB faces that yield a plan view (above)
// and two elevations (front, right). Each projected SceneObject
// is pickable; the click handler maps the picked id back to its
// source object.
//
// The example exercises the caller-owned-target shape of the
// drawings API: we create each target SceneModel up front via
// `scene.createModel`, pass it into `buildDrawing` as
// `targetModel`, and destroy it ourselves when rebuilding or
// tearing down. `buildDrawing` no longer creates or destroys
// SceneModels — it only populates the one we hand it.
//
// A floating control panel exposes the main `buildDrawing`
// configuration knobs (style, HLE, chrome, projection, section
// cut) so the effect of each parameter is visible live. Every
// change rebuilds the three projections in place; in-flight
// builds get cancelled cleanly via `target.destroyed`.

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const {scene, data, renderer} = studio;

  const ifcLoader = new xeokit.formats.ifc.IFCLoader();

  // Scene world is Z-up by default (Scene's coordinate-system
  // basis is `[1,0,0, 0,0,1, 0,1,0]`). The IFC source data
  // arrives Y-up via the loader, so the SceneModel below declares
  // a Y-up basis — the Scene's coordinate-system transform then
  // rotates the model's Y-up coords into the Z-up world. The
  // camera below uses `up: [0, 0, 1]` for that world.
  const view = studio.viewManager.createView({
    camera: {
      eye:  [55.0, -35.0, 35.0],
      look: [5.0,  5.0,   3.0],
      up:   [0,    0,     1]
    },
    // DetailedRender is the mode that actually rasterises the
    // per-material `hatchPattern` set by `applyIFCMaterials` below.
    // RealisticRender would render the same materials un-hatched.
    renderMode: xeokit.base.constants.DetailedRender,
  });

  // Exercise the quad-expanded thick-line technique. Setting this
  // above 1 produces thick lines on every WebGL2 backend — works
  // even on Windows / ANGLE where gl.LINES is clamped to a single
  // pixel. The drawing wireframes, frame borders and any
  // LinesPrimitive geometry the demo renders all pick this up.
  view.linesMaterial.lineWidth = 3;

  // 3D section plane that slices the source building at the
  // current "Z cut" depth. `dir: [0, 0, 1]` discards the half-
  // space above the plane (world-Z up), matching the plan-view
  // convention the drawings panel uses for its 2D clip + caps.
  // The plane stays inactive until the user toggles Clip; the
  // initial pos.z just mirrors the slider's default so a later
  // toggle without any slider interaction reads as expected.
  // The drawing projection ViewObjects get `clippable = false`
  // after each buildDrawing so this plane only ever affects the
  // building.
  const clipPlaneRes = view.createSectionPlane({
    id: "duplex_clip",
    pos: [0, 0, 2.5],
    dir: [0, 0, 1],
    active: false,
  });
  if (!clipPlaneRes.ok) {
    console.error("createSectionPlane:", clipPlaneRes.error);
  }
  const clipPlane = clipPlaneRes.ok ? clipPlaneRes.value : null;

  // Push the current Clip / Z-cut control values to the section
  // plane. Called immediately from the input listeners below
  // (no debounce) so toggling Clip feels instant — the drawings
  // rebuild still rides the 120 ms debouncer.
  const applyClipState = () => {
    if (!clipPlane) return;
    clipPlane.active = document.getElementById("cfgClip").checked;
    clipPlane.pos = [0, 0, Number(document.getElementById("cfgClipDepth").value)];
  };
  document.getElementById("cfgClip").addEventListener("change", applyClipState);
  document.getElementById("cfgClipDepth").addEventListener("input", applyClipState);
  applyClipState();

  const sceneModelResult = scene.createModel({
    id: "duplex",
    coordinateSystem: {
      // Left-handed Y-up declaration: same X-right and Y-up as the
      // identity basis, but Z-forward is negated. Combined with the
      // Scene's right-handed Z-up basis swap, the composite
      // mesh.worldMatrix becomes a *rotation* (det=+1) — `(x, y, z)
      // → (x, -z, y)` — rather than the reflection (det=-1) the
      // identity basis produces. The rotation preserves triangle
      // winding, which is what buildSectionCaps needs to classify
      // outer rings correctly; the reflection silently produced
      // all-hole loops and zero caps. The visible side effect: world Y
      // is now the negation of the source's other horizontal axis, so
      // the model is mirrored along world Y relative to the identity-
      // basis rendering. World Z (vertical) is unchanged.
      basis: [1, 0, 0, 0, 1, 0, 0, 0, -1],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });
  if (!sceneModelResult.ok) {
    throw new Error("Failed to create SceneModel: " + sceneModelResult.error);
  }

  const dataModelResult = data.createModel({id: "duplex"});
  if (!dataModelResult.ok) {
    throw new Error("Failed to create DataModel: " + dataModelResult.error);
  }

  const sourceSceneModel = sceneModelResult.value;
  const dataModel = dataModelResult.value;

  fetch("../../models/Duplex/ifc/model.ifc").then(response => {
    response.arrayBuffer().then(fileData => {
      ifcLoader.load({fileData, sceneModel: sourceSceneModel, dataModel}).then(() => {

        // The IFC SceneModel is now built. Project its edge geometry
        // onto each of three AABB faces. Pass an explicit AABB taken
        // from the Studio's collision index so the three planes
        // sit on the model's true world-space extent.
        const aabb = studio.picking.collisionIndex.getSceneAABB();

        // Skip projection entirely on sources with no
        // triangle-bearing geometry — point clouds, line-only
        // models, surface meshes without `edgeIndices`. Without
        // this guard `buildDrawing` would still succeed but emit
        // an empty target.
        if (!xeokit.presentations.drawings.canBuildDrawing(
              sourceSceneModel, "either")) {
          console.warn("source has no projectable edges or fills");
          studio.openInfoPanelFromMeta();
          studio.finished();
          return;
        }

        // Projector face names are anchored to Y-up world axes
        // internally — pick the ones that produce a plan view
        // and two elevations now that the world is Z-up:
        //   "back"   → +Z face  → plan view (looking down)
        //   "bottom" → −Y face  → front elevation
        //   "right"  → +X face  → right elevation
        const faces = [
          {face: "back",   offset: 10.0, frameMargin: 1.5, isPlan: true},
          {face: "bottom", offset: 10.0, frameMargin: 1.5, isPlan: false},
          {face: "right",  offset: 10.0, frameMargin: 1.5, isPlan: false},
        ];

        // Track the target SceneModels we own so we can destroy
        // them across rebuilds. Keyed by face name.
        const targets = new Map();

        // Optional intermediate SceneModel holding filled section-
        // cap geometry at the current cut depth. Owned by this
        // demo; destroyed and rebuilt whenever the cut depth /
        // toggle changes. Section caps are projected into the
        // plan-view drawing target as a second buildDrawing source.
        let capsModel = null;

        // Generation counter — every rebuild increments it; an
        // in-flight build whose generation doesn't match the
        // latest is stale and its result is discarded.
        let generation = 0;

        // Colour palettes keyed by the "color" select. Each
        // option picks a line colour and a complementary panel
        // colour so the drawing reads consistently.
        const palettes = {
          blue:  {line: [0.10, 0.20, 0.55], panel: [0.96, 0.97, 0.99]},
          black: {line: [0.05, 0.05, 0.05], panel: [0.97, 0.97, 0.97]},
          red:   {line: [0.55, 0.10, 0.12], panel: [0.99, 0.96, 0.96]},
          ink:   {line: [0.10, 0.10, 0.18], panel: [0.94, 0.94, 0.92]},
        };

        // Read every control into a plain config snapshot.
        const readConfig = () => {
          const $ = (id) => document.getElementById(id);
          const palette = palettes[$("cfgColor").value] ?? palettes.blue;
          return {
            lines:        $("cfgLines").checked,
            fill:         $("cfgFill").checked,
            color:        palette.line,
            panelColor:   palette.panel,
            hle:          $("cfgHLE").checked,
            resolution:   Number($("cfgResolution").value),
            frameMargin:  Number($("cfgFrame").value),
            panelOpacity: Number($("cfgPanelOpacity").value),
            titleBlock:   $("cfgTitleBlock").checked,
            offset:       Number($("cfgOffset").value),
            lineWidth:    Number($("cfgLineWidth").value),
            clipEnabled:  $("cfgClip").checked,
            clipDepth:    Number($("cfgClipDepth").value),
            // Section caps are only meaningful when the clip is
            // also enabled — the caps live on the cut plane.
            sectionCaps:  $("cfgClip").checked && $("cfgCaps").checked,
          };
        };

        // Build (or rebuild) the three projection SceneModels for
        // the current config. Tears any existing projections down
        // first so the rebuild replaces them in-place. Returns
        // early on a stale generation so in-flight rebuilds don't
        // stomp the latest result.
        const buildProjections = async (cfg) => {
          const myGen = ++generation;

          // Drive the View's lineWidth so the slider visibly thickens
          // the projected wireframes too.
          view.linesMaterial.lineWidth = cfg.lineWidth;

          // Tear down any prior projections we own.
          for (const targetModel of targets.values()) {
            xeokit.presentations.drawings.clearDrawing(targetModel);
          }
          targets.clear();

          // Tear down any prior caps SceneModel — the next pass
          // rebuilds at the current cut depth (or skips it if the
          // toggle is off).
          if (capsModel) {
            xeokit.presentations.sectionCaps.clearSectionCaps(capsModel);
            capsModel = null;
          }

          // A drawing with no lines AND no fills would be empty —
          // skip the whole pass to avoid a noisy "no projectable
          // edges or fills" error from buildDrawing.
          if (!cfg.lines && !cfg.fill) return;

          for (const {face, isPlan} of faces) {
            if (generation !== myGen) return;     // stale build

            // Caller owns the target SceneModel — create it here
            // and pass it into buildDrawing.
            const targetRes = scene.createModel({id: `duplex__${face}`});
            if (targetRes.ok === false) {
              console.error(`[drawing ${face}] createModel:`, targetRes.error);
              continue;
            }
            const targetModel = targetRes.value;
            targets.set(face, targetModel);

            // Optional cut-away plane. Only meaningful for the
            // plan view in this demo: the slider sets the world-Z
            // value of the cut, and only the "back" projection
            // (looking down at +Z) is clipped against it.
            const clip = cfg.clipEnabled && isPlan
              ? {depth: -cfg.clipDepth}
              : undefined;

            // Optional title-block cartouche, drawn at the
            // bottom-right of the frame on every face.
            const titleBlock = cfg.titleBlock
              ? {
                  title: `DUPLEX — ${face.toUpperCase()}`,
                  rows: [
                    {label: "PROJECT", value: "Duplex IFC"   },
                    {label: "VIEW",    value: face           },
                    {label: "DATE",    value: "2026-05-14"   },
                  ],
                }
              : undefined;

            const projRes = await xeokit.presentations.drawings.buildDrawing({
              sourceModel: sourceSceneModel,
              targetModel,
              direction:   face,
              offset:      cfg.offset,
              aabb,
              color:       cfg.color,
              lineWidth:   cfg.lineWidth,
              frame:       cfg.frameMargin,
              frameColor:  cfg.color,
              panel:       {color: cfg.panelColor, opacity: cfg.panelOpacity},
              lines:       cfg.lines,
              fill:        cfg.fill ? {opacity: 1.0} : false,
              hideHidden:  cfg.hle
                ? {resolution: cfg.resolution, samples: 7, tolerance: 0.02}
                : false,
              clip,
              titleBlock,
              // Yield to the renderer between batches so the
              // wireframe paints in progressively while the
              // building's ~150 source objects stream through.
              progressive: true,
            });

            // Stale build that got cancelled by a newer rebuild —
            // its target was destroyed mid-flight. Stay silent.
            if (generation !== myGen) return;
            if (projRes.ok === false) {
              if (!projRes.error.includes("destroyed mid-projection")) {
                console.error(`[drawing ${face}]`, projRes.error);
              }
              xeokit.presentations.drawings.clearDrawing(targetModel);
              targets.delete(face);
              continue;
            }
            // Frame border is decoration only; the wireframe lines,
            // fill silhouettes, and panel quads are all pickable so
            // the viewer can click anywhere on the drawing.
            const frameVO = view.objects[`duplex__${face}__frame`];
            if (frameVO) frameVO.pickable = false;

            // The 3D section plane is meant for the source building
            // only — opt every projected SceneObject out of clipping
            // so the drawing panels stay whole regardless of the
            // current cut depth.
            for (const id of Object.keys(targetModel.objects)) {
              const vo = view.objects[id];
              if (vo) vo.clippable = false;
            }
          }

          // Compose section caps onto the plan view as a SECOND
          // buildDrawing source against the same target SceneModel
          // the building's wireframe just populated. This is the
          // "multi-source onto one drawing" pattern: matching
          // direction / aabb / offset across the two calls so both
          // projections land on the same page, with chrome only
          // on the first call (to avoid duplicate frame / panel /
          // titleBlock / lineMat ids).
          if (cfg.sectionCaps) {
            const planTarget = targets.get("back");
            if (planTarget) {
              await composeSectionCaps(cfg, planTarget, myGen);
            }
          }
        };

        // Build a section-caps SceneModel from the building at the
        // current cut depth, then project it into the supplied
        // plan-view drawing target as a second buildDrawing source.
        // Chrome and lineWidth are intentionally omitted on this
        // second call to avoid id clashes with the first call.
        const composeSectionCaps = async (cfg, planTarget, myGen) => {

          // Z-cut convention matches the drawing's clip plane:
          //   drawing clip: { depth: -clipDepth } for "back" face
          //   cap plane:    { dir: [0, 0, 1], dist: -clipDepth }
          // Both describe the world-Z = clipDepth plane, with the
          // same kept (below) / discarded (above) sides.
          const capsRes = scene.createModel({id: "duplex__caps"});
          if (capsRes.ok === false) {
            console.error("createModel caps:", capsRes.error);
            return;
          }
          capsModel = capsRes.value;

          // 3D cap colour — neutral light grey reads as a real cut
          // surface against the building materials. Kept distinct
          // from `capFillColor` below, which is the warmer drawing-
          // convention fill used in the 2D plan-view projection.
          const cap3DColor = [0.85, 0.85, 0.85];
          const capsBuild = await xeokit.presentations.sectionCaps.buildSectionCaps({
            sourceModel: sourceSceneModel,
            targetModel: capsModel,
            capPlanes:   [{dir: [0, 0, 1], dist: -cfg.clipDepth}],
            capColor:    cap3DColor,
          });
          if (generation !== myGen) return;
          if (capsBuild.ok === false) {
            if (!capsBuild.error.includes("destroyed mid-build")) {
              console.error("buildSectionCaps:", capsBuild.error);
            }
            xeokit.presentations.sectionCaps.clearSectionCaps(capsModel);
            capsModel = null;
            return;
          }

          // buildSectionCaps returns ok even when the cut plane
          // didn't actually produce any caps — either the plane
          // missed the model entirely or every straddling mesh
          // was non-watertight (counted in numUnclosedMeshes).
          // Projecting an empty source through buildDrawing would
          // surface as the misleading "no projectable edges or
          // fills" error, so bail here with a clearer log.
          const {numObjectsWithCaps, numUnclosedMeshes} = capsBuild.value;
          if (numObjectsWithCaps === 0) {
            console.warn(
              `[section caps] no caps generated at Z=${cfg.clipDepth}` +
              (numUnclosedMeshes > 0
                ? ` — ${numUnclosedMeshes} straddling mesh(es) were non-watertight`
                : " — cut plane outside model extent")
            );
            xeokit.presentations.sectionCaps.clearSectionCaps(capsModel);
            capsModel = null;
            return;
          }

          // Show the caps in 3D as the cross-section fill, and opt
          // them out of the section plane. The caps live exactly on
          // the cut plane, so leaving them clippable lets per-
          // fragment precision flip them on and off across the
          // boundary — the visible shimmer the user was seeing.
          // Same loop also stamps the engineering-drawing hatch
          // onto each cap material — ANSI 31 (45° diagonal lines)
          // is the universal "cut surface" pattern. The hatch only
          // renders in DetailedRender mode (set on the View above);
          // the source building's IFC-derived materials stay
          // un-hatched, so only the cut faces read as engineering
          // cross-sections.
          for (const id of Object.keys(capsModel.objects)) {
            const vo = view.objects[id];
            if (vo) vo.clippable = false;
            const obj = capsModel.objects[id];
            if (obj) {
              for (const m of obj.meshes) {
                if (m.material) m.material.hatchPattern = "ansi31";
              }
            }
          }

          // Cap fills in the drawing are gated on the Fill toggle —
          // mirrors the building's own buildDrawing logic, which
          // emits fills only when `cfg.fill` is on. The 3D caps
          // remain regardless; we just don't compose them into the
          // 2D drawing when the user has fills turned off.
          if (!cfg.fill) return;

          // Project the caps SceneModel into the SAME plan-view
          // drawing target as the building's wireframe. Matching
          // `direction` and `aabb` keeps the projection plane
          // identical. Chrome (frame / panel / titleBlock) and
          // lineWidth are skipped to avoid id clashes with the
          // first projection that already created them.
          const capFillColor = [0.55, 0.40, 0.25];
          const capsProj = await xeokit.presentations.drawings.buildDrawing({
            sourceModel: capsModel,
            targetModel: planTarget,
            direction:   "back",
            offset:      cfg.offset,
            aabb,
            color:       capFillColor,
            // Fills only — caps render as solid coloured regions
            // on the plan view, no wireframe edges.
            lines:       false,
            fill:        {color: capFillColor, opacity: 0.95},
            // No clip — the caps already live exactly on the cut
            // plane; clipping them with the same plane would
            // discard half of every cap by the centroid test.
          });
          if (generation !== myGen) return;
          if (capsProj.ok === false &&
              !capsProj.error.includes("destroyed mid-projection")) {
            console.error("project caps:", capsProj.error);
          }
        };

        // Wire every control to a debounced rebuild. Sliders are
        // throttled to one rebuild per ~120 ms so dragging doesn't
        // queue dozens of in-flight builds.
        let pending = null;
        const scheduleRebuild = () => {
          if (pending) clearTimeout(pending);
          pending = setTimeout(() => {
            pending = null;
            buildProjections(readConfig());
          }, 120);
        };

        // Live slider value labels.
        const liveLabel = (inputId, labelId, fmt = (v) => v) => {
          const inp = document.getElementById(inputId);
          const out = document.getElementById(labelId);
          const sync = () => { out.textContent = fmt(inp.value); };
          inp.addEventListener("input", sync);
          sync();
        };
        liveLabel("cfgFrame",        "cfgFrameVal",        (v) => Number(v).toFixed(1));
        liveLabel("cfgPanelOpacity", "cfgPanelOpacityVal", (v) => Number(v).toFixed(2));
        liveLabel("cfgOffset",       "cfgOffsetVal");
        liveLabel("cfgLineWidth",    "cfgLineWidthVal");
        liveLabel("cfgClipDepth",    "cfgClipDepthVal",    (v) => Number(v).toFixed(1));

        // All controls trigger a rebuild on change.
        const controlIds = [
          "cfgLines", "cfgFill", "cfgColor",
          "cfgHLE", "cfgResolution",
          "cfgFrame", "cfgPanelOpacity", "cfgTitleBlock",
          "cfgOffset", "cfgLineWidth",
          "cfgClip", "cfgClipDepth", "cfgCaps",
        ];
        for (const id of controlIds) {
          const el = document.getElementById(id);
          if (!el) continue;
          // `input` fires continuously on sliders / selects;
          // `change` fires once on checkbox toggle. Both routes
          // funnel into the same debounced scheduler.
          el.addEventListener("input", scheduleRebuild);
          el.addEventListener("change", scheduleRebuild);
        }

        // Initial build.
        buildProjections(readConfig());

        // Wire up picking: clicking the wireframe selects the
        // corresponding source ViewObject. The projected SceneObject
        // ids look like `{srcId}__{targetModel.id}`; the picked
        // ViewObject's `.sceneObject.model.id` tells us which
        // drawing model it came from, so the suffix to strip is
        // computed from that id rather than hard-coded.
        const projModelIds = new Set(
          faces.map(f => `duplex__${f.face}`)
        );
        const canvas = view.htmlElement;
        canvas.addEventListener("click", (ev) => {
          const rect = canvas.getBoundingClientRect();
          const pick = studio.picking.picker.pick({
            view,
            canvasPos: [ev.clientX - rect.left, ev.clientY - rect.top]
          });
          if (!pick.hit || !pick.objectId) return;
          // Resolve the picked id to its source object. A wireframe
          // line id ends with one of the projection model suffixes
          // and strips back to a real source object; a panel quad
          // id ends with `__panel` and resolves to nothing useful.
          // Ignore any pick that doesn't map back to a source.
          let srcId = null;
          for (const projModelId of projModelIds) {
            const suffix = `__${projModelId}`;
            if (pick.objectId.endsWith(suffix)) {
              const candidate = pick.objectId.slice(0, -suffix.length);
              if (view.objects[candidate]) srcId = candidate;
              break;
            }
          }
          view.setObjectsSelected(view.selectedObjectIds, false);
          if (srcId) view.setObjectsSelected([srcId], true);
        });

        studio.finished();
      }).catch(e => console.error(e));
    });
  });
});
