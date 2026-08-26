/**
 * Per-view LOD visibility suppression.
 *
 * This is intentionally separate from ordinary application visibility. LOD
 * suppression is an additional per-view mask used by the viewing pipeline when
 * deciding which representation of an object group should be visible.
 *
 * Runtime cost model:
 *
 * - {@link setSuppressed} mutates a per-view `Set` for explicit object IDs
 *   and increments one per-view version only when the set actually changes.
 * - {@link setSelectedRep} stores a per-view representation-set selection.
 *   It builds object membership once for each supplied representation list;
 *   later switches only update the selected representation ID and bump the
 *   view version. Representation switches intentionally do not emit
 *   object-level deltas, allowing renderers to consume selection state at
 *   batch or draw-list granularity.
 * - Consumers can use {@link getViewVersion} to skip work while a view's
 *   suppression set is unchanged.
 * - A suppression change is a visibility-state change, not a scene-model
 *   mutation. It does not recreate source geometry or overwrite application
 *   visibility.
 *
 * Steady-state work is therefore a stable per-view version check plus normal
 * visibility evaluation. Representation transitions avoid whole-scene scans;
 * renderers can consume representation membership directly and reserve object
 * deltas for explicit suppression changes.
 *
 * Use representation selection when an interaction needs to switch visibility
 * for large numbers of objects at once. It is the renderer-facing fast path for
 * that case because selection state changes once per representation set instead
 * of rewriting ordinary visibility on every member object.
 */
export interface LODRepSelection {
  id: string;
  objectIds: readonly string[];
}

export interface LODRepMembership {
  selectionId: string;
  repIds: readonly string[];
}

export interface LODSuppressionDelta {
  objectIds: readonly string[];
  suppressed: boolean;
}

export interface LODSuppressionDeltas {
  fromVersion: number;
  toVersion: number;
  deltas: readonly LODSuppressionDelta[];
}

interface RepSelectionRule {
  reps: readonly LODRepSelection[];
  selectedRepId: string;
}

interface RepSelectionMembership {
  selectionId: string;
  repIds: Set<string>;
}

interface VersionedSuppressionDeltas {
  version: number;
  deltas: LODSuppressionDelta[];
}

const MAX_DELTA_HISTORY = 64;

export class LODVisibility {
  private readonly _suppressedByView: Map<string, Set<string>> = new Map();
  private readonly _repSelectionsByView: Map<string, Map<string, RepSelectionRule>> = new Map();
  private readonly _repMembershipsByView: Map<string, Map<string, RepSelectionMembership[]>> = new Map();
  private readonly _versionsByView: Map<string, number> = new Map();
  private readonly _objectSuppressionVersionsByView: Map<string, number> = new Map();
  private readonly _deltasByView: Map<string, VersionedSuppressionDeltas[]> = new Map();
  private readonly _onChanged?: (viewId: string) => void;

  /**
   * Creates a LOD visibility store.
   *
   * @param onChanged Optional callback fired when a view's suppression set changes.
   */
  constructor(onChanged?: (viewId: string) => void) {
    this._onChanged = onChanged;
  }

