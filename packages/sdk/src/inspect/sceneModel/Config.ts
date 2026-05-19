/**
 * Declarative configuration schemas for {@link Inspection} and
 * {@link Fix}.
 *
 * Each {@link Inspection} declares a {@link ConfigSchema} listing
 * the knobs the user can tune (opt-in toggle, numeric thresholds,
 * enumerated choices). The orchestrator (or the inspection
 * itself) calls {@link resolveConfig} to layer:
 *
 *   1. The field's `default`.
 *   2. Any saved per-inspection override stored on the
 *      {@link InspectionRegistry} via `setConfig` /
 *      `loadConfigs`.
 *   3. Per-call overrides on {@link InspectSceneModelParams}.
 *
 * The result is a flat keyed bag the inspection's `run` consumes
 * in place of pulling fields off `params` directly.
 *
 * A Studio "Inspection settings" panel can walk every
 * registered inspection's {@link ConfigSchema} and render a form
 * from the field metadata — labels, units, min/max, enumerations
 * — without any per-inspection UI code. Plugins inherit that UI
 * for free.
 *
 * Hand-rolled rather than zod-based: the validation surface here
 * (min/max clamp, allowed-value check) is ~20 LOC; zod would buy
 * us cross-field validation and parser composition we don't need
 * and complicate "give me a list of fields to render".
 */

/** One tunable knob in an {@link Inspection}'s {@link ConfigSchema}. */
export type ConfigField =
  | {
    kind: "boolean";
    /** Key under which the value is read from overrides and
     * written into the resolved config (e.g.
     * `"checkGeometryArrayLengths"`). */
    key: string;
    /** Short human-readable name for UI controls. */
    label: string;
    /** Plain-English explanation for tooltips / help panes. */
    description?: string;
    default: boolean;
  }
  | {
    kind: "number";
    key: string;
    label: string;
    description?: string;
    default: number;
    /** Inclusive lower bound. Values below are clamped on resolve. */
    min?: number;
    /** Inclusive upper bound. Values above are clamped on resolve. */
    max?: number;
    /** UI hint — slider / number-input step. Does not affect
     *  resolved values. */
    step?: number;
    /** UI hint — appended after the value (e.g. `"vertices"`,
     *  `"m"`). Does not affect resolved values. */
    unit?: string;
  }
  | {
    kind: "select";
    key: string;
    label: string;
    description?: string;
    default: string;
    options: { value: string; label: string }[];
  };


/**
 * Configuration surface declared by an {@link Inspection}.
 *
 * `enabled` is the opt-in toggle — present on opt-in inspections,
 * omitted on always-run inspections. `fields` is the rest of the
 * tunable knobs.
 */
export interface ConfigSchema {
  enabled?: Extract<ConfigField, { kind: "boolean" }>;
  fields?: ConfigField[];
}


/**
 * Resolved configuration produced by {@link resolveConfig}. A
 * flat keyed bag — `enabled` plus one entry per
 * {@link ConfigSchema.fields | field}, keyed by each field's
 * {@link ConfigField.key | key}.
 */
export interface ResolvedConfig {
  /** `true` when the inspection should run. Defaults to `true`
   *  when {@link ConfigSchema.enabled} is omitted (always-run
   *  inspection). */
  enabled: boolean;
  [key: string]: boolean | number | string;
}


/**
 * Merge defaults from `schema` with the (optional) `overrides`
 * bag — typically the user's {@link InspectSceneModelParams}, or
 * any object whose keys match the schema's field keys. Returns a
 * fresh {@link ResolvedConfig}.
 *
 * - `number` fields are clamped to `[min, max]` when bounds are
 *   set; non-finite values fall back to the default.
 * - `select` fields fall back to the default when the override
 *   isn't one of the declared `options`.
 * - Unknown keys on `overrides` are ignored — the schema is the
 *   list of recognised knobs.
 *
 * Pure — does not mutate `schema` or `overrides`.
 */
export function resolveConfig(
  schema: ConfigSchema | undefined,
  overrides: object | undefined,
): ResolvedConfig {
  const out: ResolvedConfig = { enabled: true };
  if (!schema) return out;

  // Indexed-access view of the (typed) overrides bag — callers
  // usually hand in a strongly-typed `InspectSceneModelParams`
  // rather than a `Record`, so the cast lives here once instead
  // of at every inspection's `run` call site.
  const bag = overrides as Record<string, unknown> | undefined;

  if (schema.enabled) {
    const v = bag?.[schema.enabled.key];
    out.enabled = typeof v === "boolean" ? v : schema.enabled.default;
  }

  for (const f of schema.fields ?? []) {
    const raw = bag?.[f.key];
    if (f.kind === "boolean") {
      out[f.key] = typeof raw === "boolean" ? raw : f.default;
    } else if (f.kind === "number") {
      const n = typeof raw === "number" && Number.isFinite(raw) ? raw : f.default;
      out[f.key] = clamp(n, f.min, f.max);
    } else {
      out[f.key] = typeof raw === "string" && f.options.some(o => o.value === raw)
        ? raw
        : f.default;
    }
  }

  return out;
}


function clamp(v: number, min?: number, max?: number): number {
  if (min !== undefined && v < min) return min;
  if (max !== undefined && v > max) return max;
  return v;
}
