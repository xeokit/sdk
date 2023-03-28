# Quick Start

### Spinning Textured Box

Let's make a simple application using xeokit - a spinning, textured box.

First import the npm modules we need from the SDK:

````bash
npm install @xeokit/scene
npm install @xeokit/viewer
npm install @xeokit/webglrenderer
npm install @xeokit/core/constants
````

Then create a simple HTML page with a canvas element:

````html
<!DOCTYPE html>
<html>
  <head>
    <title>xeokit Spinning Textured Box</title>
  </head>
  <body>
    <canvas id="myCanvas"></canvas>
  </body>
</html>
````

Now let's write some JavaScript to create the spinning, textured box.

````javascript
import {Scene} from "@xeokit/scene";
import {TrianglesPrimitive, LinearEncoding, LinearFilter} from "@xeokit/core/constants";
import {Viewer} from "@xeokit/viewer";
import {WebGLRenderer} from "@xeokit/webglrenderer";

const scene = new Scene(); // Scene graph

const renderer = new WebGLRenderer({}); // WebGL renderer kernel

const viewer = new Viewer({ // Browser-base viewer
    scene,
    renderer
});

const view = myViewer.createView({ // Independent view 
    id: "myView",
    canvasId: "myView1"
});

view.camera.eye = [0, 0, 10]; // Looking down the -Z axis
view.camera.look = [0, 0, 0];
view.camera.up = [0, 1, 0];

const sceneModel = scene.createModel(); // Start building the scene graph

sceneModel.createGeometry({ // Define a box-shaped geometry
    id: "boxGeometry",
    primitive: TrianglesPrimitive,
    positions: [-1, -1, -1, 1, -1, -1, ...],
    uvs: [1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, ...],
    indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, ...]
});

sceneModel.createTexture({ // 
    id: "boxColorTexture",
    src: "myTexture.png",
    encoding: LinearEncoding,
    magFilter: LinearFilter,
    minFilter: LinearFilter
});

sceneModel.createTextureSet({
    id: "boxTextureSet",
    colorTextureId: "boxColorTexture"
});

sceneModel.createMesh({
    id: "boxMesh",
    geometryId: "boxGeometry",
    color: [1, 1, 1],
    metallic: 0.8, // PBR material attributes
    roughness: 0.3,
    textureSetId: "boxTextureSet"
});

sceneModel.createObject({
    id: "boxObject",
    meshIds: ["boxMesh"]
});

sceneModel.build().then(() => { // Compresses textures, geometries etc.

    // A textured box object now appears on our View's canvas.

    // We can now show/hide/select/highlight our box through the View:

    view.objects["boxObject"].visible = true;
    view.objects["boxObject"].highlighted = false;  // etc.

    // Start orbiting the camera:

    viewer.onTick.subscribe(() => {
        view.camera.orbitYaw(1.0);
    });
});
````

In this example:

1. The code imports necessary modules needed to create a 3D scene application: Scene, TrianglesPrimitive, LinearEncoding, LinearFilter, Viewer, and WebGLRenderer.
2. A new Scene object is initialized and a WebGLRenderer object is instantiated.
3. A new Viewer object is also instantiated with the Scene and Renderer objects as parameters.
4. A view is then created with a given ID and canvas ID. The camera parameters such as eye, look and up are set.
5. A sceneModel is created which includes a geometry with positions, uvs and indices, a texture and textureSet.
6. A mesh is then created with the geometry, color, metallic, roughness and textureSet.
7. A 3D object is created with the mesh.
8. The sceneModel is built and the object's visibility and highlight is set to true and false respectively.
9. Finally a callback function to the viewer is set to orbit the camera's yaw by 1.0 on each tick.

### glTF Model Viewer

Let's make a simple application that views a glTF file in the browser.

First import the npm modules we need from the SDK:

````bash
npm install @xeokit/scene
npm install @xeokit/viewer
npm install @xeokit/webglrenderer
npm install @xeokit/core/constants
npm install @xeokit/gltf
````

Here's the JavaScript for our glTF viewer app:

