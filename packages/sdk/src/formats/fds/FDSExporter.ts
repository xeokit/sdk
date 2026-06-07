import {ModelExporter} from "../ModelExporter";
import {encode as encode_v6} from "./versions/v6/encode";

/**
 * Writes an FDS-shaped {@link model!data.DataModel | DataModel}
 * back to a v6 namelist text file.
 *
 * The exporter is the inverse of {@link FDSLoader}. It walks the
 * typed FDS DataObjects produced by the loader's
 * `buildDataModel` step — `FDSProject` / `FDSSurface` / `FDSMesh` /
 * `FDSObstruction` / `FDSVent` / `FDSHole` — and reconstitutes one
 * namelist record per object. XB / IJK / MB / IOR come from the
 * `Geometry` PropertySet, every other parameter from the `FDS`
 * PropertySet (which preserves the original namelist parameters
 * verbatim), and SURF_ID from the `usesSurface` Relationship.
 *
 * The DataModel is the canonical source; the SceneModel — if
 * supplied — is not consulted by the v1 encoder. Reconstituting the
 * authored XB from hole-cut SceneMesh remainders would be lossy.
 *
 * For detailed usage, refer to {@link fds | @xeokit/sdk/formats/fds}.
 */
export class FDSExporter extends ModelExporter {

  /**
   * Constructs an FDSExporter.
   */
  constructor() {
    super({
      format: "FDS",
      fileDataType: "text",
      encoders: {
        "6": encode_v6,
      },
      defaultVersion: "6",
    });
  }
}
