
Let's use xeokit to view a BCF viewpoint of a BIM model, in a web page.

First import the npm modules we need from the SDK:

````bash
npm install @xeokit/sdk
````

Here's the JavaScript for our XGF viewer app:

````javascript
import {Scene} from "@xeokit/sdk/scene";
import {Viewer} from "@xeokit/sdk/viewer";
import {WebGLRenderer} from "@xeokit/sdk/webglrenderer";
import {loadXGF} from "@xeokit/sdk/xgf";

const scene = new Scene(); // Scene graph

const renderer = new WebGLRenderer({}); // WebGL renderers kernel

const viewer = new Viewer({ // Browser-based viewer
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

const sceneModel = scene.createModel();

fetch("myModel.xgf")
    .then(response => { // Fetch the XGF

        response
            .arrayBuffer()
            .then(fileData => {

                loadXGF({
                    fileData,
                    sceneModel
                }).then(() => { // Load the XGF

                    sceneModel
                        .build()
                        .then(() => { 

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
3. Fetching a model in XGF format, and loading it into the Scene.
4. Making a couple of objects visible and un-highlighted.
5. Subscribing to the Viewer's onTick event, and setting the view's camera to orbit around the model.

