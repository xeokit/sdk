import { RenderBuffer } from "./RenderBuffer";
import type { View } from "../../viewer/view/View";
/**
 * @private
 */
export declare class RenderBufferManager {
    #private;
    constructor(view: View, gl: WebGL2RenderingContext);
    getRenderBuffer(id: string, options: {
        depthTexture: boolean;
        size: number[];
    }): RenderBuffer;
    destroy(): void;
}
