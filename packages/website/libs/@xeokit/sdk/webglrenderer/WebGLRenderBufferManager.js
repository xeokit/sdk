import { WebGLRenderBuffer } from "../webglutils";
/**
 * @private
 */
export class WebGLRenderBufferManager {
    #gl;
    #view;
    #renderBuffersBasic;
    #renderBuffersScaled;
    #webglCanvas;
    constructor(gl, webglCanvas) {
        this.#gl = gl;
        //   this.#view = view;
        this.#webglCanvas = webglCanvas;
        this.#renderBuffersBasic = {};
        this.#renderBuffersScaled = {};
    }
    getRenderBuffer(id, options) {
        //    const renderBuffers = this.#view.resolutionScale.enabled ? this.#renderBuffersBasic : this.#renderBuffersScaled;
        const renderBuffers = this.#renderBuffersBasic;
        let renderBuffer = renderBuffers[id];
        if (!renderBuffer) {
            renderBuffer = new WebGLRenderBuffer(this.#webglCanvas, this.#gl, options);
            renderBuffers[id] = renderBuffer;
        }
        else {
            if (options && options.size) {
                renderBuffer.setSize(options.size);
            }
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
//# sourceMappingURL=WebGLRenderBufferManager.js.map