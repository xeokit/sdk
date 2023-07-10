/**
 * @author https://github.com/tmarti, with support from https://tribia.com/
 * @license MIT
 **/
import type { IntArrayParam } from "@xeokit/math";
export declare function rebucketPositions(mesh: {
    positionsCompressed: IntArrayParam;
    indices: IntArrayParam;
    edgeIndices?: IntArrayParam;
}, bitsPerBucket: any, checkResult?: boolean): {
    positionsCompressed: IntArrayParam;
    indices: IntArrayParam;
    edgeIndices?: IntArrayParam;
}[];
