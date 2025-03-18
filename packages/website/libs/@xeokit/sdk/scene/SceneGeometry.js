import { createAABB3 } from "../boundaries";
/**
 * A geometry in a {@link scene!SceneModel | SceneModel}.
 *
 * * Contains triangles, lines or points
 * * Stored in {@link scene!SceneModel.geometries | SceneModel.geometries}
 * * Created with {@link scene!SceneModel.createGeometry | SceneModel.createGeometry}
 * or {@link scene!SceneModel.createGeometryCompressed | SceneModel.createGeometryCompressed}
 * * Referenced by {@link scene!SceneMesh.geometry | SceneMesh.geometry}
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneGeometry {
    /**
     * ID for the geometry.
     */
    id;
    /**
     * Primitive type.
     *
     * Possible values are {@link constants!SolidPrimitive}, {@link constants!SurfacePrimitive},
     * {@link constants!LinesPrimitive}, {@link constants!PointsPrimitive}
     * and {@link constants!TrianglesPrimitive}.
     */
    primitive;
    /**
     * Axis-aligned, non-quantized 3D boundary of the geometry's vertex positions.
     */
    aabb;
    /**
     * 4x4 matrix to de-quantize the geometry's UV coordinates, when UVs are provided.
     */
    uvsDecompressMatrix;
    /**
     * 3D vertex positions, quantized as 16-bit integers.
     *
     * Internally, the Viewer dequantizes these with {@link scene!SceneGeometry.positionsDecompressMatrix | SceneGeometry.positionsDecompressMatrix}.
     *
     * Vertex positions are required for all primitive types.
     */
    positionsCompressed;
    /**
     * UV coordinates, quantized as 16-bit integers.
     *
     * Internally, the Viewer de-quantizes these with {@link scene!SceneGeometry.uvsDecompressMatrix | SceneGeometry.uvsDecompressMatrix}.
     */
    uvsCompressed;
    /**
     * Vertex RGB colors, quantized as 8-bit integers.
     */
    colorsCompressed;
    /**
     * primitive indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
    indices;
    /**
     * Edge indices.
     *
     * This is either an array of 8-bit, 16-bit or 32-bit values.
     */
    edgeIndices;
    /**
     * Interface through which this SceneGeometry can load any user-updated geometry arrays into the renderers.
     *
     * @internal
     */
    rendererGeometry;
    /**
     * TODO
     */
    origin;
    /**
     * The count of {@link scene!SceneMesh | SceneMeshes} that reference this SceneGeometry.
     */
    numMeshes;
    constructor(params) {
        this.id = params.id;
        this.primitive = params.primitive;
        this.positionsCompressed = params.positionsCompressed;
        this.uvsCompressed = params.uvsCompressed;
        this.colorsCompressed = params.colorsCompressed;
        this.indices = params.indices;
        this.edgeIndices = params.edgeIndices;
        this.origin = params.origin;
        this.aabb = params.aabb ? params.aabb.slice() : createAABB3();
        this.numMeshes = 0;
    }
    /**
     * Gets this SceneGeometry as JSON.
     */
    getJSON() {
        const params = {
            id: this.id,
            primitive: this.primitive,
            aabb: Array.from(this.aabb),
            positionsCompressed: Array.from(this.positionsCompressed)
        };
        if (this.positionsCompressed) {
            params.positionsCompressed = Array.from(this.positionsCompressed);
        }
        if (this.uvsCompressed) {
            params.uvsCompressed = Array.from(this.uvsCompressed);
        }
        if (this.colorsCompressed) {
            params.colorsCompressed = Array.from(this.colorsCompressed);
        }
        if (this.indices) {
            params.indices = Array.from(this.indices);
        }
        if (this.edgeIndices) {
            params.edgeIndices = Array.from(this.edgeIndices);
        }
        return params;
    }
}
//# sourceMappingURL=SceneGeometry.js.map