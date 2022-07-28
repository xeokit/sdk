import {FloatArrayType, IntArrayType} from "../math/math";

/**
 * Mesh creation parameters for {@link SceneModel.createMesh}.
 */
export interface MeshCfg {
    id?: string;
    textureSetId?: string;
    geometryId?: string;
    primitive?: string;
    color?: FloatArrayType;
    opacity?: number;
    metallic?: number;
    roughness?: number;
    origin?: FloatArrayType;
    positions?: FloatArrayType;
    positionsCompressed?: FloatArrayType;
    positionsDecompressMatrix?: FloatArrayType;
    normals?: FloatArrayType;
    normalsCompressed?: FloatArrayType;
    uvs?: FloatArrayType;
    uvsCompressed?: FloatArrayType;
    uvsDecompressMatrix?: FloatArrayType;
    colors?: FloatArrayType;
    colorsCompressed?: FloatArrayType;
    indices?: IntArrayType;
    edgeIndices?: IntArrayType;
    edgeThreshold?: number;
    position?: FloatArrayType;
    scale?: FloatArrayType;
    quaternion?: FloatArrayType;
    rotation?: FloatArrayType;
    matrix?: FloatArrayType;
}