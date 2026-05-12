// import type {View} from "@xeokit/viewer";
//
// import {WebGLRenderBuffer} from "./WebGLRenderBuffer";
//
// /**
//  * @private
//  */
// export class GLRenderBufferManager {
//
//     readonly #view: View;
//     readonly #gl: WebGL2RenderingContext;
//     readonly #renderBuffersBasic: { [key: string]: WebGLRenderBuffer };
//     readonly #renderBuffersScaled: { [key: string]: WebGLRenderBuffer };
//
//     constructor(view: View, gl: WebGL2RenderingContext) {
//         this.#view = view;
//         this.#gl = gl;
//         this.#renderBuffersBasic = {};
//         this.#renderBuffersScaled = {};
//     }
//
//     getRenderBuffer(id: string, options: {
//         depthTexture: boolean;
//         size: number[];
//     }): WebGLRenderBuffer {
//         const renderBuffers = (this.#view.resolutionScale === 1.0) ? this.#renderBuffersBasic : this.#renderBuffersScaled;
//         let renderBuffer = renderBuffers[id];
//         if (!renderBuffer) {
//             renderBuffer = new WebGLRenderBuffer(this.#view.htmlElement, this.#gl, options);
//             renderBuffers[id] = renderBuffer;
//         }
//         return renderBuffer;
//     }
//
//     destroy() {
//         for (let id in this.#renderBuffersBasic) {
//             this.#renderBuffersBasic[id].destroy();
//         }
//         for (let id in this.#renderBuffersScaled) {
//             this.#renderBuffersScaled[id].destroy();
//         }
//     }
// }
