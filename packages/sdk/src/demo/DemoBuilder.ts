import {createVec3Float64, type Vec3} from "../base/math/vector";
import {Data, DataModel} from "../model/data";
import { Scene, SceneModel} from "../model/scene";
import {createUUID} from "../base/utils";
import {IFCLoader} from "../formats/ifc";

/**
 * A builder class for creating demo models in the scene. This class can be extended to include methods for building
 * various types of demo models, such as tables, chairs, or other simple geometries. The builder can utilize the
 * SceneModel and DataModel to create and manage the demo models effectively.
 *
 * - fluent API for building demo models
 */

export class DemoBuilder {


  private _position: Vec3 = createVec3Float64([0, 0, 0]);
  private _rotation: Vec3 =createVec3Float64([0, 0, 0]);
  private _scale: Vec3 = createVec3Float64([1, 1, 1]);
  private _scene: Scene;
  private _data: Data;
  private _coordSysParams: { origin: number[]; units: string; basis: number[] };
  private _sceneModel: SceneModel;
  private _dataModel: DataModel;
  private _ifcLoader: IFCLoader;

  constructor(scene: Scene, data: Data) {
    this._scene = scene;
    this._data = data;
    this._ifcLoader = new IFCLoader();

    this.reset();
  }

  reset() : DemoBuilder {
    this.position(0, 0, 0);
    this.rotate(0, 0, 0);
    this.scale(1, 1, 1);
    this.coordSysRightHanded();
    this._sceneModel = null;
    this._dataModel = null;
    return this;
  }

  coordSysRightHanded() : DemoBuilder {
    this._coordSysParams = {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [0, 0, 0],
      units: 'meters',
    };
    return this;
    }

    coordSysLeftHanded() : DemoBuilder {
    this._coordSysParams = {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, -1],
      origin: [0, 0, 0],
      units: 'meters',
    };
    return this;
    }

  position(x: number, y: number, z: number) : DemoBuilder {
  // @ts-ignore
    this._position.set([x, y, z]);
    return this;
  }

  rotate(x: number, y: number, z: number) : DemoBuilder {
    // @ts-ignore
    this._rotation.set([x, y, z]);
    return this;
  }

  scale(x: number, y: number, z: number) : DemoBuilder {
    // @ts-ignore
    this._scale.set([x, y, z]);
    return this;
  }

  box() : DemoBuilder {
    return this;
  }

  sphere() : DemoBuilder {
    return this;
  }

  /**
   * Creates a model from a template.
   * @param generatorId
   */
  model(generatorId?: string) : DemoBuilder {
    const sceneModelResult = this._scene.createModel({
      id: createUUID(),
      position: this._position,
      rotation: this._rotation,
      scale: this._scale
    });
    if (sceneModelResult.ok === false) {
      throw new Error(`Failed to create SceneModel: ${sceneModelResult.error}`);
    }
    this._sceneModel = sceneModelResult.value;
    const dataModelResult = this._data.createModel({
      id: createUUID()
    });
    if (dataModelResult.ok === false) {
      throw new Error(`Failed to create DataModel: ${dataModelResult.error}`);
    }
    this._dataModel = dataModelResult.value;

    // buildDemoModelTable({
    //   position: this._position,
    //   sceneModel,
    //   dataModel
    // });

    return this;
  }

  load(modelId: string) : DemoBuilder {
    fetch(`../../models/IfcOpenHouse2x3/ifc/model.ifc`)
      .then(response => {
        response
          .arrayBuffer()
          .then(fileData => {

            this._ifcLoader.load({
              fileData,
              sceneModel: this._sceneModel,
              dataModel:this._dataModel
            }).then(() => {
              console.log("IFC model loaded successfully");
            }).catch(err => {
              console.error("Error loading IFC model:", err);
            });
          });
      });
    return this;
  }

}
