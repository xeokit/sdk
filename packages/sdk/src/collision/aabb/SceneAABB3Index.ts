import {
  createAABB3Float64,
  collapseAABB3,
  expandAABB3,
  type AABB3Float
} from "../../math/boundaries";
import type {Scene, SceneMesh} from "../../scene";
import {createVec3Float64, type Vec3Float} from "../../math/vector";
import {type Mat4} from "../../math/matrix";

/**
 * Computes the world-space AABB for a local-space AABB using an affine 4x4 matrix.
 *
 * Assumes `matrix` is a flattened WebGL-style 4x4 matrix (column-major).
 * This uses the center/extents method, which is O(1) and handles affine
 * translation, rotation, non-uniform scale, negative scale, and shear.
 */
function getAABBWorldAABB3(
  localAABB: AABB3Float,
  matrix: Mat4,
  worldAABB: AABB3Float
): AABB3Float {
  const minX = localAABB[0];
  const minY = localAABB[1];
  const minZ = localAABB[2];
  const maxX = localAABB[3];
  const maxY = localAABB[4];
  const maxZ = localAABB[5];

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;

  const ex = (maxX - minX) * 0.5;
  const ey = (maxY - minY) * 0.5;
  const ez = (maxZ - minZ) * 0.5;

  // WebGL-style flattened 4x4 matrix (column-major)
  const m00 = matrix[0];
  const m01 = matrix[4];
  const m02 = matrix[8];
  const m03 = matrix[12];

  const m10 = matrix[1];
  const m11 = matrix[5];
  const m12 = matrix[9];
  const m13 = matrix[13];

  const m20 = matrix[2];
  const m21 = matrix[6];
  const m22 = matrix[10];
  const m23 = matrix[14];

  const worldCx = m00 * cx + m01 * cy + m02 * cz + m03;
  const worldCy = m10 * cx + m11 * cy + m12 * cz + m13;
  const worldCz = m20 * cx + m21 * cy + m22 * cz + m23;

  const worldEx = Math.abs(m00) * ex + Math.abs(m01) * ey + Math.abs(m02) * ez;
  const worldEy = Math.abs(m10) * ex + Math.abs(m11) * ey + Math.abs(m12) * ez;
  const worldEz = Math.abs(m20) * ex + Math.abs(m21) * ey + Math.abs(m22) * ez;

  worldAABB[0] = worldCx - worldEx;
  worldAABB[1] = worldCy - worldEy;
  worldAABB[2] = worldCz - worldEz;
  worldAABB[3] = worldCx + worldEx;
  worldAABB[4] = worldCy + worldEy;
  worldAABB[5] = worldCz + worldEz;

  return worldAABB;
}

/**
 * Caches and maintains axis-aligned bounding boxes (AABBs) for SceneMesh
 * instances and SceneObjects in a Scene, using lazy evaluation and dirty flags.
 */
export class SceneAABB3Index {
  /**
   * The Scene for which this index computes AABBs.
   */
  public readonly scene: Scene;

  #meshAABBs = new Map<string, AABB3Float>();
  #objectAABBs = new Map<string, AABB3Float>();
  #meshDirty = new Set<string>();
  #objectDirty = new Set<string>();
  #unsubscribers: (() => void)[] = [];
  #sceneAABB: AABB3Float;
  #sceneAABBDirty: boolean;
  #sceneCenter: Vec3Float;

