import {VBOBatchingLayer} from "../../VBOBatchingLayer";
import {createRTCViewMat} from "@xeokit/rtc";
import {VBOBatchingRenderer} from "../../VBOBatchingRenderer";

/**
 * @private
 */
export class VBOPointsBatchingPickMeshRenderer extends VBOBatchingRenderer {

    getHash(): string {
        const view = this.renderContext.view;
        const pointsMaterial = view.pointsMaterial;
        return `${pointsMaterial.perspectivePoints}-${pointsMaterial.filterIntensity}-${pointsMaterial.roundPoints}-${view.getSectionPlanesHash()}`;
    }

    buildVertexShader(src: string[]): void {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexBatchingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexPointsGeometryDefs(src);
        this.vertexPointsDrawDefs(src);
        this.vertexPickMainOpen(src);
        {
            this.vertexPointsFilterLogicOpenBlock(src);
            {
                this.vertexDrawPointsBatchingTransformLogic(src);
                this.vertexSlicingLogic(src);
                this.vertexDrawPointsColorsLogic(src);
                this.vertexPointsGeometryLogic(src);
            }
            this.vertexPointsFilterLogicCloseBlock(src);
        }
        this.vertexMainClose(src);
    }

    buildFragmentShader(src: string[]): void {
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentCommonDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentDrawFlatColorDefs(src);
        src.push("void main(void) {");
        {
            this.fragmentPointsGeometryLogic(src);
            this.fragmentSlicingLogic(src);
            this.fragmentDrawFlatColorLogic(src);
            this.fragmentCommonOutput(src);
        }
        src.push("}");
    }

    drawVBOBatchingLayerPrimitives(vboBatchingLayer: VBOBatchingLayer, renderPass: number): void {
        const gl = this.renderContext.gl;
        gl.drawArrays(gl.POINTS, 0, vboBatchingLayer.renderState.positionsBuf.numItems);
    }
}
