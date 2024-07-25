
/**
 * @private
 */
export class MeshCounts {

    numMeshes: number;
    numVisible: number;
    numTransparent: number;
    numXRayed: number;
    numSelected: number;
    numHighlighted: number;
    numClippable: number;
    numPickable: number;
    numCulled: number;

    constructor() {
        this.reset();
    }

    reset() {
        this.numMeshes = 0;
        this.numVisible = 0;
        this.numTransparent = 0;
        this.numXRayed = 0;
        this.numSelected = 0;
        this.numHighlighted = 0;
        this.numClippable = 0;
        this.numPickable = 0;
        this.numCulled = 0;
    }
}
