import {DTXTrianglesRenderer} from "./DTXTrianglesRenderer";

/**
 * @private
 */
export class DTXTrianglesFastColorRenderer extends DTXTrianglesRenderer {

    getHash(): string {
        return `${this.renderContext.view.getSectionPlanesHash()}-${this.renderContext.view.getLightsHash()}`;
    }

    buildVertexShader(): string {
        return `${this.vertHeader}
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
