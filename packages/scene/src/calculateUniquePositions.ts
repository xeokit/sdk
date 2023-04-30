/**
 * @author https://github.com/tmarti, with support from https://tribia.com/
 * @license MIT
 *
 * This file takes a geometry given by { positions, indices }, and returns
 * equivalent { positions, indices } arrays but which only contain unique
 * positions.
 *
 * The time is O(N logN) with the number of positions due to a pre-sorting
 * step, but is much more GC-friendly and actually faster than the classic O(N)
 * approach based in keeping a hash-based LUT to identify unique positions.
 */

let comparePositions: any = null;


/**
 * This function obtains unique positions in the provided object
 * .positions array and calculates an index mapping, which is then
 * applied to the provided object .indices and .edgeindices.
 *
 * The input object items are not modified, and instead new set
 * of positions, indices and edgeIndices with the applied optimization
 * are returned.
 *
 * The algorithm, instead of being based in a hash-like LUT for
 * identifying unique positions, is based in pre-sorting the input
 * positions...
 *
 * (it's possible to define a _"consistent ordering"_ for the positions
 *  as positions are quantized and thus not suffer from float number
 *  comparison artifacts)
 *
 * ... so same positions are adjacent in the sorted array, and then
 * it's easy to scan linearly the sorted array. During the linear run,
 * we will know that we found a different position because the comparison
 * function will return != 0 between current and previous element.
 *
 * During this linear traversal of the array, a `unique counter` is used
 * in order to calculate the mapping between original indices and unique
 * indices.
 *
 * @param {*} mesh The input mesh to process, with `positions`, `indices` and `edgeIndices` keys.
 * @private
 * @returns An array with 3 elements: 0 => the uniquified positions; 1 and 2 => the remapped edges and edgeIndices arrays
 */
export function uniquifyPositions(mesh: any): [Uint16Array, Uint32Array, Uint32Array | undefined] {

    let positionsCompressed = mesh.positionsCompressed;
    let indices = mesh.indices;
    let edgeIndices = mesh.edgeIndices;

    setMaxNumberOfPositions(positionsCompressed.length / 3);

    let seq = seqInit.slice(0, positionsCompressed.length / 3);
    let remappings = seqInit.slice(0, positionsCompressed.length / 3);

    comparePositions = positionsCompressed;

    seq.sort(compareVertex);

    let uniqueIdx = 0

    remappings[seq[0]] = 0;

    for (let i = 1, len = seq.length; i < len; i++) {
        if (0 != compareVertex(seq[i], seq[i - 1])) {
            uniqueIdx++;
        }

        remappings[seq[i]] = uniqueIdx;
    }

    const numUniquePositions = uniqueIdx + 1;

    const uniquePositionsCompressed = new Uint16Array(numUniquePositions * 3);

    uniqueIdx = 0

    uniquePositionsCompressed [uniqueIdx * 3 + 0] = positionsCompressed [seq[0] * 3 + 0];
    uniquePositionsCompressed [uniqueIdx * 3 + 1] = positionsCompressed [seq[0] * 3 + 1];
    uniquePositionsCompressed [uniqueIdx * 3 + 2] = positionsCompressed [seq[0] * 3 + 2];

    for (let i = 1, len = seq.length; i < len; i++) {
        if (0 !== compareVertex(seq[i], seq[i - 1])) {
            uniqueIdx++;

            uniquePositionsCompressed [uniqueIdx * 3 + 0] = positionsCompressed [seq[i] * 3 + 0];
            uniquePositionsCompressed [uniqueIdx * 3 + 1] = positionsCompressed [seq[i] * 3 + 1];
            uniquePositionsCompressed [uniqueIdx * 3 + 2] = positionsCompressed [seq[i] * 3 + 2];
        }

        remappings[seq[i]] = uniqueIdx;
    }

    comparePositions = null;

    let uniqueIndices = new Uint32Array(indices.length);

    for (let i = 0, len = indices.length; i < len; i++) {
        uniqueIndices[i] = remappings [indices[i]];
    }

    let uniqueEdgeIndices;

    if (edgeIndices) {
        uniqueEdgeIndices = new Uint32Array(edgeIndices.length);
        for (let i = 0, len = edgeIndices.length; i < len; i++) {
            uniqueEdgeIndices[i] = remappings [edgeIndices[i]];
        }
    }
    return [
        uniquePositionsCompressed,
        uniqueIndices,
        uniqueEdgeIndices
    ];
}


function compareVertex(a: any, b: any) {
    let res;

    for (let i = 0; i < 3; i++) {
        if (0 != (res = comparePositions[a * 3 + i] - comparePositions[b * 3 + i])) {
            return res;
        }
    }

    return 0;
}

let seqInit: any = null;

function setMaxNumberOfPositions(maxPositions: any) {
    if (seqInit !== null && seqInit.length >= maxPositions) {
        return;
    }

    seqInit = new Uint32Array(maxPositions);

    for (let i = 0; i < maxPositions; i++) {
        seqInit[i] = i;
    }
}

