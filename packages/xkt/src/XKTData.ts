/**
 *  XKT file data.
 *
 *  The elements of an [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file, unpacked into a set of arrays for parsing.
 *
 *  This interface represents the structure of an [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
 */
export interface XKTData {

    /**
     * Arbitrary metadata JSON for the [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
     */
    metadata: {};

    /**
     * Combined data for all textures in the [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
     */
    textureData: Uint8Array;

    /**
     * For each texture, a pointer to its portion in {@link XKTData.textureData}.
     */
    eachTextureDataPortion: Uint32Array;

    /**
     * For each texture, a set of attributes.
     *
     * The attributes for each texture are:
     *
     * * Texture compressed? - 0 (no) or 1 (yes)
     * * {@link @xeokit/scene!Texture.mediaType}
     * * {@link @xeokit/scene!Texture.width}
     * * {@link @xeokit/scene!Texture.height}
     * * {@link @xeokit/scene!Texture.minFilter}
     * * {@link @xeokit/scene!Texture.magFilter}
     * * {@link @xeokit/scene!Texture.wrapS}
     * * {@link @xeokit/scene!Texture.wrapT}
     * * {@link @xeokit/scene!Texture.wrapR}
     */
    eachTextureAttributes: Uint16Array;

    /**
     * Combined vertex positions array for entire [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
     */
    positions: Uint16Array;

    /**
     * Combined vertex colors array for entire [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
     */
    colors: Uint8Array;

    /**
     * Combined vertex UV coordinates for entire [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
     */
    uvs: Float32Array;

    /**
     * Combined 8-bit indices for entire [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
     */
    indices8Bit: Uint8Array;

    /**
     * Combined 16-bit indices for entire [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
     */
    indices16Bit: Uint16Array;

    /**
     * Combined 32-bit indices for entire [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
     */
    indices32Bit: Uint32Array;

    /**
     * Combined 8-bit edge indices for entire [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
     */
    edgeIndices8Bit: Uint8Array;

    /**
     * Combined 16-bit edge indices for entire [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
     */
    edgeIndices16Bit: Uint16Array;

    /**
     * Combines 32-bit edge indices for entire [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
     */
    edgeIndices32Bit: Uint32Array;

    /**
     * For each texture set, a set of pointers into eachTextureDataPortion.
     */
    eachTextureSetTextures: Int32Array;

    /**
     * Combined list of all positions dequantization matrices.
     */
    decodeMatrices: Float32Array;

    /**
     * For each geometry bucket, a pointer to the base of its portion in {@link XKTData.positions}.
     */
    eachBucketPositionsPortion: Uint32Array;

    /**
     * For each geometry bucket, a pointer to the base of its portion in {@link XKTData.colors}.
     */
    eachBucketColorsPortion: Uint32Array;

    /**
     * For each geometry bucket, a pointer to the base of its portion in {@link XKTData.uvs}.
     */
    eachBucketUVsPortion: Uint32Array;

    /**
     * For each geometry bucket, a pointer to the base of its portion in {@link XKTData.indices8Bit}, {@link XKTData.indices16Bit} or {@link XKTData.indices32Bit}.
     */
    eachBucketIndicesPortion: Uint32Array;

    /**
     * For each geometry bucket, a pointer to the base of its portion in {@link XKTData.edgeIndices8Bit}, {@link XKTData.edgeIndices16Bit} or {@link XKTData.edgeIndices32Bit}.
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
     * For each geometry, a pointer to its first bucket in ````XKTData.eachBucket*````.
     */
    eachGeometryBucketPortion: Uint32Array;

    /**
     * For each geometry, a pointer to a positions dequantization matrix.
     */
    eachGeometryDecodeMatricesPortion: Uint32Array;

    /**
     * Combined list of all modeling transform matrices in this [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file.
     */
    matrices: Float32Array;

    /**
     * For each mesh, a pointer to its portion of geometries in ````XKTData.eachGeometry*````
     */
    eachMeshGeometriesPortion: Uint32Array;

    /**
     * For each mesh, a pointer to its matrix in {@link XKTData.matrices}.
     */
    eachMeshMatricesPortion: Uint32Array;

    /**
     * For each mesh, a pointer to its texture set in {@link XKTData.textureSets}.
     */
    eachMeshTextureSet: Int32Array; // Allow -1 values, to indicate no TextureSet

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
     * For each object, a pointer to its forst mesh in XKTata.eachMesh*
     */
    eachObjectMeshesPortion: Uint32Array;
}