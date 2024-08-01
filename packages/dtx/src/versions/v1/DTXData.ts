
/**
 *  DTX file data.
 *
 *  The elements of a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file, unpacked into a set of arrays for parsing.
 *
 *  This interface represents the structure of a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
 *  @private
 */
export interface DTXData {

    /**
     * Combined vertex positions array for entire [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
     */
    positions: Uint16Array;

    /**
     * Combined vertex colors array for entire [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
     */
    colors: Uint8Array;

    /**
     * Combined 32-bit indices for entire [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
     */
    indices: Uint32Array;

    /**
     * Combines 32-bit edge indices for entire [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
     */
    edgeIndices: Uint32Array;

    /**
     * Combined list of all positions dequantization matrices.
     */
    aabbs: Float32Array;

    /**
     * For each geometry, a pointer to the base of its portion in {@link DTXData.positions}.
     */
    eachGeometryPositionsBase: Uint32Array;

    /**
     * For each geometry, a pointer to the base of its portion in {@link DTXData.colors}.
     */
    eachGeometryColorsBase: Uint32Array;

    /**
     * For each geometry, a pointer to the base of its portion in {@link DTXData.indices}.
     */
    eachGeometryIndicesBase: Uint32Array;

    /**
     * For each geometry, a pointer to the base of its portion in {@link DTXData.edgeIndices}.
     */
    eachGeometryEdgeIndicesBase: Uint32Array;

    /**
     * For each geometry, the primitive type.
     */
    eachGeometryPrimitiveType: Uint8Array;

    /**
     * For each geometry, a pointer to an AABB.
     */
    eachGeometryAABBBase: Uint32Array;

    /**
     * Combined list of all modeling transform matrices in this [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
     */
    matrices: Float32Array;

    /**
     * Combined list of all RTC coordinate origins in this [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
     */
    origins: Float64Array;

    /**
     * For each mesh, a pointer to its portion of geometries in ````DTXData.eachGeometry*````
     */
    eachMeshGeometriesBase: Uint32Array;

    /**
     * For each mesh, a pointer to its matrix in {@link DTXData.matrices}.
     */
    eachMeshMatricesBase: Uint32Array;

    /**
     * For each mesh, a pointer to its RTC origin in {@link DTXData.origins}.
     */
    eachMeshOriginsBase: Uint32Array;

    /**
     * For each mesh, a set of sixe material attribute values.
     *
     * The attributes for each mesh are:
     *
     * * Color R [0..255]
     * * Color G [0..255]
     * * Color B [0..255]
     * * Opacity [0..255]
     * * Metallic [0..255]
     * * Roughness [0..255]
     */
    eachMeshMaterialAttributes: Uint8Array;

    /**
     * For each object, a unique ID.
     */
    eachObjectId: string[];

    /**
     * For each object, a pointer to its forst mesh in DTXata.eachMesh*
     */
    eachObjectMeshesBase: Uint32Array;
}
