import type {ModelLoadParams} from "../ModelLoadParams";
import {ModelLoader} from "../ModelLoader";
import type {ThreeDTilesLoadOptions} from "./ThreeDTilesLoadOptions";
import {parseTileset} from "./parseTileset";

/**
 * Loads a 3D Tiles `tileset.json` into a {@link model!scene.SceneModel | SceneModel}
 * and, optionally, a {@link model!data.DataModel | DataModel}.
 *
 * For detailed usage, refer to {@link threedtiles | @xeokit/sdk/formats/threedtiles}.
 */
export class ThreeDTilesLoader extends ModelLoader {
  constructor() {
    super({
      format: "3D Tiles",
      fileDataType: "json",
      parsers: {
        "1.0": parseTileset,
        "1.1": parseTileset,
      },
      getVersion: (fileData: any): string => (fileData?.asset?.version === "1.1" ? "1.1" : "1.0"),
    });
  }

  load(params: ModelLoadParams, options: ThreeDTilesLoadOptions = {}): Promise<any> {
    return super.load(params, options);
  }
}
