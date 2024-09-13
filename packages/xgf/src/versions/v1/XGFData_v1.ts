
/**
 *  The elements of a [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) v1.0 file,
 *  unpacked into a set of arrays for parsing.
 *
 *  This interface represents the structure of the XGF v1.0 file format. Although this interface is used
 *  internally, we include it in the API documentation so that it can also serve as a reference to the file format.
 */
export interface XGFData_v1 {

    /**
     * Flat array containing all quantized 3D geometry vertex positions.
     *
     * These positions are quantized to 16-bit unsigned integers.
     */
    positions: Uint16Array;

    /**
     * Flat array containing all RGBA geometry vertex colors.
     *
     * Each element is in range `[0..255]`.
     */
    colors: Uint8Array;

    /**
     * Flat array containing all 32-bit geometry indices.
     */
    indices: Uint32Array;

    /**
     * Flat array cotaining all 32-bit geometry edge indices.
     */
    edgeIndices: Uint32Array;

    /**
     * Flat array containing 3D axis-aligned boundary (AABB) of each geometry's vertex positions.
     *
     * Each AABB is the double-precision axis-aligned 3D boundary
     * of its geometry's 3D vertex positions in {@link XGFData_v1.positions}.
     *
     * Each AABB has the layout `[minX, minY, minZ, maxX, maxY, maxZ]`.
     *
     * To decompress a quantized vertex `pUint` (unsigned 16-bit integers) to get `pDouble` (64-bit floats), we do this:
     *
     * ````
     * pDouble[0] = (pUint[0] * (maxX - minX) / 65535) + minX
     * pDouble[1] = (pUint[1] * (maxY - minY) / 65535) + minY
     * pDouble[2] = (pUint[2] * (maxZ - minZ) / 65535) + minZ
     * ````
     */
    aabbs: Float32Array;

    /**
     * For each geometry, a pointer to the start of its portion in {@link XGFData_v1.positions}.
     */
    eachGeometryPositionsBase: Uint32Array;

    /**
     * For each geometry, a pointer to the start of its portion in {@link XGFData_v1.colors}.
     */
    eachGeometryColorsBase: Uint32Array;

    /**
     * For each geometry, a pointer to the start of its portion in {@link XGFData_v1.indices}.
     */
    eachGeometryIndicesBase: Uint32Array;

    /**
     * For each geometry, a pointer to the start of its portion in {@link XGFData_v1.edgeIndices}.
     */
    eachGeometryEdgeIndicesBase: Uint32Array;

    /**
     * For each geometry, the primitive type.
     *
     * Supported types are:
     *
     * * 0: Triangle mesh (same as 2)
     * * 1: Solid, closed triangle mesh
     * * 2: Triangle surface (same as 0)
     * * 3: Lines
     * * 4: Points
     */
    eachGeometryPrimitiveType: Uint8Array;

    /**
     * For each geometry, a pointer to the start of its portion in `XGFData_v1.aabbs`.
     *
     * Each portion is six elements of `XGFData_v1.aabbs`, containing `[minX, minY, minZ, maxX, maxY, maxZ]`.
     *
     * Each AABB is the boundary of the geometry's unquantized, double-precision vertex positions, which is used
     * in the Viewer to decompress them from 16-bit integers to double-precision floats.
     */
    eachGeometryAABBBase: Uint32Array;

    /**
     * Flat array containing all modeling transform matrices.
     *
     * Each matrix has sixteen elements. These are 64-bit precision, and may contain huge full-precision translations that are
     * absolute and relative to the World-space origin.
     */
    matrices: Float64Array;

    /**
     * For each mesh, a pointer to the start of its portion in {@link XGFData_v1.eachGeometryPositionsBase},
     * {@link XGFData_v1.eachGeometryColorsBase}, {@link XGFData_v1.eachGeometryIndicesBase} and
     * {@link XGFData_v1.eachGeometryEdgeIndicesBase}.
     */
    eachMeshGeometriesBase: Uint32Array;

    /**
     * For each mesh, a pointer to its matrix in {@link XGFData_v1.matrices}.
     *
     * Each portion is sixteen elements, comprising a 4x4 matrix.
     */
    eachMeshMatricesBase: Uint32Array;

    /**
     * Flat array containing four material attributes for each mesh.
     *
     * The attributes for each mesh are:
     *
     * * Color R [0..255]
     * * Color G [0..255]
     * * Color B [0..255]
     * * Opacity [0..255]
     */
    eachMeshMaterialAttributes: Uint8Array;

    /**
     * For each object, a unique string ID.
     */
    eachObjectId: string[];

    /**
     * For each object, a pointer to its first mesh in {@link XGFData_v1.eachMeshGeometriesBase},
     * {@link XGFData_v1.eachMeshMatricesBase} and {@link XGFData_v1.eachMeshMaterialAttributes}.
     */
    eachObjectMeshesBase: Uint32Array;
}
