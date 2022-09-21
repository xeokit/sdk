import {LinesBatchingColorRenderer} from "./renderers/LinesBatchingColorRenderer";
import {LinesBatchingSilhouetteRenderer} from "./renderers/LinesBatchingSilhouetteRenderer";
import {View} from "../../../../../../view";

/**
 * @private
 */
class LinesBatchingRenderers {

    #view: View;
    #colorRenderer: LinesBatchingColorRenderer;
    #silhouetteRenderer: LinesBatchingSilhouetteRenderer;

    constructor(view: View) {
        this.#view = view;
    }

    get colorRenderer(): LinesBatchingColorRenderer {
        if (!this.#colorRenderer) {
            this.#colorRenderer = new LinesBatchingColorRenderer(this.#view);
        }
        return this.#colorRenderer;
    }

    get silhouetteRenderer(): LinesBatchingSilhouetteRenderer {
        if (!this.#silhouetteRenderer) {
            this.#silhouetteRenderer = new LinesBatchingSilhouetteRenderer(this.#view);
        }
        return this.#silhouetteRenderer;
    }

    compile() {
        if (this.#colorRenderer && (!this.#colorRenderer.getValid())) {
            this.#colorRenderer.destroy();
            this.#colorRenderer = null;
        }
        if (this.#silhouetteRenderer && (!this.#silhouetteRenderer.getValid())) {
            this.#silhouetteRenderer.destroy();
            this.#silhouetteRenderer = null;
        }
    }

    destroy() {
        if (this.#colorRenderer) {
            this.#colorRenderer.destroy();
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