````javascript
import {Scene} from "@xeokit/scene";
import {TrianglesPrimitive, LinearEncoding, LinearFilter} from "@xeokit/core/constants";
import {Viewer} from "@xeokit/viewer";
import {WebGLRenderer} from "@xeokit/webglrenderer";
import {loadGLTF} from "@xeokit/gltf";

const scene = new Scene(); // Scene graph

const renderer = new WebGLRenderer({}); // WebGL renderer kernel

const viewer = new Viewer({ // Browser-base viewer
    scene,
    renderer
});

const view = myViewer.createView({ // Independent view 
    id: "myView",
    canvasId: "myView1"
});

view.camera.eye = [0, 0, 10]; // Looking down the -Z axis
view.camera.look = [0, 0, 0];
view.camera.up = [0, 1, 0];

const sceneModel = scene.createModel(); // Start building the scene graph

fetch("myModel.glb").then(response => {

    response.arrayBuffer().then(data => {

        loadGLTF({data, scene}).then(() => {

            sceneModel.build().then(() => { // Compresses textures, geometries etc.

                // A model now appears on our View's canvas.

                // We can now show/hide/select/highlight the model's objects through the View:

                view.objects["2hExBg8jj4NRG6zzE$aSi6"].visible = true;
                view.objects["2hExBg8jj4NRG6zzE$aSi6"].highlighted = false;  // etc.

                // Start orbiting the camera:

                viewer.onTick.subscribe(() => {
                    view.camera.orbitYaw(1.0);
                });
            });
        });
    });
});
````

In this example, we are:

1. Instantiating a Scene and WebGLRenderer instance, and attaching them to a Viewer.
2. Creating a view, and setting its camera to view the scene from a certain position.
3. Fetching a model in GLTF format, and loading it into the Scene.
4. Making a couple of objects visible and un-highlighted.
5. Subscribing to the Viewer's onTick event, and setting the view's camera to orbit around the model.

### Convert a glTF file to XKT

Let's make a simple NodeJS script that converts a glTF file into xeokit's native XKT format.

First import the npm modules we need from the SDK. Note that we don't need the viewer for this example.

````bash
npm install @xeokit/scene
npm install @xeokit/core/constants
npm install @xeokit/gltf
npm install @xeokit/xkt
````

Here's the JavaScript for our converter script.

````javascript
import {Scene} from "@xeokit/scene";
import {Data} from "@xeokit/data";
import {TrianglesPrimitive, LinearEncoding, LinearFilter} from "@xeokit/core/constants";
import {loadGLTF} from "@xeokit/gltf";
import {saveXKT} from "@xeokit/xkt";

const fs = require('fs');

const scene = new Scene(); // Scene graph
const sceneModel = scene.createModel({ id: "myModel" }); // Start building the scene graph

const data = new Data();
const dataModel = data.createModel({ id: "myModel" }); // Will model the glTF scene hierarchy

fs.readFile("./tests/assets/HousePlan.glb", (err, buffer) => {
    const arraybuffer = toArrayBuffer(buffer);
    loadGLTF({
        data: arrayBuffer,
        sceneModel,
        dataModel
    }).then(() => {
        sceneModel.build().then(() => { // Compresses textures, geometries etc.
            const arrayBuffer = saveXKT({ sceneModel, dataModel });
            fs.writeFile('myModel.xkt', arrayBuffer, err => {});
        });
    })
});

function toArrayBuffer(buf) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
    }
    return ab;
}
````
The script does the following steps:

1. Import packages and modules relevant to Xeokit, as well as Node's file system module, which is used to read and write files.
2. Create a new Scene instance.
3. Create a new Data instance and Model with ID "myModel".
4. Use Node's fs module to read file called "HousePlan.glb" asynchronously.
5. Create an ArrayBuffer from the file using the toArrayBuffer() function.
6. Invoke the xeokit method loadGLTF() to load the model.
7. Invoke the xeokit method build() to prepare the scene model.
8. Invoke the xeokit method saveXKT() to create an XKT file from the scene model and data model.
9. Use Node's fs module to write the XKT file to disk.
10. The toArrayBuffer() function is called to create an ArrayBuffer from a Buffer object.

# License

Copyright 2020, AGPL3 License.

# Credits

See [*Credits*](/credits.html).
