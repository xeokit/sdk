/** @private */
export class Map {
    readonly items: any[];
    #lastUniqueId: number;

    constructor(items?: any, baseId?: any) {
        this.items = items || [];
        this.#lastUniqueId = (baseId || 0) + 1;
    }

    /**
     * Usage:
     *
     * id = myMap.addItem("foo") // ID internally generated
     * id = myMap.addItem("foo", "bar") // ID is "foo"
     */
    addItem() {
        let item;
        if (arguments.length === 2) {
            const id = arguments[0];
            item = arguments[1];
            if (this.items[id]) { // Won't happen if given ID is string
                throw "ID clash: '" + id + "'";
            }
            this.items[id] = item;
            return id;

        } else {
            item = arguments[0] || {};
            while (true) {
                const findId = this.#lastUniqueId++;
                if (!this.items[findId]) {
                    this.items[findId] = item;
                    return findId;
                }
            }
        }
    }

    removeItem(id: any) {
        const item = this.items[id];
        delete this.items[id];
        return item;
    }
}
