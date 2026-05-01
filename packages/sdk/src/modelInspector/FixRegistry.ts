import type {Fix} from "./Fix";


/**
 * Pluggable lookup table mapping {@link Issue.code | issue codes} to
 * {@link Fix | fix strategies}. Plays the role of
 * `eslint`'s rule registry / IntelliJ's `LocalQuickFixProvider`
 * registry: callers register strategies once and every subsequent
 * {@link applyFixes} run dispatches through the same registry.
 *
 * The SDK ships a pre-populated singleton at
 * {@link DEFAULT_FIX_REGISTRY}. Plugins typically register
 * additional strategies into that singleton on import — every call
 * to {@link applyFixes} then sees them automatically. Tests, custom
 * pipelines, or code that needs to work in isolation can build a
 * fresh `FixRegistry` and pass it to `applyFixes`
 * directly.
 *
 * ## Conflict resolution
 *
 * A {@link Fix} declares the codes it handles in
 * {@link Fix.codes}. When `register` is called the
 * strategy is stored under each of those codes. **Last
 * registration wins** — a later registration for an existing code
 * overrides the earlier one. This matches plugin-framework
 * convention: bring your own override later in the load order.
 *
 * Use {@link FixRegistry.unregister} to remove all
 * registrations for a code, or {@link FixRegistry.clear}
 * to start over.
 */
export class FixRegistry {

  /**
   * Per-code dispatch map. Each entry is the strategy currently
   * responsible for that code; one strategy may appear under
   * multiple keys.
   */
  readonly #byCode: Map<string, Fix> = new Map();

  /**
   * Construct a new registry. Pass an array of strategies to
   * pre-register them — equivalent to calling
   * {@link FixRegistry.register} for each in order.
   */
  constructor(strategies: Fix[] = []) {
    for (const s of strategies) {
      this.register(s);
    }
  }

  /**
   * Register a strategy, claiming every code listed in
   * {@link Fix.codes}. If any of those codes already had a
   * strategy registered, the previous strategy is replaced for
   * those codes (last-registration-wins).
   */
  register(strategy: Fix): void {
    for (const code of strategy.codes) {
      this.#byCode.set(code, strategy);
    }
  }

  /**
   * Remove the strategy registered under `code`. Returns `true` if
   * one was present, `false` otherwise.
   *
   * If the strategy that owned `code` also handled other codes,
   * those other codes remain pointed at it — only the named code
   * is detached.
   */
  unregister(code: string): boolean {
    return this.#byCode.delete(code);
  }

  /**
   * Look up the strategy currently registered under `code`, or
   * `undefined` when no strategy claims it.
   */
  get(code: string): Fix | undefined {
    return this.#byCode.get(code);
  }

  /**
   * `true` when a strategy is registered for `code`.
   */
  has(code: string): boolean {
    return this.#byCode.has(code);
  }

  /**
   * Iterator over every code that has a registered strategy.
   * Useful for building a "what can we auto-fix?" summary alongside
   * an inspection report.
   */
  codes(): IterableIterator<string> {
    return this.#byCode.keys();
  }

  /**
   * Drop every registration. After `clear`, `has(code)` is `false`
   * for every code.
   */
  clear(): void {
    this.#byCode.clear();
  }
}
