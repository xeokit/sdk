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
   * Iterator over every distinct {@link Fix} registered. One
   * strategy can claim multiple codes (`fix.codes[]`), so this
   * deduplicates — each strategy appears once regardless of how
   * many codes it owns. Useful for UI code that wants to render
   * one entry per strategy (e.g. an "Inspection settings" panel
   * with one row per fix).
   */
  fixes(): IterableIterator<Fix> {
    return new Set(this.#byCode.values()).values();
  }

  /**
   * Drop every registration. After `clear`, `has(code)` is `false`
   * for every code.
   */
  clear(): void {
    this.#byCode.clear();
    this.#configs.clear();
  }


  // ── Per-fix config overrides ───────────────────────────────────
  //
  // The registry stores user-set tweaks to each fix's
  // {@link Fix.config} schema — the layer between the schema's
  // `default` values and the per-call
  // {@link ApplyFixesParams.fixOverrides}. Orchestrators merge in
  // this order: schema-default < registry-stored < per-call
  // overrides.
  //
  // Keyed by primary code (`fix.codes[0]`). When one strategy
  // handles multiple codes, the primary code is the single
  // identity used for config lookups — same value the strategy
  // would expose in any UI that walks the registry. Serializes
  // to a plain code-keyed JSON blob; the caller links that to
  // localStorage / a file / a settings endpoint.

  /**
   * Per-fix override bag, keyed by primary code (`codes[0]`).
   * Layered under per-call overrides by the orchestrator.
   */
  readonly #configs: Map<string, Record<string, unknown>> = new Map();

  /**
   * Set (or merge) the override bag for a fix. Pass the fix
   * itself or its primary code. Subsequent {@link applyFixes}
   * calls layer this bag under any
   * {@link ApplyFixesParams.fixOverrides | per-call overrides} —
   * per-call overrides win on the keys they declare.
   *
   * Merges with any existing entry rather than replacing. Pass
   * an empty bag plus a follow-up {@link clearConfig} to wipe.
   */
  setConfig(target: Fix | string, overrides: Record<string, unknown>): void {
    const key = typeof target === "string" ? target : target.codes[0];
    if (!key) return;
    const existing = this.#configs.get(key);
    this.#configs.set(key, existing ? {...existing, ...overrides} : {...overrides});
  }

  /**
   * Get the stored override bag for a fix, or `undefined` when
   * no overrides are set. Returned object is a snapshot —
   * callers should not mutate it; use {@link setConfig} to
   * change stored overrides.
   */
  getConfig(target: Fix | string): Record<string, unknown> | undefined {
    const key = typeof target === "string" ? target : target.codes[0];
    if (!key) return undefined;
    return this.#configs.get(key);
  }

  /**
   * Drop the override bag for a fix. Returns `true` if one was
   * present.
   */
  clearConfig(target: Fix | string): boolean {
    const key = typeof target === "string" ? target : target.codes[0];
    if (!key) return false;
    return this.#configs.delete(key);
  }

  /**
   * Snapshot every stored override bag as a JSON-safe object,
   * keyed by primary code. Suitable for persistence — call
   * {@link loadConfigs} with the same blob to restore.
   */
  serializeConfigs(): Record<string, Record<string, unknown>> {
    const out: Record<string, Record<string, unknown>> = {};
    for (const [code, overrides] of this.#configs) {
      out[code] = {...overrides};
    }
    return out;
  }

  /**
   * Hydrate stored overrides from a {@link serializeConfigs}
   * blob. Each code's bag is **merged** with any existing entry
   * (last-write-wins on overlapping keys), so a partial blob
   * overlays cleanly without wiping per-fix fields the caller
   * didn't touch. Codes the caller didn't supply keep their
   * current overrides; orphan codes (no matching registered fix)
   * are accepted — they sit idle until that fix is registered.
   */
  loadConfigs(blob: Record<string, Record<string, unknown>>): void {
    for (const code in blob) {
      const v = blob[code];
      if (!v || typeof v !== "object") continue;
      const existing = this.#configs.get(code);
      this.#configs.set(code, existing ? {...existing, ...v} : {...v});
    }
  }
}
