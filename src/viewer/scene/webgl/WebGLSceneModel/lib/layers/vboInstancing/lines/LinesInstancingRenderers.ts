import {LinesInstancingColorRenderer} from "./renderers/LinesInstancingColorRenderer";
import {LinesInstancingSilhouetteRenderer} from "./renderers/LinesInstancingSilhouetteRenderer";
import {View} from "../../../../../../../view";

/**
 * @private
 */
class LinesInstancingRenderers {

    #view: View;
    #colorRenderer: LinesInstancingColorRenderer;
    #silhouetteRenderer: LinesInstancingSilhouetteRenderer;

    constructor(view: View) {
        this.#view = view;
    }

    get colorRenderer(): LinesInstancingColorRenderer {
        if (!this.#colorRenderer) {
            this.#colorRenderer = new LinesInstancingColorRenderer(this.#view, false);
        }
        return this.#colorRenderer;
    }

    get silhouetteRenderer(): LinesInstancingSilhouetteRenderer {
        if (!this.#silhouetteRenderer) {
            this.#silhouetteRenderer = new LinesInstancingSilhouetteRenderer(this.#view);
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