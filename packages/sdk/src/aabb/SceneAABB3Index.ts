import {
  createAABB3Float64, collapseAABB3,
  expandAABB3, expandAABB3Point3, type AABB3Float
} from "../math/boundaries";
import type {Scene, SceneMesh, SceneObject} from "../scene";
import {createVec3Float64, createVec4Float64, type Mat4, type Vec3Float, type Vec3, transformPoint4} from "../math";
import type {FloatArrayParam} from "../math";

const tempVec4a = createVec4Float64();
const tempVec4b = createVec4Float64();

/**
 * Computes the world-space AABB for a set of compressed positions using a transform matrix.
 * Writes the result into the given `worldAABB` array.
 */
function getPositionsWorldAABB3(
  positionsCompressed: FloatArrayParam,
  aabb: AABB3Float,
  matrix: Mat4,
  worldAABB: AABB3Float
): AABB3Float {
  collapseAABB3(worldAABB);
  const xScale = (aabb[3] - aabb[0]) / 65535;
  const xOffset = aabb[0];
  const yScale = (aabb[4] - aabb[1]) / 65535;
  const yOffset = aabb[1];
  const zScale = (aabb[5] - aabb[2]) / 65535;
  const zOffset = aabb[2];

  for (let i = 0, len = positionsCompressed.length; i < len; i += 3) {
    tempVec4a[0] = positionsCompressed[i] * xScale + xOffset;
    tempVec4a[1] = positionsCompressed[i + 1] * yScale + yOffset;
    tempVec4a[2] = positionsCompressed[i + 2] * zScale + zOffset;
    tempVec4a[3] = 1.0;
    transformPoint4(matrix, tempVec4a, tempVec4b);
    expandAABB3Point3(worldAABB, <Vec3>tempVec4b);
  }

  return worldAABB;
}

/**
 * Caches and maintains axis-aligned bounding boxes (AABBs) for {@link SceneMesh} and {@link SceneObject} instances
 * in a {@link Scene}, using lazy evaluation and dirty flags.
 */
export class SceneAABB3Index {

  #scene: Scene;
  #meshAABBs = new Map<string, AABB3Float>();
  #objectAABBs = new Map<string, AABB3Float>();
  #meshDirty = new Set<string>();
  #objectDirty = new Set<string>();
  #unsubscribers: (() => void)[] = [];
  #sceneAABB: AABB3Float;
  #sceneAABBDirty: boolean;
  #sceneCenter: Vec3Float;

  /**
   * Constructs a new SceneAABB3Index for the given {@link Scene}.
   * @param scene The scene to tileIndex.
   */
  constructor(scene: Scene) {
    this.#scene = scene;

    this.#sceneAABB = createAABB3Float64();
    this.#sceneCenter = createVec3Float64();
    this.#sceneAABBDirty = true;

    // Mark initial meshes and objects dirty
    // @ts-ignore
    for (const object of Object.values(scene.objects)) {
      for (const mesh of object.meshes) {
        this.#meshDirty.add(mesh.id);
      }
      this.#objectDirty.add(object.id);
    }

    // Subscribe to Scene events
    this.#unsubscribers.push(
      scene.events.onSceneObjectCreated.subscribe((_, object) => {
        for (const mesh of object.meshes) {
          this.#meshDirty.add(mesh.id);
        }
        this.#objectDirty.add(object.id);
      }),

      scene.events.onSceneMeshMoved.subscribe((_, mesh) => {
        this.#meshDirty.add(mesh.id);
        if (mesh.object) {
          this.#objectDirty.add(mesh.object.id);
        }
      }),

      scene.events.onSceneObjectDestroyed.subscribe((_, object) => {
        for (const mesh of object.meshes) {
          this.#meshAABBs.delete(mesh.id);
          this.#meshDirty.delete(mesh.id);
        }
        this.#objectAABBs.delete(object.id);
        this.#objectDirty.delete(object.id);
      }),

      scene.events.onSceneModelDestroyed.subscribe((_, model) => {
        // @ts-ignore
        for (const object of Object.values(model.objects)) {
          for (const mesh of object.meshes) {
            this.#meshAABBs.delete(mesh.id);
            this.#meshDirty.delete(mesh.id);
          }
          this.#objectAABBs.delete(object.id);
          this.#objectDirty.delete(object.id);
        }
      })
    );
  }

  #getMeshAABB(mesh: SceneMesh): AABB3Float {
    let aabb = this.#meshAABBs.get(mesh.id);
    if (!aabb) {
      aabb = createAABB3Float64();
      this.#meshAABBs.set(mesh.id, aabb);
    }

    if (this.#meshDirty.has(mesh.id)) {
      getPositionsWorldAABB3(
        mesh.geometry.positionsCompressed,
        mesh.geometry.aabb,
        mesh.matrix,
        aabb
      );
      this.#meshDirty.delete(mesh.id);
    }

    return aabb;
  }

  #getObjectAABB(objectId: string): AABB3Float | null {
    const object = this.#scene.objects[objectId];
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
        const meshAABB = this.#getMeshAABB(mesh);
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
    if (this.#objectDirty.size > 0) {
      collapseAABB3(this.#sceneAABB);
      // @ts-ignore
      for (const object of Object.values(this.#scene.objects)) {
        const aabb = this.#getObjectAABB(object.id);
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
    if (this.#sceneAABBDirty) {
      this.getSceneAABB();
    }
    this.#sceneCenter[0] = (this.#sceneAABB[0] + this.#sceneAABB[3]) * 0.5;
    this.#sceneCenter[1] = (this.#sceneAABB[1] + this.#sceneAABB[4]) * 0.5;
    this.#sceneCenter[2] = (this.#sceneAABB[2] + this.#sceneAABB[5]) * 0.5;
    this.#sceneCenter[3] = 1.0; // Homogeneous coordinate
    return this.#sceneCenter;
  }

  /**
   * Gets the combined AABB of the given {@link SceneObject} IDs.
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
      const aabb = this.#getObjectAABB(objectId);
      if (aabb) {
        expandAABB3(result, aabb);
        foundAny = true;
      }
    }

    return foundAny ? result : null;
  }

  /**
   * Gets the cached or computed AABB of a single {@link SceneObject}, if available.
   *
   * @param objectId The SceneObject ID.
   * @returns AABB or `null` if the object does not exist or has no meshes.
   */
  getObjectAABB(objectId: string): AABB3Float | null {
    return this.#getObjectAABB(objectId);
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


const sceneIndexes = {};

/**
 *
 * @param scene
 */
export function getSceneAABBIndex(scene: Scene) {
  let sceneIndex = sceneIndexes[scene.id];
  if (!sceneIndex) {
    sceneIndex = sceneIndexes[scene.id] = new SceneAABB3Index(scene);
    scene.events.onSceneDestroyed.sub((scene, _) => {
      sceneIndex.destroy();
      delete sceneIndexes[scene.id];
    });
  }
  return sceneIndex;
}
