/** @private */
declare class Map {
    #private;
    constructor(items: any, baseId?: any);
    /**
     * Usage:
     *
     * id = myMap.addItem("foo") // ID internally generated
     * id = myMap.addItem("foo", "bar") // ID is "foo"
     */
    addItem(): any;
    removeItem(id: any): any;
}
export { Map };
