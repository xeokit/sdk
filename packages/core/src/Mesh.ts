import type {FloatArrayParam} from "@xeokit/math/math";
import type {Geometry} from "./Geometry";
import type {TextureSet} from "./TextureSet";

export interface Mesh {
    id: string;
    geometry: Geometry;
    textureSet?: TextureSet;
    matrix: FloatArrayParam;
    color: FloatArrayParam;
    metallic: number;
    roughness: number;
    opacity: number;
}
