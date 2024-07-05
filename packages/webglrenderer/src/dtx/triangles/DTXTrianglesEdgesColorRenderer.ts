import {DTXTrianglesRenderer} from "./DTXTrianglesRenderer";

/**
 * @private
 */
export class DTXTrianglesEdgesColorRenderer extends DTXTrianglesRenderer {

    getHash(): string {
        return `${this.renderContext.view.getSectionPlanesHash()}`;
    }

    buildVertexShader(): string {
        return `${this.vertHeader}

            // TrianglesEdgesColorRenderer Vertex Shader

            ${this.vertCommonDefs}
            ${this.vertTrianglesDataTextureDefs}
            ${this.vertSlicingDefs}
            ${this.vertLogDepthBufDefs}
            void main(void) {
                ${this.vertTriangleEdgesVertexPosition}
                ${this.vertSlicing}
                ${this.vertLogDepthBuf}
            }`;
    }

    buildFragmentShader(): string {
        return `${this.fragHeader}

            // TrianglesEdgesColorRenderer Fragment Shader

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
