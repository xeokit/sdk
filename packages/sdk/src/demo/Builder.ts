// SceneBuilder.ts
import { SDKErrorType, type SDKResult } from "../base/core";
import { Scene } from "../model/scene/Scene";
import type { SceneParams } from "../model/scene/SceneParams";
import type { CoordinateSystemParams } from "../model/scene/CoordinateSystemParams";

import type { SceneModel } from "../model/scene/SceneModel";
import type { SceneModelParams } from "../model/scene/SceneModelParams";

import type { SceneTransformParams } from "../model/scene/SceneTransformParams";
import type { SceneGeometryParams } from "../model/scene/SceneGeometryParams";
import type { SceneGeometryCompressedParams } from "../model/scene/SceneGeometryCompressedParams";
import type { SceneMeshParams } from "../model/scene/SceneMeshParams";
import type { SceneObjectParams } from "../model/scene/SceneObjectParams";
import {Data} from "../model/data";

export class DemoBuilder {

  private scene: Scene;
  private data: Data;

  constructor(scene: Scene, data: Data) {
    this.scene = scene;
    this.data = data;
  }

  withScene(): SceneBuilder {
    return new SceneBuilder(this.scene);
  }

  // withData(): DataBuilder {
  //   return this;
  // }
}


/**
 * Fluent builder for creating a Scene and populating it with models/components.
 * Intended for tests, but reads like usage examples.
 */
export class SceneBuilder {

  private readonly scene?: Scene;

  public constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Creates (or selects) a model and returns a nested ModelBuilder.
   * - If the model already exists, returns a builder for it.
   * - If not, creates it with the given params.
   */
  withModel(id: string, params: Omit<SceneModelParams, "id"> = {}): ModelBuilder {
    const scene = this.scene;

    if (!scene.models[id]) {
      const created = scene.createModel({ ...params, id });
      this.unwrap(created, `[SceneBuilder.withModel] createModel(${id})`);
    }

    return new ModelBuilder(this, id);
  }

  /** Returns the built Scene. */
  build(): Scene {
    return this.scene;
  }

  /**
   * For tests that want an SDKResult instead of thrown errors.
   * (This wraps builder errors as InvalidOperation.)
   */
  buildResult(): SDKResult<Scene> {
    try {
      return { ok: true, value: this.scene };
    } catch (e: any) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: String(e?.message ?? e),
      };
    }
  }

  private unwrap<T>(result: SDKResult<T>, context: string): T {
    if (result.ok === false) {
      throw new Error(`${context} failed: ${result.error}`);
    }
    return result.value;
  }

  // Exposed for ModelBuilder
  _getScene(): Scene {
    return this.scene;
  }
}

/**
 * Nested builder that targets a single SceneModel inside a Scene.
 * All methods return `this` for fluent chaining, and `.done()` returns the parent SceneBuilder.
 */
export class ModelBuilder {
  private readonly parent: SceneBuilder;
  private readonly modelId: string;

  constructor(parent: SceneBuilder, modelId: string) {
    this.parent = parent;
    this.modelId = modelId;
  }

  /** Returns back to the SceneBuilder (nice for chaining multiple models). */
  done(): SceneBuilder {
    return this.parent;
  }

  /** Convenience to build the final Scene from inside a model chain. */
  build(): Scene {
    return this.parent.build();
  }

  // ---- Create operations ----

  withTransform(id: string, params: Omit<SceneTransformParams, "id"> = {}): this {
    const model = this.getModel();
    const result = model.createTransform({ ...params, id });
    this.unwrap(result, `[ModelBuilder.withTransform] createTransform(${id})`);
    return this;
  }

  withGeometry(id: string, params: Omit<SceneGeometryParams, "id">): this {
    const model = this.getModel();
    const result = model.createGeometry({ ...params, id });
    this.unwrap(result, `[ModelBuilder.withGeometry] createGeometry(${id})`);
    return this;
  }

  withCompressedGeometry(id: string, params: Omit<SceneGeometryCompressedParams, "id">): this {
    const model = this.getModel();
    const result = model.createGeometryCompressed({ ...params, id });
    this.unwrap(result, `[ModelBuilder.withCompressedGeometry] createGeometryCompressed(${id})`);
    return this;
  }

  withMesh(
    id: string,
    geometryId: string,
    params: Omit<Partial<SceneMeshParams>, "id" | "geometryId"> = {}
  ): this {
    const model = this.getModel();
    const result = model.createMesh({ ...(params as any), id, geometryId });
    this.unwrap(result, `[ModelBuilder.withMesh] createMesh(${id})`);
    return this;
  }

  withObject(
    id: string,
    meshIds: string[],
    params: Omit<Partial<SceneObjectParams>, "id" | "meshIds"> = {}
  ): this {
    const model = this.getModel();
    const result = model.createObject({ ...(params as any), id, meshIds });
    this.unwrap(result, `[ModelBuilder.withObject] createObject(${id})`);
    return this;
  }

  // ---- Light-weight “update” helpers (optional) ----
  // These are intentionally explicit: you pass the id you want to modify.

  updateTransform(id: string, updater: (t: any) => void): this {
    const model: any = this.getModel();
    const transform = model.transforms?.[id];
    if (!transform) {
      throw new Error(`[ModelBuilder.updateTransform] No transform '${id}' in model '${this.modelId}'.`);
    }
    updater(transform);
    return this;
  }

  updateMesh(id: string, updater: (m: any) => void): this {
    const model: any = this.getModel();
    const mesh = model.meshes?.[id];
    if (!mesh) {
      throw new Error(`[ModelBuilder.updateMesh] No mesh '${id}' in model '${this.modelId}'.`);
    }
    updater(mesh);
    return this;
  }

  updateObject(id: string, updater: (o: any) => void): this {
    const model: any = this.getModel();
    const obj = model.objects?.[id];
    if (!obj) {
      throw new Error(`[ModelBuilder.updateObject] No object '${id}' in model '${this.modelId}'.`);
    }
    updater(obj);
    return this;
  }

  // ---- internals ----

  private getModel(): SceneModel {
    const scene = this.parent._getScene();
    const model = scene.models[this.modelId];
    if (!model) {
      throw new Error(`[ModelBuilder] Model '${this.modelId}' not found in Scene.`);
    }
    return model;
  }

  private unwrap<T>(result: SDKResult<T>, context: string): T {
    if (result.ok === false) {
      throw new Error(`${context} failed: ${result.error}`);
    }
    return result.value;
  }
}
