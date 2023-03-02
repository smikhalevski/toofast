import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

export default [
  {
    input: './src/main/index.ts',
    output: [
      { file: './lib/index.js', format: 'cjs' },
      { file: './lib/index.mjs', format: 'es' },
    ],
    external: ['glob'],
    plugins: [nodeResolve(), typescript()],
  },
  {
    input: './src/main/bin/index.ts',
    output: {
      file: './lib/bin.js',
      format: 'cjs',
      banner: '#!/usr/bin/env node',
    },
    external: ['glob'],
    plugins: [nodeResolve(), typescript()],
  },
  {
    input: './src/main/index.ts',
    output: { file: './lib/index.d.ts', format: 'es' },
    plugins: [dts()],
  },
];
