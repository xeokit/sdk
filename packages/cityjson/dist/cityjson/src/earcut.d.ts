/** @private */
export function earcut(data: any, holeIndices: any, dim: any): any[];
export namespace earcut {
    function deviation(data: any, holeIndices: any, dim: any, triangles: any): number;
    function flatten(data: any): {
        vertices: any[];
        holes: any[];
        dimensions: any;
    };
}
