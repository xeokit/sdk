import {LinesVBOBatchingColorRenderer} from "./renderers/LinesVBOBatchingColorRenderer";
import {LinesBatchingSilhouetteRenderer} from "./renderers/LinesBatchingSilhouetteRenderer";
import {View} from "../../../../../src/viewer/view";

/**
 * @private
 */
class LinesBatchingRenderers {

    #view: View;
    #fastColorRenderer: LinesVBOBatchingColorRenderer;
    #silhouetteRenderer: LinesBatchingSilhouetteRenderer;

    constructor(view: View) {
        this.#view = view;
    }

    get fastColorRenderer(): LinesVBOBatchingColorRenderer {
        if (!this.#fastColorRenderer) {
            this.#fastColorRenderer = new LinesVBOBatchingColorRenderer(this.#view, false);
        }
        return this.#fastColorRenderer;
    }

    get silhouetteRenderer(): LinesBatchingSilhouetteRenderer {
        if (!this.#silhouetteRenderer) {
            this.#silhouetteRenderer = new LinesBatchingSilhouetteRenderer(this.#view);
        }
        return this.#silhouetteRenderer;
    }

    compile() {
        if (this.#fastColorRenderer && (!this.#fastColorRenderer.getValid())) {
            this.#fastColorRenderer.destroy();
            this.#fastColorRenderer = null;
        }
        if (this.#silhouetteRenderer && (!this.#silhouetteRenderer.getValid())) {
            this.#silhouetteRenderer.destroy();
            this.#silhouetteRenderer = null;
        }
    }

    destroy() {
        if (this.#fastColorRenderer) {
            this.#fastColorRenderer.destroy();
        }
        if (this.#silhouetteRenderer) {
            this.#silhouetteRenderer.destroy();
        }
    }
}

const cachdRenderers: { [key: string]: LinesBatchingRenderers } = {};

/**
 * @private
 */
export function getBatchingRenderers(view: View): LinesBatchingRenderers {
    const viewId = view.id;
    let batchingRenderers = cachdRenderers[viewId];
    if (!batchingRenderers) {
        batchingRenderers = new LinesBatchingRenderers(view);
        cachdRenderers[viewId] = batchingRenderers;
        batchingRenderers.compile();
        view.events.on("compile", () => {
            batchingRenderers.compile();
        });
        view.events.on("destroyed", () => {
            delete cachdRenderers[viewId];
            batchingRenderers.destroy();
        });
    }
    return batchingRenderers;
}