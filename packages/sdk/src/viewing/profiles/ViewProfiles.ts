import {SDKErrorType, type SDKResult} from "../../base/core";
import type {View} from "../viewer";
import type {ViewEffectProperties, ViewProfile, ViewProfileEffectId, ViewProfilesParams} from "./ViewProfilesParams";

type EffectObject = Record<string, unknown>;
type EffectPropertyMap = Record<string, unknown>;
type EffectPropertiesRecord = Record<string, EffectPropertyMap | undefined>;
type PropertyPath = string;

interface ResolvedProperty {
  key: PropertyPath;
  effectId: string;
  property: string;
  effect: EffectObject;
  value: unknown;
}

interface ManagedPropertyState {
  restoreValue: unknown;
  profileValue: unknown;
  externallyOverridden: boolean;
}

interface ExpandedProfile {
  values: Map<PropertyPath, ResolvedProperty>;
}

interface TransitionOptions {
  preserveOverridesForUnchanged?: boolean;
  reclaimPaths?: Set<PropertyPath>;
}

const EFFECT_RESOLVERS: Record<ViewProfileEffectId, (view: View) => object> = {
  sao: view => view.effects.sao,
  edges: view => view.effects.edges,
  bloom: view => view.effects.bloom,
  atmosphere: view => view.effects.atmosphere,
  depthOfField: view => view.effects.depthOfField,
  colorGrading: view => view.effects.colorGrading,
  tonemap: view => view.effects.tonemap,
  antiAliasing: view => view.effects.antiAliasing,
  shadows: view => view.effects.shadows,
  sky: view => view.effects.sky,
  sectionPlaneCaps: view => view.effects.sectionPlaneCaps,
  bodyHatch: view => view.effects.bodyHatch,
  ibl: view => view.lights.ibl,
  hemispheric: view => view.lights.hemispheric,
  texturing: view => view.texturing,
  resolutionScale: view => view.resolutionScale
};

const ENABLED_EFFECT_IDS = Object.keys(EFFECT_RESOLVERS) as ViewProfileEffectId[];

/**
 * Controls named rendering profiles on a {@link View}.
 *
 * `ViewProfiles` is the runtime owner of profile-based render state for one
 * View. It coordinates effect components, lighting components and rendering
 * controls from a single symbolic profile ID, without adding render-mode
 * logic to the View or to individual effects.
 *
 * Profiles are sparse two-level property maps. The first key identifies a
 * profileable View component, such as `sao`, `ibl` or `tonemap`; the nested
 * keys are writable properties on that component. This lets each profile
 * express only the properties it cares about while leaving unrelated runtime
 * state alone.
 *
 * When a profile is active, `enabled` has closed-world semantics. An effect is
 * enabled only when the active profile explicitly contains
 * `{enabled: true}` for that effect. Other properties remain sparse
 * overrides: omitted properties are left outside profile control and are
 * restored when profile ownership ends.
 *
 * The class tracks only properties it has taken over. When switching profiles,
 * it computes a single transition: removed properties are restored, newly
 * controlled properties capture restore values, shared properties transition
 * directly to their new profile values, and redundant setter calls are
 * avoided. Calls to {@link setProperties} can explicitly override the current
 * live value without mutating the active profile definition.
 *
 * Use {@link setActiveProfile} to switch profiles when callers need structured
 * failure reporting. The active profile ID is exposed as a read-only property
 * for queries.
 *
 * @example
 * ```ts
 * const profiles = new ViewProfiles(view, {
 *   profiles: {
 *     fast: {
 *       sao: {enabled: false},
 *       ibl: {enabled: false},
 *       resolutionScale: {enabled: true, resolutionScale: 0.75}
 *     },
 *     realistic: {
 *       sao: {enabled: true, intensity: 0.16},
 *       ibl: {enabled: true, intensity: 0.7},
 *       shadows: {enabled: true}
 *     }
 *   },
 *   activeProfile: "realistic"
 * });
 *
 * profiles.setActiveProfile("fast");
 * ```
 */
export class ViewProfiles {

