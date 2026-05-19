// Import the xeokit SDK bundle used by this example.
import * as xeokit from "../../js/xeokit-studio-bundle.js";

// ============================================================
// WHY THIS DEMO EXISTS
//
// Standard WebGL vertex shaders operate on 32-bit floats.
// At UTM-scale coordinates (e.g. easting 474,000 m, northing
// 5,561,000 m) the gap between adjacent float32 values is
// roughly 0.5–1 m, so positions closer than ~1 m apart become
// indistinguishable and the result is catastrophic vertex
// jitter — every triangle dances and snaps unpredictably.
//
// xeokit sidesteps this entirely with a transparent
// "Relative-To-Centre" (RTC) tile system built into the WebGL
// renderer. Every mesh is assigned to a tile whose centre is
// nearby; the GPU only ever sees small float32 offsets from
// that centre, while the full Float64 world position is
// maintained in JavaScript. No special API is needed — just
// place objects at large coordinates and it works.
//
// This example makes that invisible machinery visible by:
//   1. Placing a whole city block at real UTM coordinates
//      (central Europe, ~474 km east, ~5561 km north)
//   2. Animating a tower-crane arm whose world coordinates
//      exceed 5,561,036 m but update with sub-mm precision
//   3. Displaying the live Float64 world coordinates in an
//      overlay so the large numbers are impossible to miss
// ============================================================

// Approximate UTM Zone 32N coordinates — central Europe.
// Easting  ~474 km   from the UTM false origin.
// Northing ~5561 km  from the UTM false origin.
const UTM_EAST  = 474_000; // metres
const UTM_NORTH = 5_561_000; // metres

