import type {FloatArrayParam} from "../math";
import type {Tile} from "./WebGLTileManager";

/**
 * @private
 */
export class LayerMeshParams {
  tile: Tile;
  pickColor: FloatArrayParam;
  rtcMatrix: FloatArrayParam;
}
