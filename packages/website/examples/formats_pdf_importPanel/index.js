// Demo: PDF import panel — drag and drop a PDF onto the panel and
// it loads via a PDFLoader constructed internally, auto-frames the
// camera, and reports per-page stats.
//
// The panel constructs a PDFLoader internally; PDFLoader fetches
// pdf.js from a CDN on first use (overridable via PDFLoadOptions
// for self-hosting or pre-init injection).

import * as xeokit from "../../js/xeokit-studio-bundle.js";


const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

    // A neutral framing for an empty scene; the import panel auto-
    // refits the camera after each successful load via
    // studio.viewManager.fitToAabb.
    studio.viewManager.createView({
        id: "demoView",
        camera: {
            projection: "perspective",
            eye:  [0,    0,   1500],
            look: [0,    0,    0],
            up:   [0,    1,    0],
        },
    });

    // Open the floating import panel. Drag any PDF into the drop
    // zone (or click "Choose file…") and the panel runs each file
    // through PDFLoader into a fresh SceneModel.
    studio.panels.open("pdfImport");

    studio.finished();
});
