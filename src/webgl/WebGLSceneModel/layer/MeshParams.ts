import {math} from "../../../viewer/index"
import {GeometryParams} from "./GeometryParams";

export interface MeshParams {
    id: string;
    aabb: math.FloatArrayType;
    origin: math.FloatArrayType;
    positionsDecodeMatrix: math.FloatArrayType;
    geometries: GeometryParams[];
}