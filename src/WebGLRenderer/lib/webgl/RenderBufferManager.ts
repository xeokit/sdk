import {RenderBuffer} from "./RenderBuffer";
import {View} from "../../../viewer/view/View";


/**
 * @private
 */
export class RenderBufferManager {

    readonly #view: View;
    readonly #gl: WebGL2RenderingContext;
    readonly #renderBuffersBasic: { [key: string]: RenderBuffer };
    readonly #renderBuffersScaled: { [key: string]: RenderBuffer };

    constructor(view: View, gl: WebGL2RenderingContext) {
        this.#view = view;
        this.#gl = gl;
        this.#renderBuffersBasic = {};
        this.#renderBuffersScaled = {};
    }

    getRenderBuffer(id: string, options?: {
        depthTexture: boolean;
        size?: number[];
    }): RenderBuffer {
        const renderBuffers = (this.#view.canvas.resolutionScale === 1.0) ? this.#renderBuffersBasic : this.#renderBuffersScaled;
        let renderBuffer = renderBuffers[id];
        if (!renderBuffer) {
            renderBuffer = new RenderBuffer(this.#view.canvas.canvas, this.#gl, options);
            renderBuffers[id] = renderBuffer;
        }
        return renderBuffer;
    }

    destroy() {
        for (let id in this.#renderBuffersBasic) {
            this.#renderBuffersBasic[id].destroy();
        }
        for (let id in this.#renderBuffersScaled) {
            this.#renderBuffersScaled[id].destroy();
        }
    }
}
