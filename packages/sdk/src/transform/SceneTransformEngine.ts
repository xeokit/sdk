import { identityMat4, inverseMat4, mulMat4 } from "../matrix";
import type { FloatArrayParam } from "../math";
import { SceneTransform } from ".../scene/SceneTransform";

/** Optional callback for renderer upload when a world matrix updates */
export interface TransformEngineOptions {
    onWorldMatrixUpdate?: (node: SceneTransform, world: FloatArrayParam) => void;
}

/** Internal cache entry per node */
interface Entry {
    world: FloatArrayParam;       // cached world matrix (Float64)
    key: number;               // (parentWorldVersion << 2) ^ node._localVersion
    worldVersion: number;      // increments whenever world changes
}

export class SceneTransformEngine {
    private cache = new WeakMap<SceneTransform, Entry>();
    private opts: TransformEngineOptions;

    // scratch buffers to avoid temp allocs
    private _tmpA = new Float64Array(16);
    private _tmpB = new Float64Array(16);

    constructor(opts: TransformEngineOptions = {}) {
        this.opts = opts;
    }

    /** Ensure cache entry exists */
    private _entry(node: SceneTransform): Entry {
        let e = this.cache.get(node);
        if (!e) {
            e = { world: new Float64Array(16), key: 0, worldVersion: 0 };
            identityMat4(e.world as unknown as FloatArrayParam);
            this.cache.set(node, e);
        }
        return e;
    }

    /** Returns current worldVersion for a node (ensures up-to-date) */
    private _getWorldVersion(node: SceneTransform, force = false): number {
        this.getWorldMatrix(node, force);
        return this._entry(node).worldVersion;
    }

    /**
     * Compute (or retrieve cached) world matrix for a node.
     * Lazy: uses (parentWorldVersion, localVersion) to know if recompute is needed.
     */
    getWorldMatrix(node: SceneTransform, force = false): FloatArrayParam {
        const parent = node.parentTransform;
        const parentWV = parent ? this._getWorldVersion(parent, force) : 0;

        const e = this._entry(node);
        const key = (parentWV << 2) ^ (node as any)._localVersion;

        if (force || e.key !== key) {
            if (parent) {
                const pWorld = this._entry(parent).world;
                mulMat4(
                    pWorld as unknown as FloatArrayParam,
                    node.matrix as unknown as FloatArrayParam,
                    e.world as unknown as FloatArrayParam
                );
            } else {
                // world = local
                // @ts-ignore
                e.world.set(node.matrix as unknown as FloatArrayParam);
            }
            e.key = key;
            e.worldVersion++;

            // optional renderer upload
            this.opts.onWorldMatrixUpdate?.(node, e.world);
        }
        return e.world;
    }

    /**
     * Set a node's local matrix (64-bit) and invalidate cache lazily.
     */
    setLocalMatrix(node: SceneTransform, m: FloatArrayParam | null): void {
        if (m) {
            // @ts-ignore
            (node.matrix as FloatArrayParam).set(m);
        } else {
            identityMat4(node.matrix as unknown as FloatArrayParam);
        }
        (node as any)._localVersion++;
        // no deep invalidation required; lazy keys handle it
    }

    /**
     * Reparent with optional world preservation.
     * When preserveWorld is true:
     *   local' = inverse(parentNext.world) * oldWorld
     */
    setParent(node: SceneTransform, next: SceneTransform | null, opts?: { preserveWorld?: boolean }): void {
        if (next === node) throw new Error("Cannot parent to self");
        const preserve = !!opts?.preserveWorld;

        if (!preserve) {
            node._attachParentTransform(next);
            return;
        }

        // save current world
        const oldWorld = this.getWorldMatrix(node, /*force*/ false);
        // tmpA = oldWorld
        // @ts-ignore
        this._tmpA.set(oldWorld);

        node._attachParentTransform(next);

        if (next) {
            const parentWorld = this.getWorldMatrix(next, /*force*/ false);
            // tmpB = inv(parentWorld)
            inverseMat4(
                parentWorld as unknown as FloatArrayParam,
                this._tmpB as unknown as FloatArrayParam
            );
            // local' = tmpB * oldWorld
            mulMat4(
                this._tmpB as unknown as FloatArrayParam,
                this._tmpA as unknown as FloatArrayParam,
                node.matrix as unknown as FloatArrayParam
            );
        } else {
            // local' = oldWorld
            // @ts-ignore
            (node.matrix as FloatArrayParam).set(this._tmpA);
        }

        (node as any)._localVersion++;
    }

    /**
     * Convenience: get a stable version token you can use for renderer-side caching.
     */
    getWorldVersion(node: SceneTransform): number {
        return this._getWorldVersion(node);
    }

    /**
     * Optional: pre-warm a subtree’s caches (iterative walk) for a renderer frame.
     * You can call this once per frame for visible nodes.
     */
    warmSubtree(root: SceneTransform): void {
        const stack: SceneTransform[] = [root];
        while (stack.length) {
            const n = stack.pop()!;
            this.getWorldMatrix(n);
            const kids = n.childTransforms;
            for (let i = 0; i < kids.length; i++) stack.push(kids[i] as SceneTransform);
        }
    }

    /** Clear all cached world matrices (e.g., if you swap matrix libs) */
    clear(): void {
        this.cache = new WeakMap();
    }
}
