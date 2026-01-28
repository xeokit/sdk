import { VBOBatchingRenderer } from "../../VBOBatchingRenderer";
/**
 * @private
 */
export class VBOPointsBatchingSilhouetteRenderer extends VBOBatchingRenderer {
    getHash() {
        const view = this.renderContext.view;
        const pointsMaterial = view.pointsMaterial;
        return `${pointsMaterial.perspectivePoints}-${pointsMaterial.filterIntensity}-${pointsMaterial.roundPoints}-${view.getSectionPlanesHash()}`;
    }
    buildVertexShader(src) {
        this.vertexHeader(src);
        this.vertexCommonDefs(src);
        this.vertexBatchingTransformDefs(src);
        this.vertexSlicingDefs(src);
        this.vertexPointsGeometryDefs(src);
        this.vertexDrawSilhouetteDefs(src);
        this.vertexSilhouetteMainOpen(src);
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
    buildFragmentShader(src) {
        this.fragmentHeader(src);
        this.fragmentPrecisionDefs(src);
        this.fragmentCommonDefs(src);
        this.fragmentSlicingDefs(src);
        this.fragmentDrawFlatColorDefs(src);
        src.push("void main(void) {");
        {
            this.fragmentPointsGeometryLogic(src);
            this.fragmentSlicingLogic(src);
            this.fragmentDrawSilhouetteLogic(src);
            this.fragmentCommonOutput(src);
        }
        src.push("}");
    }
    drawVBOBatchingLayerPrimitives(vboBatchingLayer, renderPass) {
        const gl = this.renderContext.gl;
        gl.drawArrays(gl.POINTS, 0, vboBatchingLayer.renderState.positionsBuf.numItems);
    }
}
//# sourceMappingURL=VBOPointsBatchingSilhouetteRenderer.js.map
