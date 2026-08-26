// Demo: Duplex Level 1 floor plan, authored in vector PDF, loaded
// into a SceneModel with coordinates that align natively with the
// classic Duplex Apartment IFC at packages/website/models/Duplex/.
//
// Plan is drawn in PDF user-space millimetres (1 unit = 1 mm).
// Building origin is at PDF (0, 0). The SDK loader applies
// scale: 0.001, which converts mm → metres — the same units the
// Duplex IFC uses natively (see models/Duplex/coordSys.json).
// Result: the PDF's building footprint coincides with the IFC's
// floor plan in scene space.
//
// To overlay the IFC on this plan in a follow-up:
//   1. Load this PDF (here).
//   2. Load models/Duplex/xgf into the same studio, units already
//      metres and declare models/Duplex/coordSys.json on the SceneModel.
//      Duplex is Y-up, so its native XZ floor plane lands in scene XY,
//      exactly where the PDF already sits. The example below frames the
//      PDF from +Z (top-down on scene XY).

import * as xeokit from "../../../../js/xeokit-studio-bundle.js";
import {buildLevelOnePlanPdf} from "./duplexLevel1Pdf.js";

const {PDFLoader} = xeokit.formats.pdf;


const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {

    // Plan extents in scene-metres (post scale=0.001). Origin at (0,0),
    // building footprint 10.5 × 14.0 m. Camera centred on the plan
    // midpoint with a frame wide enough to include grid bubbles +
    // dimensions + title block. Looking down -Z (top-down on scene XY).
    const cx = 5.25;     // metres
    const cy = 7.0;
    studio.viewManager.createView({
        id: "demoView",
        camera: {
            projection: "perspective",
            eye:  [cx, cy, 22],
            look: [cx, cy, 0],
            up:   [0, 1, 0],
        },
    });

    const sceneModelRes = studio.scene.createModel({id: "duplexLevel1Plan"});
    if (sceneModelRes.ok === false) {
        throw new Error(`createModel failed: ${sceneModelRes.error}`);
    }
    const sceneModel = sceneModelRes.value;

    const fileData = buildLevelOnePlanPdf();

    const loader = new PDFLoader();
    const result = await loader.load(
        {fileData, sceneModel},
        {
            scale: 0.001,       // PDF user-space mm → scene-metres
            bezierSteps: 16,
            lineWidthScale: 0.6, // mm-scale paths produce big lineWidths
                                 //   without a damping factor here.
            minLineWidth: 1.0,
            renderFills: true,
            renderText: true,
            textPxPerUnit: 6,    // sharper labels for the small scene-unit
                                 //   text (most labels are ~0.2 m tall).
        },
    );

    if (result.ok === false) {
        throw new Error(`PDF import failed: ${result.error}`);
    }

    const p = result.value.pages[0];
    console.log(
        `[demo] Level 1: ${p.segmentCount} segments, ` +
        `${p.triangleCount} fill triangles, ` +
        `${p.textCount} labels`,
    );

    studio.finished();
});
