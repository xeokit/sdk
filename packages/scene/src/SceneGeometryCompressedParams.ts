import type {FloatArrayParam} from "@xeokit/math";
import {IntArrayParam} from "@xeokit/math";


/**
 * Pre-compressed geometry creation parameters for {@link @xeokit/scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}.
 *
 * ## Summary
 *
 * * Created from {@link @xeokit/scene!SceneGeometryParams|SceneGeometryParams} using {@link @xeokit/scene!compressGeometryParams | compressGeometryParams}
 * * Used with {@link @xeokit/scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * * Generates edge indices for triangle meshes
 * * Ignores normals (our shaders auto-generate them)
 * * Quantizes positions and UVs as 16-bit unsigned integers
 */
export interface SceneGeometryCompressedParams {

    /**
     * ID for the geometry.
     */
    id: string;

    /**
     * Primitive type.
     *
     * Possible values are {@link @xeokit/constants!SolidPrimitive}, {@link @xeokit/constants!SurfacePrimitive}, {@link @xeokit/constants!LinesPrimitive}, {@link @xeokit/constants!PointsPrimitive}
     * and {@link @xeokit/constants!TrianglesPrimitive}.
     */
    primitive: number;

    /**
     * Axis-aligned, non-quantized 3D boundary of the geometry's vertex positions.
     */
    aabb?: FloatArrayParam;

    /**
     * 4x4 matrix to de-quantize the geometry's UV coordinates, when UVs are provided.
     */
    uvsDecompressMatrix?: FloatArrayParam;

    /**
     * 3D vertex positions, quantized as 16-bit integers.
     *
     * Internally, the Viewer decompresses thses
     * with {@link @xeokit/scene!SceneGeometryCompressedParams.positionsDecompressMatrix | SceneGeometryCompressedParams.positionsDecompressMatrix}.
     *
     * Vertex positions are required for all primitive types.
     */
    positionsCompressed: IntArrayParam,

    /**
     * UV coordinates, quantized as 16-bit integers.
     *
     * Internally, the Viewer de-quantizes these
     * with {@link @xeokit/scene!SceneGeometryCompressedParams.uvsDecompressMatrix | SceneGeometryCompressedParams.uvsDecompressMatrix}.
     */
    uvsCompressed?: IntArrayParam,

    /**
     * vertex RGB colors, quantized as 8-bit integers.
     */
    colorsCompressed?: IntArrayParam;

    /**
     * primitive indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
    indices?: IntArrayParam,

    /**
     * edge indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
    edgeIndices?: IntArrayParam;

    /**
     * TODO
     */
    origin?: FloatArrayParam;
}
