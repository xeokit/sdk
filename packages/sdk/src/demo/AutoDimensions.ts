import {LinesPrimitive} from "../constants";
import {SceneModel} from "../scene";
import {SceneAABB3Index} from "../collision/aabb";
import type {AABB3Float} from "../math/boundaries";
import type {Scene, SceneObject} from "../scene";
import {buildVectorTextGeometry} from "../procgen";
import type {Data} from "./../data";
import type {DataObject} from "./../data";

type Vec3 = [number, number, number];
type PlaneName = "XY" | "XZ" | "YZ";
type PlaneAxisName = "x" | "y" | "z";

type DimensionableMatch = {
  sceneObject: SceneObject;
  dataObject: DataObject;
  aabb: AABB3Float;
};

type GlobalPlanLayout = {
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
  planeCoordinate: number;
};

export class AutoDimensions {
  private readonly sceneModel: SceneModel;
  private readonly aabb3index: SceneAABB3Index;
  private readonly sourceScene: Scene;
  private readonly data?: Data;

  private readonly includedDataObjectTypes: Set<string>;

  private readonly idPrefix: string;
  private readonly color: [number, number, number];
  private readonly textColor: [number, number, number];
  private readonly offset: number;
  private readonly extensionOvershoot: number;
  private readonly tickSize: number;
  private readonly includeDegenerate: boolean;
  private readonly autoUpdate: boolean;
  private readonly plane: PlaneName;
  private readonly planeGap: number;
  private readonly explicitPlaneCoordinate?: number;
  private readonly textScale: number;
  private readonly textOffset: number;
  private readonly formatLabel: (
    value: number,
    axis: PlaneAxisName,
    sourceObjectId: string,
    dataObject: DataObject
  ) => string;

  private readonly dimensionObjectIdsBySourceObjectId = new Map<string, string[]>();
  private readonly generatedObjectIds = new Set<string>();
  private readonly generatedMeshIds = new Set<string>();
  private readonly generatedGeometryIds = new Set<string>();
  private readonly unsubscribers: Array<() => void> = [];

  private rebuildQueued = false;
  private destroyed = false;

  constructor(params: {
    sceneModel: SceneModel;
    aabb3index: SceneAABB3Index;
    scene?: Scene;
    data?: Data;
    includedDataObjectTypes?: Iterable<string>;
    plane?: PlaneName;
    planeCoordinate?: number;
    planeGap?: number;
    idPrefix?: string;
    color?: [number, number, number];
    textColor?: [number, number, number];
    offset?: number;
    extensionOvershoot?: number;
    tickSize?: number;
    includeDegenerate?: boolean;
    autoUpdate?: boolean;
    textScale?: number;
    textOffset?: number;
    formatLabel?: (
      value: number,
      axis: PlaneAxisName,
      sourceObjectId: string,
      dataObject: DataObject
    ) => string;
  }) {
    const {sceneModel, aabb3index} = params;

    this.sceneModel = sceneModel;
    this.aabb3index = aabb3index;
    this.sourceScene = params.scene ?? aabb3index.scene;
    this.data = params.data;

    this.includedDataObjectTypes = new Set(params.includedDataObjectTypes ?? []);

    const sceneSize = this._getSceneMaxSize();

    this.plane = params.plane ?? "XZ";
    this.idPrefix = params.idPrefix ?? "__autoDims__";
    this.color = params.color ?? [0.5, 0.5, 0.5];
    this.textColor = params.textColor ?? this.color;
    this.offset = params.offset ?? Math.max(sceneSize * 0.02, 0.35);
    this.extensionOvershoot = params.extensionOvershoot ?? Math.max(sceneSize * 0.008, 0.15);
    this.tickSize = params.tickSize ?? Math.max(sceneSize * 0.006, 0.12);
    this.planeGap = params.planeGap ?? Math.max(sceneSize * 0.15, 2.0);
    this.explicitPlaneCoordinate = params.planeCoordinate;
    this.includeDegenerate = params.includeDegenerate ?? false;
    this.autoUpdate = params.autoUpdate ?? true;
    this.textScale = params.textScale ?? Math.max(sceneSize * 0.006, 0.08);
    this.textOffset = params.textOffset ?? Math.max(sceneSize * 0.02, 0.3);

    this.formatLabel =
      params.formatLabel ??
      ((value) => formatDimensionValue(value));

    this.rebuild();

    if (this.autoUpdate) {
      this._bindSceneEvents();
      this._bindDataEvents();
    }
  }

