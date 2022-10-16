import nodeResolve from 'rollup-plugin-node-resolve';

// export default {
//     input: './src/index.ts',
//     output: [
//         {
//             file: './dist/xeokit-viewer.es.js',
//             format: 'es',
//             name: 'bundle'
//         }
//     ],
//     plugins: [
//         nodeResolve()
//     ]
// }

import dts from 'rollup-plugin-dts'
import esbuild from 'rollup-plugin-esbuild'

export default {
        input: `src/viewer/index.ts`,
        plugins: [ nodeResolve(),dts()],
        output: {
            file: `dist/bundle.d.ts`,
            format: 'es',
        },
    }