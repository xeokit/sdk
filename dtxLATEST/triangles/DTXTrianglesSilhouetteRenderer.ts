import {DTXTrianglesRenderer} from "./DTXTrianglesRenderer";

/**
 * @private
 */
export class DTXTrianglesSilhouetteRenderer extends DTXTrianglesRenderer {

    getHash(): string {
        return this.renderContext.view.getSectionPlanesHash();
    }

    buildVertexShader(): string {
        return `${this.vertHeader}

            // TrianglesSilhouetteRenderer Vertex Shader

            ${this.vertCommonDefs}
            ${this.vertTrianglesDataTextureDefs}
            ${this.vertSlicingDefs}
            ${this.vertLogDepthBufDefs}
            void main(void) {
                ${this.vertTriangleVertexPosition}
                ${this.vertSlicing}
                ${this.vertLogDepthBuf}
            }`;
    }

    buildFragmentShader(): string {
        return `${this.fragHeader}

            // TrianglesSilhouetteRenderer Fragment Shader

            ${this.fragSlicingDefs}
            ${this.fragColorDefs}
            ${this.fragLogDepthBufDefs}
            void main(void) {
                ${this.fragSlicing}
                ${this.fragColor}
                ${this.fragLogDepthBuf}
            }`;
    }
}
