/**
 * @private
 */
export class MeshCounts {
    numMeshes;
    numVisible;
    numTransparent;
    numXRayed;
    numSelected;
    numHighlighted;
    numClippable;
    numPickable;
    numCulled;
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
//# sourceMappingURL=MeshCounts.js.map