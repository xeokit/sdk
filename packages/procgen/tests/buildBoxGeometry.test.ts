import {buildBoxGeometry} from "../src/index";
import {TrianglesPrimitive} from "@xeokit/constants";

describe('Test Generators', function () {
    it('buildBoxGeometry', () => {
        const geometry = buildBoxGeometry({center: [2, 3, 4], ySize: 5, xSize: 2, zSize: 3});
        expect(geometry.primitive).toStrictEqual(TrianglesPrimitive);
        expect(geometry.positions).toStrictEqual([
            4, 8, 7, 0, 8, 7, 0, -2, 7, 4, -2, 7, 4, 8, 7, 4, -2, 7, 4, -2, 1, 4,
            8, 1, 4, 8, 7, 4, 8, 1, 0, 8, 1, 0, 8, 7, 0, 8, 7, 0, 8, 1, 0, -2, 1,
            0, -2, 7, 0, -2, 1, 4, -2, 1, 4, -2, 7, 0, -2, 7, 4, -2, 1, 0, -2, 1, 0, 8, 1, 4, 8, 1,
        ]);
        expect(geometry.uv).toStrictEqual([
            1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 1,
            1, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0,]);
        expect(geometry.indices).toStrictEqual([
            0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12,
            14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,]);
    });
});
