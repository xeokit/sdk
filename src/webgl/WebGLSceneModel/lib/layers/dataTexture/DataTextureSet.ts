import {DataTexture} from "./DataTexture";
import {Program} from "../../../../lib/Program";

/**
 * Set of data textures.
 */
export class DataTextureSet {

    /**
     * Texture that holds colors/pickColors/flags/flags2 per-object:
     * - columns: one concept per column => color / pick-color / ...
     * - row: the object Id
     */
    texturePerObjectIdColorsAndFlags: DataTexture;

    /**
     * Texture that holds the XYZ offsets per-object:
     * - columns: just 1 column with the XYZ-offset
     * - row: the object Id
     */
    texturePerObjectIdOffsets: DataTexture;

    /**
     * Texture that holds the positionsDecodeMatrix per-object:
     * - columns: each column is one column of the matrix
     * - row: the object Id
     */
    texturePerObjectIdPositionsDecodeMatrix: DataTexture;

    /**
     * Texture that holds all the `different-vertices` used by the layer.
     */
    texturePerVertexIdCoordinates: DataTexture;

    /**
     * Texture that holds the PortionId that corresponds to a given polygon-id.
     *
     * Variant of the texture for 8-bit based polygon-ids.
     */
    texturePerPolygonIdPortionIds8Bits: DataTexture;

    /**
     * Texture that holds the PortionId that corresponds to a given polygon-id.
     *
     * Variant of the texture for 16-bit based polygon-ids.
     */
    texturePerPolygonIdPortionIds16Bits: DataTexture;

    /**
     * Texture that holds the PortionId that corresponds to a given polygon-id.
     *
     * Variant of the texture for 32-bit based polygon-ids.
     */
    texturePerPolygonIdPortionIds32Bits: DataTexture;

    /**
     * Texture that holds the PortionId that corresponds to a given edge-id.
     *
     * Variant of the texture for 8-bit based polygon-ids.
     */
    texturePerEdgeIdPortionIds8Bits: DataTexture;

    /**
     * Texture that holds the PortionId that corresponds to a given edge-id.
     *
     * Variant of the texture for 16-bit based polygon-ids.
     */
    texturePerEdgeIdPortionIds16Bits: DataTexture;

    /**
     * Texture that holds the PortionId that corresponds to a given edge-id.
     *
     * Variant of the texture for 32-bit based polygon-ids.
     */
    texturePerEdgeIdPortionIds32Bits: DataTexture;

    /**
     * Texture that holds the unique-vertex-indices for 8-bit based indices.
     */
    texturePerPolygonIdIndices8Bits: DataTexture;

    /**
     * Texture that holds the unique-vertex-indices for 16-bit based indices.
     */
    texturePerPolygonIdIndices16Bits: DataTexture;

    /**
     * Texture that holds the unique-vertex-indices for 32-bit based indices.
     */
    texturePerPolygonIdIndices32Bits: DataTexture;

    /**
     * Texture that holds the unique-vertex-indices for 8-bit based edge indices.
     */
    texturePerPolygonIdEdgeIndices8Bits: DataTexture;

    /**
     * Texture that holds the unique-vertex-indices for 16-bit based edge indices.
     */
    texturePerPolygonIdEdgeIndices16Bits: DataTexture;

    /**
     * Texture that holds the unique-vertex-indices for 32-bit based edge indices.
     */
    texturePerPolygonIdEdgeIndices32Bits: DataTexture;

    /**
     * Texture that holds the camera matrices
     * - columns: each column in the texture is a camera matrix column.
     * - row: each row is a different camera matrix.
     */
    textureCameraMatrices: DataTexture;

    /**
     * Texture that holds the model matrices
     * - columns: each column in the texture is a model matrix column.
     * - row: each row is a different model matrix.
     */
    textureModelMatrices: DataTexture;

    indicesPerBitnessTextures: {
        [key: number]: DataTexture
    };

    indicesPortionIdsPerBitnessTextures: {
        [key: number]: DataTexture
    };

    edgeIndicesPerBitnessTextures: {
        [key: number]: DataTexture
    };

