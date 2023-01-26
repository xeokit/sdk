import { RenderBuffer } from "../RenderBuffer";
import { View } from "../../../viewer/index";
/**
 * SAO implementation inspired from previous SAO work in THREE.js by ludobaka / ludobaka.github.io and bhouston
 */
export declare class SAODepthLimitedBlurRenderer {
    #private;
    constructor(view: View, gl: WebGL2RenderingContext);
    render(depthRenderBuffer: RenderBuffer, occlusionRenderBuffer: RenderBuffer, direction: number): void;
    destroy(): void;
}
