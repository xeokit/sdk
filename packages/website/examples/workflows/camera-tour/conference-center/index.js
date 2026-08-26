import * as presentations from "../../../../libs/presentations/dist/index.js";
// Generates and plays an automatic room-by-room camera walkthrough of the OTC
// Conference Center model.

import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const {
    planCameraTour,
    playCameraTour,
    extractSpacesFromGeometry,
} = presentations.cameraTour;

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

    const {scene, data} = studio;
    const infoEl = document.getElementById("info");

    // Initial camera framing — `planCameraTour` overrides
    // eye/look/up immediately on first waypoint enter, so the
    // exact values don't matter beyond "not pointing at the void
    // for the first paint". The wide 100° FOV (vs xeokit's 60°
    // default) DOES stay throughout playback — pushes into
    // wide-angle territory so cramped interiors read with the
    // scope of a real walkthrough rather than the keyhole feel
    // of a tighter lens.
    const view = studio.viewManager.createView({
        id: "walkthroughView",
        camera: {
            eye:  [24.40, 23.70, 27.04],
            look: [4.39, 8.90, 2.54],
            up:   [-0.56, -0.41, 0.71],
            perspectiveProjection: {
                fov: 100,
            },
        },
    });

    // NOTE: `OTCConferenceCenter/datamodel/model.json` is a
    // mislabeled SceneModel-shaped JSON (carries
    // `geometriesCompressed` instead of IFC entities), so loading
    // it as `format: "datamodel"` populates an empty DataModel and
    // the IFC extractor finds zero IfcSpaces. Duplex's
    // `datamodel/model.json` is the real deal — 21 IfcSpace + 14
    // IfcDoor + 61 IfcFurnishingElement, IFC4-tagged.
    const MODEL_ID   = "Duplex";
    const MODEL_BASE = "../../../../models/OTCConferenceCenter";

    const sceneModelRes = scene.createModel({
        id: MODEL_ID,
        coordinateSystem: {
            basis: [
                1, 0, 0, // Right
                0, 1, 0, // Up
                0, 0, 1  // Forward
            ],
            origin: [0, 0, 0],
            units: "meters",
            scaleToMeters: 1,
        },
    });
    if (!sceneModelRes.ok) throw new Error(sceneModelRes.error);
    const sceneModel = sceneModelRes.value;

    const dataModelRes = data.createModel({id: MODEL_ID});
    if (!dataModelRes.ok) throw new Error(dataModelRes.error);
    const dataModel = dataModelRes.value;

    // Load semantics + geometry in parallel — they target different
    // models and don't share state during the load, so awaiting
    // them concurrently halves the wall-clock load time vs. a
    // serial fetch chain.
    //
    // `studio.loadModel` resolves the right loader (DataModelParamsLoader
    // for "datamodel", XGFLoader for "xgf") from the format tag.
    Promise.all([
        studio.loadModel({
            id:     MODEL_ID,
            src:    `${MODEL_BASE}/datamodel/model.json`,
            format: "datamodel",
            dataModel,
        }),
        studio.loadModel({
            id:     MODEL_ID,
            src:    `${MODEL_BASE}/xgf/model.xgf`,
            format: "xgf",
            sceneModel,
        }),
    ])
        .then(async () => {

            infoEl.innerHTML = "Planning camera tour…";

            // Plan the tour. Defaults target metre-scale AECO
            // walkthroughs — eyeHeight 1.7 m, wallClearance 0.4 m,
            // 8 viewpoint candidates per room scored with 64 rays.
            // Dwells lengthened slightly so the demo lingers on
            // each room.
            const baseOptions = {
                dwellMs:          2500,
                flightDurationMs: 2000,
                onProgress: (stage, t) => {
                    infoEl.innerHTML =
                        `<b>Planning</b> · ${stage} ${(t * 100).toFixed(0)}%`;
                },
            };

            // Try the IFC extractor first — it gives one room per
            // IfcSpace with the room's proper label.
            let tourRes = await planCameraTour({
                sceneModel,
                dataModel,
                options: baseOptions,
            });

            // Web-ifc's StreamAllMeshes filters IfcSpace geometry by
            // default, so IfcSpaces land in the DataModel but lack
            // matching SceneObjects → the IFC extractor can't read
            // their AABBs and returns an empty graph. Detect that
            // and retry with the geometry-fallback extractor, which
            // flood-fills rooms out of the wall geometry directly.
            if (tourRes.ok === false &&
                /Extractor returned no spaces/.test(tourRes.error)) {
                infoEl.innerHTML =
                    `<span class="muted">No IfcSpace geometry — ` +
                    `retrying with geometry fallback…</span>`;
                tourRes = await planCameraTour({
                    sceneModel,
                    extractor: extractSpacesFromGeometry,
                    options: baseOptions,
                });
            }

            if (tourRes.ok === false) {
                infoEl.innerHTML =
                    `<span class="fail">planCameraTour failed:</span><br>${tourRes.error}`;
                throw new Error(tourRes.error);
            }
            const tour = tourRes.value;

            // In-space waypoints are the ones the planner emitted
            // per room; portal-transit waypoints (inserted by the
            // smoother) carry no spaceId and don't count as
            // "rooms visited".
            const roomWaypoints = tour.waypoints.filter(w => w.spaceId !== undefined);
            const durSec = (tour.estimatedDurationMs / 1000).toFixed(1);

            infoEl.innerHTML =
                `<b>Tour ready</b> · ${roomWaypoints.length} rooms · ${durSec}s<br>` +
                `<span class="muted">Starting…</span>`;

            // Play. Each onWaypointEnter updates the HUD with the
            // current room's IfcSpace label and progress; transit
            // waypoints (no spaceId) keep the previous room shown.
            let visited = 0;
            const playRes = playCameraTour(view, tour, {
                onWaypointEnter: (waypoint, index) => {
                    if (!waypoint.spaceId) return;   // portal transit
                    visited++;
                    const label = waypoint.label ?? `Space ${index}`;
                    infoEl.innerHTML =
                        `<span class="room">${escapeHtml(label)}</span><br>` +
                        `<span class="muted">Room ${visited} of ${roomWaypoints.length} ` +
                        `· waypoint ${index + 1} / ${tour.waypoints.length}</span>`;
                },
                onFinish: () => {
                    infoEl.innerHTML =
                        `<b>Tour complete</b> · ${roomWaypoints.length} rooms visited ` +
                        `in ${durSec}s`;
                },
            });
            if (playRes.ok === false) {
                infoEl.innerHTML =
                    `<span class="fail">playCameraTour failed:</span><br>${playRes.error}`;
                throw new Error(playRes.error);
            }

            studio.finished();
        })
        .catch(err => {
            infoEl.innerHTML = `<span class="fail">Failed: ${escapeHtml(String(err))}</span>`;
            console.error(err);
        });
});

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;",
    })[c]);
}