    edgeIndicesPortionIdsPerBitnessTextures: {
        [key: number]: DataTexture
    };

    constructor() {
        this.texturePerObjectIdColorsAndFlags = null;
        this.texturePerObjectIdOffsets = null;
        this.texturePerObjectIdPositionsDecodeMatrix = null;
        this.texturePerVertexIdCoordinates = null;
        this.texturePerPolygonIdPortionIds8Bits = null;
        this.texturePerPolygonIdPortionIds16Bits = null;
        this.texturePerPolygonIdPortionIds32Bits = null;
        this.texturePerEdgeIdPortionIds8Bits = null;
        this.texturePerEdgeIdPortionIds16Bits = null;
        this.texturePerEdgeIdPortionIds32Bits = null;
        this.texturePerPolygonIdIndices8Bits = null;
        this.texturePerPolygonIdIndices16Bits = null;
        this.texturePerPolygonIdIndices32Bits = null;
        this.texturePerPolygonIdEdgeIndices8Bits = null;
        this.texturePerPolygonIdEdgeIndices16Bits = null;
        this.texturePerPolygonIdEdgeIndices32Bits = null;
        this.textureCameraMatrices = null;
        this.textureModelMatrices = null;
    }

    finalize() {

        this.indicesPerBitnessTextures = {
            8: this.texturePerPolygonIdIndices8Bits,
            16: this.texturePerPolygonIdIndices16Bits,
            32: this.texturePerPolygonIdIndices32Bits,
        };

        this.indicesPortionIdsPerBitnessTextures = {
            8: this.texturePerPolygonIdPortionIds8Bits,
            16: this.texturePerPolygonIdPortionIds16Bits,
            32: this.texturePerPolygonIdPortionIds32Bits,
        };

        this.edgeIndicesPerBitnessTextures = {
            8: this.texturePerPolygonIdEdgeIndices8Bits,
            16: this.texturePerPolygonIdEdgeIndices16Bits,
            32: this.texturePerPolygonIdEdgeIndices32Bits,
        };

        this.edgeIndicesPortionIdsPerBitnessTextures = {
            8: this.texturePerEdgeIdPortionIds8Bits,
            16: this.texturePerEdgeIdPortionIds16Bits,
            32: this.texturePerEdgeIdPortionIds32Bits,
        };
    }

    bindCommonTextures(glProgram: Program,
                       objectMatricesTextureShaderName: string,
                       vertexTextureShaderName: string,
                       objectAttributesTextureShaderName: string,
                       cameraMatricesShaderName: string,
                       modelMatricesShaderName: string,
                       objectOffsetsShaderName: string
    ) {
        this.texturePerObjectIdPositionsDecodeMatrix.bindTexture(glProgram, objectMatricesTextureShaderName, 1);
        this.texturePerVertexIdCoordinates.bindTexture(glProgram, vertexTextureShaderName, 2);
        this.texturePerObjectIdColorsAndFlags.bindTexture(glProgram, objectAttributesTextureShaderName, 3);
        this.textureCameraMatrices.bindTexture(glProgram, cameraMatricesShaderName, 4);
        this.textureModelMatrices.bindTexture(glProgram, modelMatricesShaderName, 5);
        this.texturePerObjectIdOffsets.bindTexture(glProgram, objectOffsetsShaderName, 6);
    }

    bindTriangleIndicesTextures(glProgram: Program, portionIdsShaderName: string, polygonIndicesShaderName: string, textureBitness: number) {
        this.indicesPortionIdsPerBitnessTextures[textureBitness].bindTexture(glProgram, portionIdsShaderName, 7);
        this.indicesPerBitnessTextures[textureBitness].bindTexture(glProgram, polygonIndicesShaderName, 8);
    }

    bindEdgeIndicesTextures(glProgram: Program, edgePortionIdsShaderName: string, edgeIndicesShaderName: string, textureBitness: number) {
        this.edgeIndicesPortionIdsPerBitnessTextures[textureBitness].bindTexture(glProgram, edgePortionIdsShaderName, 7);
        this.edgeIndicesPerBitnessTextures[textureBitness].bindTexture(glProgram, edgeIndicesShaderName, 8);
    }
}
