# xeokit-sdk

[![Latest NPM release](https://img.shields.io/npm/v/@xeokit-sdk/core.svg)](https://www.npmjs.com/package/@xeokit-sdk/core)
[![Minzipped size](https://badgen.net/bundlephobia/minzip/@xeokit-sdk/core)](https://bundlephobia.com/result?p=@xeokit-sdk/core)
[![License](https://img.shields.io/badge/license-MIT-007ec6.svg)](https://github.com/xeolabs/xeokit-sdk/blob/master/LICENSE)

*Graphics SDK for browser-based AECO visualization.*

## Introduction

@xeokit/webviewer is modular:

| Package                       | Contents                                                                  | Description                                                                                                |
|-------------------------------|:--------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `@xeokit/webviewer`           | [WebViewer](./classes/webviewer_src.webviewer.html)                       | An extensible browser-based 3D viewer for AEC applications.                                                |
| `@xeokit/webviewer-xktloader` | [XKTLoaderPlugin](./classes/webviewer_xktloader_src.xktloaderplugin.html) | A WebViewer plugin to load models from our native, supercompressed XKT format.                             |
| `@xeokit/webviewer-treeview`  | [TreeViewPlugin](./classes/webviewer_xktloader_src.treeviewplugin.html)   | A WebViewer plugin that provides an HTML tree view widget to navigate viewer objects.                      |
| `@xeokit/webviewer-navcube`   | [NavCubePlugin](./classes/webviewer_navcube_src.navcubeplugin.html)       | A WebViewer plugin that provides an interactive NavCube control to assist camera navigation                |
| `@xeokit/convert2xkt`         | [convert2xkt](./classes/webviewer_navcube_src.navcubeplugin.html)         | NodeJS-based CLI tool and library for converting various AEC file formats into xeokit's native XKT format. |

## Getting started

To learn how xeokit-sdk works, see [Concepts](/concepts.html). To get started developing with the SDK, see [SDK Installation](#sdk-installation) below. Find [Functions](/functions.html) for example scripts created with the SDK already. To use the commandline interface, see [Commandline (CLI)](/cli.html). If you're interested in contributing to or customizing the project, see [contributing](/contributing.html).

### SDK Installation

Install the core WebViewer for programmatic use:

```shell
npm install --save @xeokit/webviewer
```

Then, import some modules:

```typescript
// ES Modules.
import { WebViewer } from '@xeokit/webviewer';

// CommonJS.
const { WebViewer } = require('@xeokit/webviewer');
```

## License

Copyright 2020, AGPL3 License.

## Credits

See [*Credits*](/credits.html).