  /**
   * View whose effect and lighting components are controlled by this
   * `ViewProfiles` instance.
   */
  public readonly view: View;

  private readonly _profiles = new Map<string, ViewProfile>();
  private readonly _managed = new Map<PropertyPath, ManagedPropertyState>();
  private _activeProfile: string | null = null;

  /**
   * Creates a profile controller for a View.
   *
   * The supplied profiles are cloned before storage. If
   * {@link ViewProfilesParams.activeProfile | activeProfile} is supplied, it is
   * activated through the normal transition path, including closed-world
   * `enabled` handling and restore-state capture.
   *
   * @param view View to control.
   * @param params Initial profile registry and optional active profile.
   */
  constructor(view: View, params: ViewProfilesParams = {}) {
    this.view = view;
    this.fromParams(params);
  }

  /**
   * ID of the currently active profile, or `null` when no profile is active.
   *
   * This is read-only because profile activation can fail. Use
   * {@link setActiveProfile} to change it and inspect the returned
   * {@link base!core.SDKResult | SDKResult}.
   */
  get activeProfile(): string | null {
    return this._activeProfile;
  }

  /**
   * Returns `true` when a profile with the given ID is registered.
   *
   * @param id Profile ID.
   */
  hasProfile(id: string): boolean {
    return this._profiles.has(id);
  }

  /**
   * Gets a cloned profile definition.
   *
   * Mutating the returned object does not affect this instance. Use
   * {@link setProfile} to replace a profile.
   *
   * @param id Profile ID.
   * @returns A cloned profile, or `undefined` when the ID is not registered.
   */
  getProfile(id: string): ViewProfile | undefined {
    const profile = this._profiles.get(id);
    return profile ? cloneProfile(profile) : undefined;
  }

  /**
   * Adds a profile.
   *
   * The operation validates all referenced effects and properties before
   * mutating the registry. The profile is cloned before storage.
   *
   * @param id New profile ID. Must be a non-empty string.
   * @param profile Profile definition.
   * @returns An `SDKResult` containing validation or duplicate-ID errors.
   */
  addProfile(id: string, profile: ViewProfile): SDKResult<void> {
    const idResult = this._validateProfileId(id, "addProfile");
    if (idResult.ok === false) return idResult;
    if (this._profiles.has(id)) {
      return this._error(SDKErrorType.InvalidOperation, `[ViewProfiles.addProfile] Profile "${id}" already exists.`);
    }
    const validation = this._validateProfile(profile, "addProfile");
    if (validation.ok === false) return validation;
    this._profiles.set(id, cloneProfile(profile));
    return {ok: true, value: undefined};
  }

  /**
   * Creates or replaces a profile.
   *
   * When replacing the active profile, the live View is transitioned using the
   * same diff machinery as {@link setActiveProfile}. Runtime overrides made
   * through {@link setProperties} remain in effect unless the replaced profile
   * explicitly changes that same property, in which case the profile reclaims
   * control of that property.
   *
   * @param id Profile ID. Must be a non-empty string.
   * @param profile New profile definition.
   * @returns An `SDKResult` containing validation errors, if any.
   */
  setProfile(id: string, profile: ViewProfile): SDKResult<void> {
    const idResult = this._validateProfileId(id, "setProfile");
    if (idResult.ok === false) return idResult;
    const validation = this._validateProfile(profile, "setProfile");
    if (validation.ok === false) return validation;

    const oldProfile = this._profiles.get(id);
    const newProfile = cloneProfile(profile);
    const reclaimPaths = oldProfile && id === this._activeProfile
      ? this._changedControlledPaths(oldProfile, newProfile)
      : new Set<PropertyPath>();

    if (id === this._activeProfile) {
      const transition = this._transitionToProfile(newProfile, {
        preserveOverridesForUnchanged: true,
        reclaimPaths
      });
      if (transition.ok === false) return transition;
    }

    this._profiles.set(id, newProfile);
    return {ok: true, value: undefined};
  }

