import {ModelLoader} from "../ModelLoader";
import type {ModelParser} from "../ModelParser";
import {Scene} from "../../model/scene/Scene";

// Minimal concrete loader whose parser is injected per-test, so we can observe
// SceneModel.building across the load lifecycle.
class TestLoader extends ModelLoader {
  constructor(parser: ModelParser) {
    super({format: "test", fileDataType: "arraybuffer", getVersion: () => "1", parsers: {"1": parser}});
  }
}

function freshModel() {
  const scene = new Scene();
  const sceneModel = scene.createModel({id: "m"}).value!;
  const events = {started: 0, finished: 0};
  scene.events.onSceneModelBuildStarted.subscribe(() => events.started++);
  scene.events.onSceneModelBuildFinished.subscribe(() => events.finished++);
  return {scene, sceneModel, events};
}

describe("SceneModel build state during load", () => {

  it("marks building during the parse and clears it after, with balanced events", async () => {
    const {sceneModel, events} = freshModel();
    let duringParse: boolean | undefined;
    const parser: ModelParser = async (params) => { duringParse = params.sceneModel!.building; };

    await new TestLoader(parser).load({fileData: new ArrayBuffer(8), sceneModel} as any);

    expect(duringParse).toBe(true);          // building while the parser runs
    expect(sceneModel.building).toBe(false); // cleared on completion
    expect(events).toEqual({started: 1, finished: 1});
  });

  it("clears building even when the parser rejects", async () => {
    const {sceneModel, events} = freshModel();
    const parser: ModelParser = async () => { throw new Error("boom"); };

    await expect(new TestLoader(parser).load({fileData: new ArrayBuffer(8), sceneModel} as any)).rejects.toBeDefined();

    expect(sceneModel.building).toBe(false);      // finally-cleared on the error path
    expect(events).toEqual({started: 1, finished: 1});
  });

  it("does not mark building when progressiveRender is requested", async () => {
    const {sceneModel, events} = freshModel();
    let duringParse: boolean | undefined;
    const parser: ModelParser = async (params) => { duringParse = params.sceneModel!.building; };

    await new TestLoader(parser).load({fileData: new ArrayBuffer(8), sceneModel} as any, {progressiveRender: true});

    expect(duringParse).toBe(false);
    expect(sceneModel.building).toBe(false);
    expect(events).toEqual({started: 0, finished: 0});
  });

  it("setting building to its current value is a no-op (no duplicate events)", () => {
    const {sceneModel, events} = freshModel();
    sceneModel.building = false;            // already false
    sceneModel.building = true;
    sceneModel.building = true;             // redundant
    sceneModel.building = false;
    sceneModel.building = false;            // redundant
    expect(events).toEqual({started: 1, finished: 1});
  });
});
