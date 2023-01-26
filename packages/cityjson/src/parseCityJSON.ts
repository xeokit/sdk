import {ParseParams} from "@xeokit/core/components";

/**
 * @desc Parses CityJSON into a {@link BuildableModel}.
 *
 * Use this function with {@link Model} and {@link writeXKT} to convert CityJSON to XKT, or to load CityJSON directly
 * into a {@link Viewer}.
 *
 * ## Usage
 *
 * Parsing CityJSON into an {@link Model}:
 *
 * ````javascript
 * import {ScratchModel} from "@xeokit/xkt";
 * import {parseCityJSON} from "@xeokit/cityJSON";
 *
 * const myModel = new ScratchModel(); // Implements BuildableModel and ReadableModel
 *
 * utils.loadJSON("../assets/models/cityJSON/HousePlan/cityJSON-Binary/HousePlan.glb", async (data) => {
 *
 *     parseCityJSON({
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
 * Loading CityJSON into a {@link Viewer}, by way of a {@link ViewerModel}:
 *
 * ````javascript
 * import {Viewer} from "@xeokit/viewer";
 * import {parseCityJSON} from "@xeokit/cityJSON";
 *
 * myViewer = new Viewer({ ... });
 *
 * const myViewerModel = myViewer.createModel(); // Implements BuildableModel
 *
 * utils.loadJSON("../assets/models/cityJSON/HousePlan/cityJSON-Binary/HousePlan.glb", async (data) => {
 *
 *     parseCityJSON({
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
 * @returns {Promise} Resolves when CityJSON has been parsed.
 */
export function parseCityJSON(params: ParseParams): Promise<any> {
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
