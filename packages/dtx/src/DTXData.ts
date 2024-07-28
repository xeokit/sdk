/**
 *  DTX file data.
 *
 *  The elements of a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file, unpacked into a set of arrays for parsing.
 *
 *  This interface represents the structure of a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
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
     * Combined 8-bit indices for entire [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
     */
    indices8Bit: Uint8Array;

    /**
     * Combined 16-bit indices for entire [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
     */
    indices16Bit: Uint16Array;

    /**
     * Combined 32-bit indices for entire [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
     */
    indices32Bit: Uint32Array;

    /**
     * Combined 8-bit edge indices for entire [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
     */
    edgeIndices8Bit: Uint8Array;

    /**
     * Combined 16-bit edge indices for entire [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
     */
    edgeIndices16Bit: Uint16Array;

    /**
     * Combines 32-bit edge indices for entire [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
     */
    edgeIndices32Bit: Uint32Array;

    /**
     * Combined list of all positions dequantization matrices.
     */
    aabbs: Float32Array;

    /**
     * For each geometry bucket, a pointer to the base of its portion in {@link DTXData.positions}.
     */
    eachBucketPositionsPortion: Uint32Array;

    /**
     * For each geometry bucket, a pointer to the base of its portion in {@link DTXData.colors}.
     */
    eachBucketColorsPortion: Uint32Array;

    /**
     * For each geometry bucket, a pointer to the base of its portion in {@link DTXData.indices8Bit}, {@link DTXData.indices16Bit} or {@link DTXData.indices32Bit}.
     */
    eachBucketIndicesPortion: Uint32Array;

    /**
     * For each geometry bucket, a pointer to the base of its portion in {@link DTXData.edgeIndices8Bit}, {@link DTXData.edgeIndices16Bit} or {@link DTXData.edgeIndices32Bit}.
     */
    eachBucketEdgeIndicesPortion: Uint32Array;

    /**
     * For each geometry bucket, the number of bits used to represent primitive and edge indices - 0 == 8 bits, 1 == 16 bits, and 3 == 32 bits.
     */
    eachBucketIndicesBitness: Uint8Array;

    /**
     * For each geometry, the primitive type.
     */
    eachGeometryPrimitiveType: Uint8Array;

    /**
     * For each geometry, a pointer to its first bucket in ````DTXData.eachBucket*````.
     */
    eachGeometryBucketPortion: Uint32Array;

    /**
     * For each geometry, a pointer to an AABB.
     */
    eachGeometryAABBPortion: Uint32Array;

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
    eachMeshGeometriesPortion: Uint32Array;

    /**
     * For each mesh, a pointer to its matrix in {@link DTXData.matrices}.
     */
    eachMeshMatricesPortion: Uint32Array;

    /**
     * For each mesh, a pointer to its RTC origin in {@link DTXData.origins}.
     */
    eachMeshOriginsPortion: Uint32Array;

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
     * For each geometry, a unique ID.
     */
    eachGeometryId: string[];

    /**
     * For each mesh, a unique ID.
     */
    eachMeshId: string[];

    /**
     * For each object, a unique ID.
     */
    eachObjectId: string[];

    /**
     * For each object, a pointer to its forst mesh in DTXata.eachMesh*
     */
    eachObjectMeshesPortion: Uint32Array;
}
