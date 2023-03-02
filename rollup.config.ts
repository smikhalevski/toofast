import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';

export default [
  {
    input: './src/main/index.ts',
    output: [
      { file: './lib/index.js', format: 'cjs' },
      { file: './lib/index.mjs', format: 'es' },
    ],
    external: ['glob'],
    plugins: [nodeResolve(), typescript(), commonjs()],
  },
  {
    input: './src/main/bin/index.ts',
    output: {
      file: './lib/bin.js',
      format: 'cjs',
      banner: '#!/usr/bin/env node',
    },
    external: ['glob'],
    plugins: [nodeResolve(), typescript(), commonjs()],
  },
  {
    input: './src/main/index.ts',
    output: { file: './lib/index.d.ts', format: 'es' },
    plugins: [dts()],
  },
];
