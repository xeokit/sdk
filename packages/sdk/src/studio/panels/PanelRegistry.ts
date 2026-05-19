import type {Studio} from "../Studio";

/**
 * The minimal contract a registered panel/tool *can* satisfy.
 *
 * Every member is optional because the registry covers both visual
 * panels (which all implement the full set) and non-UI tools like
 * {@link TransformControls} that have no visibility concept. The
 * registry calls each member with optional chaining, so tools without
 * UI just no-op the visibility branches.
 */
export interface PanelLike {
  visible?: boolean;
  show?(): void;
  hide?(): void;
  toggle?(): void;
}

/**
 * Context handed to every {@link PanelProvider}. Lets providers reach
 * Studio's owned components (scene, data, viewer, renderer, picker,
 * views) without capturing `studio` in a closure — important for
 * testing and for re-binding the registry to a different Studio.
 */
export interface PanelContext {
  readonly studio: Studio;
}

/**
 * Adapter that teaches the registry how to find / construct one
 * particular panel or tool. Every concrete panel in the built-in set
 * registers one of these.
 *
 * @typeParam P - The params shape callers pass to `open(id, params)`.
 *                Use `void` for panels with no per-call config.
 * @typeParam R - The concrete panel/tool type returned from `create`.
 */
export interface PanelProvider<P = void, R extends PanelLike = PanelLike> {
  /**
   * Locate an already-mounted instance, if any. Returning `undefined`
   * makes the registry fall through to {@link create}.
   */
  find(ctx: PanelContext, params: P): R | undefined;

  /**
   * Mount a new instance. Returning `undefined` is the provider's way
   * of declining (e.g. preconditions not met — no View available,
   * renderer inspector not yet exposed). Callers see `undefined`
   * back from `open(id)`.
   */
  create(ctx: PanelContext, params: P): R | undefined;

  /**
   * Optional side-effects when revealing an existing instance —
   * focus a specific model, re-bind a target, etc. The registry calls
   * this after `find` succeeds and before returning the panel.
   */
  onReveal?(panel: R, ctx: PanelContext, params: P): void;
}

/**
 * Marker interface intentionally left empty. Built-in panels populate
 * it via `declare module` augmentation in `builtinPanels.ts`; SDK
 * users register custom panels by augmenting it from their own code.
 *
 * Each entry has the shape `{ panel: SomePanel; params: SomeParams }`.
 * Use `void` for `params` when the panel takes no per-call config.
 */
export interface PanelMap {
  // augmented in builtinPanels.ts
}

type PanelEntry<K extends keyof PanelMap> = PanelMap[K] extends {
  panel: infer P;
  params: infer Q
} ? {panel: P; params: Q} : never;

/**
 * Single dispatch point for opening, hiding, and toggling every panel
 * and tool surfaced by Studio. Replaces the ~40 `openX`/`hideX`/
 * `toggleX` methods that used to live directly on Studio.
 *
 * Add a new panel by:
 *   1. Module-augmenting {@link PanelMap} with its id, panel type, params type.
 *   2. Calling {@link register} with a {@link PanelProvider}.
 * Studio code never has to change.
 */
export class PanelRegistry {

  private readonly providers = new Map<string, PanelProvider<any, any>>();

  constructor(private readonly ctx: PanelContext) {}

  /**
   * Register a panel provider under the given id. Re-registering an
   * existing id replaces the previous provider — useful for tests and
   * for SDK consumers that want to swap a built-in.
   */
  register<K extends keyof PanelMap>(
    id: K,
    provider: PanelProvider<PanelEntry<K>["params"], PanelEntry<K>["panel"] & PanelLike>,
  ): void {
    this.providers.set(id as string, provider);
  }

  /**
   * Open (or reveal) the panel registered under `id`.
   *
   * Behaviour mirrors the legacy `openX` methods: if the panel is
   * already mounted, ensures it's visible and runs the provider's
   * `onReveal` hook; otherwise constructs a new one via the
   * provider's `create`. Returns `undefined` when a provider's
   * preconditions reject construction.
   */
  open<K extends keyof PanelMap>(
    id: K,
    params?: PanelEntry<K>["params"],
  ): PanelEntry<K>["panel"] | undefined {
    const provider = this.providers.get(id as string);
    if (!provider) {
      throw new Error(`[PanelRegistry] No provider registered for '${String(id)}'`);
    }
    const p = (params ?? {}) as PanelEntry<K>["params"];
    const existing = provider.find(this.ctx, p);
    if (existing) {
      if (existing.visible === false) existing.show?.();
      provider.onReveal?.(existing, this.ctx, p);
      return existing as PanelEntry<K>["panel"];
    }
    return provider.create(this.ctx, p) as PanelEntry<K>["panel"] | undefined;
  }

  /**
   * Hide (without destroying) the panel registered under `id`, if
   * one is currently mounted. No-op when nothing is mounted.
   */
  hide<K extends keyof PanelMap>(id: K, params?: PanelEntry<K>["params"]): void {
    const provider = this.providers.get(id as string);
    if (!provider) {
      throw new Error(`[PanelRegistry] No provider registered for '${String(id)}'`);
    }
    const p = (params ?? {}) as PanelEntry<K>["params"];
    const existing = provider.find(this.ctx, p);
    existing?.hide?.();
  }

  /**
   * Toggle the panel registered under `id`. Constructs the panel on
   * first call (matching legacy `toggleX` behaviour).
   */
  toggle<K extends keyof PanelMap>(
    id: K,
    params?: PanelEntry<K>["params"],
  ): PanelEntry<K>["panel"] | undefined {
    const provider = this.providers.get(id as string);
    if (!provider) {
      throw new Error(`[PanelRegistry] No provider registered for '${String(id)}'`);
    }
    const p = (params ?? {}) as PanelEntry<K>["params"];
    const existing = provider.find(this.ctx, p);
    if (existing) {
      existing.toggle?.();
      return existing as PanelEntry<K>["panel"];
    }
    return provider.create(this.ctx, p) as PanelEntry<K>["panel"] | undefined;
  }

  /**
   * Locate the live instance for `id` without mounting one.
   * Returns `undefined` when nothing is mounted.
   */
  get<K extends keyof PanelMap>(
    id: K,
    params?: PanelEntry<K>["params"],
  ): PanelEntry<K>["panel"] | undefined {
    const provider = this.providers.get(id as string);
    if (!provider) return undefined;
    const p = (params ?? {}) as PanelEntry<K>["params"];
    return provider.find(this.ctx, p) as PanelEntry<K>["panel"] | undefined;
  }

  /** True when a provider is registered for `id`. */
  has(id: string): boolean {
    return this.providers.has(id);
  }
}
