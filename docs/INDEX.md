# @xeokit

[![Latest NPM release](https://img.shields.io/npm/v/@xeokit-sdk/core.svg)](https://www.npmjs.com/package/@xeokit-sdk/core)
[![Minzipped size](https://badgen.net/bundlephobia/minzip/@xeokit-sdk/core)](https://bundlephobia.com/result?p=@xeokit-sdk/core)
[![License](https://img.shields.io/badge/license-MIT-007ec6.svg)](https://github.com/xeolabs/xeokit-sdk/blob/master/LICENSE)

*Graphics SDK for browser-based AECO visualization.*

## Features

* Next-generation browser-based 3D/2D viewer from @xeolabs
* For BIM & AEC applications
* Fast rendering
* Compact memory footprint
* Multiple canvases
* Semantic ER data model
* Pluggable graphics (WebGL, WebGPU..)
* Natively TypeScript

## Modules

@xeokit is modular:


| Package          | Modules                                                                                                            | Description                                                           |
|------------------|:-------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| `@xeokit/viewer` | [`@xeokit/viewer`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_viewer.html)                     | Browser-based model viewer                                            |
| `@xeokit/webgl`  | [`@xeokit/webgl`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_webgl.html)                       | Configures viewer to use WebGL2                                       |
| `@xeokit/data`   | [`@xeokit/data`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_data.html)                         | Optional entity-relationship semantic data model to use with a viewer |
| `@xeokit/model`  | [`@xeokit/model`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_model.html)                       | Viewer-agnostic model representation                                  |
| `@xeokit/xkt`    | [`@xeokit/xkt`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_xkt.html)                           | Import and export XKT                                                 |
| `@xeokit/gltf`   | [`@xeokit/gltf`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_gltf.html)                         | Import and export glTF                                                |
| `@xeokit/las`    | [`@xeokit/las`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_las.html)                           | Import LAS                                                            |
| `@xeokit/core`   | [`@xeokit/core/components`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_core_components.html)   | Base component classes                                                |
|                  | [`@xeokit/core/constants`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_core_constants.html)     | Global constants                                                      |
|                  | [`@xeokit/core/utils`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_core_utils.html)             | General utilities library                                             |
| `@xeokit/math`   | [`@xeokit/math/math`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_math_math.html)               | General math definitions and constants                                |
|                  | [`@xeokit/math/boundaries`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_math_boundaries.html)   | Spatial boundary math utilities library                               |
|                  | [`@xeokit/math/compression`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_math_compression.html) | Geometry de/compression utilities library                             |
|                  | [`@xeokit/math/curves`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_math_curves.html)           | Spline curve utilities library                                        |
|                  | [`@xeokit/math/geometry`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_math_geometry.html)       | Mesh generation utilities library                                     |
|                  | [`@xeokit/math/matrix`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_math_matrix.html)           | Matrix and vector math utilities library                              |
|                  | [`@xeokit/math/rtc`](https://xeokit.github.io/xeokit-webviewer/docs/modules/_xeokit_math_rtc.html)                 | RTC coordinate math utilities library                                 |

## Getting started

To learn how @xeokit works, see [Concepts](/concepts.html). To get started developing with the SDK,
see [SDK Installation](#sdk-installation) below. Find [Functions](/functions.html) for example scripts created with the
SDK already. To use the commandline interface, see [Commandline (CLI)](/cli.html). If you're interested in contributing
to or customizing the project, see [contributing](/contributing.html).

### SDK Installation

Install the core WebViewer for programmatic use:

```shell
npm install --save @xeokit/webviewer
```

Then, import some modules:

```typescript
// ES Modules.
import {WebViewer} from '@xeokit/webviewer';

// CommonJS.
const {WebViewer} = require('@xeokit/webviewer');
```

## Concepts

The [WebViewer](./classes/webviewer_src.webviewer.html) class is the core component of
@xeokit. The WebViewer has the following main components:

- A [Scene](./classes/webviewer_src.scene.html) containing [SceneModels](./interfaces/webviewer_src.scene.html)
  and [SceneObjects](./classes/SceneObject.html), which define the geometry
  and materials of our models.
- A [Data](./classes/Data.html)
  containing [DataModels](./classes/DataModel.html)
  and [DataObjects](./classes/DataObject.html), which describe the semantics
  and structure of our models.
- One or more [Views](./classes/View.html), that each create an independent
  view of the Scene. Each View has its own
  canvas, [Camera](./classes/Camera.html),
  and [ViewObjects](./classes/ViewObject.html), which define the appearance
  of
  each SceneObject in that particular View.



## License

Copyright 2020, AGPL3 License.

## Credits

See [*Credits*](/credits.html).
