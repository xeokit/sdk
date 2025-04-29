"use strict";
exports.__esModule = true;
exports.Queue = void 0;
var Queue = /** @class */ (function () {
    function Queue() {
        this._head = [];
        this._headLength = 0;
        this._tail = [];
        this._index = 0;
        this._length = 0;
    }
    Object.defineProperty(Queue.prototype, "length", {
        get: function () {
            return this._length;
        },
        enumerable: false,
        configurable: true
    });
    Queue.prototype.shift = function () {
        if (this._index >= this._headLength) {
            var t = this._head;
            t.length = 0;
            this._head = this._tail;
            this._tail = t;
            this._index = 0;
            this._headLength = this._head.length;
            if (!this._headLength) {
                return;
            }
        }
        var value = this._head[this._index];
        if (this._index < 0) {
            delete this._head[this._index++];
        }
        else {
            this._head[this._index++] = undefined;
        }
        this._length--;
        return value;
    };
    Queue.prototype.push = function (item) {
        this._length++;
        this._tail.push(item);
        return this;
    };
    ;
    Queue.prototype.unshift = function (item) {
        this._head[--this._index] = item;
        this._length++;
        return this;
    };
    Queue.prototype.clear = function () {
        this._head = [];
        this._headLength = 0;
        this._tail = [];
        this._index = 0;
        this._length = 0;
    };
    return Queue;
}());
exports.Queue = Queue;
