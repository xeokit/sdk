import {VBOInstancingLayer} from "../../VBOInstancingLayer";
import {VBOInstancingRenderer} from "../../VBOInstancingRenderer";
import {AmbientLight, DirLight, PointLight} from "@xeokit/viewer";

/**
 * @private
 */
export class VBOTrianglesInstancingPickMeshRenderer extends VBOInstancingRenderer {

    getHash(): string {
        return this.slicingHash;
    }

    buildVertexShader(src: string[]): void {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexInstancingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexPickMeshDefs(src);
        this.vertexPickMainOpen(src);
        {
            this.vertexPickInstancingTransformLogic(src);
            this.vertexPickMeshLogic(src);
            this.vertexSlicingLogic(src);
        }
        this.vertexMainClose(src);
    }

    buildFragmentShader(src: string[]) : void{
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentCommonDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentPickMeshDefs(src);
        src.push("void main(void) {");
        {
            this.fragmentSlicingLogic(src);
            this.fragmentPickMeshLogic(src);
            this.fragmentCommonOutput(src);
        }
        src.push("}");
    }

    drawVBOInstancingLayerPrimitives(vboInstancingLayer: VBOInstancingLayer, renderPass: number): void {
        const gl = this.renderContext.gl;
        const renderState = vboInstancingLayer.renderState;
        gl.drawElementsInstanced(gl.TRIANGLES, renderState.indicesBuf.numItems, renderState.indicesBuf.itemType, 0, renderState.numInstances);
    }
}