  /**
   * Constructs a new SceneAABB3Index for the given Scene.
   * @param scene The scene to tileIndex.
   */
  constructor(scene: Scene) {
    this.scene = scene;

    this.#sceneAABB = createAABB3Float64();
    this.#sceneCenter = createVec3Float64();
    this.#sceneAABBDirty = true;

    // Mark initial meshes and objects dirty
    // @ts-ignore
    for (const object of Object.values(scene.objects)) {
      for (const mesh of object.meshes) {
        const meshId = `${mesh.object.id}-${mesh.id}`;
        this.#meshDirty.add(meshId);
      }
      this.#objectDirty.add(object.id);
    }

    // Subscribe to Scene events
    this.#unsubscribers.push(
      scene.events.onSceneObjectCreated.subscribe((_, object) => {
        for (const mesh of object.meshes) {
          const meshId = `${mesh.object.id}-${mesh.id}`;
          this.#meshDirty.add(meshId);
        }
        this.#objectDirty.add(object.id);
        this.#sceneAABBDirty = true;
      }),

      scene.events.onSceneMeshMoved.subscribe((_, mesh) => {
        const meshId = `${mesh.object.id}-${mesh.id}`;
        this.#meshDirty.add(meshId);
        if (mesh.object) {
          this.#objectDirty.add(mesh.object.id);
        }
        this.#sceneAABBDirty = true;
      }),

      scene.events.onSceneObjectDestroyed.subscribe((_, object) => {
        for (const mesh of object.meshes) {
          const meshId = `${object.id}-${mesh.id}`;
          this.#meshAABBs.delete(meshId);
          this.#meshDirty.delete(meshId);
        }
        this.#objectAABBs.delete(object.id);
        this.#objectDirty.delete(object.id);
        this.#sceneAABBDirty = true;
      }),

      scene.events.onSceneModelDestroyed.subscribe((_, model) => {
        // @ts-ignore
        for (const object of Object.values(model.objects)) {
          for (const mesh of object.meshes) {
            const meshId = `${mesh.object.id}-${mesh.id}`;
            this.#meshAABBs.delete(meshId);
            this.#meshDirty.delete(meshId);
          }
          this.#objectAABBs.delete(object.id);
          this.#objectDirty.delete(object.id);
        }
        this.#sceneAABBDirty = true;
      })
    );
  }

  getMeshAABB(mesh: SceneMesh): AABB3Float {
    const meshId = `${mesh.object.id}-${mesh.id}`;
    let aabb = this.#meshAABBs.get(meshId);
    if (!aabb) {
      aabb = createAABB3Float64();
      this.#meshAABBs.set(meshId, aabb);
    }

    if (this.#meshDirty.has(meshId)) {
      getAABBWorldAABB3(mesh.geometry.aabb, mesh.worldMatrix, aabb);
      this.#meshDirty.delete(meshId);
    }

    return aabb;
  }

  /**
   * Gets the cached or computed AABB of a single SceneObject, if available.
   *
   * @param objectId The SceneObject ID.
   * @returns AABB or `null` if the object does not exist or has no meshes.
   */
  getObjectAABB(objectId: string): AABB3Float | null {
    const object = this.scene.objects[objectId];
    if (!object) return null;

    let aabb = this.#objectAABBs.get(objectId);
    if (!aabb) {
      aabb = createAABB3Float64();
      this.#objectAABBs.set(objectId, aabb);
    }

    if (this.#objectDirty.has(objectId)) {
      collapseAABB3(aabb);
      let found = false;

      for (const mesh of object.meshes) {
        const meshAABB = this.getMeshAABB(mesh);
        expandAABB3(aabb, meshAABB);
        found = true;
      }

      if (!found) {
        this.#objectAABBs.delete(objectId);
        return null;
      }

      this.#objectDirty.delete(objectId);
    }

    return aabb;
  }

  /**
   * Gets the combined axis-aligned bounding box (AABB) of the entire scene.
   */
  getSceneAABB(): AABB3Float {
    if (this.#sceneAABBDirty || this.#objectDirty.size > 0) {
      collapseAABB3(this.#sceneAABB);

      // @ts-ignore
      for (const object of Object.values(this.scene.objects)) {
        const aabb = this.getObjectAABB(object.id);
        if (aabb) {
          expandAABB3(this.#sceneAABB, aabb);
        }
      }

      this.#sceneAABBDirty = false;
    }

    return this.#sceneAABB;
  }

  /**
   * Gets the center of the scene's AABB.
   */
  getSceneCenter(): Vec3Float {
    if (this.#sceneAABBDirty || this.#objectDirty.size > 0) {
      this.getSceneAABB();
    }

    this.#sceneCenter[0] = (this.#sceneAABB[0] + this.#sceneAABB[3]) * 0.5;
    this.#sceneCenter[1] = (this.#sceneAABB[1] + this.#sceneAABB[4]) * 0.5;
    this.#sceneCenter[2] = (this.#sceneAABB[2] + this.#sceneAABB[5]) * 0.5;

    return this.#sceneCenter;
  }

  /**
   * Gets the combined AABB of the given SceneObject IDs.
   * Only includes objects that are currently registered and valid.
   *
   * @param objectIds The list of SceneObject IDs.
   * @returns Combined AABB, or `null` if none found.
   */
  getCombinedObjectAABB(objectIds: string[]): AABB3Float | null {
    const result = createAABB3Float64();
    collapseAABB3(result);
    let foundAny = false;

    for (const objectId of objectIds) {
      const aabb = this.getObjectAABB(objectId);
      if (aabb) {
        expandAABB3(result, aabb);
        foundAny = true;
      }
    }

    return foundAny ? result : null;
  }

  /**
   * Destroys this tileIndex and releases internal resources.
   *
   * - Clears cached AABBs and dirty flags.
   * - Unsubscribes from all Scene event listeners.
   */
  destroy(): void {
    this.#meshAABBs.clear();
    this.#objectAABBs.clear();
    this.#meshDirty.clear();
    this.#objectDirty.clear();

    for (const unsubscribe of this.#unsubscribers) {
      unsubscribe();
    }
    this.#unsubscribers.length = 0;
  }
}

const sceneIndexes: Record<string, SceneAABB3Index | undefined> = {};

/**
 * Gets or creates the SceneAABB3Index for a Scene.
 *
 * @param scene
 */
export function getSceneAABB3Index(scene: Scene): SceneAABB3Index {
  let sceneIndex = sceneIndexes[scene.id];
  if (!sceneIndex) {
    sceneIndex = sceneIndexes[scene.id] = new SceneAABB3Index(scene);
    scene.events.onSceneDestroyed.sub((scene, _) => {
      sceneIndex!.destroy();
      delete sceneIndexes[scene.id];
    });
  }
  return sceneIndex;
}
