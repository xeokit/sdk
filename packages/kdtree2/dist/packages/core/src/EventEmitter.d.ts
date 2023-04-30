import type { IEvent } from "strongly-typed-events";
/**
 * Event emitter.
 *
 * @typeParam TSender - Type of the event sender
 * @typeParam TArgs - Type of the event argument
 */
export declare class EventEmitter<TSender, TArgs> {
    #private;
    constructor(ievent: IEvent<TSender, TArgs>);
    /**
     * Returns the number of subscriptions.
     */
    get count(): number;
    /**
     * Subscribe to the event.
     *
     * @param func The event handler that is called when the event is dispatched.
     * @returns Function that unsubscribes the event handler from the event.
     */
    subscribe(func: (a: TSender, b: TArgs) => void): () => void;
    /**
     * @private
     * @param sender
     * @param args
     */
    dispatch(sender: TSender, args: TArgs): void;
    /**
     * Subscribe to the event.
     * @param func The event handler that is called when the event is dispatched.
     * @returns A function that unsubscribes the event handler from the event.
     */
    sub(func: (a: TSender, b: TArgs) => void): () => void;
    /**
     * Unsubscribe from the event.
     * @param func The event handler that will be unsubsribed from the event.
     */
    unsubscribe(func: (a: TSender, b: TArgs) => void): void;
    /**
     * Unsubscribe from the event.
     * @param func The event handler that will be unsubsribed from the event.
     */
    unsub(func: (a: TSender, b: TArgs) => void): void;
    /**
     * Subscribes to the event only once.
     * @param func The event handler that is called when the event is dispatched.
     * @returns A function that unsubscribes the event handler from the event.
     */
    one(func: (a: TSender, b: TArgs) => void): () => void;
    /**
     * Checks if the event has a subscription for the specified handler.
     * @param func The event handler.
     */
    has(func: (a: TSender, b: TArgs) => void): boolean;
    /**
     * Clears all the subscriptions.
     */
    clear(): void;
}
