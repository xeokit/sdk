import type {IEvent} from "strongly-typed-events";

/**
 * Event emitter.
 *
 * Wraps every subscriber in a `try`/`catch` so a buggy subscriber's
 * throw is logged via `console.error` and the dispatch loop
 * continues with the next subscriber. Without this isolation, the
 * underlying `strongly-typed-events` dispatcher re-throws the
 * first failure straight back into whatever SDK code path fired
 * the event — so a single bad subscriber would halt a destroy
 * cascade, a model load, or any other event-emitting flow
 * mid-way. Errors are logged with the emitter's `name` (when
 * provided) so they're trivially greppable.
 *
 * @typeParam TSender - Type of the event sender
 * @typeParam TArgs - Type of the event argument
 */
export class EventEmitter<TSender, TArgs> {

  #ievent: any;

  /**
   * Optional human-readable label included in the
   * subscriber-failure log line. Defaults to `"EventEmitter"` when
   * not supplied at construction.
   */
  #name: string;

  /**
   * Maps each user-supplied subscriber to the wrapped handler we
   * actually registered with `strongly-typed-events`. Lookups
   * happen in `unsubscribe` / `unsub` / `has`, which receive the
   * original function and need to translate it to the wrapped
   * form the library has on file.
   */
  readonly #wrapped: WeakMap<
    (a: TSender, b: TArgs) => void,
    (a: TSender, b: TArgs) => void
  > = new WeakMap();

  constructor(ievent: IEvent<TSender, TArgs>, name?: string) {
    this.#ievent = ievent;
    this.#name = name ?? "EventEmitter";
  }

  /**
   * Returns the number of subscriptions.
   */
  get count(): number {
    return this.#ievent.count;
  }

  /**
   * Subscribe to the event.
   *
   * @param func The event handler that is called when the event is dispatched.
   * @returns Function that unsubscribes the event handler from the event.
   */
  subscribe(func: (a: TSender, b: TArgs) => void): () => void {
    return this.#ievent.asEvent().subscribe(this.#wrap(func));
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
    return this.#ievent.asEvent().sub(this.#wrap(func));
  }

  /**
   * Unsubscribe from the event.
   * @param func The event handler that will be unsubsribed from the event.
   */
  unsubscribe(func: (a: TSender, b: TArgs) => void): void {
    const wrapped = this.#wrapped.get(func);
    if (!wrapped) return;
    this.#ievent.asEvent().unsubscribe(wrapped);
    this.#wrapped.delete(func);
  }

  /**
   * Unsubscribe from the event.
   * @param func The event handler that will be unsubsribed from the event.
   */
  unsub(func: (a: TSender, b: TArgs) => void): void {
    const wrapped = this.#wrapped.get(func);
    if (!wrapped) return;
    this.#ievent.asEvent().unsub(wrapped);
    this.#wrapped.delete(func);
  }

  /**
   * Subscribes to the event only once.
   * @param func The event handler that is called when the event is dispatched.
   * @returns A function that unsubscribes the event handler from the event.
   */
  one(func: (a: TSender, b: TArgs) => void): () => void {
    return this.#ievent.asEvent().one(this.#wrap(func));
  }

  /**
   * Checks if the event has a subscription for the specified handler.
   * @param func The event handler.
   */
  has(func: (a: TSender, b: TArgs) => void): boolean {
    const wrapped = this.#wrapped.get(func);
    return wrapped ? this.#ievent.asEvent().has(wrapped) : false;
  }

  /**
   * Clears all the subscriptions.
   */
  clear(): void {
    this.#ievent.asEvent().clear();
  }

  /**
   * Wrap the user's subscriber so its throws never escape the
   * dispatch loop. The wrapped handler is registered with
   * `strongly-typed-events` instead of the original; the mapping
   * is cached on `#wrapped` so subsequent `unsubscribe` /
   * `has` calls can resolve the original back to its wrapper.
   *
   * Same fn re-registered yields the same wrapper — keeps
   * `unsubscribe(fn)` symmetric with `subscribe(fn)`.
   */
  #wrap(func: (a: TSender, b: TArgs) => void): (a: TSender, b: TArgs) => void {
    const existing = this.#wrapped.get(func);
    if (existing) return existing;
    const name = this.#name;
    const wrapped = (a: TSender, b: TArgs): void => {
      try {
        func(a, b);
      } catch (e) {
        const detail = e instanceof Error
          ? (e.stack || `${e.name}: ${e.message}`)
          : String(e);
        console.error(`[${name}] subscriber threw — continuing dispatch:\n${detail}`);
      }
    };
    this.#wrapped.set(func, wrapped);
    return wrapped;
  }
}