// Float32 precision at UTM northing 5,561,000 m.
// The unit of least precision (ULP) for a 32-bit float at
// magnitude M is approximately M * 2^-23 ≈ M * 1.19e-7.
// At 5.5 M metres that is about 0.66 m — any feature smaller
// than that would be indistinguishable from its neighbour.
const FLOAT32_ULP = UTM_NORTH / Math.pow(2, 23);

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

    const { scene } = studio;

    // --------------------------------------------------------
    // Camera — eye and look use genuine UTM-scale values.
    // A float32-only engine would jitter or produce NaN here.
    //
    // World space is Z-up throughout: [X=east, Y=north, Z=height].
    // --------------------------------------------------------
    const view = studio.viewManager.createView({
        camera: {
            eye:  [UTM_EAST - 60, UTM_NORTH - 60, 110],
            look: [UTM_EAST + 48, UTM_NORTH + 48,  10],
            up:   [0, 0, 1]
        }
    });

    // --------------------------------------------------------
    // SceneModel placed at the UTM site via coordinateSystem.
    //
    // The model uses a Z-up coordinate system throughout
    // (X = east, Y = north, Z = height) — the natural
    // convention for georeferenced BIM/GIS data.
    //
    // World space is also Z-up, so the basis is identity:
    // model local and world use the same orientation.
    //
    // origin [UTM_EAST, UTM_NORTH, 0] sets the model's local
    // origin in world Z-up space: [east, north, height=0].
    //
    // A transform at local [40, 40, 38] therefore maps to:
    //   world [UTM_EAST+40, UTM_NORTH+40, 38]
    //       = [474,040,     5,561,040,    38]
    //
    // The renderer resolves all of this to full 64-bit world
    // coords and decomposes into GPU tiles automatically.
    // --------------------------------------------------------
    const sceneModelResult = scene.createModel({
        id: "cityModel",
        coordinateSystem: {
            basis:  [1, 0, 0,  0, 1, 0,  0, 0, 1], // identity — Z-up local = Z-up world
            origin: [UTM_EAST, UTM_NORTH, 0],        // world Z-up: [east, north, 0]
            units:  "meters"
        }
    });
    if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
    const sceneModel = sceneModelResult.value;

    // --------------------------------------------------------
    // Shared unit-box geometry instanced by every building
    // and crane element. Scale is applied per-transform so a
    // single geometry drives the whole scene.
    // --------------------------------------------------------
    const boxGeoResult = xeokit.model.procgen.buildGeometry.buildBox({
        xSize: 1, ySize: 1, zSize: 1
    });
    if (!boxGeoResult.ok) throw new Error(boxGeoResult.error);

    const geoResult = sceneModel.createGeometry({
        id:        "box",
        primitive: boxGeoResult.value.primitive,
        positions: boxGeoResult.value.positions,
        normals:   boxGeoResult.value.normals,
        indices:   boxGeoResult.value.indices
    });
    if (!geoResult.ok) throw new Error(geoResult.error);

    // --------------------------------------------------------
    // Convenience: create a SceneTransform + SceneMesh +
    // SceneObject in one call. Returns the SceneTransform.
    //
    // All positions/scales use Z-up local space:
    //   [X = east,  Y = north,  Z = height]
    // --------------------------------------------------------
    function addBox({ id, position, scale, color, parentTransformId }) {
        const tRes = sceneModel.createTransform({
            id:               id + "_t",
            position,
            scale,
            parentTransformId
        });
        if (!tRes.ok) throw new Error(tRes.error);

        const mRes = sceneModel.createMesh({
            id:               id + "_m",
            geometryId:       "box",
            parentTransformId: id + "_t",
            color
        });
        if (!mRes.ok) throw new Error(mRes.error);

        const oRes = sceneModel.createObject({ id, meshIds: [id + "_m"] });
        if (!oRes.ok) throw new Error(oRes.error);

        return tRes.value;
    }

    // --------------------------------------------------------
    // Ground plane.
    // Local [X=48, Y=48, Z=-0.5] → world [474,048, -0.5, 5,561,048]
    // --------------------------------------------------------
    addBox({
        id:       "ground",
        position: [48, 48, -0.5],  // Z-up: [east, north, height]
        scale:    [60, 60, 0.5],
        color:    [0.38, 0.48, 0.32]
    });

    // --------------------------------------------------------
    // 6 × 6 building grid.
    //
    // Local X spans  8 … 88 m  →  world east   474,008 … 474,088 m
    // Local Y spans  8 … 88 m  →  world north  5,561,008 … 5,561,088 m
    // Local Z = h/2            →  world height (small)
    //
    // Each building's world position differs from its neighbour
    // by exactly SPACING metres in Float64. The Float32 ULP at
    // this scale is ~0.66 m, so every 1 m gap in position
    // would be completely lost in a single-precision engine.
    // --------------------------------------------------------
    const GRID    = 6;
    const SPACING = 16; // metres between building centres

    // Centre cell (row 2, col 2) — reserved for the crane building.
    const CRANE_ROW = 2, CRANE_COL = 2;

    const PALETTE = [
        [0.78, 0.62, 0.50],
        [0.55, 0.70, 0.86],
        [0.72, 0.80, 0.55],
        [0.88, 0.72, 0.42],
        [0.65, 0.55, 0.82],
        [0.85, 0.55, 0.55],
        [0.60, 0.78, 0.78],
        [0.90, 0.80, 0.50],
    ];

    for (let row = 0; row < GRID; row++) {
        for (let col = 0; col < GRID; col++) {
            if (row === CRANE_ROW && col === CRANE_COL) continue;

            const localX = col * SPACING + SPACING / 2; // east offset
            const localY = row * SPACING + SPACING / 2; // north offset
            const h = 5 + ((row * 5 + col * 11 + row * col) % 18);

            addBox({
                id:       `building_${row}_${col}`,
                position: [localX, localY, h / 2], // Z-up: [east, north, height]
                scale:    [5, 5, h / 2],
                color:    PALETTE[(row + col * 3) % PALETTE.length]
            });
        }
    }

    // --------------------------------------------------------
    // Tower crane on the centre building.
    //
    // All positions are model-local Z-up metres [east, north, height].
    // Add [UTM_EAST, UTM_NORTH, 0] (via basis + origin) for world.
    //
    //   cranePodium  [40, 40, 0..10]
    //   craneMast    [40, 40, 10..38]
    //   armRoot      [40, 40, 38]   ← ROTATED each frame
    //     arm        [+7,  0, 0] from armRoot   main jib (+X east)
    //     counterArm [-4,  0, 0] from armRoot   counter jib (−X west)
    //     cw         counterweight block
    //     rope       hangs along −Z (down), length oscillates
    //     hook       at rope end, local Z oscillates
    //
    // Animating armRoot.rotation[2] (around local Z = up) sweeps
    // the whole jib at world coords ~[474,040, 38, 5,561,040],
    // with the hook tip tracing a circle of radius 14 m —
    // all expressed and rendered in Float64.
    // --------------------------------------------------------
    const CRANE_X   = CRANE_COL * SPACING + SPACING / 2; // local east  = 40
    const CRANE_N   = CRANE_ROW * SPACING + SPACING / 2; // local north = 40
    const TOWER_TOP = 38; // mast top, model-local Z (height) metres

    // Base building + mast
    addBox({ id: "cranePodium",
             position: [CRANE_X, CRANE_N, 5],
             scale:    [5, 5, 5], color: [0.72, 0.72, 0.72] });

    addBox({ id: "craneMast",
             position: [CRANE_X, CRANE_N, TOWER_TOP / 2 + 10],
             scale:    [0.6, 0.6, (TOWER_TOP - 10) / 2], color: [0.90, 0.90, 0.90] });

    // Arm rotation root — animated transform.
    // Model-local [CRANE_X=40, CRANE_N=40, TOWER_TOP=38]
    // → world Y-up [UTM_EAST+40, 38, UTM_NORTH+40]
    // → world      [474,040, 38, 5,561,040]
    const armRootRes = sceneModel.createTransform({
        id:       "t_armRoot",
        position: [CRANE_X, CRANE_N, TOWER_TOP],
        rotation: [0, 0, 0],
        scale:    [1, 1, 1]
    });
    if (!armRootRes.ok) throw new Error(armRootRes.error);
    const armRoot = armRootRes.value;

    // Main jib extends 14 m along +X from arm root
    const armRes = sceneModel.createTransform({
        id: "t_arm", parentTransformId: "t_armRoot",
        position: [7, 0, 0], scale: [7, 0.35, 0.35]
    });
    if (!armRes.ok) throw new Error(armRes.error);
    sceneModel.createMesh({ id: "m_arm", geometryId: "box",
                            parentTransformId: "t_arm", color: [1.0, 0.82, 0.10] });
    sceneModel.createObject({ id: "craneArm", meshIds: ["m_arm"] });

    // Counter-jib extends 5 m along −X
    const cArmRes = sceneModel.createTransform({
        id: "t_cArm", parentTransformId: "t_armRoot",
        position: [-4, 0, 0], scale: [4, 0.35, 0.35]
    });
    if (!cArmRes.ok) throw new Error(cArmRes.error);
    sceneModel.createMesh({ id: "m_cArm", geometryId: "box",
                            parentTransformId: "t_cArm", color: [1.0, 0.82, 0.10] });
    sceneModel.createObject({ id: "craneCounterArm", meshIds: ["m_cArm"] });

    // Counterweight block — offset along −X and slightly below jib
    const cwRes = sceneModel.createTransform({
        id: "t_cw", parentTransformId: "t_armRoot",
        position: [-7.5, 0, -0.6], scale: [0.9, 0.9, 0.9]  // Z-up: Z=-0.6 is below jib
    });
    if (!cwRes.ok) throw new Error(cwRes.error);
    sceneModel.createMesh({ id: "m_cw", geometryId: "box",
                            parentTransformId: "t_cw", color: [0.4, 0.4, 0.8] });
    sceneModel.createObject({ id: "cwBlock", meshIds: ["m_cw"] });

    // Rope — hangs along −Z (down in Z-up local space), length oscillates
    const ropeRes = sceneModel.createTransform({
        id: "t_rope", parentTransformId: "t_armRoot",
        position: [14, 0, -2], scale: [0.12, 0.12, 2]  // Z-up: scale Z = length along height
    });
    if (!ropeRes.ok) throw new Error(ropeRes.error);
    const ropeTransform = ropeRes.value;
    sceneModel.createMesh({ id: "m_rope", geometryId: "box",
                            parentTransformId: "t_rope", color: [0.65, 0.65, 0.65] });
    sceneModel.createObject({ id: "craneRope", meshIds: ["m_rope"] });

    // Hook — at rope end, oscillates in local Z (height) each frame
    const hookRes = sceneModel.createTransform({
        id: "t_hook", parentTransformId: "t_armRoot",
        position: [14, 0, -5], scale: [0.5, 0.5, 0.5]  // Z-up: Z=-5 is below jib
    });
    if (!hookRes.ok) throw new Error(hookRes.error);
    const hookTransform = hookRes.value;
    sceneModel.createMesh({ id: "m_hook", geometryId: "box",
                            parentTransformId: "t_hook", color: [0.9, 0.25, 0.15] });
    sceneModel.createObject({ id: "craneHook", meshIds: ["m_hook"] });

    // --------------------------------------------------------
    // Wire up UI overlay
    // --------------------------------------------------------
    const modelOriginEl  = document.getElementById("modelOriginVal");
    const cameraEyeEl    = document.getElementById("cameraEyeVal");
    const cameraLookEl   = document.getElementById("cameraLookVal");
    const craneTipEl     = document.getElementById("craneTipVal");
    const craneRotEl     = document.getElementById("craneRotVal");
    const float32PrecEl  = document.getElementById("float32PrecVal");

    if (modelOriginEl) {
        modelOriginEl.textContent =
            `${UTM_EAST.toLocaleString()}, 0, ${UTM_NORTH.toLocaleString()} m`;
    }
    if (float32PrecEl) {
        float32PrecEl.textContent = FLOAT32_ULP.toFixed(3);
    }

    studio.finished();

    // --------------------------------------------------------
    // Animation loop — SDKTask runs each frame.
    //
    // We update armRoot.rotation[2] to sweep the crane jib.
    // In Z-up local space, rotation[2] is rotation around the
    // local Z axis (= "up"), so the jib sweeps horizontally.
    // The hook oscillates along the rope in local Z (height).
    //
    // The overlay shows the hook tip's world coordinates in
    // Float64: a large base value (~5,561,054) with a small
    // decimal part that changes smoothly every frame. A
    // float32-only engine could not represent adjacent positions
    // at these magnitudes without rounding to the same integer.
    // --------------------------------------------------------
    new xeokit.base.core.SDKTask({
        name:   "Animate crane",
        stage:  xeokit.base.core.SDKTask.AnimateStage,
        repeat: true,
        task: () => {
            const t   = performance.now() / 1000;
            const deg = (t * 20) % 360;              // 20°/s sweep
            const rad = deg * (Math.PI / 180);

            // Rotate the entire jib assembly around local Z (= up in Z-up space)
            armRoot.rotation = [0, 0, deg];

            // Oscillate hook — local Z (height) relative to armRoot
            const hookLocalZ = -5 + Math.sin(t * 0.85) * 3;
            hookTransform.position = [14, 0, hookLocalZ];

            // Stretch rope to follow hook
            const ropeHalfLen = Math.abs(hookLocalZ) / 2;
            ropeTransform.position = [14, 0, hookLocalZ / 2];
            ropeTransform.scale    = [0.12, 0.12, ropeHalfLen];

            // --------------------------------------------------
            // Compute hook world coordinates in Float64.
            //
            // The jib sweeps in the local XY plane (around Z=up).
            // After rotating by `deg` around local Z:
            //   local X = CRANE_X + 14 * cos(rad)   (east offset)
            //   local Y = CRANE_N + 14 * sin(rad)   (north offset)
            //   local Z = TOWER_TOP + hookLocalZ     (height)
            //
            // Identity basis + origin maps directly to Z-up world:
            //   world X = UTM_EAST  + tipLocalX   (east  — big number)
            //   world Y = UTM_NORTH + tipLocalY   (north — big number)
            //   world Z = tipLocalZ               (height — small)
            //
            // Notice: world X and Y change by fractions of a metre
            // while the integer parts are ~474,040 / ~5,561,040.
            // float32 cannot represent those fractions accurately
            // at this magnitude.
            // --------------------------------------------------
            const tipLocalX = CRANE_X + 14 * Math.cos(rad);
            const tipLocalY = CRANE_N + 14 * Math.sin(rad);
            const tipLocalZ = TOWER_TOP + hookLocalZ;

            const tipWorldX = UTM_EAST  + tipLocalX;  // east
            const tipWorldY = UTM_NORTH + tipLocalY;  // north
            const tipWorldZ = tipLocalZ;              // height

            // Update overlay
            if (cameraEyeEl) {
                const [ex, ey, ez] = view.camera.eye;
                cameraEyeEl.textContent =
                    `${ex.toFixed(1)}, ${ey.toFixed(1)}, ${ez.toFixed(1)}`;
            }
            if (cameraLookEl) {
                const [lx, ly, lz] = view.camera.look;
                cameraLookEl.textContent =
                    `${lx.toFixed(1)}, ${ly.toFixed(1)}, ${lz.toFixed(1)}`;
            }
            if (craneTipEl) {
                // Display as [east, north, height] — the two large UTM numbers
                // flanking the small height value make the precision story clear.
                craneTipEl.textContent =
                    `${tipWorldX.toFixed(3)}, ${tipWorldY.toFixed(3)}, ${tipWorldZ.toFixed(2)}`;
            }
            if (craneRotEl) {
                craneRotEl.textContent = `${deg.toFixed(1)}°`;
            }
        }
    }).schedule();
});
