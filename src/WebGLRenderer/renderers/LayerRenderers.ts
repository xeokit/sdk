import {View} from "../../viewer/index";

import {LayerRenderer} from "./LayerRenderer";
import {ColorPointsLayerRenderer} from "./ColorPointsLayerRenderer";
import {ColorTrianglesLayerRenderer} from "./ColorTrianglesLayerRenderer";

export class LayerRenderers {

    #view: View;
    #gl: WebGL2RenderingContext;

    #renderers: {
        [key: string]: LayerRenderer
    }

    constructor(view: View, gl: WebGL2RenderingContext) {
        this.#view = view;
        this.#gl = gl;
        this.#renderers.colorPointsLayerRenderer = new ColorPointsLayerRenderer(view, gl);
        this.#renderers.colorTrianglesLayerRenderer = new ColorTrianglesLayerRenderer(view, gl);
    }

    compile() {
        for (let id in this.#renderers) {
            const layerRenderer = this.#renderers[id];
            if (!layerRenderer.getValid()) {
                layerRenderer.destroy();
                delete this.#renderers[id];
            }
        }
    }

    destroy() {
        for (let id in this.#renderers) {
            const layerRenderer = this.#renderers[id];
            layerRenderer.destroy();
            delete this.#renderers[id];
        }
    }
}

//
// const cachedRenderers: { [key: string]: LayerRenderers } = {};
//
// /**
//  * @private
//  */
// function getLayerRenderers(view: View, gl: WebGL2RenderingContext): LayerRenderers {
//     const viewId = view.id;
//     let renderers = cachedRenderers[viewId];
//     if (!renderers) {
//         renderers = new LayerRenderers(view, gl);
//         cachedRenderers[viewId] = renderers;
//         renderers.compile();
//         view.events.on("compile", () => {
//             renderers.compile();
//         });
//         view.events.on("destroyed", () => {
//             delete cachedRenderers[viewId];
//             renderers.destroy();
//         });
//     }
//     return renderers;
// }
//
// export {getLayerRenderers};