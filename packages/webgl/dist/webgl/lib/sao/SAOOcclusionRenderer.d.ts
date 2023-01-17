import { RenderBuffer } from "../RenderBuffer";
import { View } from "../../../viewer/index";
/**
 * SAO implementation inspired from previous SAO work in THREE.js by ludobaka / ludobaka.github.io and bhouston
 * @private
 */
export declare class SAOOcclusionRenderer {
    #private;
    constructor(view: View, gl: WebGL2RenderingContext);
    render(depthRenderBuffer: RenderBuffer): void;
    destroy(): void;
}
