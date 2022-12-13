# xeokit-sdk

[![Latest NPM release](https://img.shields.io/npm/v/@xeokit-sdk/core.svg)](https://www.npmjs.com/package/@xeokit-sdk/core)
[![Minzipped size](https://badgen.net/bundlephobia/minzip/@xeokit-sdk/core)](https://bundlephobia.com/result?p=@xeokit-sdk/core)
[![License](https://img.shields.io/badge/license-MIT-007ec6.svg)](https://github.com/donmccurdy/xeokit-sdk/blob/master/LICENSE)

*Graphics SDK for browser-based AECO visualization.*

## Introduction

TODO

xeokit-sdk is modular:

- `@xeokit-sdk/viewer`: [Viewer](/viewer.html) An extensible, high-performance browser-based AECO model viewer.
- `@xeokit-sdk/viewer-xktloader`: A [viewer plugin](/xktloader.html) to load models from our native XKT format.
- `@xeokit-sdk/viewer-treeview`: A [viewer plugin](/treevew.html) that provides a tree view UI to navigate viewer objects.
- `@xeokit-sdk/viewer-navcube`: A [viewer plugin](/navcube.html) that provides a 3D cube widget to help navigate the camera.

## Getting started

To learn how xeokit-sdk works, see [Concepts](/concepts.html). To get started developing with the SDK, see [SDK Installation](#sdk-installation) below. Find [Functions](/functions.html) for example scripts created with the SDK already. To use the commandline interface, see [Commandline (CLI)](/cli.html). If you're interested in contributing to or customizing the project, see [contributing](/contributing.html).

### SDK Installation

Install the core SDK for programmatic use:

```shell
npm install --save @xeokit-sdk/core
```

Then, import some modules:

```typescript
// ES Modules.
import { Viewer } from '@xeokit-sdk/viewer';

// CommonJS.
const { Viewer } = require('@xeokit-sdk/viewer');
```

## License

Copyright 2020, AGPL3 License.

## Credits

See [*Credits*](/credits.html).
