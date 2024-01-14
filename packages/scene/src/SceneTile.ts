import {Scene} from "./Scene";
import {FloatArrayParam} from "@xeokit/math";

export class SceneTile {

    public readonly scene: Scene;
    public readonly id: string;
    public readonly origin: FloatArrayParam;
    public numObjects: number;

    constructor(scene: Scene, id: string, origin: FloatArrayParam) {
        this.scene = scene;
        this.id = id;
        this.origin = origin;
        this.numObjects = 0;
    }
}