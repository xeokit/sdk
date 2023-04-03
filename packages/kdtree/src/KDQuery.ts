import {KDTree} from "./KDTree";

/**
 * TODO
 */
export abstract class KDQuery {

    public kdTree: KDTree;
    public includeLayers?: string[];
    public excludeLayers?: string[];
    #dirty: boolean;

    /**
     * TODO
     */
    constructor(params: {
        kdTree: KDTree,
        includeLayers?: string[],
        excludeLayers?: string[],
    }) {
        this.kdTree = params.kdTree;
        this.kdTree.onBuilt.subscribe(() => {
            this.#dirty = true;
        })
        this.#dirty = true;
        this.reset();
    }

    reset() {
    }

    update() {
    }

}