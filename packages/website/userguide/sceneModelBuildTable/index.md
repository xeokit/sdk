Let's use xeokit to programmatically build and view a simple 3D model in a web page.

[![](tableSceneModel.png)](./../../examples/#SceneModel_build_table/index.html)

* *[Run this example](./../../examples/#SceneModel_build_table/index.html)*

---

First install the npm modules we need:

````bash
npm install @xeokit/scene
npm install @xeokit/viewer
npm install @xeokit/cameracontrol
npm install @xeokit/webglrenderer
npm install @xeokit/core/constants
````

Then create an HTML page in `index.html` that contains a canvas element:

````html
<!DOCTYPE html>
<html>
<head>
    <title>xeokit Spinning Box</title>
</head>
<body>
<canvas id="myView1"></canvas>
</body>
<script type="module" src="./index.js"></script>
</html>
````

Then create JavaScript in `index.js` to build and view our model.

````javascript
import {Scene} from "@xeokit/scene";
import {TrianglesPrimitive} from "@xeokit/constants";
import {Viewer} from "@xeokit/viewer";
import {WebGLRenderer} from "@xeokit/webglrenderer";
import {CameraControl} from "@xeokit/cameracontrol";

const scene = new Scene();

const viewer = new Viewer({
    id: "demoViewer",
    scene,
    renderer: new WebGLRenderer({})
});

const view = viewer.createView({
    id: "demoView",
    elementId: "demoCanvas"
});

view.camera.eye = [0, -5, 20];
view.camera.look = [0, -5, 0];
view.camera.up = [0, 1, 0];

new CameraControl(view);

const sceneModel = scene.createModel({
    id: "demoModel"
});

sceneModel.createGeometry({
    id: "demoBoxGeometry",
    primitive: xeokit.constants.TrianglesPrimitive,
    positions: [
        1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1,
        -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
        -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
    ],
    indices: [
        0, 1, 2, 0, 2, 3,            // front
        4, 5, 6, 4, 6, 7,            // right
        8, 9, 10, 8, 10, 11,         // top
        12, 13, 14, 12, 14, 15,      // left
        16, 17, 18, 16, 18, 19,      // bottom
        20, 21, 22, 20, 22, 23
    ]
});

sceneModel.createMesh({
    id: "redLegMesh",
    geometryId: "demoBoxGeometry",
    matrix: xeokit.scene.buildMat4({
        position: [-4, -6, -4],
        scale: [1, 3, 1]
    }),
    color: [1, 0.3, 0.3]
});

sceneModel.createObject({
    id: "redLeg",
    meshIds: ["redLegMesh"]
});

sceneModel.createMesh({
    id: "greenLegMesh",
    geometryId: "demoBoxGeometry",
    matrix: xeokit.scene.buildMat4({
        position: [4, -6, -4],
        scale: [1, 3, 1]
    }),
    color: [0.3, 1.0, 0.3]
});

sceneModel.createObject({
    id: "greenLeg",
    meshIds: ["greenLegMesh"]
});

sceneModel.createMesh({
    id: "blueLegMesh",
    geometryId: "demoBoxGeometry",
    matrix: xeokit.scene.buildMat4({
        position: [4, -6, 4],
        scale: [1, 3, 1]
    }),
    color: [0.3, 0.3, 1.0]
});

sceneModel.createObject({
    id: "blueLeg",
    meshIds: ["blueLegMesh"]
});

sceneModel.createMesh({
    id: "yellowLegMesh",
    geometryId: "demoBoxGeometry",
    matrix: xeokit.scene.buildMat4({
        position: [-4, -6, 4],
        scale: [1, 3, 1]
    }),
    color: [1.0, 1.0, 0.0]
});

sceneModel.createObject({
    id: "yellowLeg",
    meshIds: ["yellowLegMesh"]
});

sceneModel.createMesh({
    id: "purpleTableTopMesh",
    geometryId: "demoBoxGeometry",
    matrix: xeokit.scene.buildMat4({
        position: [0, -3, 0],
        scale: [6, 0.5, 6]
    }),
    color: [1.0, 0.3, 1.0]
});

sceneModel.createObject({
    id: "purpleTableTop",
    meshIds: ["purpleTableTopMesh"]
});

sceneModel.build().then(() => {

    demoHelper.finished();

}).catch((e) => {
    demoHelper.log(`Error building SceneModel: ${e}`);
    throw e;
});
````

