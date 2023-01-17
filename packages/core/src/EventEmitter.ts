import type {IEvent} from "strongly-typed-events";

/**
 * Event emitter.
 *
 * @typeParam TSender - Type of the event sender
 * @typeParam TArgs - Type of the event argument
 */
export class EventEmitter<TSender, TArgs> {

    #ievent: any;

    constructor(ievent: IEvent<TSender, TArgs>) {
        this.#ievent = ievent;
    }

    /**
     * Returns the number of subscriptions.
     */
    get count() : number {
        return this.#ievent.count;
    }
    /**
     * Subscribe to the event.
     *
     * @param func The event handler that is called when the event is dispatched.
     * @returns Function that unsubscribes the event handler from the event.
     */
    subscribe(func: (a: TSender, b: TArgs) => void): () => void {
        return this.#ievent.asEvent().subscribe(func);
    }

    /**
     * @private
     * @param sender
     * @param args
     */
    dispatch(sender: TSender, args: TArgs): void {
        this.#ievent.dispatch(sender, args);
    }

    /**
     * Subscribe to the event.
     * @param func The event handler that is called when the event is dispatched.
     * @returns A function that unsubscribes the event handler from the event.
     */
    sub(func: (a: TSender, b: TArgs) => void): () => void {
        return this.#ievent.asEvent().sub(func);
    }
    /**
     * Unsubscribe from the event.
     * @param func The event handler that will be unsubsribed from the event.
     */
    unsubscribe(func: (a: TSender, b: TArgs) => void): void {
        this.#ievent.asEvent().unsubscribe(func);
    }

    /**
     * Unsubscribe from the event.
     * @param func The event handler that will be unsubsribed from the event.
     */
    unsub(func: (a: TSender, b: TArgs) => void): void {
        this.#ievent.asEvent().unsub(func);
    }

    /**
     * Subscribes to the event only once.
     * @param func The event handler that is called when the event is dispatched.
     * @returns A function that unsubscribes the event handler from the event.
     */
    one(func: (a: TSender, b: TArgs) => void): () => void {
       return this.#ievent.asEvent().one(func);
    }

    /**
     * Checks if the event has a subscription for the specified handler.
     * @param func The event handler.
     */
    has(func: (a: TSender, b: TArgs) => void): boolean {
        return this.#ievent.asEvent().has(func);
    }

    /**
     * Clears all the subscriptions.
     */
    clear(): void {
        this.#ievent.asEvent().clear();
    }
}