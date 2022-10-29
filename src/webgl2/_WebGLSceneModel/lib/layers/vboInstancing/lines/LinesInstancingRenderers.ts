import {LinesInstancingColorRenderer} from "./renderers/LinesInstancingColorRenderer";
import {LinesInstancingSilhouetteRenderer} from "./renderers/LinesInstancingSilhouetteRenderer";
import {View} from "../../../../../../viewer/view";

/**
 * @private
 */
class LinesInstancingRenderers {

    #view: View;
    #fastColorRenderer: LinesInstancingColorRenderer;
    #silhouetteRenderer: LinesInstancingSilhouetteRenderer;

    constructor(view: View) {
        this.#view = view;
    }

    get fastColorRenderer(): LinesInstancingColorRenderer {
        if (!this.#fastColorRenderer) {
            this.#fastColorRenderer = new LinesInstancingColorRenderer(this.#view, false);
        }
        return this.#fastColorRenderer;
    }

    get silhouetteRenderer(): LinesInstancingSilhouetteRenderer {
        if (!this.#silhouetteRenderer) {
            this.#silhouetteRenderer = new LinesInstancingSilhouetteRenderer(this.#view);
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

const cachedRenderers: { [key: string]: LinesInstancingRenderers } = {};

/**
 * @private
 */
export function getInstancingRenderers(view: View): LinesInstancingRenderers {
    const viewId = view.id;
    let InstancingRenderers = cachedRenderers[viewId];
    if (!InstancingRenderers) {
        InstancingRenderers = new LinesInstancingRenderers(view);
        cachedRenderers[viewId] = InstancingRenderers;
        InstancingRenderers.compile();
        view.events.on("compile", () => {
            InstancingRenderers.compile();
        });
        view.events.on("destroyed", () => {
            delete cachedRenderers[viewId];
            InstancingRenderers.destroy();
        });
    }
    return InstancingRenderers;
}