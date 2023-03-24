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

## Modules

The xeokit SDK is modular and designed for maximum extensibility. Our philosophy is to rigorously follow SOLID principles of software 
design in order to keep the SDK comprehensive, extensible and robust.

### Model Representation and Semantics

The SDK manages model representation and model semantics in two separate data structures. The SDK lets us just work with either 
of these aspects independently. You're free to ignore the semantic model, or use a different one. These representations are usable 
with or without a viewer, in the browser or NodeJS. Use them to generate files, convert file formats, or provide content for a 
viewer to render.

| Package                                                                  | Modules                                                               | Description                                          |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------|
| [`@xeokit/data`](https://www.npmjs.com/package/@xeokit/data)             | [`@xeokit/data`](https://xeokit.github.io/sdk/docs/modules/_xeokit_data.html)                        | Entity-relationship semantic data model      |
| [`@xeokit/scene`](https://www.npmjs.com/package/@xeokit/scene)           | [`@xeokit/scene`](https://xeokit.github.io/sdk/docs/modules/_xeokit_scene.html)                       | Model representations (geometries, materials, textures and objects)                 |

### Viewing Models 

The SDK provides a high-performance Browser-based viewer for viewing our model representations. The viewer is extensible 
via a pluggable renderer strategy to use different browser graphics APIs, such as WebGL or WebGPU. The viewer can view multiple 
models, and can create multiple views of them in separate canvases. 

| Package                                                                  | Modules                                                               | Description                                          |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------|
| [`@xeokit/viewer`](https://www.npmjs.com/package/@xeokit/viewer)         | [`@xeokit/viewer`](https://xeokit.github.io/sdk/docs/modules/_xeokit_viewer.html)                     | Browser-based model viewer                           |
| [`@xeokit/cameracontrol`](https://www.npmjs.com/package/@xeokit/cameracontrol)  | [`@xeokit/cameracontrol`](https://xeokit.github.io/sdk/docs/modules/cameracontrol.html)        | Interactive camera control for a viewer                     |
| [`@xeokit/webglrenderer`](https://www.npmjs.com/package/@xeokit/webglrenderer)  | [`@xeokit/webglrenderer`](https://xeokit.github.io/sdk/docs/modules/_xeokit_webglrenderer.html) | WebGL rendering strategy for a viewer       |
| [`@xeokit/treeview`](https://www.npmjs.com/package/@xeokit/treeview)     | [`@xeokit/treeview`](https://xeokit.github.io/sdk/docs/modules/_xeokit_treeview.html)                 | HTML tree view widget for a Viewer                          |

### Importing and Exporting Models

The SDK provides various functions to import and export model representations and semantics as various industry-standard AECO file formats. Use 
these in NodeJS scripts to convert file formats, or in the browser to view various file formats with a viewer.

| Package                                                                  | Modules                                                               | Description                                          |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------------------|
| [`@xeokit/xkt`](https://www.npmjs.com/package/@xeokit/xkt)               | [`@xeokit/xkt`](https://xeokit.github.io/sdk/docs/modules/_xeokit_xkt.html)                           | Import and export XKT files                          |
| [`@xeokit/gltf`](https://www.npmjs.com/package/@xeokit/gltf)             | [`@xeokit/gltf`](https://xeokit.github.io/sdk/docs/modules/_xeokit_gltf.html)                         | Import and export glTF files                         |
| [`@xeokit/las`](https://www.npmjs.com/package/@xeokit/las)               | [`@xeokit/las`](https://xeokit.github.io/sdk/docs/modules/_xeokit_las.html)                           | Import LAS pointcloud scans                          |
| [`@xeokit/cityjson`](https://www.npmjs.com/package/@xeokit/cityjson)     | [`@xeokit/cityjson`](https://xeokit.github.io/sdk/docs/modules/_xeokit_cityjson.html)                 | Import CityJSON files                               |

### Interoperating with BIM Software

The SDK provides functions to share bookmarks of viewer state with other BIM software, as industry-standard *BCF Viewpoints*. Use these to 
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

## License

Copyright 2020, AGPL3 License.

## Credits

See [*Credits*](/credits.html).
