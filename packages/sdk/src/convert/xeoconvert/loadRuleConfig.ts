import {resolve} from "path";
import {
  DEFAULT_INSPECTION_REGISTRY,
  DEFAULT_FIX_REGISTRY,
  type InspectionRegistry,
  type FixRegistry,
} from "../../inspect/sceneModel";

/**
 * Loads inspection/optimization rule selection + tuning from JSON into the
 * inspect registries, so the CLI can be configured as a validator/optimizer
 * without code changes.
 *
 * The per-section blobs are exactly the `serializeConfigs()` shape of the
 * registries (`{ "<code>": { enabled?, ...fields } }`), so a config round-trips
 * with {@link serializeRuleConfig} / `--print-config`. Custom rules are added by
 * `plugins` modules that export a `register(registries)` function.
 *
 * Applying mutates the target registries in place; the converter consumes the
 * shipped `DEFAULT_*_REGISTRY` singletons by default, so loading into those (the
 * default) configures every subsequent inspect/optimize run in the process.
 *
 * @internal
 */
export interface RuleRegistries {
  /** SceneModel inspection registry (the validation rules). */
  inspections: InspectionRegistry;
  /** SceneModel fix registry (the optimization rules). */
  optimizations: FixRegistry;
}

/** A custom-rules plugin module. */
export interface RulePlugin {
  register(registries: RuleRegistries): void;
}

/** Parsed `--config` document. */
export interface RuleConfig {
  /** SceneModel inspection overrides, keyed by inspection code. */
  sceneInspections?: Record<string, Record<string, unknown>>;
  /** Optimization (fix) overrides, keyed by issue code. */
  optimizations?: Record<string, Record<string, unknown>>;
  /** DataModel inspection param flags. Accepted now; consumed once dataModel
   *  inspection is wired into the converter (later phase). */
  dataInspections?: Record<string, unknown>;
  /** Module specifiers exporting `register(registries)` to add custom rules. */
  plugins?: string[];
}

function defaultRegistries(): RuleRegistries {
  return {inspections: DEFAULT_INSPECTION_REGISTRY, optimizations: DEFAULT_FIX_REGISTRY};
}

/** Apply an inspection-config blob (`{code: {...}}`) to the inspection registry. */
export function applyInspectionConfig(
  blob: Record<string, Record<string, unknown>>,
  registries: RuleRegistries = defaultRegistries(),
): void {
  registries.inspections.loadConfigs(blob);
}

/** Apply an optimization-config blob (`{code: {...}}`) to the fix registry. */
export function applyOptimizationConfig(
  blob: Record<string, Record<string, unknown>>,
  registries: RuleRegistries = defaultRegistries(),
): void {
  registries.optimizations.loadConfigs(blob);
}

/**
 * Apply a full {@link RuleConfig}: inspection + optimization overrides and any
 * `plugins`. `dataInspections` is returned unchanged for a later phase to thread
 * into the dataModel inspection params.
 *
 * `requireModule` must be supplied when `plugins` is non-empty — the CLI passes
 * its own `require` (the bundled core must not statically require user paths).
 * Relative plugin specifiers resolve against `baseDir` (the config file's dir).
 */
export function applyRuleConfig(
  config: RuleConfig,
  opts: {
    registries?: RuleRegistries;
    baseDir?: string;
    requireModule?: (id: string) => any;
  } = {},
): RuleConfig {
  const registries = opts.registries ?? defaultRegistries();
  if (config.sceneInspections) {
    registries.inspections.loadConfigs(config.sceneInspections);
  }
  if (config.optimizations) {
    registries.optimizations.loadConfigs(config.optimizations);
  }
  if (config.plugins && config.plugins.length > 0) {
    if (!opts.requireModule) {
      throw new Error("[loadRuleConfig] plugins present but no requireModule was provided");
    }
    const baseDir = opts.baseDir ?? ".";
    for (const spec of config.plugins) {
      const id = spec.startsWith(".") ? resolve(baseDir, spec) : spec;
      const mod = opts.requireModule(id);
      const plugin: RulePlugin | undefined =
        mod && typeof mod.register === "function" ? mod
          : mod && mod.default && typeof mod.default.register === "function" ? mod.default
            : undefined;
      if (!plugin) {
        throw new Error(`[loadRuleConfig] plugin "${spec}" must export a register(registries) function`);
      }
      plugin.register(registries);
    }
  }
  return config;
}

/** Effective rule config from the registries — for `--print-config` scaffolding. */
export function serializeRuleConfig(registries: RuleRegistries = defaultRegistries()): RuleConfig {
  return {
    sceneInspections: registries.inspections.serializeConfigs(),
    optimizations: registries.optimizations.serializeConfigs(),
  };
}
