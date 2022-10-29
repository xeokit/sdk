import {DataTexture} from "./DataTexture";
import {Program} from "../../../lib/webgl/Program";

export class DataTextureSet {

    cameraMatrices: DataTexture;
    sceneModelMatrices: DataTexture;

    positions: DataTexture;

    indices_8Bits: DataTexture;
    indices_16Bits: DataTexture;
    indices_32Bits: DataTexture;

    edgeIndices_8Bits: DataTexture;
    edgeIndices_16Bits: DataTexture;
    edgeIndices_32Bits: DataTexture;

    indices: { [key: number]: DataTexture };
    edgeIndices: { [key: number]: DataTexture };

    eachMeshAttributes: DataTexture;
    eachMeshMatrices: DataTexture;

    eachEdgeOffset: DataTexture;

    eachTriangleMesh_8Bits: DataTexture;
    eachTriangleMesh_16Bits: DataTexture;
    eachTriangleMesh_32Bits: DataTexture;
    eachTriangleMesh: { [key: number]: DataTexture };

    eachEdgeMesh_8Bits: DataTexture;
    eachEdgeMesh_16Bits: DataTexture;
    eachEdgeMesh_32Bits: DataTexture;
    eachEdgeMesh: { [key: number]: DataTexture };

    #finalized: boolean;

    constructor() {

        this.cameraMatrices = null;
        this.sceneModelMatrices = null;

        this.positions = null;

        this.indices_8Bits = null;
        this.indices_16Bits = null;
        this.indices_32Bits = null;

        this.edgeIndices_8Bits = null;
        this.edgeIndices_16Bits = null;
        this.edgeIndices_32Bits = null;

        this.eachMeshAttributes = null;
        this.eachMeshMatrices = null;

        this.eachTriangleMesh_8Bits = null;
        this.eachTriangleMesh_16Bits = null;
        this.eachTriangleMesh_32Bits = null;

        this.eachEdgeMesh_8Bits = null;
        this.eachEdgeMesh_16Bits = null;
        this.eachEdgeMesh_32Bits = null;

        this.eachEdgeOffset = null; // ?

        this.#finalized = false;
    }

    finalize() {
        this.indices = {
            8: this.indices_8Bits,
            16: this.indices_16Bits,
            32: this.indices_32Bits,
        };
        this.eachTriangleMesh = {
            8: this.eachTriangleMesh_8Bits,
            16: this.eachTriangleMesh_16Bits,
            32: this.eachTriangleMesh_32Bits,
        };
        this.edgeIndices = {
            8: this.edgeIndices_8Bits,
            16: this.edgeIndices_16Bits,
            32: this.edgeIndices_32Bits,
        };
        this.eachEdgeMesh = {
            8: this.eachEdgeMesh_8Bits,
            16: this.eachEdgeMesh_16Bits,
            32: this.eachEdgeMesh_32Bits,
        };
        this.#finalized = true;
    }

    bindCommonTextures(glProgram: Program,
                       objectMatricesTextureShaderName: string,
                       vertexTextureShaderName: string,
                       objectAttributesTextureShaderName: string,
                       cameraMatricesShaderName: string,
                       modelMatricesShaderName: string,
                       objectOffsetsShaderName: string
    ) {
        this.cameraMatrices.bindTexture(glProgram, cameraMatricesShaderName, 4);
        this.sceneModelMatrices.bindTexture(glProgram, modelMatricesShaderName, 5);

        this.positions.bindTexture(glProgram, vertexTextureShaderName, 2);

        this.eachMeshMatrices.bindTexture(glProgram, objectMatricesTextureShaderName, 1);
        this.eachMeshAttributes.bindTexture(glProgram, objectAttributesTextureShaderName, 3);
        this.eachEdgeOffset.bindTexture(glProgram, objectOffsetsShaderName, 6);
    }

    bindTrianglesTextures(glProgram: Program, portionIdsShaderName: string, polygonIndicesShaderName: string, bitLength: number) {
        this.eachTriangleMesh[bitLength].bindTexture(glProgram, portionIdsShaderName, 7);
        this.indices[bitLength].bindTexture(glProgram, polygonIndicesShaderName, 8);
    }

    bindEdgesTextures(glProgram: Program, edgePortionIdsShaderName: string, edgeIndicesShaderName: string, bitLength: number) {
        this.eachEdgeMesh[bitLength].bindTexture(glProgram, edgePortionIdsShaderName, 7);
        this.edgeIndices[bitLength].bindTexture(glProgram, edgeIndicesShaderName, 8);
    }

    destroy() {

        this.cameraMatrices.destroy();
        this.sceneModelMatrices.destroy();

        this.positions.destroy();

        this.indices_8Bits.destroy();
        this.indices_16Bits.destroy();
        this.indices_32Bits.destroy();

        this.edgeIndices_8Bits.destroy();
        this.edgeIndices_16Bits.destroy();
        this.edgeIndices_32Bits.destroy();

        this.eachMeshMatrices.destroy();
        this.eachMeshAttributes.destroy();
        this.eachEdgeOffset.destroy();

        this.eachTriangleMesh_8Bits.destroy();
        this.eachTriangleMesh_16Bits.destroy();
        this.eachTriangleMesh_32Bits.destroy();

        this.eachEdgeMesh_8Bits.destroy();
        this.eachEdgeMesh_16Bits.destroy();
        this.eachEdgeMesh_32Bits.destroy();
    }
}
