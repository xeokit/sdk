import type {SceneCollisionIndex} from "../collision/SceneCollisionIndex";
import type {UpdateItemsMessage} from "./CullingProtocol";

/**
 * Main-thread bookkeeping for the bounds the culling worker mirrors.
 *
 * Each scene object is assigned a dense integer index (reused via a free list)
 * so the worker can speak compact integer arrays instead of string ids. The
 * mirror tracks which objects changed since the last flush and, on
 * {@link marshal}, reads their current world bounding spheres straight from the
 * shared {@link SceneCollisionIndex} — that index already keeps per-object
 * world AABBs in sync with the Scene, so there's nothing to recompute here.
 *
 * Bounds are derived as a sphere: centre = AABB centre, radius = half the AABB
 * space diagonal (matching the worker's sphere tests).
 */
export class CullBoundsMirror {

  readonly #collisionIndex: SceneCollisionIndex;

  // objectId ⇄ dense index, plus the cullable flag per index.
  readonly #indexOf = new Map<string, number>();
  readonly #objectIdOf: (string | null)[] = [];
  readonly #cullableOf: boolean[] = [];

  // Recycled dense indices, and the change-sets pending the next flush.
  readonly #freeList: number[] = [];
  readonly #dirty = new Set<number>();
  #removed: number[] = [];

  constructor(collisionIndex: SceneCollisionIndex) {
    this.#collisionIndex = collisionIndex;
  }

  /**
   * Registers or re-registers an object and marks it for the next flush.
   *
   * @param objectId - The {@link SceneObject.id}.
   * @param cullable - Whether the object may be size-culled (false for
   * screen-fixed-size geometry such as points).
   * @returns The object's dense index.
   */
  put(objectId: string, cullable: boolean): number {
    let index = this.#indexOf.get(objectId);
    if (index === undefined) {
      index = this.#freeList.length > 0 ? this.#freeList.pop()! : this.#objectIdOf.length;
      this.#indexOf.set(objectId, index);
      this.#objectIdOf[index] = objectId;
      // If this index was freed and is being reused in the same batch, cancel
      // its pending removal so the worker doesn't delete the fresh entry.
      const r = this.#removed.indexOf(index);
      if (r !== -1) {
        this.#removed.splice(r, 1);
      }
    }
    this.#cullableOf[index] = cullable;
    this.#dirty.add(index);
    return index;
  }

  /**
   * Marks a known object's bounds as changed. No-op for unknown ids.
   */
  touch(objectId: string): void {
    const index = this.#indexOf.get(objectId);
    if (index !== undefined) {
      this.#dirty.add(index);
    }
  }

  /**
   * Removes an object and frees its index for reuse. No-op for unknown ids.
   */
  remove(objectId: string): void {
    const index = this.#indexOf.get(objectId);
    if (index === undefined) {
      return;
    }
    this.#indexOf.delete(objectId);
    this.#objectIdOf[index] = null;
    this.#dirty.delete(index);
    this.#freeList.push(index);
    this.#removed.push(index);
  }

  /**
   * The object id at a dense index, or `undefined` if vacant. Used to
   * translate worker cull results back into {@link SceneObject.id}s.
   */
  objectIdAt(index: number): string | undefined {
    return this.#objectIdOf[index] ?? undefined;
  }

  /**
   * Whether there are pending adds/updates/removes to flush.
   */
  get pending(): boolean {
    return this.#dirty.size > 0 || this.#removed.length > 0;
  }

  /**
   * Packs all pending changes into an {@link UpdateItemsMessage}, clearing the
   * pending sets. Returns `null` when there is nothing to send.
   *
   * Dirty objects without bounds yet (e.g. created but not populated) are kept
   * dirty and retried on the next flush.
   */
  marshal(): UpdateItemsMessage | null {
    if (!this.pending) {
      return null;
    }

    const indices: number[] = [];
    const centers: number[] = [];
    const radii: number[] = [];
    const cullable: number[] = [];
    const retry: number[] = [];

    for (const index of this.#dirty) {
      const objectId = this.#objectIdOf[index];
      if (objectId == null) {
        continue; // removed after being dirtied
      }
      const aabb = this.#collisionIndex.getObjectAABB(objectId);
      if (!aabb) {
        retry.push(index); // no bounds yet — try again next flush
        continue;
      }
      const dx = aabb[3] - aabb[0];
      const dy = aabb[4] - aabb[1];
      const dz = aabb[5] - aabb[2];
      indices.push(index);
      centers.push((aabb[0] + aabb[3]) * 0.5, (aabb[1] + aabb[4]) * 0.5, (aabb[2] + aabb[5]) * 0.5);
      radii.push(0.5 * Math.sqrt(dx * dx + dy * dy + dz * dz));
      cullable.push(this.#cullableOf[index] ? 1 : 0);
    }

    this.#dirty.clear();
    for (const index of retry) {
      this.#dirty.add(index);
    }

    const removed = this.#removed;
    this.#removed = [];

    if (indices.length === 0 && removed.length === 0) {
      return null;
    }

    return {
      type: "UpdateItems",
      indices,
      centers: new Float64Array(centers),
      radii: new Float64Array(radii),
      cullable: new Uint8Array(cullable),
      removed
    };
  }
}