  /**
   * Removes a profile.
   *
   * Removing the active profile clears profile control first, restoring all
   * currently managed properties to their underlying runtime values, then
   * leaves {@link activeProfile} as `null`.
   *
   * @param id Profile ID.
   * @returns An `SDKResult` containing not-found or validation errors.
   */
  removeProfile(id: string): SDKResult<void> {
    const idResult = this._validateProfileId(id, "removeProfile");
    if (idResult.ok === false) return idResult;
    if (!this._profiles.has(id)) {
      return this._error(SDKErrorType.ResourceNotFound, `[ViewProfiles.removeProfile] Profile "${id}" was not found.`);
    }
    if (id === this._activeProfile) {
      const result = this._transitionToProfile(null);
      if (result.ok === false) return result;
      this._activeProfile = null;
    }
    this._profiles.delete(id);
    return {ok: true, value: undefined};
  }

  /**
   * Activates a profile or clears profile control.
   *
   * Passing `null` restores all state currently owned by `ViewProfiles` and
   * leaves the View without an active profile. Passing an ID applies that
   * profile as a single diff: properties already controlled by both profiles
   * transition directly to their new values, removed properties are restored,
   * new properties capture restore values, and redundant setter calls are
   * avoided.
   *
   * While a profile is active, only effects explicitly configured with
   * `enabled: true` remain enabled. Omitted effects, and effects without
   * `enabled: true`, are disabled.
   *
   * @param id Profile ID to activate, or `null` to clear.
   * @returns An `SDKResult` containing not-found or validation errors.
   */
  setActiveProfile(id: string | null): SDKResult<void> {
    if (id === this._activeProfile) {
      return {ok: true, value: undefined};
    }
    if (id === null) {
      const result = this._transitionToProfile(null);
      if (result.ok === false) return result;
      this._activeProfile = null;
      return {ok: true, value: undefined};
    }
    const idResult = this._validateProfileId(id, "setActiveProfile");
    if (idResult.ok === false) return idResult;
    const profile = this._profiles.get(id);
    if (!profile) {
      return this._error(SDKErrorType.ResourceNotFound, `[ViewProfiles.setActiveProfile] Profile "${id}" was not found.`);
    }
    const result = this._transitionToProfile(profile);
    if (result.ok === false) return result;
    this._activeProfile = id;
    return {ok: true, value: undefined};
  }

  /**
   * Writes effect properties as explicit runtime state.
   *
   * This accepts the same shape as a profile but does not mutate profile
   * definitions. If a written property is currently profile-managed, its
   * restore value is updated and the live property is marked as externally
   * overridden for the current activation. Subsequent unrelated active-profile
   * edits will not reapply the old profile value; a transition to another
   * profile, or an edit to that exact active-profile property, can reclaim
   * profile control.
   *
   * The full batch is validated before any effect is mutated.
   *
   * @param properties Sparse effect-property map to write.
   * @returns An `SDKResult` containing validation errors, if any.
   */
  setProperties(properties: ViewEffectProperties): SDKResult<void> {
    const resolved = this._resolveProperties(properties, "setProperties");
    if (resolved.ok === false) return copyError(resolved);

    for (const prop of resolved.value.values()) {
      const state = this._managed.get(prop.key);
      if (state) {
        state.restoreValue = prop.value;
        state.externallyOverridden = true;
      }
    }
    this._applyResolvedProperties(resolved.value);
    return {ok: true, value: undefined};
  }

