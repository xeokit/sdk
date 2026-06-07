import {ModelLoader} from "../ModelLoader";
import {parse as parse_v6} from "./versions/v6/parse";

/**
 * Loads a NIST Fire Dynamics Simulator (FDS) v6 input file into a
 * {@link model!scene.SceneModel | SceneModel} and/or a
 * {@link model!data.DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link fds | @xeokit/sdk/formats/fds}.
 */
export class FDSLoader extends ModelLoader {

  /**
   * Constructs an FDSLoader.
   */
  constructor() {
    super({
      format: "FDS",
      fileDataType: "text",
      parsers: {
        "6": parse_v6,
      },
      // FDS input files don't carry an in-band version tag. The
      // current shipping line is FDS-6.x; downstream changes to the
      // namelist are forward-compatible at the parser level.
      getVersion: (_fileData: any): string => "6",
    });
  }
}
