import {View} from "@xeokit/viewer";

import {GLRenderBuffer} from "./GLRenderBuffer";

/**
 * @private
 */
export class GLRenderBufferManager {

    readonly #view: View;
    readonly #gl: WebGL2RenderingContext;
    readonly #renderBuffersBasic: { [key: string]: GLRenderBuffer };
    readonly #renderBuffersScaled: { [key: string]: GLRenderBuffer };

    constructor(view: View, gl: WebGL2RenderingContext) {
        this.#view = view;
        this.#gl = gl;
        this.#renderBuffersBasic = {};
        this.#renderBuffersScaled = {};
    }

    getRenderBuffer(id: string, options: {
        depthTexture: boolean;
        size: number[];
    }): GLRenderBuffer {
        const renderBuffers = (this.#view.resolutionScale === 1.0) ? this.#renderBuffersBasic : this.#renderBuffersScaled;
        let renderBuffer = renderBuffers[id];
        if (!renderBuffer) {
            renderBuffer = new GLRenderBuffer(this.#view.canvasElement, this.#gl, options);
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