  /**
   * Replaces this instance's serializable configuration from plain params.
   *
   * Profiles and the requested active profile are validated before existing
   * state is cleared. If validation succeeds, current profile ownership is
   * cleared, the registry is replaced, and the requested active profile is
   * activated through {@link setActiveProfile}.
   *
   * Runtime restore values and external override state are not accepted from
   * params; they are recomputed for the current View.
   *
   * @param params Serializable profile configuration.
   * @returns An `SDKResult` containing validation or activation errors.
   */
  fromParams(params: ViewProfilesParams): SDKResult<void> {
    if (!params || typeof params !== "object") {
      return this._error(SDKErrorType.InvalidInput, "[ViewProfiles.fromParams] Expected params object.");
    }
    const profiles = params.profiles || {};
    if (typeof profiles !== "object") {
      return this._error(SDKErrorType.InvalidInput, "[ViewProfiles.fromParams] Expected profiles object.");
    }
    for (const id of Object.keys(profiles)) {
      const idResult = this._validateProfileId(id, "fromParams");
      if (idResult.ok === false) return idResult;
      const validation = this._validateProfile(profiles[id]!, "fromParams");
      if (validation.ok === false) return validation;
    }
    if (params.activeProfile !== undefined && params.activeProfile !== null && !profiles[params.activeProfile]) {
      return this._error(SDKErrorType.ResourceNotFound, `[ViewProfiles.fromParams] Active profile "${params.activeProfile}" was not found.`);
    }

    // Validate the complete replacement before clearing current state, so
    // routine input failures leave the existing profiles and live View state
    // unchanged.
    const clearResult = this.setActiveProfile(null);
    if (clearResult.ok === false) return clearResult;
    this._profiles.clear();
    for (const id of Object.keys(profiles)) {
      this._profiles.set(id, cloneProfile(profiles[id]!));
    }
    if (params.activeProfile !== undefined && params.activeProfile !== null) {
      return this.setActiveProfile(params.activeProfile);
    }
    return {ok: true, value: undefined};
  }

  /**
   * Serializes profile definitions and the active profile ID.
   *
   * The returned profile definitions are cloned. Runtime restore state,
   * effect object references and external override bookkeeping are not
   * serialized.
   *
   * @returns An `SDKResult` whose value can be passed to
   * {@link fromParams} for the same View context or to a new
   * `ViewProfiles` instance for another View.
   */
  toParams(): SDKResult<ViewProfilesParams> {
    const profiles: Record<string, ViewProfile> = {};
    for (const [id, profile] of this._profiles) {
      profiles[id] = cloneProfile(profile);
    }
    return {
      ok: true,
      value: {
        profiles,
        activeProfile: this._activeProfile
      }
    };
  }

  private _transitionToProfile(profile: ViewProfile | null, options: TransitionOptions = {}): SDKResult<void> {
    const next: SDKResult<ExpandedProfile> = profile
      ? this._expandProfile(profile, "setActiveProfile")
      : {ok: true, value: {values: new Map<PropertyPath, ResolvedProperty>()}};
    if (next.ok === false) return copyError(next);

    const desired = new Map<PropertyPath, ResolvedProperty>();
    const removals: ResolvedProperty[] = [];
    const nextValues = next.value.values;

    for (const [key, state] of this._managed) {
      const nextProp = nextValues.get(key);
      if (!nextProp) {
        const resolved = this._resolvePropertyByPath(key, state.restoreValue, "setActiveProfile");
        if (resolved.ok === false) return copyError(resolved);
        removals.push(resolved.value);
      }
    }

    for (const [key, prop] of nextValues) {
      const state = this._managed.get(key);
      const reclaim = options.reclaimPaths?.has(key) === true;
      if (state) {
        state.profileValue = prop.value;
        if (reclaim || !options.preserveOverridesForUnchanged) {
          state.externallyOverridden = false;
        }
        if (!state.externallyOverridden) {
          desired.set(key, prop);
        }
      } else {
        this._managed.set(key, {
          restoreValue: this._readProperty(prop.effect, prop.property),
          profileValue: prop.value,
          externallyOverridden: false
        });
        desired.set(key, prop);
      }
    }

    for (const prop of removals) {
      desired.set(prop.key, prop);
    }
    this._applyResolvedProperties(desired);
    for (const prop of removals) {
      this._managed.delete(prop.key);
    }
    return {ok: true, value: undefined};
  }

