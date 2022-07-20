import {Map} from "./Map";

const ids = new Map({});

/**
 * @private
 */
class RenderState {
    id: number;
    constructor(cfg: { [key: string]: any; }) {
        // @ts-ignore
        this.id = ids.addItem({});
        for (const key in cfg) {
            if (cfg.hasOwnProperty(key)) {
                // @ts-ignore
                this[key] = cfg[key];
            }
        }
    }
    destroy() {
        ids.removeItem(this.id);
    }
}

export {RenderState};