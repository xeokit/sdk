export class MeshCounts {

    numMeshes: number;
    numVisibleMeshes: number;
    numTransparentMeshes: number;
    numEdgesMeshes: number;
    numXRayedMeshes: number;
    numSelectedMeshes: number;
    numHighlightedMeshes: number;
    numClippableMeshes: number;
    numPickableMeshes: number;
    numCulledMeshes: number;

    constructor() {
        this.reset();
    }

    reset() {
        this.numMeshes = 0;
        this.numVisibleMeshes = 0;
        this.numTransparentMeshes = 0;
        this.numEdgesMeshes = 0;
        this.numXRayedMeshes = 0;
        this.numSelectedMeshes = 0;
        this.numHighlightedMeshes = 0;
        this.numClippableMeshes = 0;
        this.numPickableMeshes = 0;
        this.numCulledMeshes = 0;

    }
}