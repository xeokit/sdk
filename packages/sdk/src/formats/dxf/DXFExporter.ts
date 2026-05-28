import {ModelExporter} from "../ModelExporter";
import {encode as encode_1_0} from "./versions/v1_0/encode";

/**
 * Exports a {@link model!scene.SceneModel | SceneModel} as ASCII
 * DXF text — AutoCAD R2000-compatible. Pairs naturally with
 * {@link DXFLoader} for round-tripping: lines and 3DFACEs are both
 * recognised on re-import.
 *
 * For detailed usage, refer to {@link dxf | @xeokit/sdk/formats/dxf}.
 */
export class DXFExporter extends ModelExporter {
  constructor() {
    super({
      format:         "DXF",
      fileDataType:   "text",
      encoders:       {"1.0": encode_1_0},
      defaultVersion: "1.0",
    });
  }
}
