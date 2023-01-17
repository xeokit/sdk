/**
 * xeokit runtime statistics.
 * @type {{components: {models: number, objects: number, scenes: number, meshes: number}, memory: {indices: number, uvs: number, textures: number, materials: number, transforms: number, positions: number, programs: number, normals: number, meshes: number, colors: number}, build: {version: string}, client: {browser: string}, frame: {frameCount: number, useProgram: number, bindTexture: number, drawElements: number, bindArray: number, tasksRun: number, fps: number, drawArrays: number, tasksScheduled: number}}}
 */
declare const stats: {
    build: {
        version: string;
    };
    client: {
        browser: string;
    };
    components: {
        viewers: number;
        views: number;
        scenes: number;
        models: number;
        meshes: number;
        objects: number;
    };
    memory: {
        meshes: number;
        positions: number;
        colors: number;
        normals: number;
        uvs: number;
        indices: number;
        textures: number;
        transforms: number;
        materials: number;
        programs: number;
    };
    frame: {
        frameCount: number;
        fps: number;
        tasksRun: number;
        tasksScheduled: number;
        tasksBudget: number;
    };
};
export { stats };
