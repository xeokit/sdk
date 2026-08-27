import {ModelExporter} from "../ModelExporter";
import {encode as encode_1_0} from "./versions/v1_0/encode";

/**
 * Exports a {@link model!scene.SceneModel | SceneModel} as SVG
 * (Scalable Vector Graphics) text. Triangle meshes become
 * `<polygon>` elements, line meshes become `<line>` (or
 * `<polyline>` with coalescing enabled), point meshes become
 * `<circle r="...">`. One `<g id="...">` wrapper per SceneObject.
 *
 * SVG is inherently 2D so one world axis is dropped at export
 * time; `SVGExportOptions.projectionPlane` (default `"XY"`)
 * controls which. Pairs naturally with {@link SVGLoader} for
 * round-tripping.
 *
 * For detailed usage, refer to {@link formats!svg | @xeokit/sdk/formats/svg}.
 */
export class SVGExporter extends ModelExporter {
  constructor() {
    super({
      format:         "SVG",
      fileDataType:   "text",
      encoders:       {"1.0": encode_1_0},
      defaultVersion: "1.0",
    });
  }
}