  /**
   * Tests whether an object is suppressed in one view.
   *
   * @param viewId View ID.
   * @param objectId Scene object ID.
   * @returns `true` when LOD selection suppresses the object in that view.
   */
  public isSuppressed(viewId: string, objectId: string): boolean {
    if (this._suppressedByView.get(viewId)?.has(objectId) === true) {
      return true;
    }
    const memberships = this._repMembershipsByView.get(viewId)?.get(objectId);
    if (!memberships) {
      return false;
    }
    const selections = this._repSelectionsByView.get(viewId);
    if (!selections) {
      return false;
    }
    for (let i = 0, len = memberships.length; i < len; i++) {
      const membership = memberships[i];
      const selection = selections.get(membership.selectionId);
      if (selection && !membership.repIds.has(selection.selectedRepId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Tests whether a renderer-side representation membership is suppressed in
   * one view.
   *
   * This is the batch-oriented form of {@link isSuppressed}. A batch or draw
   * segment is suppressed when it belongs to a selected representation set, but
   * its membership does not include the representation selected for that view.
   *
   * @param viewId View ID.
   * @param memberships Representation-set memberships shared by the batch.
   * @returns `true` when representation selection suppresses that membership.
   *
   * @internal
   */
  public isRepMembershipSuppressed(viewId: string, memberships: readonly LODRepMembership[] | null | undefined): boolean {
    if (!memberships || memberships.length === 0) {
      return false;
    }
    const selections = this._repSelectionsByView.get(viewId);
    if (!selections) {
      return false;
    }
    for (let i = 0, len = memberships.length; i < len; i++) {
      const membership = memberships[i];
      const selection = selections.get(membership.selectionId);
      if (selection && membership.repIds.indexOf(selection.selectedRepId) === -1) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets the monotonically increasing suppression version for a view.
   *
   * Consumers use this to detect per-view LOD suppression changes without
   * comparing object sets.
   *
   * @param viewId View ID.
   * @returns Current suppression version for the view.
   */
  public getViewVersion(viewId: string): number {
    return this._versionsByView.get(viewId) ?? 0;
  }

  /**
   * Gets the monotonically increasing version for explicit object suppression
   * changes in a view.
   *
   * Unlike {@link getViewVersion}, representation selection changes do not
   * affect this value. Renderers can combine this with
   * {@link getRepSelectionSignature} to cache renderer state separately for
   * each selected representation while still invalidating on explicit object
   * suppression.
   *
   * @param viewId View ID.
   * @returns Current explicit object-suppression version for the view.
   *
   * @internal
   */
  public getObjectSuppressionVersion(viewId: string): number {
    return this._objectSuppressionVersionsByView.get(viewId) ?? 0;
  }

  /**
   * Gets a stable signature for representation selections in a view.
   *
   * @param viewId View ID.
   * @returns Signature of selected representations for the view.
   *
   * @internal
   */
  public getRepSelectionSignature(viewId: string): string {
    const selections = this._repSelectionsByView.get(viewId);
    if (!selections || selections.size === 0) {
      return "";
    }
    const parts: string[] = [];
    for (const [selectionId, selection] of selections) {
      parts.push(`${selectionId}:${selection.selectedRepId}`);
    }
    parts.sort();
    return parts.join("|");
  }

  /**
   * Gets object-level suppression deltas since a previous view version.
   *
   * Renderers use this to update only objects whose effective LOD suppression
   * changed. Returns `null` when the requested version is too old and the
   * caller must resynchronize from {@link isSuppressed}.
   *
   * @param viewId View ID.
   * @param version Previously consumed view version.
   * @returns Suppression deltas, or `null` when delta history is unavailable.
   *
   * @internal
   */
  public getSuppressionDeltasSince(viewId: string, version: number): LODSuppressionDeltas | null {
    const currentVersion = this.getViewVersion(viewId);
    if (version === currentVersion) {
      return {
        fromVersion: version,
        toVersion: currentVersion,
        deltas: []
      };
    }
    if (version > currentVersion) {
      return null;
    }
    const history = this._deltasByView.get(viewId) ?? [];
    if (history.length === 0) {
      return version === currentVersion
        ? {fromVersion: version, toVersion: currentVersion, deltas: []}
        : null;
    }
    const firstVersion = history[0].version;
    if (version < firstVersion - 1) {
      return null;
    }
    const deltas: LODSuppressionDelta[] = [];
    for (let i = 0, len = history.length; i < len; i++) {
      const entry = history[i];
      if (entry.version > version) {
        deltas.push(...entry.deltas);
      }
    }
    return {
      fromVersion: version,
      toVersion: currentVersion,
      deltas
    };
  }

  /**
   * Suppresses or unsuppresses objects in one view.
   *
   * @param viewId View ID.
   * @param objectIds Scene object IDs to update.
   * @param suppressed Whether to suppress or unsuppress the objects.
   * @returns `true` when the suppression set changed.
   */
  public setSuppressed(viewId: string, objectIds: readonly string[], suppressed: boolean): boolean {
    const before = this._captureSuppression(viewId, objectIds);
    let set = this._suppressedByView.get(viewId);
    if (!set) {
      if (!suppressed) {
        return false;
      }
      set = new Set<string>();
      this._suppressedByView.set(viewId, set);
    }

    let changed = false;
    for (let i = 0, len = objectIds.length; i < len; i++) {
      const objectId = objectIds[i];
      if (suppressed) {
        if (!set.has(objectId)) {
          set.add(objectId);
          changed = true;
        }
      } else if (set.delete(objectId)) {
        changed = true;
      }
    }

    if (set.size === 0) {
      this._suppressedByView.delete(viewId);
    }
    if (changed) {
      this._bumpViewVersion(viewId, this._createDeltas(viewId, objectIds, before));
      this._bumpObjectSuppressionVersion(viewId);
    }
    return changed;
  }

 /**
   * Selects one representation within a representation set for a view.
   *
   * The supplied `reps` array is treated as stable membership metadata. This
   * method indexes it the first time it sees the array for `viewId` and
   * `selectionId`; subsequent calls with the same array and a different
   * `selectedRepId` only update the selected representation. This is the
   * intended fast path for large visibility switches, because callers select
   * the active representation once and renderers suppress the non-selected
   * representation memberships.
   *
   * @param viewId View ID.
   * @param selectionId Stable representation-set selection ID.
   * @param reps Representations and their object membership.
   * @param selectedRepId Currently selected representation ID.
   * @returns `true` when the effective LOD suppression state changed.
   */
  public setSelectedRep(
    viewId: string,
    selectionId: string,
    reps: readonly LODRepSelection[],
    selectedRepId: string
  ): boolean {
    let selections = this._repSelectionsByView.get(viewId);
    if (!selections) {
      selections = new Map();
      this._repSelectionsByView.set(viewId, selections);
    }
    const previous = selections.get(selectionId);
    const membershipChanged = !previous || previous.reps !== reps;
    const selectionChanged = !previous || previous.selectedRepId !== selectedRepId;
    if (!membershipChanged && !selectionChanged) {
      return false;
    }
    if (membershipChanged) {
      if (previous) {
        this._removeRepSelectionMembership(viewId, selectionId);
      }
      this._addRepSelectionMembership(viewId, selectionId, reps);
    }
    selections.set(selectionId, {reps, selectedRepId});
    this._bumpViewVersion(viewId);
    return true;
  }

  /**
   * Clears one representation-set selection for a view.
   *
   * @param viewId View ID.
   * @param selectionId Stable representation-set selection ID.
   * @returns `true` when a selection was removed.
   */
  public clearSelectedRep(viewId: string, selectionId: string): boolean {
    const selections = this._repSelectionsByView.get(viewId);
    const previous = selections?.get(selectionId);
    if (!selections || !previous) {
      return false;
    }
    selections.delete(selectionId);
    if (selections.size === 0) {
      this._repSelectionsByView.delete(viewId);
    }
    this._removeRepSelectionMembership(viewId, selectionId);
    this._bumpViewVersion(viewId);
    return true;
  }

  /**
   * Removes an object from every view's suppression set.
   *
   * @param objectId Scene object ID to clear.
   */
  public clearObject(objectId: string): void {
    for (const viewId of Array.from(this._suppressedByView.keys())) {
      this.setSuppressed(viewId, [objectId], false);
    }
    for (const viewId of Array.from(this._repMembershipsByView.keys())) {
      const before = this._captureSuppression(viewId, [objectId]);
      const memberships = this._repMembershipsByView.get(viewId);
      if (memberships?.delete(objectId)) {
        this._bumpViewVersion(viewId, this._createDeltas(viewId, [objectId], before));
      }
    }
  }

  /**
   * Clears all LOD suppression state and view versions.
   */
  public clear(): void {
    this._suppressedByView.clear();
    this._repSelectionsByView.clear();
    this._repMembershipsByView.clear();
    this._versionsByView.clear();
    this._objectSuppressionVersionsByView.clear();
    this._deltasByView.clear();
  }

  private _addRepSelectionMembership(
    viewId: string,
    selectionId: string,
    reps: readonly LODRepSelection[]
  ): void {
    let membershipsByObject = this._repMembershipsByView.get(viewId);
    if (!membershipsByObject) {
      membershipsByObject = new Map();
      this._repMembershipsByView.set(viewId, membershipsByObject);
    }
    const repIdsByObject = new Map<string, Set<string>>();
    for (let i = 0, len = reps.length; i < len; i++) {
      const rep = reps[i];
      for (let j = 0, objectLen = rep.objectIds.length; j < objectLen; j++) {
        const objectId = rep.objectIds[j];
        let repIds = repIdsByObject.get(objectId);
        if (!repIds) {
          repIds = new Set();
          repIdsByObject.set(objectId, repIds);
        }
        repIds.add(rep.id);
      }
    }
    for (const [objectId, repIds] of repIdsByObject) {
      let memberships = membershipsByObject.get(objectId);
      if (!memberships) {
        memberships = [];
        membershipsByObject.set(objectId, memberships);
      }
      memberships.push({selectionId, repIds});
    }
  }

  private _removeRepSelectionMembership(viewId: string, selectionId: string): void {
    const membershipsByObject = this._repMembershipsByView.get(viewId);
    if (!membershipsByObject) {
      return;
    }
    for (const [objectId, memberships] of Array.from(membershipsByObject.entries())) {
      const filtered = memberships.filter((membership) => membership.selectionId !== selectionId);
      if (filtered.length === 0) {
        membershipsByObject.delete(objectId);
      } else if (filtered.length !== memberships.length) {
        membershipsByObject.set(objectId, filtered);
      }
    }
    if (membershipsByObject.size === 0) {
      this._repMembershipsByView.delete(viewId);
    }
  }

  private _captureSuppression(viewId: string, objectIds: readonly string[]): Map<string, boolean> {
    const before = new Map<string, boolean>();
    for (let i = 0, len = objectIds.length; i < len; i++) {
      const objectId = objectIds[i];
      if (!before.has(objectId)) {
        before.set(objectId, this.isSuppressed(viewId, objectId));
      }
    }
    return before;
  }

  private _createDeltas(
    viewId: string,
    objectIds: readonly string[],
    before: Map<string, boolean>
  ): LODSuppressionDelta[] {
    const suppressed: string[] = [];
    const unsuppressed: string[] = [];
    for (let i = 0, len = objectIds.length; i < len; i++) {
      const objectId = objectIds[i];
      const beforeSuppressed = before.get(objectId);
      if (beforeSuppressed === undefined) {
        continue;
      }
      const afterSuppressed = this.isSuppressed(viewId, objectId);
      if (beforeSuppressed === afterSuppressed) {
        continue;
      }
      if (afterSuppressed) {
        suppressed.push(objectId);
      } else {
        unsuppressed.push(objectId);
      }
    }
    const deltas: LODSuppressionDelta[] = [];
    if (suppressed.length > 0) {
      deltas.push({objectIds: suppressed, suppressed: true});
    }
    if (unsuppressed.length > 0) {
      deltas.push({objectIds: unsuppressed, suppressed: false});
    }
    return deltas;
  }

  private _bumpViewVersion(viewId: string, deltas: LODSuppressionDelta[] = []): void {
    const version = (this._versionsByView.get(viewId) ?? 0) + 1;
    this._versionsByView.set(viewId, version);
    let history = this._deltasByView.get(viewId);
    if (!history) {
      history = [];
      this._deltasByView.set(viewId, history);
    }
    history.push({version, deltas});
    if (history.length > MAX_DELTA_HISTORY) {
      history.splice(0, history.length - MAX_DELTA_HISTORY);
    }
    this._onChanged?.(viewId);
  }

  private _bumpObjectSuppressionVersion(viewId: string): void {
    this._objectSuppressionVersionsByView.set(viewId, (this._objectSuppressionVersionsByView.get(viewId) ?? 0) + 1);
  }
}
