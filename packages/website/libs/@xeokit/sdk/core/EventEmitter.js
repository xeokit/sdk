/**
 * Event emitter.
 *
 * @typeParam TSender - Type of the event sender
 * @typeParam TArgs - Type of the event argument
 */
export class EventEmitter {
    #ievent;
    constructor(ievent) {
        this.#ievent = ievent;
    }
    /**
     * Returns the number of subscriptions.
     */
    get count() {
        return this.#ievent.count;
    }
    /**
     * Subscribe to the event.
     *
     * @param func The event handler that is called when the event is dispatched.
     * @returns Function that unsubscribes the event handler from the event.
     */
    subscribe(func) {
        return this.#ievent.asEvent().subscribe(func);
    }
    /**
     * @private
     * @param sender
     * @param args
     */
    dispatch(sender, args) {
        this.#ievent.dispatch(sender, args);
    }
    /**
     * Subscribe to the event.
     * @param func The event handler that is called when the event is dispatched.
     * @returns A function that unsubscribes the event handler from the event.
     */
    sub(func) {
        return this.#ievent.asEvent().sub(func);
    }
    /**
     * Unsubscribe from the event.
     * @param func The event handler that will be unsubsribed from the event.
     */
    unsubscribe(func) {
        this.#ievent.asEvent().unsubscribe(func);
    }
    /**
     * Unsubscribe from the event.
     * @param func The event handler that will be unsubsribed from the event.
     */
    unsub(func) {
        this.#ievent.asEvent().unsub(func);
    }
    /**
     * Subscribes to the event only once.
     * @param func The event handler that is called when the event is dispatched.
     * @returns A function that unsubscribes the event handler from the event.
     */
    one(func) {
        return this.#ievent.asEvent().one(func);
    }
    /**
     * Checks if the event has a subscription for the specified handler.
     * @param func The event handler.
     */
    has(func) {
        return this.#ievent.asEvent().has(func);
    }
    /**
     * Clears all the subscriptions.
     */
    clear() {
        this.#ievent.asEvent().clear();
    }
}
//# sourceMappingURL=EventEmitter.js.map