export declare class Queue {
    private _head;
    private _headLength;
    private _tail;
    private _index;
    private _length;
    constructor();
    get length(): number;
    shift(): any;
    push(item: any): this;
    unshift(item: any): this;
    clear(): void;
}
