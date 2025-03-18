/** @private */
export declare class Map {
    #private;
    readonly items: any[];
    constructor(items?: any, baseId?: any);
    /**
     * Usage:
     *
     * id = myMap.addItem("foo") // ID internally generated
     * id = myMap.addItem("foo", "bar") // ID is "foo"
     */
    addItem(): any;
    removeItem(id: any): any;
}
//# sourceMappingURL=Map.d.ts.map