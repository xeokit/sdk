import {TrianglesRenderer} from "./TrianglesRenderer";

export class TrianglesFastColorRenderer extends TrianglesRenderer {

    getHash(): string {
        return `${this.renderContext.view.getSectionPlanesHash()}-${this.renderContext.view.getLightsHash()}`;
    }

    buildVertexShader(): string {
        return `${this.vertHeader}   
            ${this.vertCommonDefs}
            ${this.vertTrianglesDataTextureDefs}
            ${this.vertSlicingDefs}
            ${this.vertLightingDefs}
            ${this.vertLogDepthBufDefs}                  
            void main(void) {
                ${this.vertTriangleVertexPosition}                               
                ${this.vertSlicing}
                ${this.vertLighting}
                ${this.vertLogDepthBuf} 
            }`;
    }

    buildFragmentShader(): string {
        return `${this.fragHeader}                                    
            ${this.fragSlicingDefs} 
            ${this.fragLightingDefs}   
            ${this.fragLogDepthBufDefs} 
            void main(void) {                                                   
                ${this.fragSlicing}                                                                                      
                ${this.fragLighting}                                   
                ${this.fragLogDepthBuf}                        
            }`;
    }
}