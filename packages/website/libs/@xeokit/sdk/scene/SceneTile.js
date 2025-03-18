/**
 * A tile in a {@link scene!SceneModel | SceneModel}.
 *
 *
 * * {@link scene!SceneMeshParams.origin | SceneMeshParams.origin}
 * * Stored in {@link scene!SceneModel.tiles | SceneModel.tiles}
 * * Created automatically for each distinct value of {@link scene!SceneMeshParams.origin | SceneMeshParams.origin} given to {@link scene!SceneMeshParams.createMesh | SceneMeshParams.createMesh}
 * * Each SceneTile is destroyed as soon all {@link scene!SceneTile | SceneTiles} with that origin heve been destroyed
 *
 * See {@link "@xeokit/scene" | @xeokit/scene}  for usage.
 */
export class SceneTile {
    /**
     * Unique ID of this SceneTile.
     */
    id;
    /**
     * The Scene that owns this SceneTile.
     */
    scene;
    /**
     * The 3D World-space origin of this SceneTile.
     */
    origin;
    /**
     * The number of {@link scene!SceneMesh | SceneMeshes} associated with this SceneTile.
     */
    numObjects;
    /**
     * The {@link scene!SceneModel | SceneModels} belonging to this SceneTile, each keyed to
     * its {@link scene!SceneModel.id | SceneModel.id}.
     *
     * A SceneModel can belong to more than one SceneTile.
     */
    models;
    /**
     * The {@link scene!SceneObject | SceneObjects} in this SceneTile,
     * mapped to {@link scene!SceneObject.id | SceneObject.id}.
     *
     * A SceneObject can belong to more than one SceneTile.
     */
    objects;
    /**
     * @private
     * @param scene
     * @param id
     * @param origin
     */
    constructor(scene, id, origin) {
        this.scene = scene;
        this.id = id;
        this.origin = origin;
        this.numObjects = 0;
        this.models = {};
        this.objects = {};
    }
}
//# sourceMappingURL=SceneTile.js.map