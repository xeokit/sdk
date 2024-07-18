import {DTXTrianglesRenderer} from "./DTXTrianglesRenderer";

/**
 * @private
 */
export class DTXTrianglesQualityColorRenderer extends DTXTrianglesRenderer {

    getHash(): string {
        return `${this.renderContext.view.getSectionPlanesHash()}-${this.renderContext.view.getLightsHash()}`;
    }

    buildVertexShader(): string {
        return `${this.vertHeader}

            // TrianglesQualityColorRenderer Vertex Shader

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

            // TrianglesQualityColorRenderer Fragment Shader

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
