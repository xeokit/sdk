# @xeokit

*A complete graphics SDK for browser-based AECO model visualization.*

## Features

* Browser-based 3D/2D viewer
* Fast model loading
* Fast rendering
* Low memory footprint
* Multiple canvases
* Semantic ER data model
* Pluggable graphics engine (WebGL, WebGPU..)
* Natively TypeScript
* SOLID

# Modules

The xeokit SDK is modular and designed for maximum extensibility. Our philosophy is to rigorously follow SOLID
principles of software
design in order to keep the SDK comprehensive, extensible and robust.


## Scene Graph
   
The SDK manages model representations in a scene graph that contains the model's objects, geometries and materials. The scene graph works in both the browser and in NodeJS, and can be used to generate models, convert between model formats, and provide content for the SDK's model viewer. 
   
| Package                                                                  | Modules                                                               | Description                                                                  |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------------------------------|
| [`@xeokit/scene`](https://www.npmjs.com/package/@xeokit/scene)           | [`@xeokit/scene`](https://xeokit.github.io/sdk/docs/modules/_xeokit_scene.html)                       | Scene graph that contains model representations (geometries, materials etc.) |
   
   
[![](https://mermaid.ink/img/pako:eNqNVctu2zAQ_BWBpzZIAhToycc2QC41CsQ58sKQG5stKRp8BDEC_3tXlGgvJSqoL5Rmx7Nv6oNJp4BtmDQihAct9l5Y3ivtQUbt-u7XE--7_MuMbiehh4-CZdyDiLBFGfPla2UwIHwN2YEVKOJe_qCnC3RueMvSxKVW1-fZ3wcXEA5AgT04C9HrCozwHpOHHcQGSqAxud_ZC01lShp9LdHH0eFpaXke9VcNGA61vSRtFAUUhOgdEW6Vawy2ahGt2LxCM4khpW6l2NIZ56-v3qX9oYdAyoV5C1ND7iikjifCEdiM9-v71B_CuDZnJcipXO0421wU-zStiTZLxWj5VLJcMJyUJgVckoUFrA5Bv8HMMIuszMlaXEevrY4oQyAX9LCW4QGks0cc1bCdlTO9fWIstf6R5F9Y3brHikXDu_j_OTkAVXluwRpvE9mYtzysHWffOLu5u8Pz_v6GM7LyFTEjK-xx4v9Ht8EcoSV_WIRCvHRqwapLVfh5iQiXEAuFjGUl-h25s7FpqD2TDSm0crJbZsFboRVe67l3nMUDWOBsg48KXkUykTPen5EqUnS7Uy_ZJvoEtywdFd5H04eAbV6FCYiC0tH57fSpGI7zP49r0Ww?type=png)](https://mermaid.live/edit#pako:eNqNVctu2zAQ_BWBpzZIAhToycc2QC41CsQ58sKQG5stKRp8BDEC_3tXlGgvJSqoL5Rmx7Nv6oNJp4BtmDQihAct9l5Y3ivtQUbt-u7XE--7_MuMbiehh4-CZdyDiLBFGfPla2UwIHwN2YEVKOJe_qCnC3RueMvSxKVW1-fZ3wcXEA5AgT04C9HrCozwHpOHHcQGSqAxud_ZC01lShp9LdHH0eFpaXke9VcNGA61vSRtFAUUhOgdEW6Vawy2ahGt2LxCM4khpW6l2NIZ56-v3qX9oYdAyoV5C1ND7iikjifCEdiM9-v71B_CuDZnJcipXO0421wU-zStiTZLxWj5VLJcMJyUJgVckoUFrA5Bv8HMMIuszMlaXEevrY4oQyAX9LCW4QGks0cc1bCdlTO9fWIstf6R5F9Y3brHikXDu_j_OTkAVXluwRpvE9mYtzysHWffOLu5u8Pz_v6GM7LyFTEjK-xx4v9Ht8EcoSV_WIRCvHRqwapLVfh5iQiXEAuFjGUl-h25s7FpqD2TDSm0crJbZsFboRVe67l3nMUDWOBsg48KXkUykTPen5EqUnS7Uy_ZJvoEtywdFd5H04eAbV6FCYiC0tH57fSpGI7zP49r0Ww)

## Data Graph
    
The SDK provides an entity-relationship data graph that we can use to attach semantic data to our scene graph objects. The data graph works in both the browser and NodeJS. The data graph can also be loaded and saved as various file formats.  


| Package                                                                  | Modules                                                               | Description                                                                  |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------------------------------|
| [`@xeokit/data`](https://www.npmjs.com/package/@xeokit/data)             | [`@xeokit/data`](https://xeokit.github.io/sdk/docs/modules/_xeokit_data.html)                        | Entity-relationship graph that contains model semantic data.                 |
   
[![](https://mermaid.ink/img/pako:eNqNVMFunDAU_BX0Tu1qgxaW9QLnHBOlSm4VFwc7WVeAkTFV6Wr_vcZmu89A0nIBzxvPmzdGPkMpGYccyop23b2g74rWRcOE4qUWsgkenosmsI9lBPdU0_MVcrjiVPNHI1N9-epVOk5VeXp6_WG0ulmtrExxhtWjRudB0m32sFbJlis9vHC_cP2-LB1bd9i2YGixbLLewk3q5sHWHf7MKzpG1p1Eu6x-uyni4msvKoYBxjut5HCDVqZxDrxT8OYJ9NByvF4bZ6aL_CFhLDuJCP4viQAJNLRGTn7SqkdLbHOmhcPEev5kyrKadxfIDOfMh_92GCMMCogK2NzdmXcYbgq4_SaYZoF1ri_-seaS5xDD3kzsnWOjI_hA9hPWwuk61cvVCl7JN2f5eqz_v3WePPKxzOhanMiwhZqrmgpmLiV78AXoEzd_EeTmk_E32le6gKK5GCrttXwZmhJyrXq-hb5lpv10jUH-RqvOoC1tID_DL8hjEoVRdDxEJE73GSHZYQuDgeMwyY7kkGTRMSbp_nDZwm8pjcIuTGOSJGS_yxKSpjvD50xoqR6na3N82Q7fLX-0cfkD0IeHkg?type=png)](https://mermaid.live/edit#pako:eNqNVMFunDAU_BX0Tu1qgxaW9QLnHBOlSm4VFwc7WVeAkTFV6Wr_vcZmu89A0nIBzxvPmzdGPkMpGYccyop23b2g74rWRcOE4qUWsgkenosmsI9lBPdU0_MVcrjiVPNHI1N9-epVOk5VeXp6_WG0ulmtrExxhtWjRudB0m32sFbJlis9vHC_cP2-LB1bd9i2YGixbLLewk3q5sHWHf7MKzpG1p1Eu6x-uyni4msvKoYBxjut5HCDVqZxDrxT8OYJ9NByvF4bZ6aL_CFhLDuJCP4viQAJNLRGTn7SqkdLbHOmhcPEev5kyrKadxfIDOfMh_92GCMMCogK2NzdmXcYbgq4_SaYZoF1ri_-seaS5xDD3kzsnWOjI_hA9hPWwuk61cvVCl7JN2f5eqz_v3WePPKxzOhanMiwhZqrmgpmLiV78AXoEzd_EeTmk_E32le6gKK5GCrttXwZmhJyrXq-hb5lpv10jUH-RqvOoC1tID_DL8hjEoVRdDxEJE73GSHZYQuDgeMwyY7kkGTRMSbp_nDZwm8pjcIuTGOSJGS_yxKSpjvD50xoqR6na3N82Q7fLX-0cfkD0IeHkg)


## Model Viewer

The SDK provides a high-performance Browser-based viewer for viewing our model representations.

The viewer is extensible via a pluggable renderer strategy to use different browser graphics APIs, such as WebGL or
WebGPU. The viewer can
view multiple models, and can create multiple views of our models in separate canvases, with lights, section planes,
annotations etc.

| Package                                                                  | Modules                                                               | Description                                          |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------|
| [`@xeokit/viewer`](https://www.npmjs.com/package/@xeokit/viewer)         | [`@xeokit/viewer`](https://xeokit.github.io/sdk/docs/modules/_xeokit_viewer.html)                     | Browser-based model viewer                           |
| [`@xeokit/cameracontrol`](https://www.npmjs.com/package/@xeokit/cameracontrol)  | [`@xeokit/cameracontrol`](https://xeokit.github.io/sdk/docs/modules/cameracontrol.html)        | Interactive camera control for a viewer                     |
| [`@xeokit/webglrenderer`](https://www.npmjs.com/package/@xeokit/webglrenderer)  | [`@xeokit/webglrenderer`](https://xeokit.github.io/sdk/docs/modules/_xeokit_webglrenderer.html) | WebGL rendering strategy for a viewer       |
| [`@xeokit/treeview`](https://www.npmjs.com/package/@xeokit/treeview)     | [`@xeokit/treeview`](https://xeokit.github.io/sdk/docs/modules/_xeokit_treeview.html)                 | HTML tree view widget for a Viewer                          |
| [`@xeokit/locale`](https://www.npmjs.com/package/@xeokit/locale)     | [`@xeokit/treeview`](https://xeokit.github.io/sdk/docs/modules/_xeokit_locale.html)                 | Localization service for a viewer                         |

[![](https://mermaid.ink/img/pako:eNqtVF9PwyAQ_yoNj8at743Ziz5qNC7xqYm5wm3FUWiATqfZdxfKoUx9c02a3h2_P8eV8MG4EcgaxhU4dyNha2Fo9ZxVTxJf0VYfra7CowwHhWu0e8kxlRxHTeE-YF2rjyU3M033gty7lHAY0ALxQ1ka_aBA40_y_UzKElJkGyc7le1RBQjSUi-3vQrvV-HNwiHHAF1XGFzPTWRxPGCV92h2KZrGAr4u-syk0biKWELaqkDfSHsb-8jIuJyh3ChjqxL9iFqgpTFfXUHnvAXuV6vSP8751zRPl3_PK6ynP7hYrLJLUZpZTZi1m0DJ9_gDks_FYlFKFpQYpJSSEkEN_GA3YYOjRYc6tkzUazoDlOaBfRXKecdNSr7Lh7G3uKla1ns_uqau39DspF9upe-nbilN7cSuFoa7eh4Nuvo5QZ73M3-ZZJa9H1TLghDJRkrLSq-zOJ36_OFCQzuHV5I6dST5U186_P_1TDLffiSbvNglC9kAUoS7ZT6TLfM9DtiyJoQCNzApH3s6BihM3qwPmrPG2wkv2TQK8Ei3EWs2oFyoopDe2Du6r-Ln-AmCVquH?type=png)](https://mermaid.live/edit#pako:eNqtVF9PwyAQ_yoNj8at743Ziz5qNC7xqYm5wm3FUWiATqfZdxfKoUx9c02a3h2_P8eV8MG4EcgaxhU4dyNha2Fo9ZxVTxJf0VYfra7CowwHhWu0e8kxlRxHTeE-YF2rjyU3M033gty7lHAY0ALxQ1ka_aBA40_y_UzKElJkGyc7le1RBQjSUi-3vQrvV-HNwiHHAF1XGFzPTWRxPGCV92h2KZrGAr4u-syk0biKWELaqkDfSHsb-8jIuJyh3ChjqxL9iFqgpTFfXUHnvAXuV6vSP8751zRPl3_PK6ynP7hYrLJLUZpZTZi1m0DJ9_gDks_FYlFKFpQYpJSSEkEN_GA3YYOjRYc6tkzUazoDlOaBfRXKecdNSr7Lh7G3uKla1ns_uqau39DspF9upe-nbilN7cSuFoa7eh4Nuvo5QZ73M3-ZZJa9H1TLghDJRkrLSq-zOJ36_OFCQzuHV5I6dST5U186_P_1TDLffiSbvNglC9kAUoS7ZT6TLfM9DtiyJoQCNzApH3s6BihM3qwPmrPG2wkv2TQK8Ei3EWs2oFyoopDe2Du6r-Ln-AmCVquH)

## Model Importers and Exporters

The SDK provides various functions to import and export its model representations and semantics as various
industry-standard AECO file formats. Use
these in NodeJS scripts to convert file formats, or in the Browser to load various file formats into our viewer.

| Package                                                              | Modules                                                                               | Description                |
|----------------------------------------------------------------------|---------------------------------------------------------------------------------------|----------------------------|
| [`@xeokit/xkt`](https://www.npmjs.com/package/@xeokit/xkt)           | [`@xeokit/xkt`](https://xeokit.github.io/sdk/docs/modules/_xeokit_xkt.html)           | Import and export XKT files |
| [`@xeokit/gltf`](https://www.npmjs.com/package/@xeokit/gltf)         | [`@xeokit/gltf`](https://xeokit.github.io/sdk/docs/modules/_xeokit_gltf.html)         | Import glTF files |
| [`@xeokit/las`](https://www.npmjs.com/package/@xeokit/las)           | [`@xeokit/las`](https://xeokit.github.io/sdk/docs/modules/_xeokit_las.html)           | Import LAS pointcloud scans |
| [`@xeokit/cityjson`](https://www.npmjs.com/package/@xeokit/cityjson) | [`@xeokit/cityjson`](https://xeokit.github.io/sdk/docs/modules/_xeokit_cityjson.html) | Import CityJSON files      |
| [`@xeokit/webifc`](https://www.npmjs.com/package/@xeokit/webifc)     | [`@xeokit/webifc`](https://xeokit.github.io/sdk/docs/modules/_xeokit_webifc.html)     | Import IFC files           |

### Interoperating with BIM Software

The SDK provides functions to share bookmarks of viewer state with other BIM software, as industry-standard *BCF
Viewpoints*. Use these to
build apps for collaborating on construction projects.

| Package                                                                  | Modules                                                               | Description                                          |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------|
| [`@xeokit/bcf`](https://www.npmjs.com/package/@xeokit/bcf)               | [`@xeokit/bcf`](https://xeokit.github.io/sdk/docs/modules/_xeokit_bcf.html)                           | Load and save BCF                    |

### Utility Libraries

Most of the SDK's internal and lower-level functionality is provided as fully-documented utility libraries.

| Package                                                                  | Modules                                                               | Description                                          |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------|
| [`@xeokit/core`](https://www.npmjs.com/package/@xeokit/core)             | [`@xeokit/core/components`](https://xeokit.github.io/sdk/docs/modules/_xeokit_core_components.html)   | Basic component types used throughout the xeokit SDK |
|                                                                          | [`@xeokit/core/constants`](https://xeokit.github.io/sdk/docs/modules/_xeokit_core_constants.html)     | Constants used throughout the xeokit SDK             |
|                                                                          | [`@xeokit/core/utils`](https://xeokit.github.io/sdk/docs/modules/_xeokit_core_utils.html)             | Core utilities used throughout the xeokit SDK        |
| [`@xeokit/datatypes`](https://www.npmjs.com/package/@xeokit/datatypes)   | [`@xeokit/datatypes/basicTypes`](https://xeokit.github.io/sdk/docs/modules/_xeokit_datatypes_basicTypes.html)  | Basic semantic data type constants  |
|                                                                          | [`@xeokit/datatypes/ifcTypes`](https://xeokit.github.io/sdk/docs/modules/_xeokit_datatypes_ifcTypes.html)      | IFC data type constants  |
| [`@xeokit/math`](https://www.npmjs.com/package/@xeokit/math)             | [`@xeokit/math/math`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_math.html)               | General math definitions and constants               |
|                                                                          | [`@xeokit/math/boundaries`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_boundaries.html)   | Boundaries math library                              |
|                                                                          | [`@xeokit/math/compression`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_compression.html) | Geometry de/compression utilities library            |
|                                                                          | [`@xeokit/math/curves`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_curves.html)           | Spline curves math library                           |
|                                                                          | [`@xeokit/math/geometry`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_geometry.html)       | Mesh generation functions                            |
|                                                                          | [`@xeokit/math/matrix`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_matrix.html)           | Matrix and vector math utilities library             |
|                                                                          | [`@xeokit/math/rtc`](https://xeokit.github.io/sdk/docs/modules/_xeokit_math_rtc.html)                 | Relative-to-center (RTC) coordinates math library    |
| [`@xeokit/webgl`](https://www.npmjs.com/package/@xeokit/webglutils)      | [`@xeokit/webglutils`](https://xeokit.github.io/sdk/docs/modules/_xeokit_webglutils.html)             | WebGL utilities library        |
| [`@xeokit/procgen`](https://www.npmjs.com/package/@xeokit/procgen)       | [`@xeokit/procgen/geometry`](https://xeokit.github.io/sdk/docs/modules/_xeokit_procgen_geometry.html) | Geometry generation functions                     |
| [`@xeokit/ktx2`](https://www.npmjs.com/package/@xeokit/ktx2)             | [`@xeokit/ktx2`](https://xeokit.github.io/sdk/docs/modules/_xeokit_ktx2.html)                         | Compressed texture support              |

# Quick Start

## Examples

### Spinning Textured Box

Let's make a simple application using xeokit - a spinning, textured box.

First import the npm modules we need from the SDK:

````bash
npm install @xeokit/scene
npm install @xeokit/viewer
npm install @xeokit/webglrenderer
npm install @xeokit/core/constants
````

Here's the JavaScript for our spinning box app:

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

fetch("myModel.xkt").then(response => {
  
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

### Convert a glTF file to XKT 

Let's make a simple NodeJS script that converts a glTF file into xeokit's native XKT format.

First import the npm modules we need from the SDK. Note that we don't need the viewer for this example.

````bash
npm install @xeokit/scene
npm install @xeokit/core/constants
npm install @xeokit/gltf
npm install @xeokit/xkt
````

Here's the JavaScript for our converter script:

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

# License

Copyright 2020, AGPL3 License.

# Credits

See [*Credits*](/credits.html).
