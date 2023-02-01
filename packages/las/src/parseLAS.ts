import {ParseParams} from "@xeokit/core/components";

/**
 * @desc Parses LAS into a {@link BuildableModel}.
 *
 * Use this function with {@link Model} and {@link writeXKT} to convert LAS to XKT, or to load LAS directly
 * into a {@link Viewer}.
 *
 * ## Usage
 *
 * Parsing LAS into an {@link Model}:
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/xkt";
 * import {parseLAS} from "@xeokit/las";
 *
 * const myModel = new ScratchModel(); // Implements BuildableModel and Model
 *
 * utils.loadJSON("myscan.las", async (data) => {
 *
 *     parseLAS({
 *          data,
 *          buildableModel: myModel
 *          log: (msg) => { console.log(msg); }
 *     }).then(()=>{
 *
 *        myModel.build();
 *
 *        const arrayBuffer = writeXKT({
 *            readableModel: myModel
 *        });
 *
 *        // Save arraybuffer
 *     };
 * });
 * ````
 *
 * Loading LAS into a {@link Viewer}, by way of a {@link ViewerModel}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {parseLAS} from "@xeokit/las";
 *
 * myViewer = new Viewer({ ... });
 *
 * const myViewerModel = myViewer.createModel(); // Implements BuildableModel
 *
 * utils.loadJSON("myscan.las", async (data) => {
 *
 *     parseLAS({
 *          data,
 *          buildableModel: myViewerModel,
 *          log: (msg) => { console.log(msg); }
 *     }).then(()=>{
 *        myBuildableModel.build();
 *     };
 * });
 * ````
 *
 * @param {ParseParams} params Parsing parameters.
 * @returns {Promise} Resolves when LAS has been parsed.
 */
export function parseLAS(params: ParseParams): Promise<any> {
    return new Promise<void>(function (resolve, reject) {
        if (!params.data) {
            reject("Argument expected: data");
            return;
        }
        if (!params.buildableModel) {
            reject("Argument expected: buildableModel");
            return;
        }
        resolve();
    });
}