  private _expandProfile(profile: ViewProfile, operation: string): SDKResult<ExpandedProfile> {
    const resolved = this._resolveProperties(profile, operation);
    if (resolved.ok === false) return copyError(resolved);
    for (const effectId of ENABLED_EFFECT_IDS) {
      const effect = EFFECT_RESOLVERS[effectId](this.view);
      if (!isObject(effect)) {
        return this._error(SDKErrorType.ResourceNotFound, `[ViewProfiles.${operation}] Effect "${effectId}" was not found.`);
      }
      const validation = this._validateWritableProperty(effect, effectId, "enabled", operation);
      if (validation.ok === false) return copyError(validation);
      const profileEffect = profile[effectId];
      const enabled = profileEffect?.enabled === true;
      resolved.value.set(`${effectId}.enabled`, {
        key: `${effectId}.enabled`,
        effectId,
        property: "enabled",
        effect,
        value: enabled
      });
    }
    return {ok: true, value: {values: resolved.value}};
  }

  private _resolveProperties(properties: ViewEffectProperties, operation: string): SDKResult<Map<PropertyPath, ResolvedProperty>> {
    if (!properties || typeof properties !== "object") {
      return this._error(SDKErrorType.InvalidInput, `[ViewProfiles.${operation}] Expected effect property map.`);
    }
    const aliasValidation = this._validateAliases(properties, operation);
    if (aliasValidation.ok === false) return copyError(aliasValidation);
    const resolved = new Map<PropertyPath, ResolvedProperty>();
    const propertyMap = properties as EffectPropertiesRecord;
    for (const rawEffectId of Object.keys(properties)) {
      const effectProps = propertyMap[rawEffectId];
      if (!effectProps || typeof effectProps !== "object" || Array.isArray(effectProps)) {
        return this._error(SDKErrorType.InvalidInput, `[ViewProfiles.${operation}] Expected property map for effect "${rawEffectId}".`);
      }
      const effectId = normalizeEffectId(rawEffectId);
      const resolver = EFFECT_RESOLVERS[effectId];
      if (!resolver) {
        return this._error(SDKErrorType.ResourceNotFound, `[ViewProfiles.${operation}] Effect "${rawEffectId}" was not found.`);
      }
      const effect = resolver(this.view);
      if (!isObject(effect)) {
        return this._error(SDKErrorType.ResourceNotFound, `[ViewProfiles.${operation}] Effect "${rawEffectId}" was not found.`);
      }
      for (const property of Object.keys(effectProps)) {
        const validation = this._validateWritableProperty(effect, effectId, property, operation);
        if (validation.ok === false) return copyError(validation);
        resolved.set(`${effectId}.${property}`, {
          key: `${effectId}.${property}`,
          effectId,
          property,
          effect,
          value: effectProps[property]
        });
      }
    }
    return {ok: true, value: resolved};
  }

  private _resolvePropertyByPath(key: PropertyPath, value: unknown, operation: string): SDKResult<ResolvedProperty> {
    const dot = key.indexOf(".");
    const effectId = key.slice(0, dot);
    const property = key.slice(dot + 1);
    const resolver = EFFECT_RESOLVERS[effectId as ViewProfileEffectId];
    if (!resolver) {
      return this._error(SDKErrorType.ResourceNotFound, `[ViewProfiles.${operation}] Effect "${effectId}" was not found.`);
    }
    const effect = resolver(this.view);
    if (!isObject(effect)) {
      return this._error(SDKErrorType.ResourceNotFound, `[ViewProfiles.${operation}] Effect "${effectId}" was not found.`);
    }
    const validation = this._validateWritableProperty(effect, effectId, property, operation);
    if (validation.ok === false) return copyError(validation);
    return {ok: true, value: {key, effectId, property, effect, value}};
  }

  private _validateWritableProperty(effect: EffectObject, effectId: string, property: string, operation: string): SDKResult<void> {
    if (!(property in effect)) {
      return this._error(SDKErrorType.InvalidInput, `[ViewProfiles.${operation}] Property "${effectId}.${property}" does not exist.`);
    }
    const descriptor = findPropertyDescriptor(effect, property);
    if (descriptor && descriptor.set === undefined && descriptor.writable !== true) {
      return this._error(SDKErrorType.InvalidInput, `[ViewProfiles.${operation}] Property "${effectId}.${property}" is not writable.`);
    }
    return {ok: true, value: undefined};
  }

  private _validateProfile(profile: ViewProfile, operation: string): SDKResult<void> {
    const result = this._expandProfile(profile, operation);
    if (result.ok === false) {
      return copyError(result);
    }
    return {ok: true, value: undefined};
  }