  rebuild(): void {
    if (this.destroyed) {
      return;
    }

    this._clearGeneratedDimensions();

    const matches = this._getDimensionableMatches();
    if (matches.length === 0) {
      return;
    }

    const layout = this._getGlobalPlanLayout(matches);

    for (let i = 0, len = matches.length; i < len; i++) {
      this._createDimensionsForMatch(matches[i], layout);
    }
  }

  setDimensionsVisible(sourceObjectId: string, visible: boolean): void {
    const objectIds = this.dimensionObjectIdsBySourceObjectId.get(sourceObjectId);
    if (!objectIds) {
      return;
    }

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const dimensionObjectId = objectIds[i];
      const dimensionObject = this.sourceScene.objects[dimensionObjectId];
      if (dimensionObject) {
      //  dimensionObject.visible = visible;
      }
    }
  }

  showDimensions(sourceObjectId: string): void {
    this.setDimensionsVisible(sourceObjectId, true);
  }

  hideDimensions(sourceObjectId: string): void {
    this.setDimensionsVisible(sourceObjectId, false);
  }

  showAllDimensions(): void {
    for (const sourceObjectId of this.dimensionObjectIdsBySourceObjectId.keys()) {
      this.setDimensionsVisible(sourceObjectId, true);
    }
  }

  hideAllDimensions(): void {
    for (const sourceObjectId of this.dimensionObjectIdsBySourceObjectId.keys()) {
      this.setDimensionsVisible(sourceObjectId, false);
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    for (let i = 0, len = this.unsubscribers.length; i < len; i++) {
      this.unsubscribers[i]();
    }
    this.unsubscribers.length = 0;

    this._clearGeneratedDimensions();
    this.destroyed = true;
  }

  private _bindSceneEvents(): void {
    const events = this.sourceScene.events;

    this.unsubscribers.push(
      events.onSceneObjectCreated.subscribe((_scene, sceneObject) => {
        if (sceneObject.model === this.sceneModel) {
          return;
        }
        this._queueRebuild();
      }),

      events.onSceneObjectDestroyed.subscribe((_scene, sceneObject) => {
        if (sceneObject.model === this.sceneModel) {
          return;
        }
        this._queueRebuild();
      }),

      events.onSceneMeshMoved.subscribe((_scene, sceneMesh) => {
        if (sceneMesh.model === this.sceneModel) {
          return;
        }
        this._queueRebuild();
      }),

      events.onSceneMeshGeometryChanged.subscribe((_scene, sceneMesh) => {
        if (sceneMesh.model === this.sceneModel) {
          return;
        }
        this._queueRebuild();
      }),

      events.onSceneModelDestroyed.subscribe((_scene, sceneModel) => {
        if (sceneModel === this.sceneModel) {
          this.destroy();
          return;
        }
        this._queueRebuild();
      }),

      events.onSceneDestroyed.subscribe(() => {
        this.destroy();
      })
    );
  }

  private _bindDataEvents(): void {
    if (!this.data) {
      return;
    }

    const events = this.data.events;

    this.unsubscribers.push(
      events.onDataModelCreated.subscribe(() => {
        this._queueRebuild();
      }),

      events.onDataModelDestroyed.subscribe(() => {
        this._queueRebuild();
      }),

      events.onDataObjectCreated.subscribe((_data, dataObject) => {
        if (this._matchesIncludedDataObjectTypes(dataObject)) {
          this._queueRebuild();
        }
      }),

      events.onDataObjectDestroyed.subscribe((_data, dataObject) => {
        if (this._matchesIncludedDataObjectTypes(dataObject)) {
          this._queueRebuild();
        }
      }),

      events.onDataDestroyed.subscribe(() => {
        this.destroy();
      })
    );
  }

  private _queueRebuild(): void {
    if (this.destroyed || this.rebuildQueued) {
      return;
    }

    this.rebuildQueued = true;

    queueMicrotask(() => {
      this.rebuildQueued = false;
      if (!this.destroyed) {
        this.rebuild();
      }
    });
  }

  private _getDimensionableMatches(): DimensionableMatch[] {
    const matches: DimensionableMatch[] = [];
    const sceneObjects = this.sourceScene.objects;

    for (const objectId in sceneObjects) {
      const sceneObject = sceneObjects[objectId];
      if (!sceneObject) {
        continue;
      }

      if (sceneObject.model === this.sceneModel) {
        continue;
      }

      const dataObject = this._getMatchingDataObject(sceneObject.id);
      if (!dataObject) {
        continue;
      }

      const aabb = this.aabb3index.getObjectAABB(sceneObject.id);
      if (!aabb) {
        continue;
      }

      matches.push({
        sceneObject,
        dataObject,
        aabb
      });
    }

    return matches;
  }

  private _getMatchingDataObject(id: string): DataObject | null {
    if (!this.data) {
      return null;
    }

    const dataObject = this.data.objects[id];
    if (!dataObject) {
      return null;
    }

    if (!this._matchesIncludedDataObjectTypes(dataObject)) {
      return null;
    }

    return dataObject;
  }

  private _matchesIncludedDataObjectTypes(dataObject: DataObject): boolean {
    if (this.includedDataObjectTypes.size === 0) {
      return true;
    }
    return this.includedDataObjectTypes.has(dataObject.type);
  }

  private _createDimensionsForMatch(match: DimensionableMatch, layout: GlobalPlanLayout): void {
    const {sceneObject, dataObject, aabb} = match;
    const generatedObjectIds: string[] = [];
    const [axisA, axisB] = this._getPlaneAxes();

    const sizeA = this._getAxisMax(aabb, axisA) - this._getAxisMin(aabb, axisA);
    const sizeB = this._getAxisMax(aabb, axisB) - this._getAxisMin(aabb, axisB);

    if (this.includeDegenerate || sizeA > 1e-9) {
      const dimA = this._buildDimensionForAxis(sceneObject.id, dataObject, aabb, axisA, layout);
      if (dimA) {
        generatedObjectIds.push(...dimA.objectIds);
      }
    }

    if (this.includeDegenerate || sizeB > 1e-9) {
      const dimB = this._buildDimensionForAxis(sceneObject.id, dataObject, aabb, axisB, layout);
      if (dimB) {
        generatedObjectIds.push(...dimB.objectIds);
      }
    }

    if (generatedObjectIds.length > 0) {
      this.dimensionObjectIdsBySourceObjectId.set(sceneObject.id, generatedObjectIds);
    }
  }

  private _buildDimensionForAxis(
    sourceObjectId: string,
    dataObject: DataObject,
    aabb: AABB3Float,
    axis: PlaneAxisName,
    layout: GlobalPlanLayout
  ): {objectIds: string[]} | null {
    const segments = this._buildSegmentsForAxis(aabb, axis, layout);

    const lineObject = this._createLineDimensionObject(sourceObjectId, axis, segments);
    if (!lineObject) {
      return null;
    }

    const value = this._getAxisMax(aabb, axis) - this._getAxisMin(aabb, axis);
    const label = this.formatLabel(value, axis, sourceObjectId, dataObject);

    const labelPlacement = this._getLabelPlacement(aabb, axis, layout);

    const textObject = this._createTextLabelObject(
      sourceObjectId,
      axis,
      label,
      labelPlacement.position,
      labelPlacement.rotation
    );

    const objectIds = [lineObject.objectId];
    if (textObject) {
      objectIds.push(textObject.objectId);
    }

    return {objectIds};
  }

  private _getGlobalPlanLayout(matches: DimensionableMatch[]): GlobalPlanLayout {
    const [axisA, axisB] = this._getPlaneAxes();

    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;

    for (let i = 0, len = matches.length; i < len; i++) {
      const aabb = matches[i].aabb;
      minA = Math.min(minA, this._getAxisMin(aabb, axisA));
      maxA = Math.max(maxA, this._getAxisMax(aabb, axisA));
      minB = Math.min(minB, this._getAxisMin(aabb, axisB));
      maxB = Math.max(maxB, this._getAxisMax(aabb, axisB));
    }

    return {
      minA,
      maxA,
      minB,
      maxB,
      planeCoordinate: this._getPlaneCoordinate()
    };
  }

  private _buildSegmentsForAxis(
    aabb: AABB3Float,
    axis: PlaneAxisName,
    layout: GlobalPlanLayout
  ): Array<[Vec3, Vec3]> {
    switch (this.plane) {
      case "XY":
        return axis === "x"
          ? this._buildXY_X_DimensionSegments(aabb, layout)
          : this._buildXY_Y_DimensionSegments(aabb, layout);

      case "YZ":
        return axis === "y"
          ? this._buildYZ_Y_DimensionSegments(aabb, layout)
          : this._buildYZ_Z_DimensionSegments(aabb, layout);

      case "XZ":
      default:
        return axis === "x"
          ? this._buildXZ_X_DimensionSegments(aabb, layout)
          : this._buildXZ_Z_DimensionSegments(aabb, layout);
    }
  }

  private _buildXZ_X_DimensionSegments(aabb: AABB3Float, layout: GlobalPlanLayout): Array<[Vec3, Vec3]> {
    const minX = aabb[0];
    const minZ = aabb[2];
    const maxX = aabb[3];

    const y = layout.planeCoordinate;
    const z = layout.maxB + this.offset;

    const a: Vec3 = [minX, y, z];
    const b: Vec3 = [maxX, y, z];

    const extA0: Vec3 = [minX, y, minZ];
    const extA1: Vec3 = [minX, y, z + this.extensionOvershoot];

    const extB0: Vec3 = [maxX, y, minZ];
    const extB1: Vec3 = [maxX, y, z + this.extensionOvershoot];

    const tickA0: Vec3 = [minX, y, z - this.tickSize];
    const tickA1: Vec3 = [minX, y, z + this.tickSize];

    const tickB0: Vec3 = [maxX, y, z - this.tickSize];
    const tickB1: Vec3 = [maxX, y, z + this.tickSize];

    return [
      [extA0, extA1],
      [extB0, extB1],
      [a, b],
      [tickA0, tickA1],
      [tickB0, tickB1]
    ];
  }

  private _buildXZ_Z_DimensionSegments(aabb: AABB3Float, layout: GlobalPlanLayout): Array<[Vec3, Vec3]> {
    const minX = aabb[0];
    const minZ = aabb[2];
    const maxZ = aabb[5];

    const y = layout.planeCoordinate;
    const x = layout.minA - this.offset;

    const a: Vec3 = [x, y, minZ];
    const b: Vec3 = [x, y, maxZ];

    const extA0: Vec3 = [minX, y, minZ];
    const extA1: Vec3 = [x - this.extensionOvershoot, y, minZ];

    const extB0: Vec3 = [minX, y, maxZ];
    const extB1: Vec3 = [x - this.extensionOvershoot, y, maxZ];

    const tickA0: Vec3 = [x - this.tickSize, y, minZ];
    const tickA1: Vec3 = [x + this.tickSize, y, minZ];

    const tickB0: Vec3 = [x - this.tickSize, y, maxZ];
    const tickB1: Vec3 = [x + this.tickSize, y, maxZ];

    return [
      [extA0, extA1],
      [extB0, extB1],
      [a, b],
      [tickA0, tickA1],
      [tickB0, tickB1]
    ];
  }

  private _buildXY_X_DimensionSegments(aabb: AABB3Float, layout: GlobalPlanLayout): Array<[Vec3, Vec3]> {
    const minX = aabb[0];
    const minY = aabb[1];
    const maxX = aabb[3];

    const z = layout.planeCoordinate;
    const y = layout.maxB + this.offset;

    const a: Vec3 = [minX, y, z];
    const b: Vec3 = [maxX, y, z];

    const extA0: Vec3 = [minX, minY, z];
    const extA1: Vec3 = [minX, y + this.extensionOvershoot, z];

    const extB0: Vec3 = [maxX, minY, z];
    const extB1: Vec3 = [maxX, y + this.extensionOvershoot, z];

    const tickA0: Vec3 = [minX, y - this.tickSize, z];
    const tickA1: Vec3 = [minX, y + this.tickSize, z];

    const tickB0: Vec3 = [maxX, y - this.tickSize, z];
    const tickB1: Vec3 = [maxX, y + this.tickSize, z];

    return [
      [extA0, extA1],
      [extB0, extB1],
      [a, b],
      [tickA0, tickA1],
      [tickB0, tickB1]
    ];
  }

  private _buildXY_Y_DimensionSegments(aabb: AABB3Float, layout: GlobalPlanLayout): Array<[Vec3, Vec3]> {
    const maxX = aabb[3];
    const minY = aabb[1];
    const maxY = aabb[4];

    const z = layout.planeCoordinate;
    const x = layout.maxA + this.offset;

    const a: Vec3 = [x, minY, z];
    const b: Vec3 = [x, maxY, z];

    const extA0: Vec3 = [maxX, minY, z];
    const extA1: Vec3 = [x + this.extensionOvershoot, minY, z];

    const extB0: Vec3 = [maxX, maxY, z];
    const extB1: Vec3 = [x + this.extensionOvershoot, maxY, z];

    const tickA0: Vec3 = [x - this.tickSize, minY, z];
    const tickA1: Vec3 = [x + this.tickSize, minY, z];

    const tickB0: Vec3 = [x - this.tickSize, maxY, z];
    const tickB1: Vec3 = [x + this.tickSize, maxY, z];

    return [
      [extA0, extA1],
      [extB0, extB1],
      [a, b],
      [tickA0, tickA1],
      [tickB0, tickB1]
    ];
  }

  private _buildYZ_Y_DimensionSegments(aabb: AABB3Float, layout: GlobalPlanLayout): Array<[Vec3, Vec3]> {
    const minY = aabb[1];
    const minZ = aabb[2];
    const maxY = aabb[4];

    const x = layout.planeCoordinate;
    const z = layout.maxB + this.offset;

    const a: Vec3 = [x, minY, z];
    const b: Vec3 = [x, maxY, z];

    const extA0: Vec3 = [x, minY, minZ];
    const extA1: Vec3 = [x, minY, z + this.extensionOvershoot];

    const extB0: Vec3 = [x, maxY, minZ];
    const extB1: Vec3 = [x, maxY, z + this.extensionOvershoot];

    const tickA0: Vec3 = [x, minY, z - this.tickSize];
    const tickA1: Vec3 = [x, minY, z + this.tickSize];

    const tickB0: Vec3 = [x, maxY, z - this.tickSize];
    const tickB1: Vec3 = [x, maxY, z + this.tickSize];

    return [
      [extA0, extA1],
      [extB0, extB1],
      [a, b],
      [tickA0, tickA1],
      [tickB0, tickB1]
    ];
  }

  private _buildYZ_Z_DimensionSegments(aabb: AABB3Float, layout: GlobalPlanLayout): Array<[Vec3, Vec3]> {
    const minY = aabb[1];
    const minZ = aabb[2];
    const maxZ = aabb[5];

    const x = layout.planeCoordinate;
    const y = layout.minA - this.offset;

    const a: Vec3 = [x, y, minZ];
    const b: Vec3 = [x, y, maxZ];

    const extA0: Vec3 = [x, minY, minZ];
    const extA1: Vec3 = [x, y - this.extensionOvershoot, minZ];

    const extB0: Vec3 = [x, minY, maxZ];
    const extB1: Vec3 = [x, y - this.extensionOvershoot, maxZ];

    const tickA0: Vec3 = [x, y - this.tickSize, minZ];
    const tickA1: Vec3 = [x, y + this.tickSize, minZ];

    const tickB0: Vec3 = [x, y - this.tickSize, maxZ];
    const tickB1: Vec3 = [x, y + this.tickSize, maxZ];

    return [
      [extA0, extA1],
      [extB0, extB1],
      [a, b],
      [tickA0, tickA1],
      [tickB0, tickB1]
    ];
  }

  private _getLabelPlacement(
    aabb: AABB3Float,
    axis: PlaneAxisName,
    layout: GlobalPlanLayout
  ): { position: Vec3; rotation?: Vec3 } {
    switch (this.plane) {
      case "XY":
        return axis === "x"
          ? {
            position: [
              (aabb[0] + aabb[3]) * 0.5,
              layout.maxB + this.offset + this.textOffset,
              layout.planeCoordinate
            ],
            rotation: [0, 0, 0]
          }
          : {
            position: [
              layout.maxA + this.offset + this.textOffset,
              (aabb[1] + aabb[4]) * 0.5,
              layout.planeCoordinate
            ],
            rotation: [0, 0, 90]
          };

      case "YZ":
        return axis === "y"
          ? {
            position: [
              layout.planeCoordinate,
              (aabb[1] + aabb[4]) * 0.5,
              layout.maxB + this.offset + this.textOffset
            ],
            rotation: [0, 90, 90]
          }
          : {
            position: [
              layout.planeCoordinate,
              layout.minA - this.offset - this.textOffset,
              (aabb[2] + aabb[5]) * 0.5
            ],
            rotation: [90, 90, 0]
          };

      case "XZ":
      default:
        return axis === "x"
          ? {
            position: [
              (aabb[0] + aabb[3]) * 0.5,
              layout.planeCoordinate,
              layout.maxB + this.offset + this.textOffset
            ],
            rotation: [90, 0, 0]
          }
          : {
            position: [
              layout.minA - this.offset - this.textOffset,
              layout.planeCoordinate,
              (aabb[2] + aabb[5]) * 0.5
            ],
            rotation: [90, 0, 90]
          };
    }
  }

  private _createTextLabelObject(
    sourceObjectId: string,
    axisName: PlaneAxisName,
    text: string,
    position: Vec3,
    rotation?: Vec3
  ): { objectId: string } | null {
    const textGeometryResult = buildVectorTextGeometry({size: 1, origin: [0, 0, 0], text});
    if (textGeometryResult.ok === false) {
      console.error(textGeometryResult.error);
      return null;
    }

    const textGeometry = textGeometryResult.value;
    const geometryId = `${this.idPrefix}${sourceObjectId}-${this.plane}-${axisName}-label-geometry`;
    const meshId = `${this.idPrefix}${sourceObjectId}-${this.plane}-${axisName}-label-mesh`;
    const objectId = `${this.idPrefix}${sourceObjectId}-${this.plane}-${axisName}-label-object`;

    const geometryResult = this.sceneModel.createGeometry({
      id: geometryId,
      primitive: LinesPrimitive,
      positions: textGeometry.positions,
      indices: textGeometry.indices
    });

    if (geometryResult.ok === false) {
      console.error(geometryResult.error);
      return null;
    }

    const meshResult = this.sceneModel.createMesh({
      id: meshId,
      geometryId,
      position,
      rotation,
      scale: [this.textScale, this.textScale, this.textScale],
      color: this.textColor
    });

    if (meshResult.ok === false) {
      console.error(meshResult.error);
      const geometry = this.sceneModel.geometries[geometryId];
      if (geometry) {
        geometry.destroy();
      }
      return null;
    }

    const objectResult = this.sceneModel.createObject({
      id: objectId,
      meshIds: [meshId]
    });

    if (objectResult.ok === false) {
      console.error(objectResult.error);
      const mesh = this.sceneModel.meshes[meshId];
      if (mesh) {
        mesh.destroy();
      }
      const geometry = this.sceneModel.geometries[geometryId];
      if (geometry) {
        geometry.destroy();
      }
      return null;
    }

    this.generatedGeometryIds.add(geometryId);
    this.generatedMeshIds.add(meshId);
    this.generatedObjectIds.add(objectId);

    return {objectId};
  }

  private _createLineDimensionObject(
    sourceObjectId: string,
    axisName: PlaneAxisName,
    segments: Array<[Vec3, Vec3]>
  ): {objectId: string} | null {
    const {positions, indices} = buildLineGeometry(segments);

    const geometryId = `${this.idPrefix}${sourceObjectId}-${this.plane}-${axisName}-geometry`;
    const meshId = `${this.idPrefix}${sourceObjectId}-${this.plane}-${axisName}-mesh`;
    const objectId = `${this.idPrefix}${sourceObjectId}-${this.plane}-${axisName}-object`;

    const geometryResult = this.sceneModel.createGeometry({
      id: geometryId,
      primitive: LinesPrimitive,
      positions,
      indices
    });

    if (geometryResult.ok === false) {
      console.error(geometryResult.error);
      return null;
    }

    const meshResult = this.sceneModel.createMesh({
      id: meshId,
      geometryId,
      color: this.color
    });

    if (meshResult.ok === false) {
      console.error(meshResult.error);
      const geometry = this.sceneModel.geometries[geometryId];
      if (geometry) {
        geometry.destroy();
      }
      return null;
    }

    const objectResult = this.sceneModel.createObject({
      id: objectId,
      meshIds: [meshId]
    });

    if (objectResult.ok === false) {
      console.error(objectResult.error);
      const mesh = this.sceneModel.meshes[meshId];
      if (mesh) {
        mesh.destroy();
      }
      const geometry = this.sceneModel.geometries[geometryId];
      if (geometry) {
        geometry.destroy();
      }
      return null;
    }

    this.generatedGeometryIds.add(geometryId);
    this.generatedMeshIds.add(meshId);
    this.generatedObjectIds.add(objectId);

    return {objectId};
  }

  private _clearGeneratedDimensions(): void {
    this.dimensionObjectIdsBySourceObjectId.clear();

    for (const objectId of this.generatedObjectIds) {
      const object = this.sceneModel.objects[objectId];
      if (object) {
        object.destroy();
      }
    }
    this.generatedObjectIds.clear();

    for (const meshId of this.generatedMeshIds) {
      const mesh = this.sceneModel.meshes[meshId];
      if (mesh) {
        mesh.destroy();
      }
    }
    this.generatedMeshIds.clear();

    for (const geometryId of this.generatedGeometryIds) {
      const geometry = this.sceneModel.geometries[geometryId];
      if (geometry) {
        geometry.destroy();
      }
    }
    this.generatedGeometryIds.clear();
  }

  private _getPlaneAxes(): [PlaneAxisName, PlaneAxisName] {
    switch (this.plane) {
      case "XY":
        return ["x", "y"];
      case "YZ":
        return ["y", "z"];
      case "XZ":
      default:
        return ["x", "z"];
    }
  }

  private _getAxisMin(aabb: AABB3Float, axis: PlaneAxisName): number {
    switch (axis) {
      case "x":
        return aabb[0];
      case "y":
        return aabb[1];
      case "z":
        return aabb[2];
    }
  }

  private _getAxisMax(aabb: AABB3Float, axis: PlaneAxisName): number {
    switch (axis) {
      case "x":
        return aabb[3];
      case "y":
        return aabb[4];
      case "z":
        return aabb[5];
    }
  }

  private _getPlaneCoordinate(): number {
    if (this.explicitPlaneCoordinate !== undefined) {
      return this.explicitPlaneCoordinate;
    }

    const sceneAABB = this.aabb3index.getSceneAABB();

    switch (this.plane) {
      case "XY":
        return sceneAABB[5] + this.planeGap;
      case "YZ":
        return sceneAABB[3] + this.planeGap;
      case "XZ":
      default:
        return sceneAABB[4] + this.planeGap;
    }
  }

  private _getSceneMaxSize(): number {
    const sceneAABB = this.aabb3index.getSceneAABB();
    const sizeX = sceneAABB[3] - sceneAABB[0];
    const sizeY = sceneAABB[4] - sceneAABB[1];
    const sizeZ = sceneAABB[5] - sceneAABB[2];
    return Math.max(sizeX, sizeY, sizeZ, 1);
  }
}

function buildLineGeometry(segments: Array<[Vec3, Vec3]>): {positions: number[]; indices: number[]} {
  const positions: number[] = [];
  const indices: number[] = [];
  let index = 0;

  for (let i = 0, len = segments.length; i < len; i++) {
    const [a, b] = segments[i];
    positions.push(
      a[0], a[1], a[2],
      b[0], b[1], b[2]
    );
    indices.push(index, index + 1);
    index += 2;
  }

  return {positions, indices};
}

function formatDimensionValue(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return `${rounded}`;
}
