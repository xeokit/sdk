import {View} from "../../viewer/index";

import {LayerRenderer} from "./LayerRenderer";
import {ColorPointsLayerRenderer} from "./ColorPointsLayerRenderer";
import {ColorTrianglesLayerRenderer} from "./ColorTrianglesLayerRenderer";

class LayerRenderers {

    #view: View;
    #gl: WebGL2RenderingContext;

    #renderers: {
        [key: string]: LayerRenderer
    }

    constructor(view: View, gl: WebGL2RenderingContext) {
        this.#view = view;
        this.#gl = gl;
    }

    get colorPointsLayerRenderer(): LayerRenderer {
        return this.getRenderer("colorPoints", ColorPointsLayerRenderer);
    }

    get colorTrianglesLayerRenderer(): LayerRenderer {
        return this.getRenderer("colorTriangles", ColorTrianglesLayerRenderer);
    }

    getRenderer(id:string, claz:any) {
        if (!this.#renderers[id]) {
            this.#renderers[id] = new claz(this.#view, this.#gl);
        }
        return this.#renderers[id];
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

const cachedRenderers: { [key: string]: LayerRenderers } = {};

/**
 * @private
 */
function getLayerRenderers(view: View): LayerRenderers {
    const viewId = view.id;
    let renderers = cachedRenderers[viewId];
    if (!renderers) {
        renderers = new LayerRenderers(view);
        cachedRenderers[viewId] = renderers;
        renderers.compile();
        view.events.on("compile", () => {
            renderers.compile();
        });
        view.events.on("destroyed", () => {
            delete cachedRenderers[viewId];
            renderers.destroy();
        });
    }
    return renderers;
}

export {getLayerRenderers};