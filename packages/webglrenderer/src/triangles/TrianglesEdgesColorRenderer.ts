import {TrianglesRenderer} from "./TrianglesRenderer";

/**
 * @private
 */
export class TrianglesEdgesColorRenderer extends TrianglesRenderer {

    getHash(): string {
        return `${this.renderContext.view.getSectionPlanesHash()}`;
    }

    buildVertexShader(): string {
        return `${this.vertHeader}   
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