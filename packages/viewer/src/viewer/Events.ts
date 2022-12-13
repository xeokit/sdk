import {Map} from "./utils/index";

/**
 Manages events for its owner component.
 */
class Events {

    /**
     Indicates if this Events has been destroyed.
     */
    destroyed: boolean;
    #subIdMap: null|Map;// Subscription subId pool
    #subIdEvents: null|{ [key: string]: any };// Subscription subIds mapped to event names
    #eventSubs: null|{ [key: string]: any };// Event names mapped to subscribers
    #eventSubsNum: null|{ [key: string]: number };
    #events: null|{ [key: string]: any };// Maps names to events
    #eventCallDepth: number;// Helps us catch stack overflows from recursive events

    /**
     @private
     */
    constructor() {
        this.#subIdMap = null;
        this.#subIdEvents = null;
        this.#eventSubs = null;
        this.#eventSubsNum = null;
        this.#events = null;
        this.#eventCallDepth = 0;
        this.destroyed = false;
    }

    /**
     Fires an event.

     Notifies existing subscribers to the event, optionally retains the event to give to
     any subsequent notifications on the event as they are made.

     @param event - The event name
     @param  value - The event parameters
     @param forget - When true, does not retain event for subsequent subscribers
     */
    fire(event: string, value: any, forget?: boolean): void {
        if (!this.#events) {
            this.#events = {};
        }
        if (!this.#eventSubs) {
            this.#eventSubs = {};
            this.#eventSubsNum = {};
        }
        if (forget !== true) {
            this.#events[event] = value || true; // Save notification
        }
        const subs = this.#eventSubs[event];
        let sub;
        if (subs) { // Notify subscriptions
            for (const subId in subs) {
                if (subs.hasOwnProperty(subId)) {
                    sub = subs[subId];
                    this.#eventCallDepth++;
                    if (this.#eventCallDepth < 300) {
                        sub(value);
                    } else {
                        console.error("fire: potential stack overflow from recursive event '" + event + "' - dropping this event");
                    }
                    this.#eventCallDepth--;
                }
            }
        }
    }

    /**
     Subscribes to an event.

     @param event - The event name
     @param callback - Callback to handle the event
     @return Handle to the subscription, which may be used to unsubscribe with {@link Events.off}.
     */
    on(event: string, callback: (a: any) => void): number {
        if (!this.#events) {
            this.#events = {};
        }
        if (!this.#subIdMap) {
            // @ts-ignore
            this.#subIdMap = new Map(); // Subscription subId pool
        }
        if (!this.#subIdEvents) {
            this.#subIdEvents = {};
        }
        if (!this.#eventSubs) {
            this.#eventSubs = {};
        }
        if (!this.#eventSubsNum) {
            this.#eventSubsNum = {};
        }
        let subs = this.#eventSubs[event];
        if (!subs) {
            subs = {};
            this.#eventSubs[event] = subs;
            this.#eventSubsNum[event] = 1;
        } else {
            this.#eventSubsNum[event]++;
        }
        // @ts-ignore
        const subId = this.#subIdMap.addItem(); // Create unique subId
        subs[subId] = callback;
        this.#subIdEvents[subId] = event;
        const value = this.#events[event];
        if (value !== undefined) { // A publication exists, notify callback immediately
            callback(value);
        }
        return subId;
    }

    /**
     Cancels an event subscription that was previously made with {@link Events.on} or {@link Events.once}.

     @param subId - Subscription ID
     */
    off(subId: number): void {
        if (subId === undefined || subId === null) {
            return;
        }
        if (!this.#subIdEvents) {
            return;
        }
        const event = this.#subIdEvents[subId];
        if (event) {
            delete this.#subIdEvents[subId];
            // @ts-ignore
            const subs = this.#eventSubs[event];
            if (subs) {
                delete subs[subId];
                // @ts-ignore
                this.#eventSubsNum[event]--;
            }
            // @ts-ignore
            this.#subIdMap.removeItem(subId); // Release subId
        }
    }

    /**
     Subscribes to the next occurrence of the given event, then un-subscribes as soon as the event is handled.

     This is equivalent to calling {@link Events.on}, and then calling {@link Events.off} inside the callback function.

     @param event - The event name
     @param callback - Callback to handle the event
     */
    once(event: string, callback: (a: any) => void): void {
        const subId = this.on(event,
            (value) => {
                this.off(subId);
                callback(value);
            });
    }

    /**
     Returns true if there are any subscribers to the given event on this Events.

     @param event - The event name
     @return True if there are any subscribers to the given event
     */
    hasSubs(event: string): boolean {
        return <boolean>(this.#eventSubsNum && (this.#eventSubsNum[event] > 0));
    }

    /**
     @private
     */
    destroy(): void {

        if (this.destroyed) {
            return;
        }

        this.fire("destroyed", this.destroyed = true); // Must fire before we blow away subscription maps, below

        this.#subIdMap = null;
        this.#subIdEvents = null;
        this.#eventSubs = null;
        this.#events = null;
        this.#eventCallDepth = 0;
    }
}

export {Events};