  private _validateProfileId(id: string, operation: string): SDKResult<void> {
    if (typeof id !== "string" || id.length === 0) {
      return this._error(SDKErrorType.InvalidInput, `[ViewProfiles.${operation}] Profile ID must be a non-empty string.`);
    }
    return {ok: true, value: undefined};
  }

  private _validateAliases(properties: ViewEffectProperties, operation: string): SDKResult<void> {
    if (Object.prototype.hasOwnProperty.call(properties, "tonemap") &&
      Object.prototype.hasOwnProperty.call(properties, "toneMap")) {
      return this._error(SDKErrorType.InvalidInput, `[ViewProfiles.${operation}] Specify either "tonemap" or "toneMap", not both.`);
    }
    return {ok: true, value: undefined};
  }

  private _changedControlledPaths(oldProfile: ViewProfile, newProfile: ViewProfile): Set<PropertyPath> {
    const oldExpanded = this._expandProfile(oldProfile, "setProfile");
    const newExpanded = this._expandProfile(newProfile, "setProfile");
    const changed = new Set<PropertyPath>();
    if (oldExpanded.ok === false || newExpanded.ok === false) return changed;
    for (const [key, next] of newExpanded.value.values) {
      const prev = oldExpanded.value.values.get(key);
      if (!prev || !sameValue(prev.value, next.value)) {
        changed.add(key);
      }
    }
    for (const key of oldExpanded.value.values.keys()) {
      if (!newExpanded.value.values.has(key)) {
        changed.add(key);
      }
    }
    return changed;
  }

  private _applyResolvedProperties(properties: Map<PropertyPath, ResolvedProperty>): void {
    const nonEnabled: ResolvedProperty[] = [];
    const enabled: ResolvedProperty[] = [];
    for (const prop of properties.values()) {
      if (prop.property === "enabled") {
        enabled.push(prop);
      } else {
        nonEnabled.push(prop);
      }
    }
    for (const prop of nonEnabled) this._assignIfChanged(prop);
    for (const prop of enabled) this._assignIfChanged(prop);
  }

  private _assignIfChanged(prop: ResolvedProperty): void {
    if (sameValue(this._readProperty(prop.effect, prop.property), prop.value)) return;
    prop.effect[prop.property] = prop.value;
  }

  private _readProperty(effect: EffectObject, property: string): unknown {
    return effect[property];
  }

  private _error(type: SDKErrorType, error: string): SDKResult<any> {
    return this.view.viewer.logError({ok: false, type, error});
  }
}

function normalizeEffectId(effectId: string): ViewProfileEffectId {
  return (effectId === "toneMap" ? "tonemap" : effectId) as ViewProfileEffectId;
}

function cloneProfile(profile: ViewProfile): ViewProfile {
  const result: ViewProfile = {};
  const source = profile as Record<string, Record<string, unknown> | undefined>;
  const target = result as Record<string, Record<string, unknown>>;
  for (const effectId of Object.keys(profile || {})) {
    const props = source[effectId];
    if (!props) continue;
    target[normalizeEffectId(effectId)] = {...props};
  }
  return result;
}

function isObject(value: unknown): value is EffectObject {
  return typeof value === "object" && value !== null;
}

function findPropertyDescriptor(object: object, property: string): PropertyDescriptor | undefined {
  let current: object | null = object;
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, property);
    if (descriptor) return descriptor;
    current = Object.getPrototypeOf(current);
  }
  return undefined;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (isArrayLike(a) && isArrayLike(b) && a.length === b.length) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    for (let i = 0; i < a.length; i++) {
      if (!sameValue(a[i], b[i])) return false;
    }
    return true;
  }
  return Object.is(a, b);
}

function copyError<T>(result: { ok: false; error: string; type: SDKErrorType }): SDKResult<T> {
  return {ok: false, type: result.type, error: result.error};
}

function isArrayLike(value: unknown): value is ArrayLike<unknown> {
  return Array.isArray(value) || ArrayBuffer.isView(value);
}
