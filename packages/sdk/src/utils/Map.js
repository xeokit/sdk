"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Map_lastUniqueId;
exports.__esModule = true;
exports.Map = void 0;
/** @private */
var Map = /** @class */ (function () {
    function Map(items, baseId) {
        _Map_lastUniqueId.set(this, void 0);
        this.items = items || [];
        __classPrivateFieldSet(this, _Map_lastUniqueId, (baseId || 0) + 1, "f");
    }
    /**
     * Usage:
     *
     * id = myMap.addItem("foo") // ID internally generated
     * id = myMap.addItem("foo", "bar") // ID is "foo"
     */
    Map.prototype.addItem = function () {
        var _a, _b;
        var item;
        if (arguments.length === 2) {
            var id = arguments[0];
            item = arguments[1];
            if (this.items[id]) { // Won't happen if given ID is string
                throw "ID clash: '" + id + "'";
            }
            this.items[id] = item;
            return id;
        }
        else {
            item = arguments[0] || {};
            while (true) {
                var findId = (__classPrivateFieldSet(this, _Map_lastUniqueId, (_b = __classPrivateFieldGet(this, _Map_lastUniqueId, "f"), _a = _b++, _b), "f"), _a);
                if (!this.items[findId]) {
                    this.items[findId] = item;
                    return findId;
                }
            }
        }
    };
    Map.prototype.removeItem = function (id) {
        var item = this.items[id];
        delete this.items[id];
        return item;
    };
    return Map;
}());
exports.Map = Map;
_Map_lastUniqueId = new WeakMap();
