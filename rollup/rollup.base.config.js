import {nodeResolve} from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import typescript from "typescript";

function buildBaseConfig(input, name) {
    return {
        input: input,
        output: [
            {
                file: `./dist/${name}.es.js`,
                format: 'esm',
                //exports: 'named',
                sourcemap: true,
            }
        ],
        plugins: [
            peerDepsExternal(),
            nodeResolve({
                browser: true,
                preferBuiltins: false
            }),
            typescript({
                useTsconfigDeclarationDir: true,
                tsconfigOverride: {
                    exclude: ['**/*.stories.*'],
                },
            }),
            commonjs({
                exclude: 'node_modules',
                ignoreGlobal: true,
            }),
        ]
    }
}

export default buildBaseConfig;