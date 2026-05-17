import type {Inspection} from "./Inspection";


/**
 * Pluggable list of {@link Inspection | inspections} that
 * {@link inspectSceneModel} runs against a {@link model!scene.SceneModel | SceneModel}.
 * Mirrors {@link FixRegistry} — same conventions,
 * complementary half of the pipeline.
 *
 * The SDK ships a pre-populated singleton at
 * {@link DEFAULT_INSPECTION_REGISTRY}. Plugins typically register
 * additional inspections into that singleton on import — every
 * call to {@link inspectSceneModel} then sees them automatically.
 * Tests, custom pipelines, or code that needs to work in isolation
 * can build a fresh `InspectionRegistry` and pass it via the
 * `registry` field on {@link InspectSceneModelParams}.
 *
 * ## Conflict resolution
 *
 * An {@link Inspection} declares the codes it can emit in
 * {@link Inspection.codes}. **Last registration wins** for any
 * given code — a later registration claims the code, but the
 * earlier inspection still runs (registry's lookup is a list, not
 * a per-code map). This differs slightly from
 * {@link FixRegistry}: there's only one fix per code, but
 * any number of inspections can contribute to the same report.
 *
 * Use {@link InspectionRegistry.unregister} to remove all
 * registrations for a code, or {@link InspectionRegistry.clear} to
 * start over.
 */
export class InspectionRegistry {

  /**
   * Registered inspections in order. The orchestrator walks this
   * list end-to-end, concatenating each `run`'s issues — order is
   * preserved so a deterministic report is easy to diff.
   */
  readonly #inspections: Inspection[] = [];

  /**
   * Construct a new registry. Pass an array of inspections to
   * pre-register them — equivalent to calling
   * {@link InspectionRegistry.register} for each in order.
   */
  constructor(inspections: Inspection[] = []) {
    for (const i of inspections) {
      this.register(i);
    }
  }

  /**
   * Register an inspection. Appended to the end of the list, so
   * later registrations run last and can pile their issues on top
   * of earlier ones. Plugins typically call this on import.
   */
  register(inspection: Inspection): void {
    this.#inspections.push(inspection);
  }

  /**
   * Unregister every inspection that claims `code`. Returns the
   * number of inspections removed.
   *
   * If a removed inspection also handled other codes, those other
   * codes are dropped along with it — `unregister` is a per-rule
   * eject, not per-code.
   */
  unregister(code: string): number {
    let removed = 0;
    for (let i = this.#inspections.length - 1; i >= 0; i--) {
      if (this.#inspections[i].codes.indexOf(code) !== -1) {
        this.#inspections.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Iterate every registered inspection, in registration order.
   * {@link inspectSceneModel} consumes this directly.
   */
  inspections(): readonly Inspection[] {
    return this.#inspections;
  }

  /**
   * `true` when at least one registered inspection lists `code` in
   * its {@link Inspection.codes}.
   */
  has(code: string): boolean {
    for (const insp of this.#inspections) {
      if (insp.codes.indexOf(code) !== -1) return true;
    }
    return false;
  }

  /**
   * Iterator over every distinct code declared by any registered
   * inspection. Useful for building a "codes this report could
   * surface" summary alongside the actual report.
   */
  codes(): IterableIterator<string> {
    const seen = new Set<string>();
    for (const insp of this.#inspections) {
      for (const c of insp.codes) seen.add(c);
    }
    return seen.values();
  }

  /**
   * Drop every registration. After `clear`, `inspections()` is
   * empty.
   */
  clear(): void {
    this.#inspections.length = 0;
    this.#configs.clear();
  }


  // ── Per-inspection config overrides ────────────────────────────
  //
  // The registry stores user-set tweaks to each inspection's
  // {@link Inspection.config} schema — the layer between the
  // schema's `default` values and the per-call
  // {@link InspectSceneModelParams}. Orchestrators merge in this
  // order: schema-default < registry-stored < per-call params.
  //
  // Keyed by primary code (`inspection.codes[0]`). Serializes to a
  // plain code-keyed JSON blob; the caller wires that to
  // localStorage / a file / a settings endpoint — the SDK itself
  // stays free of DOM dependencies.

  /**
   * Per-inspection override bag, keyed by primary code
   * (`codes[0]`). Layered under per-call params by the
   * orchestrator.
   */
  readonly #configs: Map<string, Record<string, unknown>> = new Map();

  /**
   * Set (or merge) the override bag for an inspection. Pass the
   * inspection itself or its primary code. Subsequent
   * {@link inspectSceneModel} calls layer this bag under any
   * per-call params they receive — per-call params win on the
   * keys they declare.
   *
   * Merges with any existing entry rather than replacing. Pass an
   * empty bag plus a follow-up {@link clearConfig} to wipe.
   */
  setConfig(target: Inspection | string, overrides: Record<string, unknown>): void {
    const key = typeof target === "string" ? target : target.codes[0];
    if (!key) return;
    const existing = this.#configs.get(key);
    this.#configs.set(key, existing ? {...existing, ...overrides} : {...overrides});
  }

  /**
   * Get the stored override bag for an inspection, or `undefined`
   * when no overrides are set. Returned object is a snapshot —
   * callers should not mutate it; use {@link setConfig} to change
   * stored overrides.
   */
  getConfig(target: Inspection | string): Record<string, unknown> | undefined {
    const key = typeof target === "string" ? target : target.codes[0];
    if (!key) return undefined;
    return this.#configs.get(key);
  }

  /**
   * Drop the override bag for an inspection. Returns `true` if
   * one was present.
   */
  clearConfig(target: Inspection | string): boolean {
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
   * overlays cleanly without wiping per-inspection fields the
   * caller didn't touch. Codes the caller didn't supply keep
   * their current overrides; orphan codes (no matching
   * registered inspection) are accepted — they sit idle until
   * that inspection is registered.
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
