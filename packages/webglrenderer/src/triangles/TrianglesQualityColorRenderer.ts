import {TrianglesRenderer} from "./TrianglesRenderer";

/**
 * @private
 */
export class TrianglesQualityColorRenderer extends TrianglesRenderer {

    getHash(): string {
        return `${this.renderContext.view.getSectionPlanesHash()}-${this.renderContext.view.getLightsHash()}`;
    }

    buildVertexShader(): string {
        return `${this.vertHeader}

            //----------------------------------------------------
            // TrianglesQualityColorRenderer Vertex Shader
            //----------------------------------------------------

            ${this.vertCommonDefs}
            ${this.vertTrianglesDataTextureDefs}
            ${this.vertSlicingDefs}
            ${this.vertTrianglesLightingDefs}
            ${this.vertLogDepthBufDefs}
            void main(void) {
                ${this.vertTriangleVertexPosition}
                ${this.vertSlicing}
                ${this.vertTrianglesLighting}
                ${this.vertLogDepthBuf}
            }`;
    }

    buildFragmentShader(): string {
        return `${this.fragHeader}

            //----------------------------------------------------
            // TrianglesQualityColorRenderer Fragment Shader
            //----------------------------------------------------

            ${this.fragSlicingDefs}
            ${this.fragTrianglesLightingDefs}
            ${this.fragLogDepthBufDefs}
            void main(void) {
                ${this.fragSlicing}
                ${this.fragTrianglesLighting}
                ${this.fragLogDepthBuf}
            }`;
    }
}
