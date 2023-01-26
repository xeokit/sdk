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
 *
 * @returns An array with 3 elements: 0 => the uniquified positions; 1 and 2 => the remapped edges and edgeIndices arrays
 */
export declare function uniquifyPositions(mesh: any): (Uint16Array | Uint32Array | undefined)[];
